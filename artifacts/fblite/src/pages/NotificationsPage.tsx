import { useState, useEffect } from "react";
import { useNavigate } from "../router";
import { apiGetNotifications, apiMarkAllNotificationsRead, type ApiNotification } from "../lib/api";

/* Reaction badge colours per notification type — matches FB Lite exactly */
const TYPE_BADGE: Record<string, { bg: string; icon: string }> = {
  like:    { bg: "#1877F2", icon: "👍" },
  love:    { bg: "#F33E58", icon: "❤️" },
  haha:    { bg: "#F7B125", icon: "😆" },
  wow:     { bg: "#F7B125", icon: "😮" },
  sad:     { bg: "#748FD5", icon: "😢" },
  angry:   { bg: "#E9710F", icon: "😡" },
  comment: { bg: "#1877F2", icon: "💬" },
  friend:  { bg: "#42B72A", icon: "👥" },
  message: { bg: "#00BFA5", icon: "✉️" },
  job:     { bg: "#FF9800", icon: "💼" },
  tontine: { bg: "#4CAF50", icon: "💰" },
  group:   { bg: "#1565C0", icon: "🏘️" },
  system:  { bg: "#FF6D00", icon: "⭐" },
  verify:  { bg: "#4CAF50", icon: "✅" },
};

const AVATAR_COLORS = ["#1877F2","#E91E63","#9C27B0","#F57C00","#388E3C","#212121","#D32F2F","#00838F"];

function avatarBg(name: string | null) {
  if (!name) return AVATAR_COLORS[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function actorInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60)    return `Il y a ${secs} seconde${secs !== 1 ? "s" : ""}`;
  const mins = Math.floor(secs / 60);
  if (mins < 60)    return `Il y a ${mins} minute${mins !== 1 ? "s" : ""}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24)   return `Il y a ${hours} heure${hours !== 1 ? "s" : ""}`;
  const days = Math.floor(hours / 24);
  if (days < 7)     return `Il y a ${days} jour${days !== 1 ? "s" : ""}`;
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "long" });
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifs, setNotifs]   = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiGetNotifications()
      .then(data => setNotifs(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const markAllRead = async () => {
    setNotifs(ns => ns.map(n => ({ ...n, isRead: true })));
    await apiMarkAllNotificationsRead().catch(() => {});
  };

  const markRead = (id: number, link?: string | null) => {
    setNotifs(ns => ns.map(n => n.id === id ? { ...n, isRead: true } : n));
    if (link) navigate(link);
  };

  const unread  = notifs.filter(n => !n.isRead);
  const read    = notifs.filter(n =>  n.isRead);
  const hasAny  = notifs.length > 0;

  function NotifItem({ notif }: { notif: ApiNotification }) {
    const badge  = TYPE_BADGE[notif.type] ?? TYPE_BADGE["system"];
    const initials = actorInitials(notif.actorName);
    const bg     = avatarBg(notif.actorName);
    return (
      <div
        onClick={() => markRead(notif.id, notif.link)}
        style={{
          display: "flex", alignItems: "flex-start", gap: 12,
          padding: "10px 14px",
          background: notif.isRead ? "#fff" : "#EBF5FF",
          cursor: "pointer",
        }}
      >
        {/* Avatar + badge */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            background: bg, overflow: "hidden",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>{initials}</span>
          </div>
          {/* Reaction badge — bottom-right of avatar */}
          <div style={{
            position: "absolute", bottom: -1, right: -2,
            width: 22, height: 22, borderRadius: "50%",
            background: badge.bg,
            border: "2px solid #fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, lineHeight: 1,
          }}>
            {badge.icon}
          </div>
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, lineHeight: 1.45, color: "#050505" }}>
            {notif.actorName && <strong>{notif.actorName} </strong>}
            <span style={{ fontWeight: 400 }}>{notif.action}</span>
            {notif.detail && (
              <span style={{ color: "#65676b", fontWeight: 400 }}>
                {" "}: «{notif.detail}»
              </span>
            )}
          </div>
          <div style={{
            marginTop: 4, fontSize: 13,
            color: notif.isRead ? "#65676b" : "#1877F2",
            fontWeight: notif.isRead ? 400 : 600,
          }}>
            {timeAgo(notif.createdAt)}
          </div>
        </div>

        {/* ··· menu */}
        <button
          onClick={e => e.stopPropagation()}
          style={{
            background: "none", border: "none", cursor: "pointer",
            width: 32, height: 32, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#65676b", fontSize: 18, fontWeight: 700, flexShrink: 0,
          }}
        >···</button>
      </div>
    );
  }

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100vh" }}>

      {/* ── Sub-header ── */}
      <div style={{
        background: "#fff", display: "flex", alignItems: "center",
        padding: "10px 14px", gap: 10,
        borderBottom: "1px solid #e4e6eb",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <button
          onClick={() => navigate(-1 as unknown as string)}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#050505", padding: "0 4px 0 0", lineHeight: 1, fontWeight: 300 }}
        >
          ‹
        </button>
        <div style={{ flex: 1, fontWeight: 800, fontSize: 20, color: "#050505", lineHeight: 1 }}>
          Notifications
        </div>
        {/* Mark-all-read button — black circle with checkmark */}
        <button
          onClick={markAllRead}
          title="Tout marquer comme lu"
          style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "#050505", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {/* Search button */}
        <button
          onClick={() => navigate("/search")}
          style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "#e4e6eb", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 17,
          }}
        >
          🔍
        </button>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#65676b" }}>
          <div style={{ width: 28, height: 28, border: "3px solid #e4e6eb", borderTopColor: "#1877F2", borderRadius: "50%", animation: "fb-spin .7s linear infinite", margin: "0 auto 10px" }} />
          Chargement…
          <style>{`@keyframes fb-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !hasAny && (
        <div style={{ background: "#fff", textAlign: "center", padding: "60px 20px" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#e4e6eb", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", position: "relative" }}>
            <span style={{ fontSize: 36 }}>🔔</span>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "4px solid #E41E3F", clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)" }} />
            <div style={{ position: "absolute", top: "50%", left: "50%", width: "120%", height: 4, background: "#E41E3F", transform: "translate(-50%, -50%) rotate(-45deg)", borderRadius: 2 }} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#050505", marginBottom: 4 }}>Aucune notification</div>
          <div style={{ fontSize: 14, color: "#65676b" }}>Vous êtes à jour !</div>
        </div>
      )}

      {/* ── Nouveau (unread) ── */}
      {!loading && unread.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ background: "#fff", padding: "12px 14px 6px" }}>
            <span style={{ fontWeight: 700, fontSize: 17, color: "#050505" }}>Nouveau</span>
          </div>
          <div style={{ background: "#fff" }}>
            {unread.map(n => <NotifItem key={n.id} notif={n} />)}
          </div>
        </div>
      )}

      {/* ── Plus tôt (read) ── */}
      {!loading && read.length > 0 && (
        <div>
          <div style={{ background: "#fff", padding: "12px 14px 6px" }}>
            <span style={{ fontWeight: 700, fontSize: 17, color: "#050505" }}>Plus tôt</span>
          </div>
          <div style={{ background: "#fff" }}>
            {read.map(n => <NotifItem key={n.id} notif={n} />)}
          </div>
        </div>
      )}

    </div>
  );
}
