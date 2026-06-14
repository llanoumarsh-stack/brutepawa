import { useState, useEffect, useRef, ReactNode } from "react";
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

  return (
    <div className="app-shell">

      {/* ── Top Navbar ── */}
      <nav className="navbar">
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <img src="/logo.png" alt="Brute Pawa" style={{ width: 36, height: 36, borderRadius: 8, display: "block" }} />
        </button>

        <div className="navbar-search-wrap" ref={searchWrapRef}>
          <input
            className="navbar-search"
            placeholder="🔍 Rechercher sur Brute Pawa"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={e => {
              if (e.key === "Enter" && searchQuery.trim()) {
                saveRecent(searchQuery);
                setShowSuggestions(false);
                navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                (e.target as HTMLInputElement).blur();
              }
              if (e.key === "Escape") {
                setShowSuggestions(false);
                setSearchQuery("");
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
          {showSuggestions && (searchQuery.length >= 2 || recentSearches.length > 0) && (
            <SearchSuggestionsDropdown
              query={searchQuery}
              onClose={() => setShowSuggestions(false)}
              navigate={navigate}
              recentSearches={recentSearches}
              onSelectRecent={q => {
                setSearchQuery(q);
                saveRecent(q);
                setShowSuggestions(true);
              }}
              onRemoveRecent={removeRecent}
              onCommitSearch={saveRecent}
            />
          )}
        </div>

        <div className="navbar-actions">
          <div className="relative">
            <button className="nav-btn" title="Messenger" onClick={() => navigate("/messages")}>💬</button>
            {unreadMessages > 0 && <span className="badge">{unreadMessages}</span>}
          </div>
          <div className="relative">
            <button className="nav-btn" title="Notifications" onClick={() => navigate("/notifications")}>🔔</button>
            {unreadNotifs > 0 && <span className="badge">{unreadNotifs}</span>}
          </div>
          <button
            className="nav-btn"
            title="Profil"
            onClick={() => navigate("/profile")}
            style={{ padding: 0, overflow: "hidden", borderRadius: "50%", width: 32, height: 32 }}
          >
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt="Profil" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
              : <span style={{ width: 32, height: 32, borderRadius: "50%", background: "#1877F2", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700 }}>
                  {userInitials}
                </span>
            }
          </button>
        </div>
      </nav>

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
              { icon: "💬", label: "Messages",    path: "/messages" },
              { icon: "🏆", label: "Score",       path: "/score" },
              { icon: "🪙", label: "Portefeuille", path: "/wallet" },
              { icon: "🎬", label: "Live",        path: "/live" },
              { icon: "📊", label: "Créateur",    path: "/creator" },
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

      {/* ── Bottom Nav (mobile only) ── */}
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

        <button className="create-btn-fab" onClick={() => setShowCreate(true)} title="Créer">
          <span style={{ fontSize: 24, lineHeight: 1 }}>＋</span>
        </button>

        <button
          className="bottom-nav-btn-main"
          onClick={() => setShowSearchOverlay(true)}
          title="Rechercher"
        >
          <span className="tab-icon">🔍</span>
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
