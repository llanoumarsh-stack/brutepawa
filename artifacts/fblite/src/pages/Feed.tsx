import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "../router";
import { openImageViewer } from "../components/ImageViewer";
import { apiGetPosts, apiCreatePost, apiLikePost, apiGetStories, apiToggleSaved, apiFollow, apiCheckFollowing, apiDeletePost, type FeedPost, type StoryGroup } from "../lib/api";
import StoryViewer from "../components/StoryViewer";
import { storyDraftStore } from "../lib/storyDraft";

/* ── Premium Music Card ─────────────────────────────────────── */
const WAVE_HEIGHTS = [5,10,7,14,9,12,6,15,8,11,5,13,9,7,12,6,14,10,8,5,11,9,13,7,10,6,14,8,12,5,8,11];

function FeedMusicCard({ trackName, artist, artworkUrl, url, duration, onClick }: {
  trackName: string; artist: string; artworkUrl: string | null;
  url: string | null; duration: string | null; onClick: () => void;
}) {
  const [playing, setPlaying]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent]   = useState("0:00");
  const [tick, setTick]         = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tickRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!url) return;
    const a = new Audio(url);
    audioRef.current = a;
    a.addEventListener("timeupdate", () => {
      if (!a.duration) return;
      setProgress((a.currentTime / a.duration) * 100);
      const m = Math.floor(a.currentTime / 60);
      const s = Math.floor(a.currentTime % 60);
      setCurrent(`${m}:${s.toString().padStart(2, "0")}`);
    });
    a.addEventListener("ended", () => {
      setPlaying(false); setProgress(0); setCurrent("0:00");
      if (tickRef.current) clearInterval(tickRef.current);
    });
    return () => { a.pause(); a.src = ""; if (tickRef.current) clearInterval(tickRef.current); };
  }, [url]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause(); setPlaying(false);
      if (tickRef.current) clearInterval(tickRef.current);
    } else {
      a.play().catch(() => {});
      setPlaying(true);
      tickRef.current = setInterval(() => setTick(t => t + 1), 120);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const a = audioRef.current;
    if (!a || !a.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    a.currentTime = pct * a.duration;
  };

  const totalBars = WAVE_HEIGHTS.length;

  return (
    <div
      onClick={onClick}
      style={{
        margin: "0 14px 12px", background: "#fff", borderRadius: 18,
        padding: "12px 14px", display: "flex", alignItems: "center", gap: 12,
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)", cursor: "pointer",
        border: "1px solid #F1F5F9", minHeight: 110,
      }}
    >
      {/* Album art — 80×80 */}
      <div style={{ width: 80, height: 80, borderRadius: 12, overflow: "hidden", background: "linear-gradient(135deg,#1e1e2e,#2d3748)", flexShrink: 0 }}>
        {artworkUrl
          ? <img src={artworkUrl} alt={trackName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg viewBox="0 0 24 24" width="36" height="36" fill="#4B5563"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
            </div>
        }
      </div>

      {/* Center: title + artist + waveform + seek */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.2, marginBottom: 3 }}>
          {trackName}
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 8 }}>
          {artist}
        </div>

        {/* Waveform — Spotify style, colored by progress */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 1.5, height: 22, marginBottom: 6, overflow: "hidden" }}>
          {WAVE_HEIGHTS.map((baseH, i) => {
            const filled = (i / totalBars) * 100 < progress;
            const animOffset = playing ? Math.sin((tick + i) * 0.6) * 0.4 + 0.8 : 0.45;
            const h = Math.max(3, Math.round(baseH * animOffset));
            return (
              <div key={i} style={{
                width: 2.5, borderRadius: 2, flexShrink: 0,
                background: filled ? "#22C55E" : "#D1FAE5",
                height: h,
                transition: playing ? `height 0.12s ease` : "height 0.3s ease",
              }} />
            );
          })}
        </div>

        {/* Seek bar + times */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 600, flexShrink: 0, minWidth: 32 }}>{current}</span>
          <div
            onClick={handleSeek}
            style={{ flex: 1, height: 4, background: "#E5E7EB", borderRadius: 4, position: "relative", cursor: "pointer" }}
          >
            <div style={{ width: `${progress}%`, height: "100%", background: "#22C55E", borderRadius: 4, position: "relative" }}>
              {progress > 0 && (
                <div style={{ position: "absolute", right: -5, top: "50%", transform: "translateY(-50%)", width: 10, height: 10, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 0 2px #fff" }} />
              )}
            </div>
          </div>
          <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 600, flexShrink: 0, minWidth: 32, textAlign: "right" }}>{duration ?? "0:00"}</span>
        </div>
      </div>

      {/* Right: play/pause + equalizer */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <button
          onClick={toggle}
          style={{ width: 44, height: 44, borderRadius: "50%", background: "#22C55E", border: "none", cursor: url ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", opacity: url ? 1 : 0.4, boxShadow: "0 2px 8px rgba(34,197,94,0.35)" }}
        >
          {playing
            ? <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            : <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
          }
        </button>
        {/* Equalizer icon */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 14 }}>
          {[5, 10, 7, 13, 9].map((h, i) => {
            const animH = playing ? Math.max(3, Math.round(h * (Math.sin((tick + i * 2) * 0.8) * 0.4 + 0.8))) : 3;
            return (
              <div key={i} style={{ width: 3, borderRadius: 2, background: "#22C55E", height: animH, transition: "height 0.12s ease" }} />
            );
          })}
        </div>
      </div>
    </div>
  );
}

