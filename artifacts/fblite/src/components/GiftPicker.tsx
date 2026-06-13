import { useState, useEffect } from "react";
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
  contextType: "live" | "video";
  contextId: number;
  tokenBalance: number;
  onClose: () => void;
  onSent: (gift: GiftItem, tokenBalance: number) => void;
}

export default function GiftPicker({
  streamId, receiverId, receiverName, contextType, contextId,
  tokenBalance: initialBalance, onClose, onSent,
}: Props) {
  const [catalog, setCatalog]       = useState<GiftItem[]>([]);
  const [selected, setSelected]     = useState<GiftItem | null>(null);
  const [balance, setBalance]       = useState(initialBalance);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState(false);

  // Load catalog
  useEffect(() => {
    fetch("/api/gifts/catalog")
      .then(r => r.json())
      .then((data: GiftItem[]) => setCatalog(data))
      .catch(() => {});
  }, []);

  // Read current token balance
  useEffect(() => {
    const token = getBpToken();
    if (!token) return;
    fetch("/api/creator/wallet", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((d: { tokenBalance?: number }) => { if (d.tokenBalance !== undefined) setBalance(d.tokenBalance); })
      .catch(() => {});
  }, []);

  const handleSend = async () => {
    if (!selected) return;
    setLoading(true); setError(null);
    const rawUser = localStorage.getItem("fb_user");
    const user = rawUser ? JSON.parse(rawUser) as { name?: string; id?: number } : {};
    const token = getBpToken();
    try {
      const res = await fetch("/api/gifts/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          giftId:      selected.id,
          receiverId,
          contextType,
          contextId,
          senderName:  user.name ?? "",
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(e.error ?? "Erreur d'envoi");
      }
      const newBalance = balance - selected.tokenCost;
      setBalance(newBalance);
      setSuccess(true);
      setTimeout(() => {
        onSent(selected, newBalance);
        onClose();
      }, 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.6)", display: "flex",
        alignItems: "flex-end", justifyContent: "center",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: "100%", maxWidth: 480, background: "#1a1a2e",
        borderRadius: "20px 20px 0 0", padding: "20px 16px 36px",
        color: "#fff",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>🎁 Envoyer un cadeau</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
              à {receiverName}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Solde</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#FFD700" }}>🪙 {balance.toLocaleString()}</div>
          </div>
        </div>

        {/* Gift grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {catalog.map(g => {
            const canAfford = balance >= g.tokenCost;
            const isSelected = selected?.id === g.id;
            return (
              <button
                key={g.id}
                onClick={() => canAfford && setSelected(g)}
                style={{
                  background: isSelected ? "rgba(255,215,0,0.2)" : "rgba(255,255,255,0.07)",
                  border: isSelected ? "2px solid #FFD700" : "2px solid transparent",
                  borderRadius: 14, padding: "14px 8px", cursor: canAfford ? "pointer" : "not-allowed",
                  opacity: canAfford ? 1 : 0.45, textAlign: "center", transition: "all 0.15s",
                }}
              >
                <div style={{ fontSize: 36, lineHeight: 1 }}>{g.iconEmoji}</div>
                <div style={{ fontWeight: 700, fontSize: 13, marginTop: 6 }}>{g.name}</div>
                <div style={{ fontSize: 12, color: "#FFD700", marginTop: 2 }}>🪙 {g.tokenCost}</div>
              </button>
            );
          })}
        </div>

        {error && (
          <div style={{ background: "rgba(244,67,54,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#ff6b6b" }}>
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div style={{ background: "rgba(76,175,80,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 14, color: "#81c784", textAlign: "center", fontWeight: 700 }}>
            ✅ Cadeau envoyé !
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={!selected || loading || success}
          style={{
            width: "100%", background: selected && !loading && !success ? "#E91E8C" : "rgba(255,255,255,0.15)",
            border: "none", borderRadius: 14, padding: "14px 0",
            color: "#fff", fontWeight: 800, fontSize: 16,
            cursor: selected && !loading ? "pointer" : "not-allowed",
          }}
        >
          {loading ? "Envoi en cours…" : success ? "✅ Envoyé !" : selected ? `Envoyer ${selected.iconEmoji} ${selected.name} (🪙 ${selected.tokenCost})` : "Sélectionne un cadeau"}
        </button>

        <button onClick={onClose} style={{
          width: "100%", background: "transparent", border: "none",
          color: "rgba(255,255,255,0.5)", fontSize: 14, marginTop: 10, cursor: "pointer", padding: 8,
        }}>
          Annuler
        </button>
      </div>
    </div>
  );
}
