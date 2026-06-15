import { useState, useEffect, useRef, ReactNode, type ReactElement } from "react";
import { useLocation, useNavigate } from "./router";
import CreateModal from "./components/CreateModal";
import PostModal from "./components/PostModal";
import SearchSuggestionsDropdown from "./components/SearchSuggestionsDropdown";
import MobileSearchOverlay from "./components/MobileSearchOverlay";
import { apiGetFriendRequests, apiGetUnreadNotifCount } from "./lib/api";

interface Props {
  children: ReactNode;
  onNewPost?: (content: string) => void;
}

type Tab = "home" | "community" | "marketplace" | "notifications" | "menu";

const TABS: { id: Tab; icon: string; label: string; path: string }[] = [
  { id: "home",          icon: "🏠", label: "Accueil",     path: "/"             },
  { id: "community",     icon: "👥", label: "Communauté",  path: "/community"    },
  { id: "marketplace",   icon: "🛍️", label: "Marché",      path: "/marketplace"  },
  { id: "notifications", icon: "🔔", label: "Alertes",     path: "/notifications"},
  { id: "menu",          icon: "☰",  label: "Menu",        path: "/menu"         },
];

export default function Layout({ children, onNewPost }: Props) {
  const path     = useLocation();
  const navigate = useNavigate();
  const [showCreate,        setShowCreate]        = useState(false);
  const [showPostModal,     setShowPostModal]     = useState(false);
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [searchQuery,   setSearchQuery]   = useState(() => {
    const qs = window.location.search;
    return new URLSearchParams(qs).get("q") ?? "";
  });
  const [pendingRequests, setPendingRequests] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("bp_recent_searches") ?? "[]");
    } catch { return []; }
  });
  const searchWrapRef = useRef<HTMLDivElement>(null);

  const saveRecent = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setRecentSearches(prev => {
      const deduped = [trimmed, ...prev.filter(x => x !== trimmed)].slice(0, 5);
      localStorage.setItem("bp_recent_searches", JSON.stringify(deduped));
      return deduped;
    });
  };

  const removeRecent = (q: string) => {
    setRecentSearches(prev => {
      const next = prev.filter(x => x !== q);
      localStorage.setItem("bp_recent_searches", JSON.stringify(next));
      return next;
    });
  };

  const rawUser      = localStorage.getItem("fb_user");
  const user         = rawUser ? JSON.parse(rawUser) : { name: "Utilisateur", email: "", avatarUrl: null };
  const userInitials = user.name ? user.name.slice(0, 2).toUpperCase() : "ME";

  // Pre-fill search bar if already on /search?q=...
  const currentPath = path;
  const currentQs   = currentPath.includes("?") ? currentPath.slice(currentPath.indexOf("?") + 1) : "";
  const currentQ    = new URLSearchParams(currentQs).get("q") ?? "";

  const menuPaths = ["/menu", "/wallet", "/tontines", "/formations", "/jobs"];
  const activeTab = TABS.find(t => t.path === path)?.id
    ?? (menuPaths.some(p => path.startsWith(p)) ? "menu" : "home");

  const handleCreateSelect = (type: string) => {
    setShowCreate(false);
    if (type === "post") setShowPostModal(true);
    else if (type === "product")  navigate("/marketplace");
    else if (type === "service")  navigate("/marketplace");
    else if (type === "group")    navigate("/community");
    else if (type === "job")      navigate("/marketplace");
    else if (type === "course")   navigate("/menu");
    else if (type === "tontine")  navigate("/menu");
  };

  useEffect(() => {
    apiGetFriendRequests().then(r => setPendingRequests(r.length)).catch(() => {});
    const iv = setInterval(() => {
      apiGetFriendRequests().then(r => setPendingRequests(r.length)).catch(() => {});
    }, 30_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    apiGetUnreadNotifCount().then(setUnreadNotifs).catch(() => {});
    const iv = setInterval(() => {
      apiGetUnreadNotifCount().then(setUnreadNotifs).catch(() => {});
    }, 30_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (path === "/notifications") {
      setUnreadNotifs(0);
    }
  }, [path]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadMessages = 0;

  const FB_TABS: { id: Tab; path: string; badge?: number; Icon: () => ReactElement }[] = [
    {
      id: "home", path: "/",
      Icon: () => activeTab === "home"
        ? <svg width="24" height="24" viewBox="0 0 24 24" fill="#1877F2"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
        : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#65676b" strokeWidth="2" strokeLinejoin="round"><path d="M3 12L12 3l9 9M5 10v9a1 1 0 0 0 1 1h4v-5h4v5h4a1 1 0 0 0 1-1v-9"/></svg>,
    },
    {
      id: "community", path: "/community", badge: pendingRequests || undefined,
      Icon: () => {
        const c = activeTab === "community" ? "#1877F2" : "#65676b";
        return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="7" r="3.5" stroke={c} strokeWidth="1.8"/><circle cx="17" cy="8" r="2.5" stroke={c} strokeWidth="1.8"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6" stroke={c} strokeWidth="1.8" strokeLinecap="round"/><path d="M19 14c2.5.5 4 2 4 4.5" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></svg>;
      },
    },
    {
      id: "notifications" as Tab, path: "/messages",
      Icon: () => {
        const c = activeTab === "notifications" ? "#1877F2" : "#65676b";
        return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke={c} strokeWidth="1.8" strokeLinejoin="round" fill={activeTab === "notifications" ? "#1877F2" : "none"} fillOpacity={activeTab === "notifications" ? .15 : 0}/></svg>;
      },
    },
    {
      id: "marketplace", path: "/notifications", badge: unreadNotifs || undefined,
      Icon: () => {
        const active = activeTab === "marketplace" || path === "/notifications";
        const c = active ? "#1877F2" : "#65676b";
        return <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "#1877F2" : "none"}><path d="M18 8a6 6 0 0 0-12 0c0 4-2 5-2 5h16s-2-1-2-5" stroke={c} strokeWidth="1.8" strokeLinecap="round"/><path d="M13.73 21a2 2 0 0 1-3.46 0" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></svg>;
      },
    },
    {
      id: "menu", path: "/marketplace",
      Icon: () => {
        const c = activeTab === "menu" ? "#1877F2" : "#65676b";
        return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" stroke={c} strokeWidth="1.8"/><line x1="3" y1="6" x2="21" y2="6" stroke={c} strokeWidth="1.8"/><path d="M16 10a4 4 0 0 1-8 0" stroke={c} strokeWidth="1.8" fill="none"/></svg>;
      },
    },
  ];

  return (
    <div className="app-shell">

      {/* ══════════════════════════════════════════════════
          FACEBOOK LITE STICKY HEADER — 3 rows
      ══════════════════════════════════════════════════ */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "#fff", boxShadow: "0 1px 0 #e4e6eb" }}>

        {/* Row 1 — Mode payant */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 14px", borderBottom: "1px solid #f0f2f5" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 13.5, color: "#050505" }}>Mode payant</span>
            <div style={{ width: 17, height: 17, borderRadius: "50%", background: "#ccd0d5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff", lineHeight: 1 }}>?</div>
          </div>
          <button style={{ background: "#e4e6eb", border: "none", borderRadius: 6, padding: "6px 13px", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#050505" }}>
            Changer de mode
          </button>
        </div>

        {/* Row 2 — Brand logo + icon buttons */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px" }}>
          <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}>
            <span style={{ color: "#1877F2", fontWeight: 900, fontSize: 28, fontFamily: "'Georgia', serif", fontStyle: "italic", letterSpacing: -1 }}>brutepawa</span>
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowCreate(true)} title="Créer"
              style={{ width: 40, height: 40, borderRadius: "50%", background: "#e4e6eb", border: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#050505", cursor: "pointer" }}>
              +
            </button>
            <button onClick={() => setShowSearchOverlay(true)} title="Rechercher"
              style={{ width: 40, height: 40, borderRadius: "50%", background: "#e4e6eb", border: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, cursor: "pointer" }}>
              🔍
            </button>
            <button onClick={() => navigate("/menu")} title="Menu"
              style={{ width: 40, height: 40, borderRadius: "50%", background: "#e4e6eb", border: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, cursor: "pointer" }}>
              ☰
            </button>
          </div>
        </div>

        {/* Row 3 — 5 tab icons */}
        <div style={{ display: "flex", borderTop: "1px solid #e4e6eb" }}>
          {FB_TABS.map(({ id, path: tabPath, badge, Icon }) => {
            const isActive = activeTab === id || (id === "marketplace" && path === "/notifications");
            return (
              <button key={id} onClick={() => navigate(tabPath)}
                style={{ flex: 1, background: "none", border: "none", padding: "10px 0 8px", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", borderBottom: isActive ? "3px solid #1877F2" : "3px solid transparent", cursor: "pointer" }}>
                <Icon />
                {badge && badge > 0 && (
                  <span style={{ position: "absolute", top: 6, right: "20%", background: "#E41E3F", color: "#fff", borderRadius: 10, minWidth: 16, height: 16, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", border: "1.5px solid #fff" }}>
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Body: sidebar + main ── */}
      <div className="app-body">

        {/* ── Desktop Sidebar ── */}
        <aside className="app-sidebar">

          {/* User card */}
          <div className="sidebar-user-card" onClick={() => navigate("/profile")}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--fb-blue)" }}>
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt="" style={{ width: 40, height: 40, objectFit: "cover" }} />
                : <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>{userInitials}</span>
              }
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.name}</div>
              <div className="sidebar-user-email">{user.email}</div>
            </div>
          </div>

          <div className="sidebar-divider" />

          {/* Navigation links */}
          <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`sidebar-nav-item${activeTab === tab.id ? " active" : ""}`}
                onClick={() => navigate(tab.path)}
              >
                <span className="sidebar-nav-icon">{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.id === "community" && pendingRequests > 0 && (
                  <span style={{ marginLeft: "auto", background: "#E41E3F", color: "#fff", borderRadius: 10, minWidth: 18, height: 18, padding: "0 5px", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {pendingRequests > 9 ? "9+" : pendingRequests}
                  </span>
                )}
                {tab.id === "notifications" && unreadNotifs > 0 && (
                  <span style={{ marginLeft: "auto", background: "#F44336", color: "#fff", borderRadius: 10, minWidth: 18, height: 18, padding: "0 5px", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {unreadNotifs}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="sidebar-divider" />

          {/* Quick links */}
          <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {[
              { icon: "💬", label: "Messages",       path: "/messages" },
              { icon: "🏆", label: "Score",          path: "/score" },
              { icon: "🪙", label: "Portefeuille",   path: "/wallet" },
              { icon: "📅", label: "Événements",     path: "/events" },
              { icon: "🔖", label: "Enregistrements", path: "/saved" },
              { icon: "✨", label: "Souvenirs",      path: "/memories" },
              { icon: "🎬", label: "Live",           path: "/live" },
              { icon: "📊", label: "Créateur",       path: "/creator" },
            ].map(item => (
              <button
                key={item.path}
                className={`sidebar-nav-item${path === item.path ? " active" : ""}`}
                onClick={() => navigate(item.path)}
              >
                <span className="sidebar-nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div style={{ flex: 1 }} />

          {/* Create button */}
          <button className="sidebar-create-btn" onClick={() => setShowCreate(true)}>
            <span style={{ fontSize: 20 }}>＋</span>
            Créer
          </button>

          <div style={{ padding: "12px 4px 4px", fontSize: 11, color: "var(--fb-text-secondary)", lineHeight: 1.8 }}>
            Brute Pawa © 2025
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="app-main">
          {children}
        </main>
      </div>


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
      {showSearchOverlay && (
        <MobileSearchOverlay
          onClose={() => setShowSearchOverlay(false)}
          navigate={(path) => { setShowSearchOverlay(false); navigate(path); }}
          recentSearches={recentSearches}
          onSelectRecent={(q) => { saveRecent(q); }}
          onRemoveRecent={removeRecent}
          onCommitSearch={saveRecent}
        />
      )}
    </div>
  );
}
