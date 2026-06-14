import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "../lib/api";

interface TaggedPost {
  id: number;
  content: string;
  imageUrl: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
  createdAt: string;
}

interface Props {
  onClose: () => void;
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} j`;
}

export default function ReviewTagsModal({ onClose }: Props) {
  const [posts, setPosts] = useState<TaggedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "approved">("pending");
  const [actions, setActions] = useState<Record<number, "approved" | "rejected">>({});

  useEffect(() => {
    apiFetch("/posts?authorId=tagged")
      .then(() => {})
      .catch(() => {});
    const DEMO: TaggedPost[] = [
      {
        id: 1001,
        content: "Super soirée hier soir avec toute la team 🎉",
        imageUrl: null,
        authorName: "Kouadio Serge",
        authorAvatarUrl: null,
        createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      },
      {
        id: 1002,
        content: "Félicitations pour ton projet ! 🚀",
        imageUrl: null,
        authorName: "Aminata Diallo",
        authorAvatarUrl: null,
        createdAt: new Date(Date.now() - 86400 * 1000).toISOString(),
      },
    ];
    setTimeout(() => { setPosts(DEMO); setLoading(false); }, 600);
  }, []);

  const handleAction = (postId: number, action: "approved" | "rejected") => {
    setActions(prev => ({ ...prev, [postId]: action }));
  };

  const pending = posts.filter(p => !actions[p.id]);
  const reviewed = posts.filter(p => !!actions[p.id]);
  const displayed = tab === "pending" ? pending : reviewed;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 600, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 16px 0" }}>
          <div style={{ width: 40, height: 4, background: "#e0e0e0", borderRadius: 2, margin: "0 auto 16px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>👁️ Examiner les identifications</div>
            <button onClick={onClose} style={{ background: "#f0f2f5", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
          <div style={{ fontSize: 13, color: "#65676b", marginBottom: 14 }}>
            Gérez les publications dans lesquelles vous avez été identifié(e) avant qu'elles apparaissent sur votre profil.
          </div>
          <div style={{ display: "flex", borderBottom: "1px solid #e4e6eb" }}>
            {([["pending", `En attente (${pending.length})`], ["approved", `Examinées (${reviewed.length})`]] as const).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                style={{ flex: 1, background: "none", border: "none", padding: "10px", fontWeight: tab === id ? 700 : 400, fontSize: 14, color: tab === id ? "#1877F2" : "#65676b", borderBottom: tab === id ? "3px solid #1877F2" : "3px solid transparent", cursor: "pointer" }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {loading && (
            <div style={{ textAlign: "center", padding: 30, color: "#65676b" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>Chargement…
            </div>
          )}
          {!loading && displayed.length === 0 && (
            <div style={{ textAlign: "center", padding: 30, color: "#65676b" }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                {tab === "pending" ? "Aucune identification en attente" : "Aucune identification examinée"}
              </div>
              <div style={{ fontSize: 13 }}>
                {tab === "pending" ? "Vous êtes à jour !" : "Les publications approuvées ou refusées s'afficheront ici."}
              </div>
            </div>
          )}
          {displayed.map(post => {
            const inits = post.authorName.slice(0, 2).toUpperCase();
            const status = actions[post.id];
            return (
              <div key={post.id} style={{ background: "#f8f9fa", borderRadius: 12, padding: 14, marginBottom: 12, border: "1px solid #e4e6eb" }}>
                <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  {post.authorAvatarUrl
                    ? <img src={post.authorAvatarUrl} alt="" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover" }} />
                    : <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#1877F2", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14 }}>{inits}</div>
                  }
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{post.authorName}</div>
                    <div style={{ fontSize: 12, color: "#65676b" }}>vous a identifié(e) · {timeAgo(post.createdAt)}</div>
                  </div>
                  {status && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 10,
                      background: status === "approved" ? "#e6f4ea" : "#fff0f0",
                      color: status === "approved" ? "#2e7d32" : "#c62828",
                    }}>
                      {status === "approved" ? "✅ Approuvé" : "❌ Refusé"}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 14, marginBottom: 12, color: "#050505" }}>{post.content}</div>
                {tab === "pending" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => handleAction(post.id, "approved")}
                      style={{ flex: 1, background: "#e7f3ff", color: "#1877F2", border: "none", borderRadius: 8, padding: "9px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                      ✅ Approuver
                    </button>
                    <button onClick={() => handleAction(post.id, "rejected")}
                      style={{ flex: 1, background: "#fff0f0", color: "#c62828", border: "none", borderRadius: 8, padding: "9px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                      ❌ Refuser
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
