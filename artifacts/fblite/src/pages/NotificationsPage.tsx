import { useState, useEffect } from "react";
import { useNavigate } from "../router";
import { apiGetNotifications, apiMarkAllNotificationsRead, type ApiNotification } from "../lib/api";

const TYPE_ICONS: Record<string, string> = {
  like: "❤️", comment: "💬", friend: "👥", message: "✉️",
  job: "💼", tontine: "💰", group: "🏘️", system: "⭐", verify: "✅",
};

const TYPE_COLORS: Record<string, string> = {
  like: "#F44336", comment: "var(--fb-blue)", friend: "var(--fb-blue)",
  message: "#9C27B0", job: "#FF9800", tontine: "#4CAF50",
  group: "#1565C0", system: "#FF6D00", verify: "#4CAF50",
};

const TYPE_DESTINATIONS: Record<string, string> = {
  like: "/", comment: "/", friend: "/community",
  message: "/messages", job: "/jobs", tontine: "/tontines",
  group: "/community", system: "/menu", verify: "/menu",
};

type Filter = "all" | "unread";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Maintenant";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}j`;
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function actorInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    setLoading(true);
    apiGetNotifications().then(setNotifs).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const displayed = filter === "unread" ? notifs.filter(n => !n.isRead) : notifs;
  const unreadCount = notifs.filter(n => !n.isRead).length;

  const markAllRead = async () => {
    setNotifs(ns => ns.map(n => ({ ...n, isRead: true })));
    await apiMarkAllNotificationsRead().catch(() => {});
  };

  const markRead = (id: number) => {
    setNotifs(ns => ns.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const handleClick = (notif: ApiNotification) => {
    markRead(notif.id);
    const dest = notif.link ?? TYPE_DESTINATIONS[notif.type] ?? "/";
    navigate(dest);
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ background: "var(--fb-white)", padding: "12px 16px", borderBottom: "1px solid var(--fb-divider)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 900, fontSize: 22 }}>Notifications</div>
        <button onClick={markAllRead} style={{ background: "none", border: "none", color: "var(--fb-blue)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          Tout marquer comme lu
        </button>
      </div>

      <div style={{ background: "var(--fb-white)", borderBottom: "1px solid var(--fb-divider)", display: "flex" }}>
        {[
          { id: "all" as Filter, label: "Toutes" },
          { id: "unread" as Filter, label: `Non lues (${unreadCount})` },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: "12px 20px", background: "none", border: "none",
            borderBottom: filter === f.id ? "3px solid var(--fb-blue)" : "3px solid transparent",
            color: filter === f.id ? "var(--fb-blue)" : "var(--fb-text-secondary)",
            fontWeight: filter === f.id ? 700 : 500, fontSize: 14, cursor: "pointer",
          }}>{f.label}</button>
        ))}
      </div>

      <div>
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--fb-text-secondary)" }}>
            Chargement…
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--fb-text-secondary)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔕</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Aucune notification</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Vous êtes à jour !</div>
          </div>
        ) : (
          displayed.map(notif => {
            const initials = actorInitials(notif.actorName);
            const typeColor = TYPE_COLORS[notif.type] ?? "var(--fb-blue)";
            return (
              <div
                key={notif.id}
                onClick={() => handleClick(notif)}
                style={{
                  display: "flex", gap: 12, padding: "12px 16px", cursor: "pointer",
                  background: !notif.isRead ? "#E8F0FE" : "var(--fb-white)",
                  borderBottom: "1px solid var(--fb-divider)",
                  transition: "background 0.15s",
                }}
              >
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <div className="avatar" style={{ background: typeColor, width: 52, height: 52, fontSize: 18 }}>{initials}</div>
                  <div style={{
                    position: "absolute", bottom: 0, right: 0, width: 22, height: 22,
                    background: typeColor,
                    borderRadius: "50%", display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 11, border: "2px solid #fff"
                  }}>
                    {TYPE_ICONS[notif.type] ?? "🔔"}
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                    {notif.actorName && <strong>{notif.actorName} </strong>}
                    {notif.action}
                    {notif.detail && (
                      <span style={{ color: "var(--fb-text-secondary)" }}> : «{notif.detail}»</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: !notif.isRead ? "var(--fb-blue)" : "var(--fb-text-secondary)", marginTop: 4, fontWeight: !notif.isRead ? 700 : 400, display: "flex", alignItems: "center", gap: 6 }}>
                    {timeAgo(notif.createdAt)}
                    {!notif.isRead && <span style={{ fontSize: 10 }}>· Tap pour ouvrir →</span>}
                  </div>
                </div>

                {!notif.isRead && (
                  <div style={{ width: 12, height: 12, background: "var(--fb-blue)", borderRadius: "50%", flexShrink: 0, alignSelf: "center" }} />
                )}
              </div>
            );
          })
        )}
      </div>

      {displayed.length > 0 && (
        <div style={{ textAlign: "center", padding: "20px 0", color: "var(--fb-text-secondary)", fontSize: 13 }}>
          {filter === "all" ? "Vous avez vu toutes vos notifications ✓" : `${unreadCount} notification${unreadCount > 1 ? "s" : ""} non lue${unreadCount > 1 ? "s" : ""}`}
        </div>
      )}
    </div>
  );
}
