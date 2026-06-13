import { useState, useEffect, useRef } from "react";
import {
  apiGetWallet, apiGetTransactions, apiDeposit, apiTransfer, apiGetUsers,
  apiGetCreatorWallet, apiPurchaseTokens, apiGetTokenPurchaseStatus,
  type ApiTx, type PublicUser, type ApiTokenPurchase,
} from "../lib/api";

type Tab = "accueil" | "depot" | "envoyer" | "historique" | "jetons";
type DepotMethod = "mtn" | "orange" | "moov";
type TokenOp = "orange" | "mtn" | "wave";

const TOKEN_PACKS = [
  { id: "pack_100"  as const, tokens: 100,  xof: 500,   label: "Pack Débutant",  emoji: "🌱" },
  { id: "pack_500"  as const, tokens: 500,  xof: 2500,  label: "Pack Standard",  emoji: "⭐" },
  { id: "pack_2000" as const, tokens: 2000, xof: 10000, label: "Pack Premium",   emoji: "💎" },
];

const TOKEN_OPERATORS: { id: TokenOp; label: string; emoji: string }[] = [
  { id: "orange", label: "Orange Money", emoji: "🟠" },
  { id: "mtn",    label: "MTN MoMo",     emoji: "🟡" },
  { id: "wave",   label: "Wave",         emoji: "🔵" },
];

