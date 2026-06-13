import { useState, useEffect, useRef } from "react";
import { useNavigate } from "../router";
import {
  apiGetUsersWithStatus, apiGetFriendRequests, apiGetUserPosts,
  apiSendFriendRequest, apiAcceptFriendRequest, apiRejectFriendRequest,
  apiBlockUser, apiUnblockUser, apiCheckBlock, apiReportUser,
  type PublicUserWithStatus, type FriendRequest, type FeedPost,
} from "../lib/api";

const AVATAR_COLORS = ["#1877F2","#E91E63","#9C27B0","#FF9800","#4CAF50","#00BCD4","#F44336","#3F51B5"];
function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }
function fullName(u: { firstName: string; lastName: string }) { return `${u.firstName} ${u.lastName}`.trim(); }
function initials(u: { firstName: string; lastName: string }) {
  return ((u.firstName?.[0] ?? "") + (u.lastName?.[0] ?? "")).toUpperCase() || "??";
}
function relTime(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60) return "À l'instant";
  if (d < 3600) return `Il y a ${Math.floor(d / 60)} min`;
  if (d < 86400) return `Il y a ${Math.floor(d / 3600)} h`;
  return `Il y a ${Math.floor(d / 86400)} j`;
}

const COUNTRY_FLAGS: Record<string, string> = {
  CI:"🇨🇮",SN:"🇸🇳",BJ:"🇧🇯",TG:"🇹🇬",BF:"🇧🇫",NE:"🇳🇪",
  ML:"🇲🇱",GN:"🇬🇳",CM:"🇨🇲",TD:"🇹🇩",GA:"🇬🇦",CG:"🇨🇬",
  CD:"🇨🇩",CF:"🇨🇫",GH:"🇬🇭",
};

type ProfileTab = "posts" | "about" | "photos";