const COUNTRY_FLAGS: Record<string, string> = {
  CI: "🇨🇮", SN: "🇸🇳", BJ: "🇧🇯", TG: "🇹🇬", BF: "🇧🇫", NE: "🇳🇪",
  ML: "🇲🇱", GN: "🇬🇳", CM: "🇨🇲", TD: "🇹🇩", GA: "🇬🇦", CG: "🇨🇬",
  CD: "🇨🇩", CF: "🇨🇫", GH: "🇬🇭",
};
const AVATAR_COLORS = ["#1877F2","#E91E63","#9C27B0","#F57C00","#388E3C","#212121","#D32F2F","#00838F"];

function getInitials(name: string) { return name.slice(0, 2).toUpperCase(); }
function formatNumber(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(".0", "") + " k";
  return String(n);
}
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `Il y a ${d} j`;
}

/* ── SVG tab icons (filled = active, outline = inactive) ── */
function IconHome({ active }: { active: boolean }) {
  return active
    ? <svg width="24" height="24" viewBox="0 0 24 24" fill="#1877F2"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
    : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#65676b" strokeWidth="2" strokeLinejoin="round"><path d="M3 12L12 3l9 9M5 10v9a1 1 0 0 0 1 1h4v-5h4v5h4a1 1 0 0 0 1-1v-9"/></svg>;
}
function IconFriends({ active }: { active: boolean }) {
  const c = active ? "#1877F2" : "#65676b";
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="7" r="3.5" stroke={c} strokeWidth={active?2:1.8} fill={active?"#1877F2":"none"} fillOpacity={active?.15:0}/><circle cx="17" cy="8" r="2.5" stroke={c} strokeWidth={active?2:1.8} fill="none"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6" stroke={c} strokeWidth={active?2:1.8} strokeLinecap="round" fill="none"/><path d="M19 14c2.5.5 4 2 4 4.5" stroke={c} strokeWidth={active?2:1.8} strokeLinecap="round" fill="none"/></svg>;
}
function IconMessenger({ active }: { active: boolean }) {
  const c = active ? "#1877F2" : "#65676b";
  return <svg width="24" height="24" viewBox="0 0 24 24" fill={active?"#1877F2":"none"}><path d="M12 2C6.48 2 2 6.2 2 11.4c0 2.77 1.26 5.26 3.28 6.99V22l3.56-1.96c.95.26 1.96.4 3.16.4 5.52 0 10-4.2 10-9.4S17.52 2 12 2z" stroke={c} strokeWidth="1.8" fill={active?"#1877F2":"none"} fillOpacity={active?1:0}/><path d="M7 13l2.5-2.5 2.5 2.5 4-5" stroke={active?"#fff":"#65676b"} strokeWidth={active?2:1.8} strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>;
}
function IconBell({ active }: { active: boolean }) {
  const c = active ? "#1877F2" : "#65676b";
  return <svg width="24" height="24" viewBox="0 0 24 24" fill={active?"#1877F2":"none"}><path d="M18 8a6 6 0 0 0-12 0c0 4-2 5-2 5h16s-2-1-2-5" stroke={c} strokeWidth="1.8" strokeLinecap="round" fill={active?"#1877F2":"none"}/><path d="M13.73 21a2 2 0 0 1-3.46 0" stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none"/></svg>;
}
function IconShop({ active }: { active: boolean }) {
  const c = active ? "#1877F2" : "#65676b";
  return <svg width="24" height="24" viewBox="0 0 24 24" fill={active?"#1877F2":"none"}><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" stroke={c} strokeWidth="1.8" fill={active?"#1877F2":"none"} fillOpacity={active?.15:0}/><line x1="3" y1="6" x2="21" y2="6" stroke={c} strokeWidth="1.8"/><path d="M16 10a4 4 0 0 1-8 0" stroke={c} strokeWidth="1.8" fill="none"/></svg>;
}

