import { useState, useEffect, ReactNode } from "react";
import { useLocation, useNavigate } from "./router";
import CreateModal from "./components/CreateModal";
import PostModal from "./components/PostModal";
import { apiGetFriendRequests } from "./lib/api";

interface Props {
  children: ReactNode;
  onNewPost?: (content: string) => void;
}

type Tab = "home" | "community" | "marketplace" | "notifications" | "menu";

const TABS: { id: Tab; icon: string; label: string; path: string }[] = [
  { id: "home", icon: "🏠", label: "Accueil", path: "/" },
  { id: "community", icon: "👥", label: "Communauté", path: "/community" },
  { id: "marketplace", icon: "🛍️", label: "Marché", path: "/marketplace" },
  { id: "notifications", icon: "🔔", label: "Alertes", path: "/notifications" },
  { id: "menu", icon: "☰", label: "Menu", path: "/menu" },
];

export default function Layout({ children, onNewPost }: Props) {
  const path = useLocation();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const rawUser = localStorage.getItem("fb_user");
  const user = rawUser ? JSON.parse(rawUser) : { name: "Utilisateur", email: "" };
  const userInitials = user.name ? user.name.slice(0, 2).toUpperCase() : "ME";

  const menuPaths = ["/menu", "/wallet", "/tontines", "/formations", "/jobs"];
  const activeTab = TABS.find(t => t.path === path)?.id
    ?? (menuPaths.some(p => path.startsWith(p)) ? "menu" : "home");

  const handleCreateSelect = (type: string) => {
    setShowCreate(false);
    if (type === "post") setShowPostModal(true);
    else if (type === "product") navigate("/marketplace");
    else if (type === "service") navigate("/marketplace");
    else if (type === "group") navigate("/community");
    else if (type === "job") navigate("/marketplace");
    else if (type === "course") navigate("/menu");
    else if (type === "tontine") navigate("/menu");
  };

  const [pendingRequests, setPendingRequests] = useState(0);

  useEffect(() => {
    apiGetFriendRequests().then(r => setPendingRequests(r.length)).catch(() => {});
    const interval = setInterval(() => {
      apiGetFriendRequests().then(r => setPendingRequests(r.length)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const unreadNotifs = 0;
  const unreadMessages = 0;

  return (
    <div style={{ paddingBottom: 60, minHeight: "100vh", background: "var(--fb-bg)" }}>
      {/* Top Navbar */}
      <nav className="navbar">
        <button
          onClick={() => navigate("/")}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <span className="navbar-logo">BP</span>
        </button>
        <input
          className="navbar-search"
          placeholder="🔍 Rechercher sur Brute Pawa"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <div className="navbar-actions">
          <div className="relative">
            <button className="nav-btn" title="Messenger" onClick={() => navigate("/messages")}>💬</button>
            {unreadMessages > 0 && <span className="badge">{unreadMessages}</span>}
          </div>
          <div className="relative">
            <button className="nav-btn" title="Notifications" onClick={() => navigate("/notifications")}>🔔</button>
            {unreadNotifs > 0 && <span className="badge">{unreadNotifs}</span>}
          </div>
          <button className="nav-btn" title="Profil" onClick={() => navigate("/profile")} style={{ padding: 0, overflow: "hidden", borderRadius: "50%", width: 32, height: 32 }}>
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt="Profil" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
              : <span style={{ width: 32, height: 32, borderRadius: "50%", background: "#1877F2", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700 }}>{userInitials}</span>
            }
          </button>
        </div>
      </nav>

      {/* Page content */}
      {children}

      {/* Bottom Navigation */}
      <nav className="bottom-nav-main">
        {TABS.slice(0, 2).map(tab => (
          <button
            key={tab.id}
            className={`bottom-nav-btn-main${activeTab === tab.id ? " active" : ""}`}
            onClick={() => navigate(tab.path)}
            title={tab.label}
            style={{ position: "relative" }}
          >
            <span className="tab-icon">{tab.icon}</span>
            {tab.id === "community" && pendingRequests > 0 && (
              <span style={{ position: "absolute", top: 6, right: 6, background: "#E41E3F", color: "#fff", borderRadius: 10, minWidth: 16, height: 16, padding: "0 4px", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                {pendingRequests > 9 ? "9+" : pendingRequests}
              </span>
            )}
          </button>
        ))}

        {/* Center Create Button */}
        <button
          className="create-btn-fab"
          onClick={() => setShowCreate(true)}
          title="Créer"
        >
          <span style={{ fontSize: 24, lineHeight: 1 }}>＋</span>
        </button>

        {TABS.slice(2).map(tab => (
          <button
            key={tab.id}
            className={`bottom-nav-btn-main${activeTab === tab.id ? " active" : ""}`}
            onClick={() => navigate(tab.path)}
            title={tab.label}
          >
            <span className="tab-icon">{tab.icon}</span>
            {tab.id === "notifications" && unreadNotifs > 0 && (
              <span className="tab-badge">{unreadNotifs}</span>
            )}
          </button>
        ))}
      </nav>

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onSelect={handleCreateSelect} />
      )}

      {showPostModal && (
        <PostModal
          userInitials={userInitials}
          userName={user.name}
          onClose={() => setShowPostModal(false)}
          onPost={(content) => { onNewPost?.(content); }}
        />
      )}
    </div>
  );
}
