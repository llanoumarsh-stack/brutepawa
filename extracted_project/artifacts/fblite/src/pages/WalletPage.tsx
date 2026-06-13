import { useState, useEffect } from "react";
import {
  apiGetWallet, apiGetTransactions, apiDeposit, apiTransfer, apiGetUsers,
  type ApiTx, type PublicUser,
} from "../lib/api";

type Tab = "accueil" | "depot" | "envoyer" | "historique";
type DepotMethod = "mtn" | "orange" | "moov";

export default function WalletPage() {
  const [balance, setBalance]         = useState(0);
  const [transactions, setTransactions] = useState<ApiTx[]>([]);
  const [loading, setLoading]         = useState(true);
  const [users, setUsers]             = useState<PublicUser[]>([]);
  const [tab, setTab]                 = useState<Tab>("accueil");
  const [depotMethod, setDepotMethod] = useState<DepotMethod>("mtn");
  const [depotAmount, setDepotAmount] = useState("");
  const [depotPhone, setDepotPhone]   = useState("");
  const [sendTo, setSendTo]           = useState("");
  const [sendToUserId, setSendToUserId] = useState<number | null>(null);
  const [sendAmount, setSendAmount]   = useState("");
  const [processing, setProcessing]   = useState(false);
  const [success, setSuccess]         = useState<string | null>(null);
  const [txError, setTxError]         = useState<string | null>(null);

  const meId = (() => {
    try { return (JSON.parse(localStorage.getItem("fb_user") ?? "{}") as { id?: number }).id ?? 0; }
    catch { return 0; }
  })();

  const reloadWallet = () =>
    Promise.all([apiGetWallet(), apiGetTransactions()])
      .then(([w, txs]) => { setBalance(w.balance); setTransactions(txs); })
      .catch(() => {});

  useEffect(() => {
    Promise.all([apiGetWallet(), apiGetTransactions(), apiGetUsers()])
      .then(([w, txs, userList]) => {
        setBalance(w.balance);
        setTransactions(txs);
        setUsers(userList.filter(u => u.id !== meId));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const methodInfo: Record<DepotMethod, { label: string; color: string; emoji: string; prefix: string }> = {
    mtn:    { label: "MTN Mobile Money",    color: "#FFC107", emoji: "🟡", prefix: "+229 66" },
    orange: { label: "Orange Money",        color: "#FF6D00", emoji: "🟠", prefix: "+229 97" },
    moov:   { label: "Moov Money",          color: "#1565C0", emoji: "🔵", prefix: "+229 96" },
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

  const normTxs = transactions.map(normTx);

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1877F2, #0d47a1)", color: "#fff", padding: "20px 20px 30px" }}>
        <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 6 }}>💳 Mon Portefeuille Brute Pawa</div>
        <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: -1 }}>
          {loading ? "..." : balance.toLocaleString()} <span style={{ fontSize: 18 }}>FCFA</span>
        </div>
        <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>Solde disponible · Mis à jour à l'instant</div>
        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
          {([
            { icon: "⬇️", label: "Déposer",    tab: "depot"      as Tab },
            { icon: "⬆️", label: "Envoyer",    tab: "envoyer"    as Tab },
            { icon: "📋", label: "Historique", tab: "historique" as Tab },
          ] as const).map(btn => (
            <button key={btn.tab} onClick={() => setTab(btn.tab)} style={{
              flex: 1, background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 12,
              color: "#fff", padding: "10px 0", cursor: "pointer", fontWeight: 700, fontSize: 13
            }}>
              <div style={{ fontSize: 22 }}>{btn.icon}</div>
              <div>{btn.label}</div>
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
    </div>
  );
}
