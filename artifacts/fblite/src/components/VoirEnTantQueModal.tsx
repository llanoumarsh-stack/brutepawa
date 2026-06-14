import { createPortal } from "react-dom";

interface Props {
  onClose: () => void;
  userName: string;
  avatarUrl?: string;
  bio?: string;
  country?: string;
  flag?: string;
  friendsCount: number;
  postsCount: number;
}

export default function VoirEnTantQueModal({ onClose, userName, avatarUrl, bio, country, flag, friendsCount, postsCount }: Props) {
  const userInitials = userName.slice(0, 2).toUpperCase();

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, overflowY: "auto" }}>
      <div style={{ maxWidth: 600, margin: "0 auto", minHeight: "100vh", background: "#f0f2f5", position: "relative" }}>
        {/* Banner */}
        <div style={{ background: "#1877F2", color: "#fff", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: 34, height: 34, color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Voir en tant que</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>Aperçu tel que vos visiteurs vous voient</div>
          </div>
        </div>

        <div style={{ background: "#fff2cc", borderLeft: "4px solid #f0ad00", padding: "10px 16px", fontSize: 13, color: "#7a5c00" }}>
          ⚠️ Ceci est un aperçu. Seules les informations publiques sont affichées.
        </div>

        {/* Cover */}
        <div style={{ height: 160, background: "linear-gradient(135deg, #1877F2, #42b0ff)", position: "relative" }}>
          {/* Avatar overlapping */}
          <div style={{ position: "absolute", bottom: -40, left: 16 }}>
            {avatarUrl
              ? <img src={avatarUrl} alt={userName} style={{ width: 80, height: 80, borderRadius: "50%", border: "4px solid #fff", objectFit: "cover" }} />
              : <div style={{ width: 80, height: 80, borderRadius: "50%", border: "4px solid #fff", background: "#1877F2", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 26 }}>{userInitials}</div>
            }
          </div>
        </div>

        {/* Profile info */}
        <div style={{ background: "#fff", paddingTop: 52, paddingBottom: 16, paddingLeft: 16, paddingRight: 16, borderBottom: "1px solid #e4e6eb" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 20, display: "flex", alignItems: "center", gap: 6 }}>
                {userName}
                {flag && <span style={{ fontSize: 18 }}>{flag}</span>}
                <span style={{ color: "#1877F2", fontSize: 14 }}>✔️</span>
              </div>
              {bio && <div style={{ fontSize: 14, color: "#65676b", marginTop: 4 }}>{bio}</div>}
              {country && <div style={{ fontSize: 13, color: "#65676b", marginTop: 4 }}>📍 {country}</div>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 24, marginTop: 12 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>{friendsCount}</div>
              <div style={{ fontSize: 12, color: "#65676b" }}>Amis</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>{postsCount}</div>
              <div style={{ fontSize: 12, color: "#65676b" }}>Publications</div>
            </div>
          </div>
          {/* Visitor sees these buttons */}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <div style={{ flex: 1, background: "#e7f3ff", borderRadius: 8, padding: "9px", textAlign: "center", fontWeight: 700, color: "#1877F2", fontSize: 14 }}>👥 Ajouter</div>
            <div style={{ flex: 1, background: "#f0f2f5", borderRadius: 8, padding: "9px", textAlign: "center", fontWeight: 700, color: "#050505", fontSize: 14 }}>💬 Message</div>
          </div>
        </div>

        {/* Tabs (read-only view) */}
        <div style={{ background: "#fff", borderBottom: "1px solid #e4e6eb", display: "flex" }}>
          {["Publications", "À propos", "Amis", "Photos"].map((t, i) => (
            <button key={t} style={{ flex: 1, background: "none", border: "none", padding: "12px 4px", fontSize: 13, fontWeight: i === 0 ? 700 : 400, color: i === 0 ? "#1877F2" : "#65676b", borderBottom: i === 0 ? "3px solid #1877F2" : "3px solid transparent", cursor: "default" }}>
              {t}
            </button>
          ))}
        </div>

        <div style={{ padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e4e6eb", padding: 20, textAlign: "center", color: "#65676b", fontSize: 14 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🔒</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Publications visibles par vos amis uniquement</div>
            <div style={{ fontSize: 13 }}>Les visiteurs qui ne sont pas vos amis voient cette vue.</div>
          </div>
        </div>

        <div style={{ padding: "0 16px 32px" }}>
          <button onClick={onClose}
            style={{ width: "100%", background: "#1877F2", color: "#fff", border: "none", borderRadius: 8, padding: 13, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
            Quitter l'aperçu
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
