import { useState, useEffect, useRef } from "react";
import { getBpToken } from "../lib/api";

interface GiftItem {
  id: number;
  name: string;
  iconEmoji: string;
  iconUrl?: string;
  tokenCost: number;
  animationType: string;
}

const GIFT_IMG: Record<string, string> = {
  "Rose":          "/gifts/rose.jpg",
  "Cœur":          "/gifts/coeur.jpg",
  "Ours":          "/gifts/ours.jpg",
  "Gâteau":        "/gifts/gateau.jpg",
  "Couronne":      "/gifts/couronne.jpg",
  "Voiture":       "/gifts/voiture.jpg",
  "Diamant":       "/gifts/diamant.jpg",
  "Jet Privé":     "/gifts/jet-prive.jpg",
  "Lion Royal":    "/gifts/lion-royal.jpg",
  "Château Royal": "/gifts/chateau-royal.jpg",
  "Afrique d'Or":  "/gifts/afrique-or.jpg",
};

function giftImg(g: GiftItem): string | null {
  return g.iconUrl || GIFT_IMG[g.name] || null;
}

interface Props {
  streamId: number;
  receiverId: number;
  receiverName: string;
  receiverAvatar?: string;
  contextType: "live" | "video";
  contextId: number;
  tokenBalance: number;
  onClose: () => void;
  onSent: (gift: GiftItem, tokenBalance: number) => void;
  onBuyTokens?: () => void;
}

const CATEGORIES = [
  { id: "all",      label: "🔥 Populaires" },
  { id: "amour",    label: "❤️ Amour"       },
  { id: "prestige", label: "👑 Prestige"     },
  { id: "fun",      label: "🎉 Fun"          },
  { id: "premium",  label: "🚀 Premium"      },
];

function giftCategory(g: GiftItem): string[] {
  const cats = ["all"];
  if (g.tokenCost <= 150)                          cats.push("amour");
  if (g.tokenCost >= 200 && g.tokenCost <= 2000)   cats.push("prestige");
  if (g.tokenCost >= 100 && g.tokenCost <= 1000)   cats.push("fun");
  if (g.tokenCost >= 2000)                         cats.push("premium");
  return cats;
}