export default function Feed() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newPost, setNewPost] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"feed" | "friends" | "messenger" | "notifs" | "shop">("feed");

  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerGroupIdx, setViewerGroupIdx] = useState(0);
  const storyFileRef = useRef<HTMLInputElement>(null);
  const [postMenuId, setPostMenuId] = useState<number | null>(null);
  const [savedSet, setSavedSet] = useState<Set<number>>(new Set());
  const [followedIds, setFollowedIds] = useState<Set<number>>(new Set());

  // Lock body scroll when bottom sheet is open to prevent layout shift
  useEffect(() => {
    if (postMenuId !== null) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    } else {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    }
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, [postMenuId]);

  const handleStoryFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (e.target) e.target.value = "";
    const previewUrl = URL.createObjectURL(file);
    storyDraftStore.set({ file, previewUrl });
    navigate("/create-story");
  };

  const rawUser = localStorage.getItem("fb_user");
  const user = rawUser ? JSON.parse(rawUser) as { id?: number; name: string; email: string; avatarUrl?: string; flag?: string } : { name: "Moi", email: "" };
  const userInitials = user.name ? user.name.slice(0, 2).toUpperCase() : "ME";

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try { const data = await apiGetPosts(); setPosts(data); }
    catch { setPosts([]); }
    finally { setLoading(false); }
  }, []);

  const loadStories = useCallback(async () => {
    try { setStoryGroups(await apiGetStories()); }
    catch { setStoryGroups([]); }
  }, []);

  useEffect(() => { loadPosts(); loadStories(); }, [loadPosts, loadStories]);

  // Charge la liste des utilisateurs déjà suivis dès que les posts sont chargés
  useEffect(() => {
    if (posts.length === 0) return;
    const ids = [...new Set(posts.map(p => p.authorId).filter(Boolean))];
    apiCheckFollowing(ids).then(followed => {
      setFollowedIds(new Set(followed));
    }).catch(() => {});
  }, [posts.length]);

  const handleFollow = async (authorId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const isFollowing = followedIds.has(authorId);
    setFollowedIds(prev => {
      const next = new Set(prev);
      if (isFollowing) next.delete(authorId); else next.add(authorId);
      return next;
    });
    try {
      await apiFollow(authorId, isFollowing ? "unfollow" : "follow");
    } catch {
      // Annuler l'optimistic update en cas d'erreur
      setFollowedIds(prev => {
        const next = new Set(prev);
        if (isFollowing) next.add(authorId); else next.delete(authorId);
        return next;
      });
    }
  };

  const archivePost = async (id: number) => {
    setPostMenuId(null);
    setPosts(ps => ps.filter(p => p.id !== id));
    try { await apiDeletePost(id); } catch { loadPosts(); }
  };

  const toggleLike = async (id: number) => {
    const post = posts.find(p => p.id === id);
    if (!post) return;
    const action = post.liked ? "unlike" : "like";
    setPosts(ps => ps.map(p =>
      p.id === id ? { ...p, liked: !p.liked, likesCount: p.liked ? p.likesCount - 1 : p.likesCount + 1 } : p
    ));
    try { await apiLikePost(id, action); } catch { loadPosts(); }
  };

  const toggleSave = async (id: number) => {
    const isSaved = savedSet.has(id);
    setSavedSet(s => { const n = new Set(s); isSaved ? n.delete(id) : n.add(id); return n; });
    try { await apiToggleSaved(id); } catch { setSavedSet(s => { const n = new Set(s); isSaved ? n.add(id) : n.delete(id); return n; }); }
  };

  const submitPost = async () => {
    if (!newPost.trim() || submitting) return;
    setSubmitting(true);
    try { await apiCreatePost(newPost.trim()); setNewPost(""); setShowModal(false); await loadPosts(); }
    catch { /* silent */ }
    finally { setSubmitting(false); }
  };

  const handleTabClick = (tab: typeof activeTab) => {
    setActiveTab(tab);
    if (tab === "messenger") navigate("/messages");
    if (tab === "notifs")    navigate("/notifications");
    if (tab === "shop")      navigate("/marketplace");
    if (tab === "friends")   navigate("/search");
  };

  const TABS: { id: typeof activeTab; Icon: React.FC<{ active: boolean }> }[] = [
    { id: "feed",      Icon: IconHome },
    { id: "friends",   Icon: IconFriends },
    { id: "messenger", Icon: IconMessenger },
    { id: "notifs",    Icon: IconBell },
    { id: "shop",      Icon: IconShop },
  ];

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100vh", paddingBottom: 20 }}>
      {viewerOpen && storyGroups.length > 0 && (
        <StoryViewer
          groups={storyGroups}
          initialGroupIndex={viewerGroupIdx}
          onClose={() => { setViewerOpen(false); loadStories(); }}
          onAuthorClick={authorId => {
            setViewerOpen(false);
            navigate(`/user/${authorId}`);
          }}
        />
      )}

      {/* ═══════════════════════════════════════════════
          STICKY HEADER — 3 rows exactly like Facebook
      ═══════════════════════════════════════════════ */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "#fff" }}>

        {/* Row 1 — Mode payant */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "7px 14px", borderBottom: "1px solid #f0f2f5",
          background: "#fff",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 13.5, color: "#050505" }}>Mode payant</span>
            <div style={{
              width: 17, height: 17, borderRadius: "50%", background: "#ccd0d5",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 800, color: "#fff", lineHeight: 1,
            }}>?</div>
          </div>
          <button style={{
            background: "#e4e6eb", border: "none", borderRadius: 6,
            padding: "6px 13px", fontWeight: 600, fontSize: 13, cursor: "pointer",
            color: "#050505",
          }}>
            Changer de mode
          </button>
        </div>

        {/* Row 2 — Brand + icon buttons */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 14px",
        }}>
          {/* Brand logo */}
          <img src="/logo.png" alt="Brute Pawa" style={{ height: 38, width: 38, borderRadius: 10, objectFit: "cover" }} />

          {/* Icon buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { label: "+",  title: "Créer",           action: () => navigate("/create-post") },
              { label: "🔍", title: "Rechercher",       action: () => navigate("/search") },
              { label: "☰",  title: "Menu",             action: () => navigate("/menu") },
            ].map(btn => (
              <button
                key={btn.title}
                title={btn.title}
                onClick={btn.action}
                style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: "#e4e6eb", border: "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: btn.label === "+" ? 22 : 18,
                  fontWeight: btn.label === "+" ? 700 : 400,
                  color: "#050505", cursor: "pointer", flexShrink: 0,
                  lineHeight: 1,
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 3 — Tab bar */}
        <div style={{
          display: "flex",
          borderTop: "1px solid #e4e6eb",
        }}>
          {TABS.map(({ id, Icon }) => (
            <button
              key={id}
              onClick={() => handleTabClick(id)}
              style={{
                flex: 1, background: "none", border: "none",
                padding: "10px 0 8px",
                display: "flex", alignItems: "center", justifyContent: "center",
                borderBottom: activeTab === id ? "3px solid #1877F2" : "3px solid transparent",
                cursor: "pointer",
                transition: "border-color .15s",
              }}
            >
              <Icon active={activeTab === id} />
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          FEED CONTENT
      ═══════════════════════════════════════════ */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>

        {/* ── Stories row ── */}
        <input ref={storyFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleStoryFileSelect} />
        <div style={{ background: "#fff", overflowX: "auto", padding: "10px 0 10px 10px" }}>
          <div style={{ display: "flex", gap: 8, width: "max-content" }}>

            {/* Create story card */}
            <div
              onClick={() => storyFileRef.current?.click()}
              style={{
                width: 96, flexShrink: 0, cursor: "pointer",
                display: "flex", flexDirection: "column",
              }}
            >
              <div style={{
                width: 96, height: 144, borderRadius: 10, overflow: "hidden",
                position: "relative", border: "1px solid #e4e6eb",
              }}>
                <div style={{ width: "100%", height: "100%", background: "#e4e6eb", overflow: "hidden" }}>
                  {user.avatarUrl
                    ? <img src={user.avatarUrl} alt="moi" style={{ width: "100%", height: "75%", objectFit: "cover", display: "block" }} />
                    : <div style={{ width: "100%", height: "75%", background: "#42B72A", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 26 }}>{userInitials}</div>
                  }
                  <div style={{ height: "25%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }} />
                </div>
                {/* Blue + circle at bottom of image zone */}
                <div style={{
                  position: "absolute", bottom: "23%", left: "50%",
                  transform: "translate(-50%, 50%)",
                  width: 32, height: 32, borderRadius: "50%",
                  background: "#1877F2", border: "3px solid #fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 20, fontWeight: 900, lineHeight: 1,
                  zIndex: 2,
                }}>+</div>
              </div>
              <div style={{
                textAlign: "center", fontSize: 12, fontWeight: 700,
                color: "#050505", marginTop: 6, lineHeight: 1.3,
                padding: "0 2px",
              }}>Créer une story</div>
            </div>

            {/* Real story groups */}
            {storyGroups.map((group, idx) => {
              const initials = getInitials(group.authorName);
              const avatarBg = AVATAR_COLORS[group.authorId % AVATAR_COLORS.length];
              const preview = group.stories[0];
              return (
                <div
                  key={group.authorId}
                  onClick={() => { setViewerGroupIdx(idx); setViewerOpen(true); }}
                  style={{ width: 96, flexShrink: 0, cursor: "pointer" }}
                >
                  <div style={{
                    width: 96, height: 144, borderRadius: 10, overflow: "hidden",
                    position: "relative",
                    background: preview?.mediaUrl
                      ? `url(${preview.mediaUrl}) center/cover no-repeat`
                      : (preview?.bgColor ?? avatarBg),
                  }}>
                    {/* Emoji overlay */}
                    {preview?.emoji && !preview?.mediaUrl && (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>{preview.emoji}</div>
                    )}
                    {/* Gradient overlay at bottom */}
                    <div style={{
                      position: "absolute", inset: 0,
                      background: "linear-gradient(to bottom, rgba(0,0,0,0) 50%, rgba(0,0,0,0.55) 100%)",
                    }} />
                    {/* Author avatar ring — top left */}
                    <div style={{
                      position: "absolute", top: 8, left: 8,
                      width: 36, height: 36, borderRadius: "50%",
                      border: "3px solid #1877F2",
                      background: avatarBg,
                      overflow: "hidden", flexShrink: 0,
                    }}>
                      {group.authorAvatarUrl
                        ? <img src={group.authorAvatarUrl} alt={group.authorName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13 }}>{initials}</div>
                      }
                    </div>
                    {/* Count badge — top right */}
                    {group.storiesCount > 1 && (
                      <div style={{
                        position: "absolute", top: 6, right: 6,
                        background: "#1877F2", color: "#fff",
                        borderRadius: 10, minWidth: 20, height: 20,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, padding: "0 4px",
                        border: "2px solid #fff",
                      }}>{group.storiesCount}</div>
                    )}
                    {/* Author name — bottom */}
                    <div style={{
                      position: "absolute", bottom: 8, left: 6, right: 6,
                      color: "#fff", fontWeight: 700, fontSize: 12,
                      textShadow: "0 1px 3px rgba(0,0,0,0.7)",
                    }}>{group.authorName.split(" ")[0]}</div>
                  </div>
                </div>
              );
            })}

            {/* Padding right */}
            <div style={{ width: 2, flexShrink: 0 }} />
          </div>
        </div>

        {/* ── Post creation card ── */}
        <div style={{ background: "#fff", padding: "10px 14px 0" }}>
          {/* Top row: avatar + input + Photo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            {/* Avatar */}
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt="moi" onClick={() => navigate("/profile")} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0, cursor: "pointer" }} />
              : <div onClick={() => navigate("/profile")} style={{ width: 40, height: 40, borderRadius: "50%", background: "#42B72A", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15, flexShrink: 0, cursor: "pointer" }}>{userInitials}</div>
            }
            {/* Fake input */}
            <div
              onClick={() => navigate("/create-post")}
              style={{
                flex: 1, background: "#f0f2f5", borderRadius: 22,
                padding: "9px 14px", fontSize: 16,
                color: "#65676b", cursor: "pointer",
                border: "1px solid #ccd0d5",
                userSelect: "none",
              }}
            >
              À quoi pensez-vous ?
            </div>
            {/* Photo button */}
            <div
              onClick={() => navigate("/create-post")}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 2, cursor: "pointer", flexShrink: 0,
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 8,
                background: "#e6f4ea", border: "1px solid #c8e6c9",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20,
              }}>📷</div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#65676b" }}>Photo</span>
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: "1px solid #e4e6eb" }} />

          {/* Quick action row */}
          <div style={{ display: "flex" }}>
            {[
              { emoji: "🙂", label: "Je me sens...", action: () => navigate("/create-post") },
              { emoji: "📹", label: "Vidéo",         action: () => navigate("/create-post") },
              { emoji: "📍", label: "Localisation",  action: () => navigate("/create-post") },
            ].map((btn, i) => (
              <button
                key={btn.label}
                onClick={btn.action}
                style={{
                  flex: 1, background: "none", border: "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 5, padding: "10px 4px", cursor: "pointer",
                  borderLeft: i > 0 ? "1px solid #e4e6eb" : "none",
                  fontSize: 13, fontWeight: 600, color: "#65676b",
                }}
              >
                <span style={{ fontSize: 18 }}>{btn.emoji}</span>
                <span>{btn.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div style={{ textAlign: "center", padding: 32, background: "#fff", color: "#65676b" }}>
            <div style={{
              width: 28, height: 28, border: "3px solid #e4e6eb",
              borderTopColor: "#1877F2", borderRadius: "50%",
              animation: "fb-spin .7s linear infinite",
              margin: "0 auto 10px",
            }} />
            Chargement des publications…
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && posts.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, background: "#fff", color: "#65676b" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
            <div style={{ fontWeight: 700, color: "#050505" }}>Aucune publication pour l'instant</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Soyez le premier à publier quelque chose !</div>
          </div>
        )}

        {/* ── Posts ── */}
        {posts.map(post => {
          const flag = COUNTRY_FLAGS[post.authorCountry] ?? "";
          const initials = getInitials(post.authorName);
          const avatarColor = AVATAR_COLORS[post.authorId % AVATAR_COLORS.length];
          return (
            <div key={post.id} style={{ background: "#fff" }}>
              {/* Post header */}
              <div style={{ display: "flex", alignItems: "flex-start", padding: "12px 14px 8px", gap: 10 }}>
                {post.authorAvatarUrl
                  ? <img src={post.authorAvatarUrl} alt={post.authorName} loading="lazy" decoding="async" onClick={() => navigate(`/user/${post.authorId}`)}
                      style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0, cursor: "pointer" }} />
                  : <div onClick={() => navigate(`/user/${post.authorId}`)}
                      style={{ width: 40, height: 40, borderRadius: "50%", background: avatarColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15, flexShrink: 0, cursor: "pointer" }}>
                      {initials}
                    </div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 14.5, color: "#050505", cursor: "pointer" }}
                      onClick={() => navigate(`/user/${post.authorId}`)}>
                      {post.authorName}
                    </span>
                    {flag && <span style={{ fontSize: 14 }}>{flag}</span>}
                    {followedIds.has(post.authorId)
                      ? <span
                          onClick={(e) => handleFollow(post.authorId, e)}
                          style={{ fontSize: 13, fontWeight: 600, color: "#65676b", cursor: "pointer" }}>· Suivi</span>
                      : <span
                          onClick={(e) => handleFollow(post.authorId, e)}
                          style={{ fontSize: 13, fontWeight: 600, color: "#1877F2", cursor: "pointer" }}>· Suivre</span>
                    }
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#65676b", marginTop: 1 }}>
                    <span>{timeAgo(post.createdAt)}</span>
                    <span>·</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#65676b"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6l5 3-1 1.73-6-3.5V7z"/></svg>
                  </div>
                </div>
                {/* ... and × */}
                <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                  <button onClick={() => setPostMenuId(post.id)}
                    style={{ width: 32, height: 32, borderRadius: "50%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#65676b", fontSize: 20, fontWeight: 700, lineHeight: 1 }}>
                    ···
                  </button>
                  <button
                    style={{ width: 32, height: 32, borderRadius: "50%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#65676b", fontSize: 16, fontWeight: 700 }}>
                    ✕
                  </button>
                </div>
              </div>

              {/* Content + Music card (unified) */}
              {(() => {
                // Detect music in content: "🎵 Track — Artist" or "♪/♫ Track — Artist"
                // CreatePostPage stores as: `🎵 Title — Artist`
                const MUSIC_RE = /^[♪♫🎵🎶🎼]\s*(.+?)\s*[—–\-]\s*(.+)$/;
                const parsed = !post.musicTrackName && post.content
                  ? post.content.match(MUSIC_RE)
                  : null;
                // Also detect multi-line content where last line is the music tag
                const parsedLine = !post.musicTrackName && !parsed && post.content
                  ? (post.content.split("\n").pop() ?? "").match(MUSIC_RE)
                  : null;

                const musicTrack  = post.musicTrackName ?? (parsed ? parsed[1].trim() : null) ?? (parsedLine ? parsedLine[1].trim() : null);
                const musicArtist = post.musicArtist   ?? (parsed ? parsed[2].trim() : null) ?? (parsedLine ? parsedLine[2].trim() : null);
                // isMusicContent: the ENTIRE content is just the music tag (no other text)
                const isMusicContent = !!parsed;
                // If music was appended as last line, get the caption (everything before)
                const captionLines = parsedLine
                  ? post.content!.split("\n").slice(0, -1).join("\n").trim()
                  : null;

                return (
                  <>
                    {/* Pure music tag — don't show as text */}
                    {post.content && !isMusicContent && !post.musicTrackName && !parsedLine && (
                      <div style={{ padding: "0 14px 10px", fontSize: 15, color: "#050505", lineHeight: 1.5 }}>
                        {post.content}
                      </div>
                    )}
                    {/* Caption from DB musicTrackName posts */}
                    {post.content && post.musicTrackName && (
                      <div style={{ padding: "0 14px 10px", fontSize: 15, color: "#050505", lineHeight: 1.5 }}>
                        {post.content}
                      </div>
                    )}
                    {/* Caption when music tag is the last line */}
                    {captionLines && (
                      <div style={{ padding: "0 14px 10px", fontSize: 15, color: "#050505", lineHeight: 1.5 }}>
                        {captionLines}
                      </div>
                    )}
                    {/* Music card — from music_* fields OR parsed from content */}
                    {musicTrack && (
                      <FeedMusicCard
                        trackName={musicTrack}
                        artist={musicArtist ?? "Artiste inconnu"}
                        artworkUrl={post.musicArtworkUrl ?? null}
                        url={post.musicUrl ?? null}
                        duration={post.musicDuration ?? null}
                        onClick={() => navigate(`/post/${post.id}`)}
                      />
                    )}
                  </>
                );
              })()}

              {/* Media */}
              {post.imageUrl && (
                <div style={{ overflow: "hidden", background: "#000" }}>
                  <img src={post.imageUrl} alt="" loading="lazy" decoding="async"
                    onClick={() => openImageViewer(post.imageUrl!)}
                    style={{ width: "100%", height: "auto", objectFit: "contain", display: "block", cursor: "zoom-in" }} />
                </div>
              )}

              {/* Stats bar — Facebook Premium */}
              {(post.likesCount > 0 || post.commentsCount > 0) && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px 5px", fontSize: 13, color: "#65676b" }}>
                  {/* Left: reaction emoji circles + count */}
                  {post.likesCount > 0 ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {/* Stacked reaction circles */}
                      <div style={{ display: "flex" }}>
                        {/* 👍 Like — always shown */}
                        <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#1877F2", border: "1.5px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, zIndex: 3 }}>👍</div>
                        {post.likesCount >= 3 && (
                          <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#F43F5E", border: "1.5px solid #fff", marginLeft: -6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, zIndex: 2 }}>❤️</div>
                        )}
                        {post.likesCount >= 7 && (
                          <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#F59E0B", border: "1.5px solid #fff", marginLeft: -6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, zIndex: 1 }}>😂</div>
                        )}
                      </div>
                      <span style={{ color: "#65676b", fontSize: 13 }}>{formatNumber(post.likesCount)} réaction{post.likesCount > 1 ? "s" : ""}</span>
                    </div>
                  ) : <div />}

                  {/* Right: avatar stack + comments count + ">" */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {post.likesCount > 0 && (
                      <div style={{ display: "flex", alignItems: "center" }}>
                        {/* Mock avatar stack — colored circles */}
                        {[
                          { bg: "#22C55E", i: 0 },
                          ...(post.likesCount > 1 ? [{ bg: "#3B82F6", i: 1 }] : []),
                          ...(post.likesCount > 2 ? [{ bg: "#F43F5E", i: 2 }] : []),
                        ].map(({ bg, i }) => (
                          <div key={i} style={{
                            width: 22, height: 22, borderRadius: "50%",
                            background: bg, border: "2px solid #fff",
                            marginLeft: i > 0 ? -8 : 0, zIndex: 3 - i,
                            position: "relative",
                          }} />
                        ))}
                        <span style={{ marginLeft: 4, color: "#65676b", fontSize: 14, fontWeight: 600 }}>›</span>
                      </div>
                    )}
                    {post.commentsCount > 0 && (
                      <span style={{ cursor: "pointer", color: "#65676b", fontSize: 13 }} onClick={() => navigate(`/post/${post.id}`)}>
                        {formatNumber(post.commentsCount)} commentaire{post.commentsCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Divider */}
              <div style={{ height: 1, background: "#e4e6eb", margin: "0 14px" }} />

              {/* Action bar — SVG icons, no emoji */}
              <div style={{ display: "flex", padding: "2px 0" }}>
                {/* J'aime */}
                <button
                  onClick={() => toggleLike(post.id)}
                  style={{ flex: 1, background: "none", border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 4px", fontSize: 13.5, fontWeight: 700, color: post.liked ? "#22C55E" : "#65676b", cursor: "pointer", transition: "color .13s" }}
                >
                  <svg viewBox="0 0 24 24" width="19" height="19" fill={post.liked ? "#22C55E" : "none"} stroke={post.liked ? "#22C55E" : "#65676b"} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v12M15 5.88L14 10h5.83A2 2 0 0 1 21.83 12.49L19.04 19.5A2 2 0 0 1 17.12 21H7a2 2 0 0 1-2-2v-8.5a2 2 0 0 1 .586-1.414L10 5H13a2 2 0 0 1 2 2v-.12z"/></svg>
                  <span>J'aime</span>
                </button>
                <div style={{ width: 1, background: "#e4e6eb", alignSelf: "stretch", margin: "6px 0" }} />
                {/* Commenter */}
                <button
                  onClick={() => navigate(`/post/${post.id}`)}
                  style={{ flex: 1, background: "none", border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 4px", fontSize: 13.5, fontWeight: 700, color: "#65676b", cursor: "pointer" }}
                >
                  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="#65676b" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  <span>Commenter</span>
                </button>
                <div style={{ width: 1, background: "#e4e6eb", alignSelf: "stretch", margin: "6px 0" }} />
                {/* Partager */}
                <button
                  style={{ flex: 1, background: "none", border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 4px", fontSize: 13.5, fontWeight: 700, color: "#65676b", cursor: "pointer" }}
                >
                  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="#65676b" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>
                  <span>Partager</span>
                </button>
                <div style={{ width: 1, background: "#e4e6eb", alignSelf: "stretch", margin: "6px 0" }} />
                {/* Enregistrer */}
                <button
                  onClick={() => toggleSave(post.id)}
                  style={{ flex: 1, background: "none", border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 4px", fontSize: 13.5, fontWeight: 700, color: savedSet.has(post.id) ? "#22C55E" : "#65676b", cursor: "pointer", transition: "color .13s" }}
                >
                  <svg viewBox="0 0 24 24" width="19" height="19" fill={savedSet.has(post.id) ? "#22C55E" : "none"} stroke={savedSet.has(post.id) ? "#22C55E" : "#65676b"} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                  <span>Enregistrer</span>
                </button>
              </div>
            </div>
          );
        })}

        {/* End of feed */}
        {!loading && posts.length > 0 && (
          <div style={{ textAlign: "center", padding: "20px 0", color: "#65676b", fontSize: 13 }}>
            Vous avez tout vu
          </div>
        )}
      </div>

      {/* ── Spin animation ── */}
      <style>{`@keyframes fb-spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Post options bottom sheet ── */}
      {postMenuId !== null && createPortal(
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", zIndex: 9000 }} onClick={() => setPostMenuId(null)} />
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9001, background: "#fff", borderRadius: "28px 28px 0 0", boxShadow: "0 -8px 40px rgba(0,0,0,0.18)", maxHeight: "88vh", overflowY: "auto", animation: "slideUpSheet 0.28s cubic-bezier(0.32,0.72,0,1)" }}>
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 6 }}>
              <div style={{ width: 44, height: 5, background: "#E2E8F0", borderRadius: 99 }} />
            </div>
            <div style={{ padding: "4px 14px 32px", display: "flex", flexDirection: "column", gap: 10 }}>

              {/* Green group */}
              {(() => {
                const menuPost = posts.find(p => p.id === postMenuId);
                const isMyPost = menuPost?.authorId === user.id;
                const greenItems: {svg:React.ReactNode;bg:string;label:string;desc:string;action:()=>void}[] = isMyPost
                  ? [
                      { svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><line x1="10" y1="12" x2="14" y2="12"/></svg>, bg: "#FEF3C7", label: "Archiver le post", desc: "Cette publication sera supprimée du fil pour tout le monde.", action: () => { if (postMenuId !== null) archivePost(postMenuId); } },
                      { svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#16C24A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>, bg: "#DCFCE7", label: "Activer les notifications", desc: "Recevez des notifications pour cette publication.", action: () => setPostMenuId(null) },
                    ]
                  : [
                      { svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#16C24A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>, bg: "#DCFCE7", label: "Ça m'intéresse", desc: "Vous verrez plus de publications de ce type.", action: () => setPostMenuId(null) },
                      { svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#16C24A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>, bg: "#DCFCE7", label: "Enregistrer la publication", desc: "Ajoutez ceci à vos éléments enregistrés.", action: () => { if (postMenuId !== null) toggleSave(postMenuId); setPostMenuId(null); } },
                      { svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#16C24A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>, bg: "#DCFCE7", label: "Activer les notifications", desc: "Recevez des notifications pour cette publication.", action: () => setPostMenuId(null) },
                    ];
                return (
              <div style={{ background: "#F8FAFC", borderRadius: 20, overflow: "hidden" }}>
                {(greenItems).map((item, i, arr) => (
                  <button key={i} onClick={item.action} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", borderBottom: i < arr.length - 1 ? "1px solid #F1F5F9" : "none", textAlign: "left" }}>
                    <div style={{ width: 42, height: 42, borderRadius: "50%", background: item.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{item.svg}</div>
                    <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>{item.label}</div><div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 2 }}>{item.desc}</div></div>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                ))}
              </div>
                );
              })()}

              {/* Blue group */}
              <div style={{ background: "#F8FAFC", borderRadius: 20, overflow: "hidden" }}>
                {([
                  { svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#3B82F6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>, bg: "#DBEAFE", label: "Partager", desc: "Envoyez cette publication à vos amis.", action: () => setPostMenuId(null) },
                  { svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#3B82F6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>, bg: "#DBEAFE", label: "Copier le lien", desc: "Copiez le lien de cette publication.", action: () => setPostMenuId(null) },
                ] as {svg:React.ReactNode;bg:string;label:string;desc:string;action:()=>void}[]).map((item, i, arr) => (
                  <button key={i} onClick={item.action} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", borderBottom: i < arr.length - 1 ? "1px solid #F1F5F9" : "none", textAlign: "left" }}>
                    <div style={{ width: 42, height: 42, borderRadius: "50%", background: item.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{item.svg}</div>
                    <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>{item.label}</div><div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 2 }}>{item.desc}</div></div>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                ))}
              </div>

              {/* Gray group */}
              <div style={{ background: "#F8FAFC", borderRadius: 20, overflow: "hidden" }}>
                {([
                  { svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#475569" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>, bg: "#F1F5F9", label: "Masquer cette publication", desc: "Moins de publications comme celle-ci.", action: () => setPostMenuId(null) },
                  { svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#475569" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>, bg: "#F1F5F9", label: "Ne plus voir ce type de contenu", desc: "Vous verrez moins de publications de ce type.", action: () => setPostMenuId(null) },
                ] as {svg:React.ReactNode;bg:string;label:string;desc:string;action:()=>void}[]).map((item, i, arr) => (
                  <button key={i} onClick={item.action} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", borderBottom: i < arr.length - 1 ? "1px solid #F1F5F9" : "none", textAlign: "left" }}>
                    <div style={{ width: 42, height: 42, borderRadius: "50%", background: item.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{item.svg}</div>
                    <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>{item.label}</div><div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 2 }}>{item.desc}</div></div>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                ))}
              </div>

              {/* Red group */}
              <div style={{ background: "#FFF5F5", borderRadius: 20, overflow: "hidden" }}>
                {([
                  { svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="#EF4444"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15" stroke="#EF4444" strokeWidth="2"/></svg>, bg: "#FEE2E2", label: "Signaler la publication", desc: "L'auteur ne saura pas qui a signalé.", action: () => setPostMenuId(null) },
                  { svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>, bg: "#FEE2E2", label: "Bloquer cet utilisateur", desc: "Vous ne verrez plus ses publications.", action: () => setPostMenuId(null) },
                ] as {svg:React.ReactNode;bg:string;label:string;desc:string;action:()=>void}[]).map((item, i, arr) => (
                  <button key={i} onClick={item.action} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", borderBottom: i < arr.length - 1 ? "1px solid #FEE2E2" : "none", textAlign: "left" }}>
                    <div style={{ width: 42, height: 42, borderRadius: "50%", background: item.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{item.svg}</div>
                    <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 15, color: "#EF4444" }}>{item.label}</div><div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 2 }}>{item.desc}</div></div>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#FCA5A5" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                ))}
              </div>

              <button onClick={() => setPostMenuId(null)} style={{ width: "100%", background: "#F8FAFC", border: "none", borderRadius: 20, padding: "16px", fontWeight: 700, fontSize: 16, color: "#475569", cursor: "pointer" }}>
                Annuler
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* ── Quick post modal ── */}
      {showModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{ background: "#fff", borderRadius: 10, width: "100%", maxWidth: 500, overflow: "hidden" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid #e4e6eb" }}>
              <span style={{ fontWeight: 700, fontSize: 17 }}>Créer une publication</span>
              <button onClick={() => setShowModal(false)} style={{ background: "#e4e6eb", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontSize: 16, fontWeight: 700 }}>✕</button>
            </div>
            <div style={{ padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                {user.avatarUrl
                  ? <img src={user.avatarUrl} alt="Avatar" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
                  : <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#42B72A", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15 }}>{userInitials}</div>
                }
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{user.name}</div>
                  <div style={{ fontSize: 12, color: "#65676b" }}>🌐 Public</div>
                </div>
              </div>
              <textarea
                style={{ width: "100%", border: "none", outline: "none", resize: "none", fontSize: 18, minHeight: 120, color: "#050505", fontFamily: "inherit", lineHeight: 1.5, background: "transparent" }}
                placeholder={`Quoi de neuf, ${user.name.split(" ")[0]} ?`}
                value={newPost}
                onChange={e => setNewPost(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{ padding: "0 14px 14px" }}>
              <button
                onClick={submitPost}
                disabled={submitting || !newPost.trim()}
                style={{
                  width: "100%", background: !newPost.trim() ? "#bec3c9" : "#1877F2",
                  color: "#fff", border: "none", borderRadius: 6,
                  padding: "10px", fontWeight: 700, fontSize: 16,
                  cursor: !newPost.trim() ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? "Publication…" : "Publier"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
