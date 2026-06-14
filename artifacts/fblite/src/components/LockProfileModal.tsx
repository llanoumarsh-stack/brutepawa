import { useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  onClose: () => void;
  currentlyLocked: boolean;
  onToggle: (locked: boolean) => void;
}

export default function LockProfileModal({ onClose, currentlyLocked, onToggle }: Props) {
  const [locked, setLocked] = useState(currentlyLocked);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const save = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    localStorage.setItem("bp_profile_locked", locked ? "1" : "0");
    onToggle(locked);
    setSaving(false);
    setDone(true);
    setTimeout(onClose, 1500);
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 600, padding: "20px 20px 40px" }}>
        <div style={{ width: 40, height: 4, background: "#e0e0e0", borderRadius: 2, margin: "0 auto 20px" }} />

        {done ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>{locked ? "🔒" : "🔓"}</div>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>
              {locked ? "Profil verrouillé !" : "Profil déverrouillé !"}
            </div>
            <div style={{ fontSize: 14, color: "#65676b" }}>
              {locked ? "Seuls vos amis peuvent voir vos photos et publications complètes." : "Votre profil est maintenant accessible à tous."}
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: locked ? "#e7f3ff" : "#f0f2f5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>
                {locked ? "🔒" : "🔓"}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 17 }}>Verrouiller le profil</div>
                <div style={{ fontSize: 13, color: "#65676b" }}>Contrôlez qui peut voir votre profil</div>
              </div>
            </div>

            <div style={{ background: "#f0f2f5", borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>Qu'est-ce que le verrouillage du profil ?</div>
              {[
                "📷 Votre photo de profil et couverture ne peuvent pas être téléchargées",
                "📝 Vos publications ne sont visibles que par vos amis",
                "👥 Les non-amis voient une version limitée de votre profil",
                "🔍 Les détails de votre À propos sont masqués aux inconnus",
              ].map((item, i) => (
                <div key={i} style={{ fontSize: 13, color: "#050505", padding: "6px 0", borderBottom: i < 3 ? "1px solid #e4e6eb" : "none", display: "flex", gap: 8 }}>
                  {item}
                </div>
              ))}
            </div>

            {/* Toggle */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", marginBottom: 20, borderTop: "1px solid #e4e6eb", borderBottom: "1px solid #e4e6eb" }}>
              <div>
                <div style={{ fontWeight: 700 }}>{locked ? "Profil verrouillé" : "Profil non verrouillé"}</div>
                <div style={{ fontSize: 13, color: "#65676b" }}>{locked ? "Restriction active" : "Cliquer pour activer"}</div>
              </div>
              <button
                onClick={() => setLocked(l => !l)}
                style={{
                  width: 52, height: 28, borderRadius: 14, border: "none", cursor: "pointer",
                  background: locked ? "#1877F2" : "#ccc",
                  position: "relative", transition: "background 0.2s",
                }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", background: "#fff",
                  position: "absolute", top: 3, transition: "left 0.2s",
                  left: locked ? 27 : 3,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                }} />
              </button>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onClose}
                style={{ flex: 1, background: "#f0f2f5", border: "none", borderRadius: 8, padding: 13, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                Annuler
              </button>
              <button onClick={save} disabled={saving || locked === currentlyLocked}
                style={{ flex: 1, background: locked === currentlyLocked ? "#ccc" : "#1877F2", color: "#fff", border: "none", borderRadius: 8, padding: 13, fontWeight: 700, fontSize: 15, cursor: locked === currentlyLocked ? "not-allowed" : "pointer" }}>
                {saving ? "Enregistrement…" : "Confirmer"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
