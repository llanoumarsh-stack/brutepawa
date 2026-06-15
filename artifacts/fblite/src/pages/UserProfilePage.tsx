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
      if (isBlocked) { await apiUnblockUser(userId); setIsBlocked(false); }
      else { await apiBlockUser(userId); setIsBlocked(true); }
    } catch { }
    setBlockLoading(false);
  };

  const handleReport = async () => {
    if (!reportReason.trim()) return;
    setReportLoading(true);
    try { await apiReportUser(userId, reportReason); setReportSent(true); setReportReason(""); }
    catch { }
    setReportLoading(false);
  };

  const handleSendRequest = async () => {
    if (!user) return;
    setActionLoading(true);
    try { await apiSendFriendRequest(user.id); setUser(u => u ? { ...u, friendshipStatus: "pending_sent" } : u); }
    catch { }
    setActionLoading(false);
  };

  const handleCancel = async () => {
    if (!user?.requestId) return;
    setActionLoading(true);
    try { await apiRejectFriendRequest(user.requestId); setUser(u => u ? { ...u, friendshipStatus: "none", requestId: undefined } : u); }
    catch { }
    setActionLoading(false);
  };

  const handleAccept = async () => {
    if (!pendingRequest) return;
    setActionLoading(true);
    try { await apiAcceptFriendRequest(pendingRequest.id); setUser(u => u ? { ...u, friendshipStatus: "friends" } : u); setPendingRequest(null); }
    catch { }
    setActionLoading(false);
  };

  const handleReject = async () => {
    if (!pendingRequest) return;
    setActionLoading(true);
    try { await apiRejectFriendRequest(pendingRequest.id); setUser(u => u ? { ...u, friendshipStatus: "none", requestId: undefined } : u); setPendingRequest(null); }
    catch { }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 44, height: 44, border: "4px solid #DCFCE7", borderTop: "4px solid #22C55E", borderRadius: "50%", margin: "0 auto 16px" }} />
          <div style={{ color: "#64748B", fontSize: 14, fontWeight: 600 }}>Chargement du profil…</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: "#F8FAFC", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 32 }}>
        <div style={{ fontSize: 56 }}>😕</div>
        <div style={{ fontWeight: 900, fontSize: 20, color: "#0D1B2A" }}>Profil introuvable</div>
        <button onClick={() => window.history.back()} style={{ background: "linear-gradient(135deg, #22C55E, #16A34A)", color: "#fff", border: "none", borderRadius: 14, padding: "12px 28px", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
          ← Retour
        </button>
      </div>
    );
  }

  const flag = user.country ? (COUNTRY_FLAGS[user.country] ?? "🌍") : "🌍";
  const name = fullName(user);
  const color = avatarColor(user.id);
  const photoCount = posts.filter(p => p.imageUrl).length + (user.avatarUrl ? 1 : 0);

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", maxWidth: 600, margin: "0 auto", position: "relative" }}>

      {/* ── STICKY HEADER ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(255,255,255,0.96)", backdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(0,0,0,0.07)",
        padding: "0 14px",
        height: 58, display: "flex", alignItems: "center", gap: 12,
      }}>
        <button
          onClick={() => window.history.back()}
          style={{ background: "#F1F5F9", border: "none", width: 40, height: 40, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0D1B2A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <span style={{ fontWeight: 900, fontSize: 17, color: "#0D1B2A", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
        <div ref={moreMenuRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => setMoreMenuOpen(v => !v)}
            disabled={blockLoading}
            style={{ background: "#F1F5F9", border: "none", width: 40, height: 40, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, letterSpacing: 1 }}
          >
            {blockLoading ? "…" : "⋯"}
          </button>
          {moreMenuOpen && (
            <div style={{
              position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 100,
              background: "#fff", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
              border: "1px solid rgba(0,0,0,0.06)", minWidth: 230, overflow: "hidden",
            }}>
              <button onClick={handleToggleBlock} style={{ display: "block", width: "100%", padding: "15px 18px", background: "none", border: "none", textAlign: "left", cursor: "pointer", fontSize: 14, fontWeight: 700, color: isBlocked ? "#22C55E" : "#EF5350" }}>
                {isBlocked ? "🔓 Débloquer cet utilisateur" : "🚫 Bloquer cet utilisateur"}
              </button>
              <div style={{ height: 1, background: "#F1F5F9" }} />
              <button onClick={() => { setMoreMenuOpen(false); setReportOpen(true); setReportSent(false); setReportReason(""); }} style={{ display: "block", width: "100%", padding: "15px 18px", background: "none", border: "none", textAlign: "left", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#EF5350" }}>
                🚩 Signaler ce profil
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── COVER ── */}
      <div style={{ height: 190, background: `linear-gradient(135deg, ${color}ee 0%, ${color}88 60%, ${color}33 100%)`, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -50, right: -50, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.1)" }} />
        <div style={{ position: "absolute", bottom: -30, right: 70, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
        <div style={{ position: "absolute", top: 14, right: 14, background: "rgba(255,255,255,0.92)", borderRadius: "50%", width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: "0 2px 12px rgba(0,0,0,0.15)" }}>
          {flag}
        </div>
        <div style={{ position: "absolute", bottom: -46, left: 20, zIndex: 5 }}>
          {user.avatarUrl
            ? <img src={user.avatarUrl} alt={name} style={{ width: 94, height: 94, borderRadius: "50%", border: "4px solid #fff", objectFit: "cover", boxShadow: "0 4px 16px rgba(0,0,0,0.18)" }} />
            : <div style={{ width: 94, height: 94, borderRadius: "50%", background: color, border: "4px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 32, boxShadow: "0 4px 16px rgba(0,0,0,0.18)" }}>{initials(user)}</div>
          }
          <div style={{ position: "absolute", bottom: 6, right: 5, width: 17, height: 17, borderRadius: "50%", background: "#22C55E", border: "2.5px solid #fff" }} />
        </div>
      </div>

      {/* ── PROFILE INFO ── */}
      <div style={{ background: "#fff", paddingTop: 58, borderBottom: "1px solid #F1F5F9" }}>
        <div style={{ padding: "0 20px 18px" }}>

          {/* Name + verified icon */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 900, fontSize: 23, color: "#0D1B2A", lineHeight: 1.2 }}>{name}</span>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="#1E88E5" stroke="none">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
          </div>

          <div style={{ fontSize: 13, color: "#8896A6", marginTop: 3 }}>@{name.toLowerCase().replace(/\s+/g, "_")}</div>

          {user.bio && <div style={{ fontSize: 14, color: "#374151", marginTop: 9, lineHeight: 1.55 }}>{user.bio}</div>}

          {user.country && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 7 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#8896A6"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>
              <span style={{ fontSize: 13, color: "#8896A6" }}>{flag} {user.country}</span>
            </div>
          )}

          {/* Badges */}
          <div style={{ display: "flex", gap: 8, marginTop: 11, flexWrap: "wrap" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#DCFCE7", borderRadius: 20, padding: "4px 12px" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
              </svg>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#16A34A" }}>Vérifié</span>
            </div>
            <div style={{ background: "linear-gradient(135deg, #22C55E, #16A34A)", borderRadius: 20, padding: "4px 12px", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#FFD700" stroke="none">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>Niveau 4</span>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", marginTop: 16, paddingTop: 16, borderTop: "1px solid #F1F5F9" }}>
            {[
              { value: posts.length.toString(), label: "Publications" },
              { value: "—", label: "Abonnés" },
              { value: "—", label: "Abonnements" },
            ].map((stat, i) => (
              <div key={i} style={{ flex: 1, textAlign: "center", borderRight: i < 2 ? "1px solid #F1F5F9" : "none" }}>
                <div style={{ fontWeight: 900, fontSize: 18, color: "#0D1B2A" }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: "#8896A6", marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            {user.friendshipStatus === "none" && !pendingRequest && (
              <button disabled={actionLoading} onClick={handleSendRequest} style={{ flex: 1, padding: "11px 8px", background: "linear-gradient(135deg, #22C55E, #16A34A)", color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: actionLoading ? 0.7 : 1 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
                </svg>
                {actionLoading ? "…" : "Ajouter"}
              </button>
            )}
            {user.friendshipStatus === "pending_sent" && (
              <button disabled={actionLoading} onClick={handleCancel} style={{ flex: 1, padding: "11px 8px", background: "#F1F5F9", color: "#374151", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                {actionLoading ? "…" : "⏳ Demande envoyée"}
              </button>
            )}
            {(user.friendshipStatus === "pending_received" || pendingRequest) && (
              <>
                <button disabled={actionLoading} onClick={handleAccept} style={{ flex: 1, padding: "11px 8px", background: "linear-gradient(135deg, #22C55E, #16A34A)", color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                  {actionLoading ? "…" : "✓ Confirmer"}
                </button>
                <button disabled={actionLoading} onClick={handleReject} style={{ flex: 1, padding: "11px 8px", background: "#F1F5F9", color: "#374151", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                  Supprimer
                </button>
              </>
            )}
            {user.friendshipStatus === "friends" && (
              <button style={{ flex: 1, padding: "11px 8px", background: "#DCFCE7", color: "#16A34A", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                Ami(e)s
              </button>
            )}
            <button onClick={() => navigate(`/messages?userId=${user.id}`)} style={{ flex: 1, padding: "11px 8px", background: "#EFF6FF", color: "#1E88E5", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1E88E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              Message
            </button>
          </div>

          {isBlocked && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "#FFF3E0", borderRadius: 10, fontSize: 13, color: "#E65100", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
              <span>🚫</span><span>Vous avez bloqué cet utilisateur.</span>
            </div>
          )}
        </div>

        {/* ── TABS ── */}
        <div style={{ display: "flex", borderTop: "1px solid #F1F5F9" }}>
          {([
            { id: "posts" as ProfileTab, label: "Publications" },
            { id: "about" as ProfileTab, label: "À propos" },
            { id: "photos" as ProfileTab, label: "Photos" },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, padding: "14px 8px",
                background: "none", border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: activeTab === tab.id ? 800 : 500,
                color: activeTab === tab.id ? "#22C55E" : "#8896A6",
                borderBottom: `2.5px solid ${activeTab === tab.id ? "#22C55E" : "transparent"}`,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ padding: "12px 12px 32px" }}>

        {/* PUBLICATIONS */}
        {activeTab === "posts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {posts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "52px 16px", background: "#fff", borderRadius: 18, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>📝</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#0D1B2A", marginBottom: 6 }}>Aucune publication</div>
                <div style={{ fontSize: 13, color: "#8896A6" }}>Cet utilisateur n'a pas encore partagé de contenu.</div>
              </div>
            ) : posts.map(post => (
              <div key={post.id} style={{ background: "#fff", borderRadius: 18, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  {user.avatarUrl
                    ? <img src={user.avatarUrl} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: "2px solid #DCFCE7" }} />
                    : <div style={{ width: 44, height: 44, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 15, border: "2px solid #DCFCE7" }}>{initials(user)}</div>
                  }
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#0D1B2A" }}>{name} {flag}</div>
                    <div style={{ fontSize: 12, color: "#8896A6", marginTop: 1 }}>🌐 {relTime(post.createdAt)}</div>
                  </div>
                </div>
                <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.6 }}>{post.content}</div>
                {post.imageUrl && (
                  <img src={post.imageUrl} alt="" style={{ width: "100%", maxHeight: 320, objectFit: "cover", borderRadius: 12, marginTop: 10 }} />
                )}
                <div style={{ display: "flex", gap: 4, marginTop: 12, paddingTop: 10, borderTop: "1px solid #F8FAFC" }}>
                  {[
                    { icon: "👍", label: `${post.likesCount}` },
                    { icon: "💬", label: `${post.commentsCount}` },
                    { icon: "↗️", label: "Partager" },
                  ].map((btn, i) => (
                    <button key={i} style={{ flex: 1, padding: "8px 4px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#64748B", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 8 }}>
                      <span>{btn.icon}</span><span>{btn.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* À PROPOS */}
        {activeTab === "about" && (
          <div style={{ background: "#fff", borderRadius: 18, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.04)" }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#0D1B2A", marginBottom: 14 }}>Informations</div>
            {[
              user.bio && { icon: "💼", label: user.bio },
              user.country && { icon: flag, label: `Habite en ${user.country}` },
            ].filter(Boolean).map((info, i, arr) => (
              <div key={i} style={{ display: "flex", gap: 12, paddingTop: i > 0 ? 12 : 0, paddingBottom: i < arr.length - 1 ? 12 : 0, borderTop: i > 0 ? "1px solid #F1F5F9" : "none" }}>
                <span style={{ fontSize: 20, width: 28, textAlign: "center" }}>{(info as {icon:string;label:string}).icon}</span>
                <span style={{ fontSize: 14, color: "#374151", lineHeight: 1.5 }}>{(info as {icon:string;label:string}).label}</span>
              </div>
            ))}
            {!user.bio && !user.country && (
              <div style={{ color: "#8896A6", fontSize: 14, textAlign: "center", padding: "20px 0" }}>Aucune information publique disponible.</div>
            )}
          </div>
        )}

        {/* PHOTOS */}
        {activeTab === "photos" && (
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#0D1B2A", marginBottom: 12 }}>Photos ({photoCount})</div>
            {photoCount === 0 ? (
              <div style={{ textAlign: "center", padding: "52px 16px", background: "#fff", borderRadius: 18, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>📷</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#0D1B2A", marginBottom: 6 }}>Aucune photo</div>
                <div style={{ fontSize: 13, color: "#8896A6" }}>Aucune photo partagée pour l'instant.</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
                {user.avatarUrl && (
                  <div style={{ aspectRatio: "1", borderRadius: 12, overflow: "hidden", border: "2.5px solid #22C55E" }}>
                    <img src={user.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                )}
                {posts.filter(p => p.imageUrl).map(p => (
                  <div key={p.id} style={{ aspectRatio: "1", borderRadius: 12, overflow: "hidden" }}>
                    <img src={p.imageUrl!} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── REPORT MODAL (bottom sheet) ── */}
      {reportOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", padding: "20px 20px 44px", width: "100%", maxWidth: 600, boxShadow: "0 -8px 32px rgba(0,0,0,0.15)" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 40, height: 4, background: "#E2E8F0", borderRadius: 2, margin: "0 auto 20px" }} />
            {reportSent ? (
              <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
                <div style={{ fontWeight: 900, fontSize: 17, color: "#0D1B2A", marginBottom: 6 }}>Signalement envoyé</div>
                <div style={{ fontSize: 14, color: "#8896A6", marginBottom: 24 }}>Notre équipe examinera ce profil dans les meilleurs délais.</div>
                <button onClick={() => setReportOpen(false)} style={{ background: "linear-gradient(135deg, #22C55E, #16A34A)", color: "#fff", border: "none", borderRadius: 14, padding: "13px 32px", fontWeight: 700, fontSize: 15, cursor: "pointer", width: "100%" }}>Fermer</button>
              </div>
            ) : (
              <>
                <div style={{ fontWeight: 900, fontSize: 17, color: "#0D1B2A", marginBottom: 4 }}>🚩 Signaler ce profil</div>
                <div style={{ fontSize: 13, color: "#8896A6", marginBottom: 16 }}>Décrivez la raison de votre signalement. Nous garderons cela confidentiel.</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  {["Contenu inapproprié", "Harcèlement ou intimidation", "Faux profil", "Spam", "Autre"].map(reason => (
                    <button key={reason} onClick={() => setReportReason(reason)} style={{ padding: "12px 16px", borderRadius: 12, border: `2px solid ${reportReason === reason ? "#22C55E" : "#E2E8F0"}`, background: reportReason === reason ? "#DCFCE7" : "#fff", cursor: "pointer", textAlign: "left", fontSize: 14, fontWeight: 600, color: reportReason === reason ? "#16A34A" : "#374151" }}>
                      {reason}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setReportOpen(false)} style={{ flex: 1, padding: 13, background: "#F1F5F9", border: "none", borderRadius: 14, fontWeight: 700, fontSize: 14, cursor: "pointer", color: "#374151" }}>Annuler</button>
                  <button onClick={handleReport} disabled={!reportReason.trim() || reportLoading} style={{ flex: 1, padding: 13, background: !reportReason.trim() ? "#E2E8F0" : "linear-gradient(135deg, #22C55E, #16A34A)", color: !reportReason.trim() ? "#8896A6" : "#fff", border: "none", borderRadius: 14, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                    {reportLoading ? "…" : "Envoyer"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