export default function UserProfilePage({ userId }: { userId: number }) {
  const navigate = useNavigate();

  const [user, setUser] = useState<PublicUserWithStatus | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<FriendRequest | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");

  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiGetUsersWithStatus(),
      apiGetUserPosts(userId),
      apiGetFriendRequests(),
      apiCheckBlock(userId),
    ]).then(([users, userPosts, requests, blocked]) => {
      const found = users.find(u => u.id === userId) ?? null;
      setUser(found);
      setPosts(userPosts);
      const req = requests.find(r => r.fromUser.id === userId);
      setPendingRequest(req ?? null);
      setIsBlocked(blocked);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    if (!moreMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [moreMenuOpen]);

  const handleToggleBlock = async () => {
    setMoreMenuOpen(false);
    setBlockLoading(true);
    try {
      if (isBlocked) {
        await apiUnblockUser(userId);
        setIsBlocked(false);
      } else {
        await apiBlockUser(userId);
        setIsBlocked(true);
      }
    } catch { /* ignore */ }
    setBlockLoading(false);
  };

  const handleReport = async () => {
    if (!reportReason.trim()) return;
    setReportLoading(true);
    try {
      await apiReportUser(userId, reportReason);
      setReportSent(true);
      setReportReason("");
    } catch { /* ignore */ }
    setReportLoading(false);
  };

  const handleSendRequest = async () => {
    if (!user) return;
    setActionLoading(true);
    try {
      await apiSendFriendRequest(user.id);
      setUser(u => u ? { ...u, friendshipStatus: "pending_sent" } : u);
    } catch { /* ignore */ }
    setActionLoading(false);
  };

  const handleCancel = async () => {
    if (!user?.requestId) return;
    setActionLoading(true);
    try {
      await apiRejectFriendRequest(user.requestId);
      setUser(u => u ? { ...u, friendshipStatus: "none", requestId: undefined } : u);
    } catch { /* ignore */ }
    setActionLoading(false);
  };

  const handleAccept = async () => {
    if (!pendingRequest) return;
    setActionLoading(true);
    try {
      await apiAcceptFriendRequest(pendingRequest.id);
      setUser(u => u ? { ...u, friendshipStatus: "friends" } : u);
      setPendingRequest(null);
    } catch { /* ignore */ }
    setActionLoading(false);
  };

  const handleReject = async () => {
    if (!pendingRequest) return;
    setActionLoading(true);
    try {
      await apiRejectFriendRequest(pendingRequest.id);
      setUser(u => u ? { ...u, friendshipStatus: "none", requestId: undefined } : u);
      setPendingRequest(null);
    } catch { /* ignore */ }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 80 }}>
        <div style={{ color: "var(--fb-text-secondary)", fontSize: 15 }}>Chargement du profil…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 80, gap: 16 }}>
        <div style={{ fontSize: 48 }}>😕</div>
        <div style={{ fontWeight: 700, fontSize: 17 }}>Profil introuvable</div>
        <button onClick={() => navigate("/community")} className="btn-primary" style={{ width: "auto", padding: "10px 20px" }}>Retour</button>
      </div>
    );
  }

  const flag = user.country ? (COUNTRY_FLAGS[user.country] ?? "🌍") : "🌍";
  const name = fullName(user);
  const color = avatarColor(user.id);
  const photoCount = posts.filter(p => p.imageUrl).length + (user.avatarUrl ? 1 : 0);

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", paddingBottom: 20 }}>
      {/* Back bar */}
      <div style={{ background: "var(--fb-white)", padding: "10px 16px", borderBottom: "1px solid var(--fb-divider)", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => window.history.back()} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--fb-blue)" }}>←</button>
        <span style={{ fontWeight: 700, fontSize: 17, flex: 1 }}>{name}</span>
      </div>

      {/* Cover */}
      <div style={{ height: 160, background: `linear-gradient(135deg, ${color}cc, ${color}55)`, position: "relative" }}>
        <div style={{ position: "absolute", top: 12, right: 12, fontSize: 28, background: "rgba(255,255,255,0.9)", borderRadius: "50%", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
          {flag}
        </div>

        {/* Avatar */}
        <div style={{ position: "absolute", bottom: -40, left: 16, zIndex: 2 }}>
          {user.avatarUrl
            ? <img src={user.avatarUrl} alt={name} style={{ width: 86, height: 86, borderRadius: "50%", border: "4px solid #fff", objectFit: "cover", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }} />
            : <div style={{ width: 86, height: 86, borderRadius: "50%", background: color, border: "4px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 28, boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>{initials(user)}</div>
          }
        </div>
      </div>

      {/* Profile info */}
      <div style={{ background: "var(--fb-white)", paddingTop: 52, paddingBottom: 16, borderBottom: "1px solid var(--fb-divider)" }}>
        <div style={{ padding: "0 16px" }}>
          <div style={{ fontWeight: 800, fontSize: 22, lineHeight: 1.2 }}>{name}</div>
          {user.bio && <div style={{ fontSize: 14, color: "var(--fb-text-secondary)", marginTop: 4 }}>{user.bio}</div>}
          {user.country && <div style={{ fontSize: 13, color: "var(--fb-text-secondary)", marginTop: 4 }}>📍 {user.country}</div>}

          {/* Stats */}
          <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
            {[
              { label: "Publications", value: posts.length },
              { label: "Photos", value: photoCount },
            ].map(s => (
              <div key={s.label}>
                <span style={{ fontWeight: 900, fontSize: 18 }}>{s.value}</span>
                <span style={{ fontSize: 12, color: "var(--fb-text-secondary)", marginLeft: 4 }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            {user.friendshipStatus === "none" && !pendingRequest && (
              <button className="btn-primary" style={{ flex: 1, padding: 10 }} disabled={actionLoading} onClick={handleSendRequest}>
                {actionLoading ? "…" : "👤 + Ajouter en ami"}
              </button>
            )}
            {user.friendshipStatus === "pending_sent" && (
              <button style={{ flex: 1, padding: 10, background: "var(--fb-divider)", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }} disabled={actionLoading} onClick={handleCancel}>
                {actionLoading ? "…" : "⏳ Demande envoyée"}
              </button>
            )}
            {(user.friendshipStatus === "pending_received" || pendingRequest) && (
              <>
                <button className="btn-primary" style={{ flex: 1, padding: 10 }} disabled={actionLoading} onClick={handleAccept}>
                  {actionLoading ? "…" : "✓ Confirmer"}
                </button>
                <button style={{ flex: 1, padding: 10, background: "var(--fb-divider)", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }} disabled={actionLoading} onClick={handleReject}>
                  Supprimer
                </button>
              </>
            )}
            {user.friendshipStatus === "friends" && (
              <button style={{ flex: 1, padding: 10, background: "var(--fb-divider)", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", color: "var(--fb-blue)" }}>
                ✓ Ami(e)s
              </button>
            )}
            <button
              style={{ flex: 1, padding: 10, background: "var(--fb-divider)", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
              onClick={() => navigate(`/messages?userId=${user.id}`)}
            >
              💬 Message
            </button>
            {/* More menu */}
            <div ref={moreMenuRef} style={{ position: "relative" }}>
              <button
                onClick={() => setMoreMenuOpen(v => !v)}
                disabled={blockLoading}
                style={{ padding: "10px 14px", background: "var(--fb-divider)", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 18, lineHeight: 1 }}
                title="Plus d'options"
              >
                {blockLoading ? "…" : "⋯"}
              </button>
              {moreMenuOpen && (
                <div style={{
                  position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 100,
                  background: "var(--fb-white)", borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
                  border: "1px solid var(--fb-divider)", minWidth: 210, overflow: "hidden",
                }}>
                  <button
                    onClick={handleToggleBlock}
                    style={{ display: "block", width: "100%", padding: "13px 16px", background: "none", border: "none", textAlign: "left", cursor: "pointer", fontSize: 14, fontWeight: 600, color: isBlocked ? "var(--fb-blue)" : "#E53935" }}
                  >
                    {isBlocked ? "🔓 Débloquer cet utilisateur" : "🚫 Bloquer cet utilisateur"}
                  </button>
                  <div style={{ height: 1, background: "var(--fb-divider)" }} />
                  <button
                    onClick={() => { setMoreMenuOpen(false); setReportOpen(true); setReportSent(false); setReportReason(""); }}
                    style={{ display: "block", width: "100%", padding: "13px 16px", background: "none", border: "none", textAlign: "left", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#E53935" }}
                  >
                    🚩 Signaler ce profil
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Block confirmation banner */}
          {isBlocked && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: "#FFF3E0", borderRadius: 8, fontSize: 13, color: "#E65100", fontWeight: 600 }}>
              🚫 Vous avez bloqué cet utilisateur. Il ne peut plus vous envoyer de messages.
            </div>
          )}
        </div>

        {/* Profile tabs */}
        <div className="profile-tabs" style={{ marginTop: 16 }}>
          {([
            { id: "posts" as ProfileTab, label: "Publications" },
            { id: "about" as ProfileTab, label: "À propos" },
            { id: "photos" as ProfileTab, label: "Photos" },
          ]).map(tab => (
            <button key={tab.id} className={`profile-tab${activeTab === tab.id ? " active" : ""}`} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Report modal */}
      {reportOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--fb-white)", borderRadius: 14, padding: 24, width: "100%", maxWidth: 380, boxShadow: "0 8px 32px rgba(0,0,0,0.25)" }}>
            {reportSent ? (
              <>
                <div style={{ textAlign: "center", fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ fontWeight: 700, fontSize: 16, textAlign: "center", marginBottom: 8 }}>Signalement envoyé</div>
                <div style={{ fontSize: 14, color: "var(--fb-text-secondary)", textAlign: "center", marginBottom: 20 }}>
                  Merci. Notre équipe examinera ce profil dans les meilleurs délais.
                </div>
                <button
                  onClick={() => setReportOpen(false)}
                  className="btn-primary"
                  style={{ width: "100%", padding: 11 }}
                >
                  Fermer
                </button>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>🚩 Signaler ce profil</div>
                <div style={{ fontSize: 13, color: "var(--fb-text-secondary)", marginBottom: 14 }}>
                  Décrivez la raison de votre signalement. Nous garderons cela confidentiel.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                  {["Contenu inapproprié", "Harcèlement ou intimidation", "Faux profil", "Spam", "Autre"].map(reason => (
                    <button
                      key={reason}
                      onClick={() => setReportReason(reason)}
                      style={{
                        padding: "9px 14px", borderRadius: 8, border: `1.5px solid ${reportReason === reason ? "var(--fb-blue)" : "var(--fb-divider)"}`,
                        background: reportReason === reason ? "#E8F0FE" : "none", cursor: "pointer", textAlign: "left", fontSize: 14, fontWeight: 600,
                        color: reportReason === reason ? "var(--fb-blue)" : "var(--fb-text)",
                      }}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setReportOpen(false)}
                    style={{ flex: 1, padding: 11, background: "var(--fb-divider)", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleReport}
                    disabled={!reportReason.trim() || reportLoading}
                    className="btn-primary"
                    style={{ flex: 1, padding: 11, opacity: !reportReason.trim() ? 0.5 : 1 }}
                  >
                    {reportLoading ? "…" : "Envoyer"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div style={{ padding: "12px" }}>
        {/* PUBLICATIONS */}
        {activeTab === "posts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {posts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--fb-text-secondary)" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
                <div>Aucune publication pour l'instant</div>
              </div>
            ) : posts.map(post => (
              <div key={post.id} className="post-card">
                <div className="post-header">
                  {user.avatarUrl
                    ? <img src={user.avatarUrl} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                    : <div className="avatar" style={{ background: color, flexShrink: 0 }}>{initials(user)}</div>
                  }
                  <div className="post-meta">
                    <div className="post-author">{name} {flag}</div>
                    <div className="post-time">🌐 {relTime(post.createdAt)}</div>
                  </div>
                </div>
                <div className="post-content">{post.content}</div>
                {post.imageUrl && (
                  <img src={post.imageUrl} alt="" style={{ width: "100%", maxHeight: 300, objectFit: "cover", borderRadius: 8, marginTop: 8 }} />
                )}
                <div className="post-actions">
                  <button className="post-btn">👍 {post.likesCount}</button>
                  <button className="post-btn">💬 {post.commentsCount}</button>
                  <button className="post-btn">↗️ Partager</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* À PROPOS */}
        {activeTab === "about" && (
          <div style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Informations</div>
            {[
              user.bio && { icon: "💼", label: user.bio },
              user.country && { icon: flag, label: `Habite en ${user.country}` },
            ].filter(Boolean).map((info, i) => (
              <div key={i} style={{ display: "flex", gap: 12, paddingTop: i > 0 ? 10 : 0, borderTop: i > 0 ? "1px solid var(--fb-divider)" : "none" }}>
                <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>{(info as {icon:string;label:string}).icon}</span>
                <span style={{ fontSize: 14, color: "var(--fb-text)" }}>{(info as {icon:string;label:string}).label}</span>
              </div>
            ))}
            {!user.bio && !user.country && (
              <div style={{ color: "var(--fb-text-secondary)", fontSize: 14 }}>Aucune information publique disponible.</div>
            )}
          </div>
        )}

        {/* PHOTOS */}
        {activeTab === "photos" && (
          <>
            <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 15 }}>Photos ({photoCount})</div>
            {photoCount === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 16px", color: "var(--fb-text-secondary)" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📷</div>
                <div>Aucune photo pour l'instant</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3 }}>
                {user.avatarUrl && (
                  <div style={{ aspectRatio: "1", borderRadius: 4, overflow: "hidden", border: "2px solid var(--fb-blue)" }}>
                    <img src={user.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                )}
                {posts.filter(p => p.imageUrl).map(p => (
                  <div key={p.id} style={{ aspectRatio: "1", borderRadius: 4, overflow: "hidden" }}>
                    <img src={p.imageUrl!} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
