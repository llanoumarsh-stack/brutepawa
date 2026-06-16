import { useState, useEffect, useRef } from "react";
import { getBpToken } from "../lib/api";

interface GiftItem {
  id: number;
  name: string;
  iconEmoji: string;
  tokenCost: number;
  animationType: string;
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
  { id: "all",     label: "🔥 Populaires" },
  { id: "amour",   label: "❤️ Amour" },
  { id: "prestige",label: "👑 Prestige" },
  { id: "fun",     label: "🎉 Fun" },
  { id: "premium", label: "🚀 Premium" },
];

function giftCategory(g: GiftItem): string[] {
  const cats = ["all"];
  if (g.tokenCost <= 150)                   cats.push("amour");
  if (g.tokenCost >= 200 && g.tokenCost <= 2000)  cats.push("prestige");
  if (g.tokenCost >= 100 && g.tokenCost <= 1000)  cats.push("fun");
  if (g.tokenCost >= 2000)                  cats.push("premium");
  return cats;
}

/* ── Particle burst for send success ── */
function Burst({ emoji }: { emoji: string }) {
  const particles = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * 360;
    const dist  = 55 + Math.random() * 40;
    const dx    = Math.cos((angle * Math.PI) / 180) * dist;
    const dy    = Math.sin((angle * Math.PI) / 180) * dist;
    return { dx, dy, rot: Math.random() * 360 };
  });
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {particles.map((p, i) => (
        <div key={i} style={{
          position: "absolute", fontSize: 26,
          animation: `giftBurst 0.7s ${i * 0.03}s ease-out forwards`,
          ["--dx" as string]: `${p.dx}px`, ["--dy" as string]: `${p.dy}px`,
          ["--rot" as string]: `${p.rot}deg`,
        }}>{emoji}</div>
      ))}
      <style>{`
        @keyframes giftBurst {
          0%   { transform: translate(0,0) rotate(0deg) scale(1); opacity:1; }
          100% { transform: translate(var(--dx),var(--dy)) rotate(var(--rot)) scale(0.2); opacity:0; }
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

  /* pull catalog */
  useEffect(() => {
    fetch("/api/gifts/catalog")
      .then(r => r.json())
      .then((d: GiftItem[]) => setCatalog(d))
      .catch(() => {});
  }, []);

  /* pull live balance */
  useEffect(() => {
    const token = getBpToken();
    if (!token) return;
    fetch("/api/creator/wallet", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((d: { tokenBalance?: number }) => { if (d.tokenBalance !== undefined) setBalance(d.tokenBalance); })
      .catch(() => {});
  }, []);

  const filtered = catalog.filter(g => giftCategory(g).includes(cat));
  const totalCost = selected ? selected.tokenCost * qty : 0;
  const canAffordSel = selected ? balance >= totalCost : false;

  const handleSend = async () => {
    if (!selected || loading || success || !canAffordSel) return;
    setLoading(true); setError(null);
    const rawUser = localStorage.getItem("fb_user");
    const user = rawUser ? JSON.parse(rawUser) as { name?: string } : {};
    const token = getBpToken();
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
      setTimeout(() => { onSent(selected, newBal); onClose(); }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const initials = receiverName.slice(0, 2).toUpperCase();

  return (
    <>
      {showBurst && selected && <Burst emoji={selected.iconEmoji} />}

      {/* Backdrop */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(3px)" }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        {/* Sheet */}
        <div
          ref={sheetRef}
          style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            background: "linear-gradient(180deg,#0F0F1A 0%,#14142B 100%)",
            borderRadius: "24px 24px 0 0",
            maxHeight: "92vh", display: "flex", flexDirection: "column",
            boxShadow: "0 -12px 60px rgba(0,0,0,0.6)",
            animation: "sheetUp 0.32s cubic-bezier(0.34,1.56,0.64,1) forwards",
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Handle */}
          <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
            <div style={{ width: 44, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
          </div>

          {/* ── Header ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 20px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Gift icon */}
              <div style={{ width: 46, height: 46, borderRadius: "50%", background: "linear-gradient(135deg,#16C24A,#0DA63E)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 18px rgba(22,194,74,0.45)", flexShrink: 0 }}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="#fff"><path d="M20 6h-2.18c.07-.31.18-.59.18-.9C18 3.4 16.6 2 14.9 2c-.92 0-1.73.42-2.3 1.08L12 3.7l-.6-.62C10.83 2.42 10.02 2 9.1 2 7.4 2 6 3.4 6 5.1c0 .31.11.59.18.9H4c-1.11 0-2 .89-2 2v13c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5.1-2c.61 0 1.1.49 1.1 1.1 0 .61-.49 1.1-1.1 1.1H13V4.9c0-.61.49-1.1 1.1-1.1zM9.1 4c.61 0 1.1.49 1.1 1.1V6H9.1C8.49 6 8 5.51 8 4.9 8 4.29 8.49 4 9.1 4zM4 8h6v3H4V8zm2 11v-6h4v6H6zm6 0v-6h4v6h-4zm6 0h-4v-6h4v6zm0-8h-6V8h6v3z"/></svg>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 17, color: "#fff" }}>Envoyer un cadeau</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#1877F2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                    {initials}
                  </div>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>à <strong style={{ color: "rgba(255,255,255,0.9)" }}>{receiverName}</strong></span>
                </div>
              </div>
            </div>
            {/* Balance card */}
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 2 }}>Solde actuel</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="#FFD700"><circle cx="12" cy="12" r="10"/><text x="12" y="16" textAnchor="middle" fontSize="11" fill="#000" fontWeight="bold">J</text></svg>
                <span style={{ fontWeight: 900, fontSize: 16, color: "#FFD700" }}>{balance.toLocaleString()} Jeton{balance !== 1 ? "s" : ""}</span>
              </div>
              {onBuyTokens && (
                <button onClick={onBuyTokens} style={{ marginTop: 5, background: "transparent", border: "1px solid #16C24A", borderRadius: 20, padding: "4px 10px", color: "#16C24A", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="#16C24A"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                  Recharger
                </button>
              )}
            </div>
          </div>

          {/* ── Category tabs ── */}
          <div style={{ display: "flex", gap: 8, padding: "0 16px 12px", overflowX: "auto", scrollbarWidth: "none", flexShrink: 0 }}>
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                style={{
                  flexShrink: 0, padding: "8px 16px", borderRadius: 24, border: "none",
                  background: cat === c.id ? "linear-gradient(135deg,#16C24A,#0DA63E)" : "rgba(255,255,255,0.08)",
                  color: cat === c.id ? "#fff" : "rgba(255,255,255,0.6)",
                  fontWeight: cat === c.id ? 800 : 600, fontSize: 13, cursor: "pointer",
                  boxShadow: cat === c.id ? "0 3px 14px rgba(22,194,74,0.4)" : "none",
                  transition: "all 0.18s",
                }}
              >{c.label}</button>
            ))}
          </div>

          {/* ── Gift grid ── */}
          <div style={{ overflowY: "auto", padding: "0 16px", flex: 1, scrollbarWidth: "none" }}>
            {catalog.length === 0 ? (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: "32px 0", fontSize: 14 }}>Chargement…</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, paddingBottom: 8 }}>
                {filtered.map(g => {
                  const canAfford = balance >= g.tokenCost;
                  const isSel    = selected?.id === g.id;
                  return (
                    <button
                      key={g.id}
                      onClick={() => { if (canAfford) { setSelected(g); setQty(1); setError(null); } }}
                      style={{
                        background: isSel
                          ? "linear-gradient(135deg,rgba(22,194,74,0.25),rgba(13,166,62,0.15))"
                          : "rgba(255,255,255,0.06)",
                        border: isSel ? "1.5px solid #16C24A" : "1.5px solid rgba(255,255,255,0.08)",
                        borderRadius: 14, padding: "10px 4px 8px",
                        cursor: canAfford ? "pointer" : "not-allowed",
                        opacity: canAfford ? 1 : 0.38,
                        textAlign: "center",
                        boxShadow: isSel ? "0 0 14px rgba(22,194,74,0.35)" : "none",
                        transition: "all 0.15s",
                        transform: isSel ? "scale(1.05)" : "scale(1)",
                      }}
                    >
                      <div style={{ fontSize: 28, lineHeight: 1, marginBottom: 4 }}>{g.iconEmoji}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: isSel ? "#16C24A" : "rgba(255,255,255,0.8)", lineHeight: 1.2, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 2px" }}>{g.name}</div>
                      <div style={{ fontSize: 10, color: "#FFD700", fontWeight: 700 }}>{g.tokenCost >= 1000 ? `${(g.tokenCost/1000).toFixed(g.tokenCost % 1000 === 0 ? 0 : 1)}K` : g.tokenCost}</div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Selected gift detail card ── */}
            {selected && (
              <div style={{
                margin: "10px 0 4px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(22,194,74,0.3)",
                borderRadius: 18, padding: "14px 16px",
                display: "flex", alignItems: "center", gap: 14,
              }}>
                <div style={{ fontSize: 48, lineHeight: 1, filter: "drop-shadow(0 0 12px rgba(22,194,74,0.5))" }}>{selected.iconEmoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 16, color: "#fff" }}>{selected.name}</span>
                    {selected.tokenCost >= 2000 && (
                      <span style={{ background: "linear-gradient(135deg,#FFD700,#FFA000)", borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 800, color: "#000" }}>Premium</span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="#FFD700"><circle cx="12" cy="12" r="10"/></svg>
                    <span style={{ color: "#FFD700", fontWeight: 800, fontSize: 15 }}>{selected.tokenCost.toLocaleString()} Jetons</span>
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>
                    Un cadeau prestigieux qui montre ton soutien et ton admiration.
                  </div>
                </div>
                {/* Qty selector */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                  <span style={{ color: "#fff", fontWeight: 800, fontSize: 16, minWidth: 20, textAlign: "center" }}>{qty}</span>
                  <button onClick={() => setQty(q => balance >= selected.tokenCost * (q + 1) ? q + 1 : q)} style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                </div>
              </div>
            )}
          </div>

          {/* ── Error / success banners ── */}
          <div style={{ padding: "0 16px", flexShrink: 0 }}>
            {error && (
              <div style={{ background: "rgba(244,67,54,0.18)", border: "1px solid rgba(244,67,54,0.35)", borderRadius: 12, padding: "10px 14px", marginTop: 8, fontSize: 13, color: "#ff6b6b", display: "flex", alignItems: "center", gap: 8 }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="#ff6b6b"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                {error}
              </div>
            )}
            {success && (
              <div style={{ background: "rgba(22,194,74,0.18)", border: "1px solid rgba(22,194,74,0.35)", borderRadius: 12, padding: "10px 14px", marginTop: 8, fontSize: 14, color: "#4ade80", textAlign: "center", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="#4ade80"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                Cadeau envoyé avec succès !
              </div>
            )}
          </div>

          {/* ── Send button ── */}
          <div style={{ padding: "14px 16px 32px", flexShrink: 0 }}>
            <button
              onClick={handleSend}
              disabled={!selected || loading || success || !canAffordSel}
              style={{
                width: "100%", padding: "16px 0", borderRadius: 18, border: "none",
                background: selected && !loading && !success && canAffordSel
                  ? "linear-gradient(135deg,#16C24A,#0DA63E)"
                  : "rgba(255,255,255,0.1)",
                color: selected && canAffordSel ? "#fff" : "rgba(255,255,255,0.35)",
                fontWeight: 900, fontSize: 16,
                cursor: selected && !loading && !success && canAffordSel ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                boxShadow: selected && canAffordSel && !loading && !success ? "0 6px 24px rgba(22,194,74,0.45)" : "none",
                transition: "all 0.2s",
              }}
            >
              {loading ? (
                <>
                  <div style={{ width: 18, height: 18, border: "2.5px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                  Envoi en cours…
                </>
              ) : success ? (
                <><svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Envoyé !</>
              ) : selected ? (
                <>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M20 6h-2.18c.07-.31.18-.59.18-.9C18 3.4 16.6 2 14.9 2c-.92 0-1.73.42-2.3 1.08L12 3.7l-.6-.62C10.83 2.42 10.02 2 9.1 2 7.4 2 6 3.4 6 5.1c0 .31.11.59.18.9H4c-1.11 0-2 .89-2 2v13c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2z"/></svg>
                  Envoyer le cadeau
                  <span style={{ fontSize: 13, background: "rgba(0,0,0,0.2)", borderRadius: 20, padding: "2px 10px" }}>
                    {totalCost.toLocaleString()} Jetons
                  </span>
                </>
              ) : (
                "Sélectionne un cadeau"
              )}
            </button>
            <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="rgba(255,255,255,0.3)"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
              Paiement 100% sécurisé avec vos jetons <strong style={{ color: "#16C24A" }}>BrutePawa</strong>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes sheetUp {
          from { transform: translateY(100%); opacity: 0.6; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