function fmtPrice(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)} 000`;
  return String(n);
}

/* ── Particle burst ── */
function Burst({ img, emoji }: { img: string | null; emoji: string }) {
  const particles = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * 360;
    const dist  = 60 + Math.random() * 50;
    return {
      dx: Math.cos((angle * Math.PI) / 180) * dist,
      dy: Math.sin((angle * Math.PI) / 180) * dist,
      rot: Math.random() * 360,
    };
  });
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {particles.map((p, i) => (
        <div key={i} style={{
          position: "absolute", width: 28, height: 28,
          animation: `giftBurst 0.75s ${i * 0.03}s ease-out forwards`,
          ["--dx" as string]: `${p.dx}px`,
          ["--dy" as string]: `${p.dy}px`,
          ["--rot" as string]: `${p.rot}deg`,
        }}>
          {img
            ? <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6 }} />
            : <span style={{ fontSize: 24 }}>{emoji}</span>
          }
        </div>
      ))}
      <style>{`
        @keyframes giftBurst {
          0%   { transform: translate(0,0) rotate(0deg) scale(1); opacity:1; }
          100% { transform: translate(var(--dx),var(--dy)) rotate(var(--rot)) scale(0.1); opacity:0; }
        }
      `}</style>
    </div>
  );
}

export default function GiftPicker({
  streamId, receiverId, receiverName, receiverAvatar,
  contextType, contextId,
  tokenBalance: initialBalance, onClose, onSent, onBuyTokens,
}: Props) {
  const [catalog, setCatalog]     = useState<GiftItem[]>([]);
  const [selected, setSelected]   = useState<GiftItem | null>(null);
  const [qty, setQty]             = useState(1);
  const [balance, setBalance]     = useState(initialBalance);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState(false);
  const [cat, setCat]             = useState("all");
  const [showBurst, setShowBurst] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/gifts/catalog")
      .then(r => r.json())
      .then((d: GiftItem[]) => setCatalog(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const token = getBpToken();
    if (!token) return;
    fetch("/api/creator/wallet", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((d: { tokenBalance?: number }) => { if (d.tokenBalance !== undefined) setBalance(d.tokenBalance); })
      .catch(() => {});
  }, []);

  const filtered   = catalog.filter(g => giftCategory(g).includes(cat));
  const totalCost  = selected ? selected.tokenCost * qty : 0;
  const canAffordSel = selected ? balance >= totalCost : false;

  const handleSend = async () => {
    if (!selected || loading || success || !canAffordSel) return;
    setLoading(true); setError(null);
    const rawUser = localStorage.getItem("fb_user");
    const user    = rawUser ? JSON.parse(rawUser) as { name?: string } : {};
    const token   = getBpToken();
    try {
      for (let i = 0; i < qty; i++) {
        const res = await fetch("/api/gifts/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ giftId: selected.id, receiverId, contextType, contextId, senderName: user.name ?? "" }),
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(e.error ?? "Erreur d'envoi");
        }
      }
      const newBal = balance - totalCost;
      setBalance(newBal);
      setSuccess(true);
      setShowBurst(true);
      setTimeout(() => { onSent(selected, newBal); onClose(); }, 1300);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const initials = receiverName.slice(0, 2).toUpperCase();

  return (
    <>
      {showBurst && selected && <Burst img={giftImg(selected)} emoji={selected.iconEmoji} />}

      {/* Backdrop — semi-transparent so video shows at top */}
      <div
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.55)" }}
      >
        {/* ── Bottom sheet ── */}
        <div
          ref={sheetRef}
          onClick={e => e.stopPropagation()}
          style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            background: "linear-gradient(180deg,#111120 0%,#0D0D1E 100%)",
            borderRadius: "22px 22px 0 0",
            maxHeight: "95vh",
            display: "flex", flexDirection: "column",
            boxShadow: "0 -8px 50px rgba(0,0,0,0.7), 0 -1px 0 rgba(255,255,255,0.06)",
            animation: "sheetUp 0.3s cubic-bezier(0.34,1.4,0.64,1) forwards",
          }}
        >
          {/* Drag handle */}
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, paddingBottom: 2, flexShrink: 0 }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.18)" }} />
          </div>

          {/* ── Header ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px 10px", flexShrink: 0 }}>
            {/* Left: icon + title + receiver */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 42, height: 42, borderRadius: "50%",
                background: "linear-gradient(135deg,#16C24A,#0AA83A)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 16px rgba(22,194,74,0.5)", flexShrink: 0,
              }}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="#fff">
                  <path d="M20 6h-2.18c.07-.31.18-.59.18-.9C18 3.4 16.6 2 14.9 2c-.92 0-1.73.42-2.3 1.08L12 3.7l-.6-.62C10.83 2.42 10.02 2 9.1 2 7.4 2 6 3.4 6 5.1c0 .31.11.59.18.9H4c-1.11 0-2 .89-2 2v13c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2z"/>
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#fff", lineHeight: 1.2 }}>Envoyer un cadeau</div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
                  {/* Receiver avatar */}
                  {receiverAvatar ? (
                    <img src={receiverAvatar} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: "linear-gradient(135deg,#1877F2,#0D5FD9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                      {initials}
                    </div>
                  )}
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                    à <strong style={{ color: "#fff" }}>{receiverName}</strong>
                  </span>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="#16C24A"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                </div>
              </div>
            </div>

            {/* Right: balance */}
            <div style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(22,194,74,0.3)",
              borderRadius: 14, padding: "8px 12px", textAlign: "right",
              boxShadow: "0 0 12px rgba(22,194,74,0.12)",
            }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginBottom: 2, letterSpacing: 0.3 }}>Solde actuel</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", marginBottom: 4 }}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="#FFD700"><circle cx="12" cy="12" r="10"/><text x="12" y="16" textAnchor="middle" fontSize="10" fill="#7A5000" fontWeight="bold">J</text></svg>
                <span style={{ fontWeight: 900, fontSize: 15, color: "#FFD700" }}>{balance.toLocaleString()} Jeton{balance !== 1 ? "s" : ""}</span>
              </div>
              <button
                onClick={onBuyTokens}
                style={{
                  background: "transparent",
                  border: "1.5px solid #16C24A",
                  borderRadius: 20, padding: "3px 10px",
                  color: "#16C24A", fontSize: 11, fontWeight: 700,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                  marginLeft: "auto",
                }}
              >
                <svg viewBox="0 0 24 24" width="11" height="11" fill="#16C24A"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                Recharger
              </button>
            </div>
          </div>

          {/* ── Category tabs ── */}
          <div style={{
            display: "flex", gap: 7, padding: "0 14px 10px",
            overflowX: "auto", scrollbarWidth: "none", flexShrink: 0,
          }}>
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                style={{
                  flexShrink: 0, padding: "7px 14px", borderRadius: 22, border: "none",
                  background: cat === c.id
                    ? "linear-gradient(135deg,#16C24A,#0AA83A)"
                    : "rgba(255,255,255,0.08)",
                  color: cat === c.id ? "#fff" : "rgba(255,255,255,0.55)",
                  fontWeight: cat === c.id ? 800 : 600, fontSize: 13,
                  cursor: "pointer",
                  boxShadow: cat === c.id ? "0 4px 16px rgba(22,194,74,0.45)" : "none",
                  transition: "all 0.18s",
                }}
              >{c.label}</button>
            ))}
          </div>

          {/* ── Gift grid (scrollable) ── */}
          <div style={{ overflowY: "auto", padding: "0 12px", flex: 1, scrollbarWidth: "none" }}>
            {catalog.length === 0 ? (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.35)", padding: "28px 0", fontSize: 14 }}>
                Chargement…
              </div>
            ) : (
              /* 5-column grid matching the mockup */
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 7, paddingBottom: 10 }}>
                {filtered.map(g => {
                  const canAfford = balance >= g.tokenCost;
                  const isSel     = selected?.id === g.id;
                  const img       = giftImg(g);
                  const num       = String(catalog.findIndex(c => c.id === g.id) + 1).padStart(2, "0");
                  const price     = fmtPrice(g.tokenCost);

                  return (
                    <button
                      key={g.id}
                      onClick={() => { if (canAfford) { setSelected(g); setQty(1); setError(null); } }}
                      style={{
                        position: "relative",
                        background: "rgba(18,18,32,0.95)",
                        border: isSel ? "2px solid #16C24A" : "1.5px solid rgba(255,255,255,0.08)",
                        borderRadius: 14, padding: 0, overflow: "hidden",
                        cursor: canAfford ? "pointer" : "not-allowed",
                        opacity: canAfford ? 1 : 0.35,
                        textAlign: "left",
                        boxShadow: isSel
                          ? "0 0 22px rgba(22,194,74,0.65), 0 4px 16px rgba(0,0,0,0.55)"
                          : "0 3px 10px rgba(0,0,0,0.5)",
                        transition: "all 0.15s",
                        transform: isSel ? "scale(1.06)" : "scale(1)",
                        aspectRatio: "3/4",
                        animation: isSel ? "selGlow 1.6s ease-in-out infinite alternate" : "none",
                      }}
                    >
                      {/* Gift image */}
                      {img ? (
                        <img
                          src={img} alt={g.name} draggable={false}
                          style={{
                            position: "absolute", inset: 0,
                            width: "100%", height: "100%",
                            objectFit: "cover", borderRadius: 12,
                            display: "block",
                          }}
                        />
                      ) : (
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>
                          {g.iconEmoji}
                        </div>
                      )}

                      {/* Bottom gradient overlay */}
                      <div style={{
                        position: "absolute", bottom: 0, left: 0, right: 0, height: "58%",
                        background: "linear-gradient(to top,rgba(0,0,0,0.95) 0%,rgba(0,0,0,0.55) 55%,transparent 100%)",
                        borderRadius: "0 0 12px 12px",
                        pointerEvents: "none",
                      }} />

                      {/* Number badge top-left */}
                      <div style={{
                        position: "absolute", top: 5, left: 5,
                        background: "rgba(0,0,0,0.6)",
                        borderRadius: 6, padding: "1px 5px",
                        color: "#16C24A", fontWeight: 900, fontSize: 9,
                        lineHeight: 1.4, letterSpacing: 0.5,
                      }}>{num}</div>

                      {/* Selected checkmark top-right */}
                      {isSel && (
                        <div style={{
                          position: "absolute", top: 5, right: 5,
                          width: 17, height: 17, borderRadius: "50%",
                          background: "#16C24A",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: "0 0 8px rgba(22,194,74,0.8)",
                        }}>
                          <svg viewBox="0 0 24 24" width="11" height="11" fill="#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                        </div>
                      )}

                      {/* Name + price inside card at bottom */}
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 5px 5px" }}>
                        <div style={{
                          color: isSel ? "#16C24A" : "#fff",
                          fontWeight: 700, fontSize: 9,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          marginBottom: 2, lineHeight: 1.2,
                          transition: "color 0.15s",
                        }}>{g.name}</div>
                        {/* Gold price badge */}
                        <div style={{
                          display: "inline-flex", alignItems: "center", gap: 2,
                          background: "rgba(255,215,0,0.15)",
                          border: "1px solid rgba(255,215,0,0.35)",
                          borderRadius: 20, padding: "1px 5px",
                        }}>
                          <svg viewBox="0 0 20 20" width="9" height="9" fill="#FFD700"><circle cx="10" cy="10" r="9"/></svg>
                          <span style={{ color: "#FFD700", fontWeight: 800, fontSize: 9 }}>{price}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Selected gift detail panel ── */}
            {selected && (
              <div style={{
                marginBottom: 10,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(22,194,74,0.25)",
                borderRadius: 16, padding: "12px 14px",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                {/* Gift image thumbnail */}
                {giftImg(selected) ? (
                  <div style={{
                    width: 64, height: 80, borderRadius: 10,
                    overflow: "hidden", flexShrink: 0,
                    boxShadow: "0 0 18px rgba(22,194,74,0.4)",
                  }}>
                    <img
                      src={giftImg(selected)!} alt={selected.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  </div>
                ) : (
                  <div style={{ fontSize: 52, lineHeight: 1, flexShrink: 0 }}>{selected.iconEmoji}</div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Name + Premium badge */}
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: "#fff" }}>{selected.name}</span>
                    {selected.tokenCost >= 2000 && (
                      <span style={{
                        background: "linear-gradient(135deg,#FFD700,#FFA000)",
                        borderRadius: 6, padding: "2px 7px",
                        fontSize: 10, fontWeight: 800, color: "#000",
                      }}>Premium</span>
                    )}
                  </div>
                  {/* Price */}
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5 }}>
                    <svg viewBox="0 0 20 20" width="16" height="16" fill="#FFD700"><circle cx="10" cy="10" r="9"/></svg>
                    <span style={{ color: "#FFD700", fontWeight: 900, fontSize: 14 }}>{selected.tokenCost.toLocaleString()} Jetons</span>
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 4, lineHeight: 1.4 }}>
                    Un cadeau prestigieux qui montre ton soutien et ton admiration pour ce créateur.
                  </div>
                </div>

                {/* Qty selector */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <button
                    onClick={() => setQty(q => Math.max(1, q - 1))}
                    style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >−</button>
                  <span style={{ color: "#fff", fontWeight: 900, fontSize: 17, minWidth: 22, textAlign: "center" }}>{qty}</span>
                  <button
                    onClick={() => setQty(q => balance >= selected.tokenCost * (q + 1) ? q + 1 : q)}
                    style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >+</button>
                </div>
              </div>
            )}
          </div>

          {/* ── Error / success banners ── */}
          <div style={{ padding: "0 14px", flexShrink: 0 }}>
            {error && (
              <div style={{ background: "rgba(244,67,54,0.15)", border: "1px solid rgba(244,67,54,0.35)", borderRadius: 10, padding: "9px 13px", marginBottom: 6, fontSize: 13, color: "#ff6b6b", display: "flex", alignItems: "center", gap: 8 }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="#ff6b6b"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                {error}
              </div>
            )}
            {success && (
              <div style={{ background: "rgba(22,194,74,0.15)", border: "1px solid rgba(22,194,74,0.35)", borderRadius: 10, padding: "9px 13px", marginBottom: 6, fontSize: 14, color: "#4ade80", textAlign: "center", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="#4ade80"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                Cadeau envoyé avec succès !
              </div>
            )}
          </div>

          {/* ── Send button ── */}
          <div style={{ padding: "10px 14px 28px", flexShrink: 0 }}>
            <button
              onClick={handleSend}
              disabled={!selected || loading || success || !canAffordSel}
              style={{
                width: "100%", padding: "0", borderRadius: 18, border: "none",
                background: selected && !loading && !success && canAffordSel
                  ? "linear-gradient(135deg,#1ED45A,#0DA83A,#0A8A30)"
                  : "rgba(255,255,255,0.08)",
                color: selected && canAffordSel ? "#fff" : "rgba(255,255,255,0.3)",
                fontWeight: 900,
                cursor: selected && !loading && !success && canAffordSel ? "pointer" : "not-allowed",
                boxShadow: selected && canAffordSel && !loading && !success
                  ? "0 6px 28px rgba(22,194,74,0.55), inset 0 1px 0 rgba(255,255,255,0.25)"
                  : "none",
                transition: "all 0.2s",
                overflow: "hidden",
                position: "relative",
              }}
            >
              {/* Shimmer sweep */}
              {selected && canAffordSel && !loading && !success && (
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                  background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)",
                  animation: "shimmer 2.2s linear infinite",
                  pointerEvents: "none",
                }} />
              )}
              <div style={{ padding: "14px 0 4px", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, position: "relative" }}>
                {loading ? (
                  <>
                    <div style={{ width: 18, height: 18, border: "2.5px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                    <span style={{ fontSize: 16 }}>Envoi en cours…</span>
                  </>
                ) : success ? (
                  <>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                    <span style={{ fontSize: 16 }}>Envoyé !</span>
                  </>
                ) : selected ? (
                  <>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M20 6h-2.18c.07-.31.18-.59.18-.9C18 3.4 16.6 2 14.9 2c-.92 0-1.73.42-2.3 1.08L12 3.7l-.6-.62C10.83 2.42 10.02 2 9.1 2 7.4 2 6 3.4 6 5.1c0 .31.11.59.18.9H4c-1.11 0-2 .89-2 2v13c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2z"/></svg>
                    <span style={{ fontSize: 17 }}>Envoyer le cadeau</span>
                  </>
                ) : (
                  <span style={{ fontSize: 16 }}>Sélectionne un cadeau</span>
                )}
              </div>
              {/* Token subtitle */}
              {selected && !loading && !success && (
                <div style={{ paddingBottom: 12, fontSize: 13, opacity: canAffordSel ? 0.85 : 0.4, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <svg viewBox="0 0 20 20" width="13" height="13" fill="#FFD700"><circle cx="10" cy="10" r="9"/></svg>
                  <span style={{ color: canAffordSel ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)" }}>
                    {totalCost.toLocaleString()} Jetons
                  </span>
                </div>
              )}
            </button>

            {/* Security line */}
            <div style={{ textAlign: "center", marginTop: 9, fontSize: 11, color: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
              <svg viewBox="0 0 24 24" width="11" height="11" fill="rgba(255,255,255,0.25)"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
              Paiement 100% sécurisé avec vos jetons <strong style={{ color: "#16C24A" }}>BrutePawa</strong>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes sheetUp {
          from { transform: translateY(100%); opacity: 0.7; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes selGlow {
          from { box-shadow: 0 0 14px rgba(22,194,74,0.5), 0 4px 16px rgba(0,0,0,0.55); }
          to   { box-shadow: 0 0 28px rgba(22,194,74,0.85), 0 4px 16px rgba(0,0,0,0.55); }
        }
      `}</style>
    </>
  );
}
