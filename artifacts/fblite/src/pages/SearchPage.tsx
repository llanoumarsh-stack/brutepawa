import { useState, useEffect, useRef } from "react";
import { useNavigate } from "../router";
import { apiSearchUsers, apiSendFriendRequest, PublicUserWithStatus } from "../lib/api";

const AVATAR_COLORS = ["#1877F2","#E91E63","#9C27B0","#F57C00","#388E3C","#D32F2F","#00838F","#5D4037"];

function colorForId(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

interface Props {
  q: string;
}

export default function SearchPage({ q }: Props) {
  const navigate = useNavigate();
  const [users, setUsers] = useState<PublicUserWithStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestStates, setRequestStates] = useState<Record<number, "sending" | "sent" | "friends" | "pending_sent" | "none">>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!q.trim()) {
      setUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await apiSearchUsers(q);
        setUsers(results);
        const initial: Record<number, "sending" | "sent" | "friends" | "pending_sent" | "none"> = {};
        results.forEach(u => {
          initial[u.id] = u.friendshipStatus === "friends" ? "friends"
            : u.friendshipStatus === "pending_sent" ? "pending_sent"
            : "none";
        });
        setRequestStates(initial);
      } catch {
        setUsers([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q]);

  const handleAddFriend = async (userId: number) => {
    setRequestStates(prev => ({ ...prev, [userId]: "sending" }));
    try {
      await apiSendFriendRequest(userId);
      setRequestStates(prev => ({ ...prev, [userId]: "sent" }));
    } catch {
      setRequestStates(prev => ({ ...prev, [userId]: "none" }));
    }
  };

  const initials = (u: PublicUserWithStatus) =>
    `${u.firstName[0] ?? ""}${u.lastName[0] ?? ""}`.toUpperCase();

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 12px" }}>

      {/* Header */}
      <div style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: "14px 16px", marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
          {q ? `Résultats pour « ${q} »` : "Recherche"}
        </div>
        {!q && (
          <p style={{ color: "var(--fb-text-secondary)", fontSize: 14 }}>
            Tapez un nom dans la barre de recherche ci-dessus et appuyez sur Entrée.
          </p>
        )}
      </div>

      {/* People section */}
      {(loading || users.length > 0 || (q && !loading)) && (
        <div style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--fb-divider)", fontWeight: 700, fontSize: 16 }}>
            👥 Personnes
          </div>

          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--fb-divider)" }}>
                  <div className="skeleton" style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton skeleton-text" style={{ width: "55%", height: 15, marginBottom: 6 }} />
                    <div className="skeleton skeleton-text" style={{ width: "35%", height: 12 }} />
                  </div>
                  <div className="skeleton" style={{ width: 90, height: 34, borderRadius: 6 }} />
                </div>
              ))}
            </div>
          )}

          {!loading && users.length === 0 && q && (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--fb-text-secondary)" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🔍</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Aucun résultat trouvé</div>
              <div style={{ fontSize: 13 }}>
                Aucun utilisateur ne correspond à « {q} ».<br />
                Vérifiez l'orthographe ou essayez un autre nom.
              </div>
            </div>
          )}

          {!loading && users.map((user, idx) => {
            const state = requestStates[user.id] ?? "none";
            const fullName = `${user.firstName} ${user.lastName}`;
            return (
              <div
                key={user.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  borderBottom: idx < users.length - 1 ? "1px solid var(--fb-divider)" : "none",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--fb-bg)")}
                onMouseLeave={e => (e.currentTarget.style.background = "")}
              >
                {/* Avatar */}
                <div
                  onClick={() => navigate(`/profile/${user.id}`)}
                  style={{ cursor: "pointer", flexShrink: 0 }}
                >
                  {user.avatarUrl
                    ? <img src={user.avatarUrl} alt="" style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover", display: "block" }} />
                    : (
                      <div style={{ width: 52, height: 52, borderRadius: "50%", background: colorForId(user.id), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 20 }}>
                        {initials(user)}
                      </div>
                    )
                  }
                </div>

                {/* Info */}
                <div onClick={() => navigate(`/profile/${user.id}`)} role="button" style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                  <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {fullName}
                  </div>
                  {user.country && (
                    <div style={{ fontSize: 13, color: "var(--fb-text-secondary)", marginTop: 2 }}>
                      📍 {user.country}
                    </div>
                  )}
                  {user.bio && (
                    <div style={{ fontSize: 12, color: "var(--fb-text-secondary)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {user.bio}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => navigate(`/profile/${user.id}`)}
                    style={{ padding: "8px 14px", borderRadius: 6, background: "var(--fb-bg)", border: "1px solid var(--fb-divider)", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "var(--fb-text)", transition: "background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#e4e6e9")}
                    onMouseLeave={e => (e.currentTarget.style.background = "var(--fb-bg)")}
                  >
                    Voir profil
                  </button>

                  <button
                    onClick={() => navigate(`/messages?userId=${user.id}`)}
                    style={{ padding: "8px 14px", borderRadius: 6, background: "var(--fb-bg)", border: "1px solid var(--fb-divider)", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "var(--fb-blue)", transition: "background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#e4e6e9")}
                    onMouseLeave={e => (e.currentTarget.style.background = "var(--fb-bg)")}
                    title="Envoyer un message"
                  >
                    💬
                  </button>

                  {state === "friends" && (
                    <button disabled style={{ padding: "8px 14px", borderRadius: 6, background: "#e7f3e8", border: "none", fontWeight: 600, fontSize: 13, cursor: "default", color: "#2e7d32" }}>
                      ✓ Amis
                    </button>
                  )}
                  {(state === "pending_sent" || state === "sent") && (
                    <button disabled style={{ padding: "8px 14px", borderRadius: 6, background: "var(--fb-bg)", border: "1px solid var(--fb-divider)", fontWeight: 600, fontSize: 13, cursor: "default", color: "var(--fb-text-secondary)" }}>
                      Demande envoyée
                    </button>
                  )}
                  {state === "none" && (
                    <button
                      onClick={() => handleAddFriend(user.id)}
                      style={{ padding: "8px 14px", borderRadius: 6, background: "var(--fb-blue)", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#fff", transition: "background 0.15s, transform 0.1s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--fb-blue-dark)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "var(--fb-blue)")}
                      onMouseDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
                      onMouseUp={e => (e.currentTarget.style.transform = "")}
                    >
                      + Ajouter
                    </button>
                  )}
                  {state === "sending" && (
                    <button disabled style={{ padding: "8px 14px", borderRadius: 6, background: "var(--fb-blue)", border: "none", fontWeight: 600, fontSize: 13, cursor: "default", color: "#fff", opacity: 0.7 }}>
                      ...
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
