import { useState } from "react";
import { useNavigate } from "../router";

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

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<{id: number; type: string; user: string; action: string; detail: string; time: string; read: boolean; initials: string; color: string}[]>([]);
  const [filter, setFilter] = useState<Filter>("all");

  const displayed = filter === "unread" ? notifs.filter(n => !n.read) : notifs;
  const unreadCount = notifs.filter(n => !n.read).length;

  const markAllRead = () => setNotifs(ns => ns.map(n => ({ ...n, read: true })));
  const markRead = (id: number) => setNotifs(ns => ns.map(n => n.id === id ? { ...n, read: true } : n));

  const handleClick = (notif: typeof notifs[0]) => {
    markRead(notif.id);
    const dest = TYPE_DESTINATIONS[notif.type] ?? "/";
    navigate(dest);
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ background: "var(--fb-white)", padding: "12px 16px", borderBottom: "1px solid var(--fb-divider)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 900, fontSize: 22 }}>Notifications</div>
        <button onClick={markAllRead} style={{ background: "none", border: "none", color: "var(--fb-blue)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          Tout marquer comme lu
        </button>
      </div>

      {/* Filter tabs */}
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

      {/* Notification list */}
      <div>
        {displayed.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--fb-text-secondary)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔕</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Aucune notification</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Vous êtes à jour !</div>
          </div>
        ) : (
          displayed.map(notif => (
            <div
              key={notif.id}
              onClick={() => handleClick(notif)}
              style={{
                display: "flex", gap: 12, padding: "12px 16px", cursor: "pointer",
                background: !notif.read ? "#E8F0FE" : "var(--fb-white)",
                borderBottom: "1px solid var(--fb-divider)",
                transition: "background 0.15s",
              }}
            >
              {/* Avatar */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                {typeof notif.initials === "string" && notif.initials.length === 2 && notif.initials.match(/[A-Z]/) ? (
                  <div className="avatar" style={{ background: notif.color, width: 52, height: 52, fontSize: 18 }}>{notif.initials}</div>
                ) : (
                  <div style={{ width: 52, height: 52, background: TYPE_COLORS[notif.type] + "20", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>
                    {notif.initials}
                  </div>
                )}
                <div style={{
                  position: "absolute", bottom: 0, right: 0, width: 22, height: 22,
                  background: TYPE_COLORS[notif.type] ?? "var(--fb-blue)",
                  borderRadius: "50%", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 11, border: "2px solid #fff"
                }}>
                  {TYPE_ICONS[notif.type]}
                </div>
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                  <strong>{notif.user}</strong> {notif.action}
                  {notif.detail && (
                    <span style={{ color: "var(--fb-text-secondary)" }}> : «{notif.detail}»</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: !notif.read ? "var(--fb-blue)" : "var(--fb-text-secondary)", marginTop: 4, fontWeight: !notif.read ? 700 : 400, display: "flex", alignItems: "center", gap: 6 }}>
                  {notif.time}
                  {!notif.read && <span style={{ fontSize: 10 }}>· Tap pour ouvrir →</span>}
                </div>
              </div>

              {/* Unread dot */}
              {!notif.read && (
                <div style={{ width: 12, height: 12, background: "var(--fb-blue)", borderRadius: "50%", flexShrink: 0, alignSelf: "center" }} />
              )}
            </div>
          ))
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
