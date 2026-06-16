import { useState, useEffect, useRef } from "react";
import { useNavigate } from "../router";
import {
  apiGetUsersWithStatus, apiGetFriendRequests, apiGetUserPosts,
  apiSendFriendRequest, apiAcceptFriendRequest, apiRejectFriendRequest,
  apiBlockUser, apiUnblockUser, apiCheckBlock, apiReportUser, apiGetUserStats,
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
function fmtCount(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

const COUNTRY_FLAGS: Record<string, string> = {
  CI:"🇨🇮",SN:"🇸🇳",BJ:"🇧🇯",TG:"🇹🇬",BF:"🇧🇫",NE:"🇳🇪",
  ML:"🇲🇱",GN:"🇬🇳",CM:"🇨🇲",TD:"🇹🇩",GA:"🇬🇦",CG:"🇨🇬",
  CD:"🇨🇩",CF:"🇨🇫",GH:"🇬🇭",
};

type ProfileTab = "posts" | "about" | "photos";

/* ── SVG ICONS ─────────────────────────────────────────── */
const IconBlock = ({ color = "#EF4444" }: { color?: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2"/>
    <path d="M6.34 17.66L17.66 6.34" stroke={color} strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const IconFlag = ({ color = "#EF4444" }: { color?: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill={color}/>
    <line x1="4" y1="22" x2="4" y2="15" stroke={color} strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const IconUnlock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="#DCFCE7" stroke="#22C55E"/>
    <path d="M7 11V7a5 5 0 019.9-1"/>
  </svg>
);
const IconGlobe = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8896A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
  </svg>
);
const IconLike = ({ active }: { active?: boolean }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill={active ? "#22C55E" : "none"} stroke={active ? "#22C55E" : "#8896A6"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3z"/>
    <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>
  </svg>
);
const IconComment = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8896A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
  </svg>
);
const IconShare = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8896A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
    <polyline points="16 6 12 2 8 6"/>
    <line x1="12" y1="2" x2="12" y2="15"/>
  </svg>
);
const IconBriefcase = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8896A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
    <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
  </svg>
);
const IconMapPin = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#8896A6">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
  </svg>
);
const IconCheck = ({ size = 15, color = "#fff" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconClock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8896A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

/* ── EMPTY STATE ILLUSTRATION ─────────────────────────── */
const EmptyPostsIllustration = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="18" y="22" width="84" height="76" rx="10" fill="#DCFCE7"/>
    <rect x="26" y="34" width="68" height="42" rx="7" fill="#F0FDF4" stroke="#22C55E" strokeWidth="1.5"/>
    <circle cx="38" cy="47" r="6" fill="#BBF7D0"/>
    <path d="M26 76l16-14 10 10 14-18 22 22H26z" fill="#86EFAC" opacity="0.7"/>
    <rect x="32" y="84" width="56" height="6" rx="3" fill="#A7F3D0"/>
    <rect x="42" y="94" width="36" height="4" rx="2" fill="#D1FAE5"/>
    <circle cx="88" cy="84" r="14" fill="#22C55E"/>
    <path d="M82 84h12M88 78v12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="30" cy="22" r="3" fill="#22C55E" opacity="0.4"/>
    <circle cx="95" cy="30" r="4" fill="#22C55E" opacity="0.25"/>
    <circle cx="20" cy="88" r="2" fill="#22C55E" opacity="0.3"/>
  </svg>
);

const EmptyPhotosIllustration = () => (
  <svg width="110" height="110" viewBox="0 0 110 110" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="20" width="90" height="70" rx="10" fill="#DCFCE7"/>
    <rect x="18" y="28" width="74" height="54" rx="7" fill="#F0FDF4" stroke="#22C55E" strokeWidth="1.5"/>
    <circle cx="36" cy="42" r="7" fill="#BBF7D0"/>
    <path d="M18 72l20-18 14 12 18-22 28 28H18z" fill="#86EFAC" opacity="0.6"/>
    <circle cx="55" cy="8" r="5" fill="#22C55E" opacity="0.3"/>
    <circle cx="95" cy="18" r="3" fill="#22C55E" opacity="0.4"/>
    <circle cx="15" cy="95" r="4" fill="#22C55E" opacity="0.2"/>
    <path d="M70 85l8-8 8 8" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
  </svg>
);

const NotFoundIllustration = () => (
  <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
    <circle cx="50" cy="50" r="40" fill="#DCFCE7"/>
    <circle cx="38" cy="42" r="5" fill="#22C55E"/>
    <circle cx="62" cy="42" r="5" fill="#22C55E"/>
    <path d="M35 62c4-6 26-6 30 0" stroke="#22C55E" strokeWidth="3" strokeLinecap="round" fill="none"/>
    <path d="M20 20l60 60M80 20L20 80" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" opacity="0.25"/>
  </svg>
);

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
  const [stats, setStats] = useState<{ postsCount: number; followersCount: number; followingCount: number } | null>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiGetUsersWithStatus(),
      apiGetUserPosts(userId),
      apiGetFriendRequests(),
      apiCheckBlock(userId),
      apiGetUserStats(userId),
    ]).then(([users, userPosts, requests, blocked, userStats]) => {
      const found = users.find(u => u.id === userId) ?? null;
      setUser(found);
      setPosts(userPosts);
      const req = requests.find(r => r.fromUser.id === userId);
      setPendingRequest(req ?? null);
      setIsBlocked(blocked);
      setStats(userStats);
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

  /* ── LOADING ── */
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#f0fdf4 0%,#fff 60%,#f0fdf4 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 48, height: 48, border: "4px solid #DCFCE7", borderTop: "4px solid #22C55E", borderRadius: "50%", margin: "0 auto 16px", animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <div style={{ color: "#64748B", fontSize: 14, fontWeight: 600 }}>Chargement du profil…</div>
        </div>
      </div>
    );
  }

  /* ── NOT FOUND ── */
  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#f0fdf4 0%,#fff 60%,#f0fdf4 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 32 }}>
        <NotFoundIllustration />
        <div style={{ fontWeight: 900, fontSize: 20, color: "#0D1B2A" }}>Profil introuvable</div>
        <div style={{ fontSize: 14, color: "#8896A6", textAlign: "center" }}>Ce profil n'existe pas ou a été supprimé.</div>
        <button onClick={() => window.history.back()} style={{ background: "linear-gradient(135deg, #22C55E, #16A34A)", color: "#fff", border: "none", borderRadius: 14, padding: "13px 32px", fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: "0 4px 16px rgba(34,197,94,0.35)" }}>
          Retour
        </button>
      </div>
    );
  }

  const flag = user.country ? (COUNTRY_FLAGS[user.country] ?? "🌍") : null;
  const name = fullName(user);
  const color = avatarColor(user.id);
  const photoCount = posts.filter(p => p.imageUrl).length + (user.avatarUrl ? 1 : 0);

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", maxWidth: 600, margin: "0 auto", position: "relative" }}>

      {/* ── STICKY HEADER ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(255,255,255,0.96)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        padding: "0 14px",
        height: 58, display: "flex", alignItems: "center", gap: 12,
      }}>
        <button
          onClick={() => window.history.back()}
          style={{ background: "#F1F5F9", border: "none", width: 40, height: 40, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.15s" }}
          onPointerDown={e => (e.currentTarget.style.background = "#E2E8F0")}
          onPointerUp={e => (e.currentTarget.style.background = "#F1F5F9")}
          onPointerLeave={e => (e.currentTarget.style.background = "#F1F5F9")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0D1B2A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <span style={{ fontWeight: 900, fontSize: 17, color: "#0D1B2A", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>

        {/* ⋮ menu */}
        <div ref={moreMenuRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => setMoreMenuOpen(v => !v)}
            disabled={blockLoading}
            style={{ background: "#F1F5F9", border: "none", width: 40, height: 40, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
            onPointerDown={e => (e.currentTarget.style.background = "#E2E8F0")}
            onPointerUp={e => (e.currentTarget.style.background = "#F1F5F9")}
            onPointerLeave={e => (e.currentTarget.style.background = "#F1F5F9")}
          >
            {blockLoading
              ? <div style={{ width: 18, height: 18, border: "2.5px solid #22C55E", borderTop: "2.5px solid transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="#374151"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
            }
          </button>

          {/* Dropdown glassmorphism */}
          {moreMenuOpen && (
            <div style={{
              position: "absolute", right: 0, top: "calc(100% + 10px)", zIndex: 200,
              background: "rgba(255,255,255,0.97)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
              borderRadius: 18, boxShadow: "0 8px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)",
              border: "1px solid rgba(255,255,255,0.8)", minWidth: 248, overflow: "hidden",
            }}>
              <button
                onClick={handleToggleBlock}
                style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "15px 18px", background: "none", border: "none", textAlign: "left", cursor: "pointer" }}
                onPointerDown={e => (e.currentTarget.style.background = "#FFF5F5")}
                onPointerUp={e => (e.currentTarget.style.background = "none")}
                onPointerLeave={e => (e.currentTarget.style.background = "none")}
              >
                <div style={{ width: 38, height: 38, borderRadius: 12, background: isBlocked ? "#F0FDF4" : "#FFF5F5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {isBlocked ? <IconUnlock /> : <IconBlock />}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: isBlocked ? "#16A34A" : "#EF4444", lineHeight: 1.3 }}>
                    {isBlocked ? "Débloquer cet utilisateur" : "Bloquer cet utilisateur"}
                  </div>
                  <div style={{ fontSize: 12, color: "#8896A6", marginTop: 2 }}>
                    {isBlocked ? "Vous reverrez ce profil" : "Vous ne verrez plus ce profil"}
                  </div>
                </div>
              </button>
              <div style={{ height: 1, background: "rgba(0,0,0,0.05)", margin: "0 14px" }} />
              <button
                onClick={() => { setMoreMenuOpen(false); setReportOpen(true); setReportSent(false); setReportReason(""); }}
                style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "15px 18px", background: "none", border: "none", textAlign: "left", cursor: "pointer" }}
                onPointerDown={e => (e.currentTarget.style.background = "#FFF5F5")}
                onPointerUp={e => (e.currentTarget.style.background = "none")}
                onPointerLeave={e => (e.currentTarget.style.background = "none")}
              >
                <div style={{ width: 38, height: 38, borderRadius: 12, background: "#FFF5F5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <IconFlag />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#EF4444", lineHeight: 1.3 }}>Signaler ce profil</div>
                  <div style={{ fontSize: 12, color: "#8896A6", marginTop: 2 }}>Signaler un contenu ou un comportement</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── COVER ── */}
      <div style={{ height: 190, background: `linear-gradient(135deg, ${color}ee 0%, ${color}88 60%, ${color}33 100%)`, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -60, right: -60, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,0.12)" }} />
        <div style={{ position: "absolute", bottom: -40, right: 60, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
        <div style={{ position: "absolute", top: 30, left: "50%", transform: "translateX(-50%)", width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
        {/* Flag circle removed from cover */}
        {/* avatar overlap */}
        <div style={{ position: "absolute", bottom: -48, left: 20, zIndex: 5 }}>
          {user.avatarUrl
            ? <img src={user.avatarUrl} alt={name} style={{ width: 96, height: 96, borderRadius: "50%", border: "4px solid #fff", objectFit: "cover", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }} />
            : <div style={{ width: 96, height: 96, borderRadius: "50%", background: color, border: "4px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 32, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>{initials(user)}</div>
          }
          <div style={{ position: "absolute", bottom: 7, right: 5, width: 18, height: 18, borderRadius: "50%", background: "#22C55E", border: "2.5px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }} />
        </div>
      </div>

      {/* ── PROFILE INFO ── */}
      <div style={{ background: "#fff", paddingTop: 62, borderBottom: "1px solid #F1F5F9" }}>
        <div style={{ padding: "0 20px 18px" }}>

          {/* Name + verified */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 900, fontSize: 23, color: "#0D1B2A", lineHeight: 1.2 }}>{name}</span>
            <img src="/badge-verified.jpg" alt="Vérifié" style={{ width: 24, height: 24, objectFit: "cover", borderRadius: "50%", flexShrink: 0 }} />
          </div>

          <div style={{ fontSize: 13, color: "#8896A6", marginTop: 3 }}>@{name.toLowerCase().replace(/\s+/g, "_")}</div>

          {user.bio && <div style={{ fontSize: 14, color: "#374151", marginTop: 9, lineHeight: 1.6 }}>{user.bio}</div>}

          {user.country && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8 }}>
              <IconMapPin />
              <span style={{ fontSize: 13, color: "#8896A6" }}>{user.country}</span>
            </div>
          )}

          {/* Badges */}
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#F0FDF4", border: "1.5px solid #22C55E", borderRadius: 20, padding: "5px 13px" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
              </svg>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: "#16A34A" }}>Vérifié</span>
            </div>
            <div style={{ background: "linear-gradient(135deg, #22C55E, #16A34A)", borderRadius: 20, padding: "5px 13px", display: "inline-flex", alignItems: "center", gap: 5, boxShadow: "0 2px 8px rgba(34,197,94,0.3)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#FFD700">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: "#fff" }}>Niveau 4</span>
            </div>
          </div>

          {/* Stats — real data */}
          <div style={{ display: "flex", marginTop: 18, paddingTop: 16, borderTop: "1px solid #F1F5F9" }}>
            {[
              { value: fmtCount(stats?.postsCount ?? posts.length), label: "Publications" },
              { value: stats ? fmtCount(stats.followersCount) : "—", label: "Abonnés" },
              { value: stats ? fmtCount(stats.followingCount) : "—", label: "Abonnements" },
            ].map((stat, i) => (
              <div key={i} style={{ flex: 1, textAlign: "center", borderRight: i < 2 ? "1px solid #F1F5F9" : "none", padding: "2px 4px" }}>
                <div style={{ fontWeight: 900, fontSize: 19, color: "#0D1B2A", lineHeight: 1.2 }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: "#8896A6", marginTop: 3, fontWeight: 500 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            {user.friendshipStatus === "none" && !pendingRequest && (
              <button disabled={actionLoading} onClick={handleSendRequest}
                style={{ flex: 1, padding: "12px 8px", background: "linear-gradient(135deg, #22C55E, #16A34A)", color: "#fff", border: "none", borderRadius: 14, fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, opacity: actionLoading ? 0.7 : 1, boxShadow: "0 4px 14px rgba(34,197,94,0.35)", transition: "transform 0.15s" }}
                onPointerDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
                onPointerUp={e => (e.currentTarget.style.transform = "scale(1)")}
                onPointerLeave={e => (e.currentTarget.style.transform = "scale(1)")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
                </svg>
                {actionLoading ? "…" : "Ajouter"}
              </button>
            )}
            {user.friendshipStatus === "pending_sent" && (
              <button disabled={actionLoading} onClick={handleCancel}
                style={{ flex: 1, padding: "12px 8px", background: "#F1F5F9", color: "#374151", border: "none", borderRadius: 14, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <IconClock />
                {actionLoading ? "…" : "Demande envoyée"}
              </button>
            )}
            {(user.friendshipStatus === "pending_received" || pendingRequest) && (
              <>
                <button disabled={actionLoading} onClick={handleAccept}
                  style={{ flex: 1, padding: "12px 8px", background: "linear-gradient(135deg, #22C55E, #16A34A)", color: "#fff", border: "none", borderRadius: 14, fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: "0 4px 14px rgba(34,197,94,0.3)" }}>
                  <IconCheck />
                  {actionLoading ? "…" : "Confirmer"}
                </button>
                <button disabled={actionLoading} onClick={handleReject}
                  style={{ flex: 1, padding: "12px 8px", background: "#F1F5F9", color: "#374151", border: "none", borderRadius: 14, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                  Supprimer
                </button>
              </>
            )}
            {user.friendshipStatus === "friends" && (
              <button style={{ flex: 1, padding: "12px 8px", background: "#F0FDF4", color: "#16A34A", border: "1.5px solid #DCFCE7", borderRadius: 14, fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <IconCheck size={16} color="#16A34A" />
                Ami(e)s
              </button>
            )}
            <button onClick={() => navigate(`/messages?userId=${user.id}`)}
              style={{ flex: 1, padding: "12px 8px", background: "#EFF6FF", color: "#1E88E5", border: "1.5px solid #DBEAFE", borderRadius: 14, fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, transition: "transform 0.15s" }}
              onPointerDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
              onPointerUp={e => (e.currentTarget.style.transform = "scale(1)")}
              onPointerLeave={e => (e.currentTarget.style.transform = "scale(1)")}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1E88E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
              Message
            </button>
          </div>

          {/* Blocked banner */}
          {isBlocked && (
            <div style={{ marginTop: 14, padding: "11px 16px", background: "#FFF3E0", borderRadius: 12, fontSize: 13, color: "#C2410C", fontWeight: 600, display: "flex", alignItems: "center", gap: 10, border: "1px solid #FED7AA" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#C2410C" strokeWidth="2"/>
                <path d="M6.34 17.66L17.66 6.34" stroke="#C2410C" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span>Vous avez bloqué cet utilisateur.</span>
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
                transition: "color 0.15s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ padding: "14px 12px 40px" }}>

        {/* PUBLICATIONS */}
        {activeTab === "posts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {posts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "52px 20px 48px", background: "#fff", borderRadius: 22, boxShadow: "0 2px 12px rgba(0,0,0,0.05)", border: "1px solid rgba(34,197,94,0.07)" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                  <EmptyPostsIllustration />
                </div>
                <div style={{ fontWeight: 800, fontSize: 17, color: "#0D1B2A", marginBottom: 8 }}>Aucune publication</div>
                <div style={{ fontSize: 13, color: "#8896A6", lineHeight: 1.6 }}>Cet utilisateur n'a pas encore partagé de contenu.</div>
              </div>
            ) : posts.map(post => (
              <div key={post.id} style={{ background: "#fff", borderRadius: 20, padding: "16px 16px 12px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  {user.avatarUrl
                    ? <img src={user.avatarUrl} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: "2px solid #DCFCE7" }} />
                    : <div style={{ width: 44, height: 44, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 15, border: "2px solid #DCFCE7", flexShrink: 0 }}>{initials(user)}</div>
                  }
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#0D1B2A" }}>{name}</div>
                    <div style={{ fontSize: 12, color: "#8896A6", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                      <IconGlobe />
                      {relTime(post.createdAt)}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 14.5, color: "#374151", lineHeight: 1.65 }}>{post.content}</div>
                {post.imageUrl && (
                  <img src={post.imageUrl} alt="" style={{ width: "100%", maxHeight: 320, objectFit: "cover", borderRadius: 14, marginTop: 12 }} />
                )}
                <div style={{ display: "flex", gap: 2, marginTop: 12, paddingTop: 10, borderTop: "1px solid #F8FAFC" }}>
                  {[
                    { icon: <IconLike />, label: `${post.likesCount}`, suffix: "J'aime" },
                    { icon: <IconComment />, label: `${post.commentsCount}`, suffix: "Commenter" },
                    { icon: <IconShare />, label: "", suffix: "Partager" },
                  ].map((btn, i) => (
                    <button key={i} style={{ flex: 1, padding: "8px 4px", background: "none", border: "none", cursor: "pointer", fontWeight: 600, color: "#64748B", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 10, fontSize: 12.5 }}
                      onPointerDown={e => (e.currentTarget.style.background = "#F8FAFC")}
                      onPointerUp={e => (e.currentTarget.style.background = "none")}
                      onPointerLeave={e => (e.currentTarget.style.background = "none")}
                    >
                      {btn.icon}
                      <span>{btn.label ? `${btn.label} ` : ""}{btn.suffix}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* À PROPOS */}
        {activeTab === "about" && (
          <div style={{ background: "#fff", borderRadius: 20, padding: "18px 20px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.04)" }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#0D1B2A", marginBottom: 16 }}>Informations</div>
            {(() => {
              const rows = [
                user.bio && { icon: <IconBriefcase />, label: user.bio },
                user.country && { icon: <IconMapPin />, label: `Habite en ${user.country}` },
              ].filter(Boolean) as { icon: React.ReactNode; label: string }[];
              if (rows.length === 0) return (
                <div style={{ color: "#8896A6", fontSize: 14, textAlign: "center", padding: "20px 0" }}>Aucune information publique disponible.</div>
              );
              return rows.map((info, i) => (
                <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", paddingTop: i > 0 ? 14 : 0, paddingBottom: i < rows.length - 1 ? 14 : 0, borderTop: i > 0 ? "1px solid #F1F5F9" : "none" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {info.icon}
                  </div>
                  <span style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, paddingTop: 8 }}>{info.label}</span>
                </div>
              ));
            })()}
          </div>
        )}

        {/* PHOTOS */}
        {activeTab === "photos" && (
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#0D1B2A", marginBottom: 12, paddingLeft: 4 }}>Photos ({photoCount})</div>
            {photoCount === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px 44px", background: "#fff", borderRadius: 22, boxShadow: "0 2px 12px rgba(0,0,0,0.05)", border: "1px solid rgba(34,197,94,0.07)" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                  <EmptyPhotosIllustration />
                </div>
                <div style={{ fontWeight: 800, fontSize: 17, color: "#0D1B2A", marginBottom: 8 }}>Aucune photo</div>
                <div style={{ fontSize: 13, color: "#8896A6" }}>Aucune photo partagée pour l'instant.</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5 }}>
                {user.avatarUrl && (
                  <div style={{ aspectRatio: "1", borderRadius: 14, overflow: "hidden", border: "2.5px solid #22C55E", boxShadow: "0 2px 8px rgba(34,197,94,0.2)" }}>
                    <img src={user.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                )}
                {posts.filter(p => p.imageUrl).map(p => (
                  <div key={p.id} style={{ aspectRatio: "1", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
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
        <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setReportOpen(false)}
        >
          <div style={{ background: "#fff", borderRadius: "26px 26px 0 0", padding: "20px 20px 48px", width: "100%", maxWidth: 600, boxShadow: "0 -8px 40px rgba(0,0,0,0.18)" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 40, height: 4, background: "#E2E8F0", borderRadius: 2, margin: "0 auto 22px" }} />
            {reportSent ? (
              <div style={{ textAlign: "center", padding: "8px 0 20px" }}>
                <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#DCFCE7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <div style={{ fontWeight: 900, fontSize: 18, color: "#0D1B2A", marginBottom: 8 }}>Signalement envoyé</div>
                <div style={{ fontSize: 14, color: "#8896A6", marginBottom: 28, lineHeight: 1.6 }}>Notre équipe examinera ce profil dans les meilleurs délais.</div>
                <button onClick={() => setReportOpen(false)} style={{ background: "linear-gradient(135deg, #22C55E, #16A34A)", color: "#fff", border: "none", borderRadius: 14, padding: "13px 32px", fontWeight: 700, fontSize: 15, cursor: "pointer", width: "100%", boxShadow: "0 4px 14px rgba(34,197,94,0.3)" }}>Fermer</button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "#FFF5F5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <IconFlag />
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 17, color: "#0D1B2A" }}>Signaler ce profil</div>
                </div>
                <div style={{ fontSize: 13, color: "#8896A6", marginBottom: 18, paddingLeft: 52 }}>Décrivez la raison de votre signalement. Nous garderons cela confidentiel.</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                  {["Contenu inapproprié", "Harcèlement ou intimidation", "Faux profil", "Spam", "Autre"].map(reason => (
                    <button key={reason} onClick={() => setReportReason(reason)} style={{ padding: "13px 16px", borderRadius: 14, border: `2px solid ${reportReason === reason ? "#22C55E" : "#E2E8F0"}`, background: reportReason === reason ? "#F0FDF4" : "#fff", cursor: "pointer", textAlign: "left", fontSize: 14, fontWeight: 600, color: reportReason === reason ? "#16A34A" : "#374151", display: "flex", alignItems: "center", gap: 10, transition: "all 0.15s" }}>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${reportReason === reason ? "#22C55E" : "#D1D5DB"}`, background: reportReason === reason ? "#22C55E" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                        {reportReason === reason && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                      {reason}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setReportOpen(false)} style={{ flex: 1, padding: 14, background: "#F1F5F9", border: "none", borderRadius: 14, fontWeight: 700, fontSize: 14, cursor: "pointer", color: "#374151" }}>Annuler</button>
                  <button onClick={handleReport} disabled={!reportReason.trim() || reportLoading} style={{ flex: 2, padding: 14, background: !reportReason.trim() ? "#E2E8F0" : "linear-gradient(135deg, #22C55E, #16A34A)", color: !reportReason.trim() ? "#8896A6" : "#fff", border: "none", borderRadius: 14, fontWeight: 700, fontSize: 14, cursor: !reportReason.trim() ? "default" : "pointer", boxShadow: reportReason.trim() ? "0 4px 14px rgba(34,197,94,0.3)" : "none", transition: "all 0.2s" }}>
                    {reportLoading ? "Envoi…" : "Envoyer"}
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