export default function WalletPage() {
  const [balance, setBalance]           = useState(0);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [transactions, setTransactions] = useState<ApiTx[]>([]);
  const [loading, setLoading]           = useState(true);
  const [users, setUsers]               = useState<PublicUser[]>([]);
  const [tab, setTab]                   = useState<Tab>(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    if (t === "jetons" || t === "depot" || t === "envoyer" || t === "historique") return t as Tab;
    return "accueil";
  });

  // XOF wallet state
  const [depotMethod, setDepotMethod]   = useState<DepotMethod>("mtn");
  const [depotAmount, setDepotAmount]   = useState("");
  const [depotPhone, setDepotPhone]     = useState("");
  const [sendTo, setSendTo]             = useState("");
  const [sendToUserId, setSendToUserId] = useState<number | null>(null);
  const [sendAmount, setSendAmount]     = useState("");
  const [processing, setProcessing]     = useState(false);
  const [success, setSuccess]           = useState<string | null>(null);
  const [txError, setTxError]           = useState<string | null>(null);

  // Token purchase state
  const [tokenPack, setTokenPack]           = useState<typeof TOKEN_PACKS[0] | null>(null);
  const [tokenOp, setTokenOp]               = useState<TokenOp>("orange");
  const [tokenPhone, setTokenPhone]         = useState("");
  const [tokenLoading, setTokenLoading]     = useState(false);
  const [tokenResult, setTokenResult]       = useState<ApiTokenPurchase | null>(null);
  const [tokenError, setTokenError]         = useState<string | null>(null);
  const [tokenConfirmed, setTokenConfirmed] = useState(false);
  const pollRef                             = useRef<ReturnType<typeof setInterval> | null>(null);

  const meId = (() => {
    try { return (JSON.parse(localStorage.getItem("fb_user") ?? "{}") as { id?: number }).id ?? 0; }
    catch { return 0; }
  })();

  // Poll purchase status after initiation until confirmed/failed (max 5 min)
  useEffect(() => {
    if (!tokenResult) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    const start = Date.now();
    const MAX_POLL_MS = 5 * 60 * 1000;
    pollRef.current = setInterval(async () => {
      if (Date.now() - start > MAX_POLL_MS) {
        clearInterval(pollRef.current!); pollRef.current = null; return;
      }
      try {
        const s = await apiGetTokenPurchaseStatus(tokenResult.purchaseId);
        if (s.status === "confirmed") {
          clearInterval(pollRef.current!); pollRef.current = null;
          setTokenConfirmed(true);
          const cw = await apiGetCreatorWallet();
          setTokenBalance(cw.tokenBalance);
        } else if (s.status === "failed") {
          clearInterval(pollRef.current!); pollRef.current = null;
          setTokenError("Paiement échoué. Veuillez réessayer.");
          setTokenResult(null);
        }
      } catch { /* ignore transient errors */ }
    }, 3000);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [tokenResult]);

  const reloadWallet = () =>
    Promise.all([apiGetWallet(), apiGetTransactions()])
      .then(([w, txs]) => { setBalance(Number(w.balance)); setTransactions(txs); })
      .catch(() => {});

  useEffect(() => {
    Promise.all([apiGetWallet(), apiGetTransactions(), apiGetUsers(), apiGetCreatorWallet()])
      .then(([w, txs, userList, cw]) => {
        setBalance(Number(w.balance));
        setTransactions(txs);
        setUsers(userList.filter(u => u.id !== meId));
        setTokenBalance(cw.tokenBalance);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const methodInfo: Record<DepotMethod, { label: string; color: string; emoji: string; prefix: string }> = {
    mtn:    { label: "MTN Mobile Money", color: "#FFC107", emoji: "🟡", prefix: "+229 66" },
    orange: { label: "Orange Money",     color: "#FF6D00", emoji: "🟠", prefix: "+229 97" },
    moov:   { label: "Moov Money",       color: "#1565C0", emoji: "🔵", prefix: "+229 96" },
  };

  const normTx = (tx: ApiTx) => {
    let txType = "paiement";
    if (tx.type === "deposit") txType = "depot";
    else if (tx.type === "transfer" && tx.fromUserId === meId) txType = "envoi";
    else if (tx.type === "transfer" && tx.toUserId   === meId) txType = "reception";
    return {
      ...tx,
      txType,
      label: tx.description ?? "Transaction",
      date: new Date(tx.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
      statusLabel: tx.status === "completed" ? "effectué" : tx.status === "pending" ? "en attente" : "échoué",
    };
  };

  const txIcon:  Record<string, string> = { depot: "⬇️", envoi: "⬆️", reception: "⬇️", paiement: "💳" };
  const txColor: Record<string, string> = { depot: "#4CAF50", envoi: "#F44336", reception: "#4CAF50", paiement: "#FF9800" };

  const handleDeposit = async () => {
    if (!depotAmount || !depotPhone) return;
    setProcessing(true); setTxError(null);
    try {
      await apiDeposit(parseInt(depotAmount), depotMethod, depotPhone);
      await reloadWallet();
      setSuccess(`+${parseInt(depotAmount).toLocaleString()} FCFA reçus sur votre wallet !`);
      setDepotAmount(""); setDepotPhone("");
      setTimeout(() => { setSuccess(null); setTab("accueil"); }, 3000);
    } catch (e) { setTxError(e instanceof Error ? e.message : "Dépôt échoué"); }
    setProcessing(false);
  };

  const handleSend = async () => {
    if (!sendAmount || !sendToUserId) return;
    const amt = parseInt(sendAmount);
    if (amt > balance) return;
    setProcessing(true); setTxError(null);
    try {
      await apiTransfer(sendToUserId, amt, `Transfert → ${sendTo}`);
      await reloadWallet();
      setSuccess(`${amt.toLocaleString()} FCFA envoyés à ${sendTo} !`);
      setSendAmount(""); setSendTo(""); setSendToUserId(null);
      setTimeout(() => { setSuccess(null); setTab("accueil"); }, 3000);
    } catch (e) { setTxError(e instanceof Error ? e.message : "Transfert échoué"); }
    setProcessing(false);
  };

  const handleTokenPurchase = async () => {
    if (!tokenPack || !tokenPhone) return;
    setTokenLoading(true); setTokenError(null); setTokenResult(null); setTokenConfirmed(false);
    try {
      const result = await apiPurchaseTokens({ packId: tokenPack.id, paymentMethod: tokenOp, paymentPhone: tokenPhone });
      setTokenResult(result);
    } catch (e) { setTokenError(e instanceof Error ? e.message : "Erreur d'achat"); }
    setTokenLoading(false);
  };

  const resetTokenPurchase = () => {
    setTokenResult(null); setTokenPack(null); setTokenPhone(""); setTokenConfirmed(false); setTokenError(null);
  };

  const normTxs = transactions.map(normTx);

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1877F2, #0d47a1)", color: "#fff", padding: "20px 20px 30px" }}>
        <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 6 }}>💳 Mon Portefeuille Brute Pawa</div>
        <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: -1 }}>
          {loading ? "..." : balance.toLocaleString()} <span style={{ fontSize: 18 }}>FCFA</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, marginBottom: 16 }}>
          <div style={{ background: "rgba(255,215,0,0.2)", borderRadius: 20, padding: "4px 12px", fontSize: 14, fontWeight: 700, color: "#FFD700" }}>
            🪙 {tokenBalance.toLocaleString()} jetons
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {([
            { icon: "⬇️", label: "Déposer",    tab: "depot"      as Tab },
            { icon: "⬆️", label: "Envoyer",    tab: "envoyer"    as Tab },
            { icon: "🪙",  label: "Jetons",     tab: "jetons"     as Tab },
            { icon: "📋", label: "Historique", tab: "historique" as Tab },
          ] as const).map(btn => (
            <button key={btn.tab} onClick={() => setTab(btn.tab)} style={{
              flex: 1, background: tab === btn.tab ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.2)",
              border: tab === btn.tab ? "2px solid rgba(255,255,255,0.6)" : "2px solid transparent",
              borderRadius: 12, color: "#fff", padding: "9px 0", cursor: "pointer", fontWeight: 700, fontSize: 12, minWidth: 60,
            }}>
              <div style={{ fontSize: 20 }}>{btn.icon}</div>
              <div style={{ marginTop: 2 }}>{btn.label}</div>
            </button>
          ))}
        </div>
      </div>

      {success  && <div style={{ background: "#E8F5E9", color: "#2E7D32", padding: "14px 16px", fontWeight: 700, textAlign: "center", fontSize: 15 }}>✅ {success}</div>}
      {txError  && <div style={{ background: "#FFEBEE", color: "#C62828", padding: "14px 16px", fontWeight: 700, textAlign: "center", fontSize: 14 }}>❌ {txError}</div>}

      {/* ── ACCUEIL ── */}
      {tab === "accueil" && (
        <div>
          <div style={{ background: "var(--fb-white)", padding: "16px" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Opérateurs supportés</div>
            <div style={{ display: "flex", gap: 12 }}>
              {Object.entries(methodInfo).map(([key, m]) => (
                <div key={key} style={{ flex: 1, textAlign: "center", background: m.color + "15", borderRadius: 12, padding: "12px 0" }}>
                  <div style={{ fontSize: 28 }}>{m.emoji}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>{m.label.split(" ").slice(0, 2).join(" ")}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: "var(--fb-white)", marginTop: 4 }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--fb-divider)", fontWeight: 700, fontSize: 15, display: "flex", justifyContent: "space-between" }}>
              <span>Transactions récentes</span>
              <button onClick={() => setTab("historique")} style={{ background: "none", border: "none", color: "var(--fb-blue)", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Voir tout</button>
            </div>
            {normTxs.length === 0 && (
              <div style={{ padding: "28px 16px", textAlign: "center", color: "var(--fb-text-secondary)", fontSize: 13 }}>
                Aucune transaction pour l'instant. Faites votre premier dépôt !
              </div>
            )}
            {normTxs.slice(0, 5).map(tx => (
              <div key={tx.id} style={{ padding: "12px 16px", borderBottom: "1px solid var(--fb-divider)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ width: 40, height: 40, background: (txColor[tx.txType] ?? "#ccc") + "20", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                    {txIcon[tx.txType] ?? "💰"}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{tx.label}</div>
                    <div style={{ fontSize: 12, color: "var(--fb-text-secondary)" }}>{tx.date}</div>
                  </div>
                </div>
                <div style={{ fontWeight: 800, color: txColor[tx.txType] ?? "#000", fontSize: 15 }}>
                  {tx.txType === "depot" || tx.txType === "reception" ? "+" : "-"}{tx.amount.toLocaleString()} FCFA
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── DEPOT ── */}
      {tab === "depot" && (
        <div style={{ padding: 16 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 17 }}>⬇️ Déposer de l'argent</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {(Object.entries(methodInfo) as [DepotMethod, typeof methodInfo[DepotMethod]][]).map(([key, m]) => (
              <button key={key} onClick={() => setDepotMethod(key)} style={{
                flex: 1, padding: "12px 0", borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 12,
                border: `2px solid ${depotMethod === key ? m.color : "var(--fb-divider)"}`,
                background: depotMethod === key ? m.color + "15" : "var(--fb-white)"
              }}>
                <div style={{ fontSize: 22 }}>{m.emoji}</div>
                <div>{m.label.split(" ").slice(0, 2).join(" ")}</div>
              </button>
            ))}
          </div>
          <div style={{ background: "var(--fb-white)", borderRadius: 16, padding: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 15 }}>{methodInfo[depotMethod].emoji} {methodInfo[depotMethod].label}</div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Numéro de téléphone</label>
            <input value={depotPhone} onChange={e => setDepotPhone(e.target.value)} placeholder={methodInfo[depotMethod].prefix + " XX XX XX"}
              style={{ width: "100%", background: "var(--fb-bg)", border: "none", borderRadius: 10, padding: "12px 14px", fontSize: 15, marginBottom: 14, boxSizing: "border-box" }} />
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Montant à déposer (FCFA)</label>
            <input value={depotAmount} onChange={e => setDepotAmount(e.target.value)} type="number" placeholder="Ex : 50000"
              style={{ width: "100%", background: "var(--fb-bg)", border: "none", borderRadius: 10, padding: "12px 14px", fontSize: 18, fontWeight: 800, marginBottom: 14, boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {[5000, 10000, 25000, 50000, 100000].map(amt => (
                <button key={amt} onClick={() => setDepotAmount(String(amt))} style={{
                  padding: "6px 14px", borderRadius: 20, border: "1px solid var(--fb-divider)",
                  background: depotAmount === String(amt) ? "var(--fb-blue)" : "var(--fb-bg)",
                  color: depotAmount === String(amt) ? "#fff" : "var(--fb-text)",
                  fontWeight: 700, cursor: "pointer", fontSize: 13
                }}>{amt.toLocaleString()}</button>
              ))}
            </div>
            <button onClick={handleDeposit} disabled={processing || !depotAmount || !depotPhone} style={{
              width: "100%", background: processing ? "#ccc" : "var(--fb-blue)", color: "#fff", border: "none",
              borderRadius: 12, padding: "14px", fontWeight: 800, fontSize: 16, cursor: "pointer"
            }}>
              {processing ? "Traitement en cours..." : `Déposer ${depotAmount ? parseInt(depotAmount).toLocaleString() + " FCFA" : ""}`}
            </button>
          </div>
        </div>
      )}

      {/* ── ENVOYER ── */}
      {tab === "envoyer" && (
        <div style={{ padding: 16 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 17 }}>⬆️ Envoyer de l'argent</h3>
          <div style={{ background: "var(--fb-white)", borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Envoyer à</div>
            <input value={sendTo} onChange={e => { setSendTo(e.target.value); setSendToUserId(null); }}
              placeholder="Nom ou email"
              style={{ width: "100%", background: "var(--fb-bg)", border: "none", borderRadius: 10, padding: "12px 14px", fontSize: 15, marginBottom: 12, boxSizing: "border-box" }} />

            <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", marginBottom: 16 }}>
              {users.slice(0, 5).map(u => {
                const name = `${u.firstName} ${u.lastName}`;
                const colors = ["#1877F2","#E91E8C","#7B1FA2","#F57C00","#388E3C"];
                const color  = colors[u.id % colors.length];
                const inits  = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                const sel    = sendToUserId === u.id;
                return (
                  <div key={u.id} onClick={() => { setSendTo(name); setSendToUserId(u.id); }}
                    style={{ flexShrink: 0, textAlign: "center", cursor: "pointer", opacity: sel ? 1 : 0.7 }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: color, color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14,
                      border: sel ? "3px solid var(--fb-blue)" : "3px solid transparent", margin: "0 auto 4px", overflow: "hidden" }}>
                      {u.avatarUrl
                        ? <img src={u.avatarUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : inits}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700 }}>{u.firstName}</div>
                  </div>
                );
              })}
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Montant (FCFA)</div>
            <input value={sendAmount} onChange={e => setSendAmount(e.target.value)} type="number" placeholder="Ex : 25000"
              style={{ width: "100%", background: "var(--fb-bg)", border: "none", borderRadius: 10, padding: "12px 14px", fontSize: 18, fontWeight: 800, marginBottom: 8, boxSizing: "border-box" }} />
            {sendAmount && parseInt(sendAmount) > balance && (
              <div style={{ color: "#F44336", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                ⚠️ Solde insuffisant ({balance.toLocaleString()} FCFA disponibles)
              </div>
            )}
            {!sendToUserId && sendTo && (
              <div style={{ color: "#FF9800", fontSize: 13, marginBottom: 8 }}>
                ⚠️ Sélectionnez un contact dans la liste
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {[5000, 10000, 25000, 50000].map(amt => (
                <button key={amt} onClick={() => setSendAmount(String(amt))} style={{
                  padding: "6px 14px", borderRadius: 20, border: "1px solid var(--fb-divider)",
                  background: sendAmount === String(amt) ? "var(--fb-blue)" : "var(--fb-bg)",
                  color: sendAmount === String(amt) ? "#fff" : "var(--fb-text)",
                  fontWeight: 700, cursor: "pointer", fontSize: 13
                }}>{amt.toLocaleString()}</button>
              ))}
            </div>
            <button onClick={handleSend} disabled={processing || !sendAmount || !sendToUserId || parseInt(sendAmount) > balance} style={{
              width: "100%", background: processing ? "#ccc" : "#4CAF50", color: "#fff", border: "none",
              borderRadius: 12, padding: "14px", fontWeight: 800, fontSize: 16, cursor: "pointer"
            }}>
              {processing ? "Envoi en cours..." : `Envoyer ${sendAmount ? parseInt(sendAmount).toLocaleString() + " FCFA" : ""}`}
            </button>
          </div>
        </div>
      )}

      {/* ── JETONS 🪙 ── */}
      {tab === "jetons" && (
        <div style={{ padding: 16 }}>
          {/* Balance card */}
          <div style={{ background: "linear-gradient(135deg, #E91E8C, #9C27B0)", borderRadius: 16, padding: "18px 20px", marginBottom: 16, color: "#fff" }}>
            <div style={{ fontSize: 13, opacity: 0.85 }}>Solde jetons</div>
            <div style={{ fontSize: 36, fontWeight: 900, margin: "4px 0" }}>🪙 {tokenBalance.toLocaleString()}</div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>1 jeton = 5 XOF · Utilisables pour offrir des cadeaux en live</div>
          </div>

          {!tokenResult ? (
            <>
              {/* Pack selection */}
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Choisir un pack</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {TOKEN_PACKS.map(p => (
                  <button key={p.id} onClick={() => setTokenPack(p)} style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 14,
                    border: `2px solid ${tokenPack?.id === p.id ? "#E91E8C" : "var(--fb-divider)"}`,
                    background: tokenPack?.id === p.id ? "#fce4ec" : "var(--fb-white)",
                    cursor: "pointer", textAlign: "left",
                  }}>
                    <div style={{ fontSize: 32 }}>{p.emoji}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>{p.label}</div>
                      <div style={{ fontSize: 13, color: "var(--fb-text-secondary)", marginTop: 2 }}>🪙 {p.tokens.toLocaleString()} jetons</div>
                    </div>
                    <div style={{ fontWeight: 900, fontSize: 16, color: "#E91E8C" }}>{p.xof.toLocaleString()} XOF</div>
                  </button>
                ))}
              </div>

              {tokenPack && (
                <>
                  {/* Operator */}
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Opérateur Mobile Money</div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                    {TOKEN_OPERATORS.map(op => (
                      <button key={op.id} onClick={() => setTokenOp(op.id)} style={{
                        flex: 1, padding: "10px 0", borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 12,
                        border: `2px solid ${tokenOp === op.id ? "#E91E8C" : "var(--fb-divider)"}`,
                        background: tokenOp === op.id ? "#fce4ec" : "var(--fb-white)",
                      }}>
                        <div style={{ fontSize: 22 }}>{op.emoji}</div>
                        <div style={{ marginTop: 2 }}>{op.label.split(" ")[0]}</div>
                      </button>
                    ))}
                  </div>

                  {/* Phone */}
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Numéro de téléphone</div>
                  <input value={tokenPhone} onChange={e => setTokenPhone(e.target.value)}
                    placeholder="+225 07 XX XX XX XX"
                    style={{ width: "100%", background: "var(--fb-bg)", border: "none", borderRadius: 10, padding: "12px 14px", fontSize: 15, marginBottom: 14, boxSizing: "border-box" }} />

                  {tokenError && (
                    <div style={{ background: "#FFEBEE", color: "#C62828", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13 }}>❌ {tokenError}</div>
                  )}

                  <button onClick={handleTokenPurchase} disabled={tokenLoading || !tokenPhone}
                    style={{
                      width: "100%", background: tokenLoading ? "#ccc" : "#E91E8C", color: "#fff", border: "none",
                      borderRadius: 12, padding: 14, fontWeight: 800, fontSize: 16, cursor: "pointer",
                    }}>
                    {tokenLoading ? "Traitement…" : `Acheter 🪙 ${tokenPack.tokens} jetons — ${tokenPack.xof.toLocaleString()} XOF`}
                  </button>
                </>
              )}
            </>
          ) : tokenConfirmed ? (
            /* Confirmed — tokens credited */
            <div style={{ background: "var(--fb-white)", borderRadius: 16, padding: 20, textAlign: "center" }}>
              <div style={{ fontSize: 64, marginBottom: 8 }}>🎉</div>
              <div style={{ fontWeight: 900, fontSize: 20, color: "#4CAF50", marginBottom: 6 }}>Jetons crédités !</div>
              <div style={{ fontSize: 15, color: "var(--fb-text-secondary)", marginBottom: 20 }}>
                🪙 +{tokenResult!.tokens.toLocaleString()} jetons ont bien été ajoutés à ton solde.
              </div>
              <div style={{ background: "linear-gradient(135deg, #E91E8C, #9C27B0)", borderRadius: 16, padding: "16px 20px", marginBottom: 20, color: "#fff" }}>
                <div style={{ fontSize: 13, opacity: 0.85 }}>Nouveau solde jetons</div>
                <div style={{ fontSize: 34, fontWeight: 900, margin: "4px 0" }}>🪙 {tokenBalance.toLocaleString()}</div>
              </div>
              <button onClick={resetTokenPurchase}
                style={{ width: "100%", background: "#E91E8C", color: "#fff", border: "none", borderRadius: 12, padding: 14, fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
                Acheter d'autres jetons
              </button>
            </div>
          ) : (
            /* Purchase result — waiting for payment confirmation */
            <div style={{ background: "var(--fb-white)", borderRadius: 16, padding: 20 }}>
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 48 }}>🕐</div>
                <div style={{ fontWeight: 800, fontSize: 17, marginTop: 8 }}>Paiement en attente</div>
                <div style={{ fontSize: 13, color: "var(--fb-text-secondary)", marginTop: 4 }}>
                  Effectue le paiement selon les instructions ci-dessous
                </div>
                <div style={{ fontSize: 12, color: "var(--fb-text-secondary)", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#4CAF50", animation: "blink 1.2s ease-in-out infinite" }} />
                  Vérification automatique en cours…
                </div>
              </div>
              <div style={{ background: "var(--fb-bg)", borderRadius: 12, padding: 16, marginBottom: 16, fontSize: 14, lineHeight: 1.7 }}>
                {tokenResult.instructions.message}
              </div>
              <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>Référence</div>
              <div style={{ fontFamily: "monospace", background: "#E3F2FD", borderRadius: 8, padding: "10px 14px", fontSize: 14, fontWeight: 700, marginBottom: 16, wordBreak: "break-all" }}>
                {tokenResult.paymentRef}
              </div>
              <div style={{ fontSize: 13, color: "var(--fb-text-secondary)", marginBottom: 16, textAlign: "center" }}>
                🪙 +{tokenResult.tokens.toLocaleString()} jetons crédités automatiquement après confirmation
              </div>
              <button onClick={resetTokenPurchase}
                style={{ width: "100%", background: "#E91E8C", color: "#fff", border: "none", borderRadius: 12, padding: 14, fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
                Faire un autre achat
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── HISTORIQUE ── */}
      {tab === "historique" && (
        <div style={{ background: "var(--fb-white)", marginTop: 4 }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--fb-divider)", fontWeight: 700, fontSize: 15 }}>
            📋 Toutes les transactions ({normTxs.length})
          </div>
          {normTxs.length === 0 && (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--fb-text-secondary)", fontSize: 13 }}>
              Aucune transaction pour l'instant
            </div>
          )}
          {normTxs.map(tx => (
            <div key={tx.id} style={{ padding: "14px 16px", borderBottom: "1px solid var(--fb-divider)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 44, height: 44, background: (txColor[tx.txType] ?? "#ccc") + "20", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                  {txIcon[tx.txType] ?? "💰"}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{tx.label}</div>
                  <div style={{ fontSize: 12, color: "var(--fb-text-secondary)" }}>{tx.date}</div>
                  <div style={{ fontSize: 11, color: tx.statusLabel === "effectué" ? "#4CAF50" : "#FF9800", fontWeight: 700 }}>
                    ● {tx.statusLabel}
                  </div>
                </div>
              </div>
              <div style={{ fontWeight: 900, color: txColor[tx.txType] ?? "#000", fontSize: 16 }}>
                {tx.txType === "depot" || tx.txType === "reception" ? "+" : "-"}{tx.amount.toLocaleString()} FCFA
              </div>
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0.25; } }`}</style>
    </div>
  );
}
