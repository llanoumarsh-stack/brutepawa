import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "../router";
import { apiGetPosts, apiCreatePost, apiLikePost, apiGetStories, apiToggleSaved, type FeedPost, type StoryGroup } from "../lib/api";
import StoryViewer from "../components/StoryViewer";
import { storyDraftStore } from "../lib/storyDraft";

/* ── Mini music card for feed posts ─────────────────────────── */
function FeedMusicCard({ trackName, artist, artworkUrl, url, duration, onClick }: {
  trackName: string; artist: string; artworkUrl: string | null;
  url: string | null; duration: string | null; onClick: () => void;
}) {
  const [playing, setPlaying]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent]   = useState("0:00");
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
    a.addEventListener("ended", () => { setPlaying(false); setProgress(0); setCurrent("0:00"); });
    return () => { a.pause(); a.src = ""; };
  }, [url]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().catch(() => {}); setPlaying(true); }
  };

  return (
    <div
      onClick={onClick}
      style={{ margin: "0 14px 12px", background: "#fff", borderRadius: 16, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", cursor: "pointer" }}
    >
      {/* Album art */}
      <div style={{ width: 52, height: 52, borderRadius: 10, overflow: "hidden", background: "#F1F5F9", flexShrink: 0 }}>
        {artworkUrl
          ? <img src={artworkUrl} alt={trackName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#E2E8F0" }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="#94A3B8"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
            </div>
        }
      </div>

      {/* Track info + progress */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
          <div style={{ width: 15, height: 15, borderRadius: "50%", background: "#22C55E", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" width="9" height="9" fill="#fff"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{trackName}</span>
        </div>
        <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 6, paddingLeft: 20, fontWeight: 500 }}>{artist}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9.5, color: "#94A3B8", flexShrink: 0, minWidth: 24, fontWeight: 600 }}>{current}</span>
          <div style={{ flex: 1, height: 3, background: "#E2E8F0", borderRadius: 3, position: "relative" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg,#22C55E,#16A34A)", borderRadius: 3, position: "relative" }}>
              <div style={{ position: "absolute", right: -4, top: "50%", transform: "translateY(-50%)", width: 9, height: 9, borderRadius: "50%", background: "#22C55E" }} />
            </div>
          </div>
          <span style={{ fontSize: 9.5, color: "#94A3B8", flexShrink: 0, minWidth: 24, textAlign: "right", fontWeight: 600 }}>{duration ?? "0:00"}</span>
        </div>
      </div>

      {/* Play/pause */}
      <button onClick={toggle} style={{ width: 36, height: 36, borderRadius: "50%", background: "#0F172A", border: "none", cursor: url ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: url ? 1 : 0.35 }}>
        {playing
          ? <svg viewBox="0 0 24 24" width="16" height="16" fill="#fff"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          : <svg viewBox="0 0 24 24" width="16" height="16" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
        }
      </button>

      {/* Visualizer bars */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, flexShrink: 0, height: 18 }}>
        {[8, 14, 11, 16, 9].map((h, i) => (
          <div key={i} style={{ width: 2.5, borderRadius: 2, background: "#22C55E", height: playing ? h : 4, transition: `height ${0.2 + i * 0.07}s ease` }} />
        ))}
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

  // Lock body scroll when bottom sheet is open to prevent layout shift
  useEffect(() => {
    if (postMenuId !== null) {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
    } else {
      const scrollY = document.body.style.top;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
      if (scrollY) window.scrollTo(0, -parseInt(scrollY));
    }
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
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
          {/* Brand logo text */}
          <span style={{
            color: "#1877F2", fontWeight: 900, fontSize: 28,
            fontFamily: "'Georgia', serif", fontStyle: "italic", letterSpacing: -1,
            lineHeight: 1,
          }}>
            brutepawa
          </span>

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
              ? <img src={user.avatarUrl} alt="moi" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
              : <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#42B72A", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{userInitials}</div>
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
                  ? <img src={post.authorAvatarUrl} alt={post.authorName} onClick={() => navigate(`/user/${post.authorId}`)}
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
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1877F2", cursor: "pointer" }}>· Suivre</span>
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
                // Detect "♪ TrackName — Artist" or "♫ ..." in content
                const parsed = !post.musicTrackName && post.content
                  ? post.content.match(/^[♪♫]\s*(.+?)\s*[—–-]\s*(.+)$/)
                  : null;

                const musicTrack = post.musicTrackName ?? (parsed ? parsed[1].trim() : null);
                const musicArtist = post.musicArtist ?? (parsed ? parsed[2].trim() : null);
                const isMusicContent = !!parsed; // content was the music info, don't show as text

                return (
                  <>
                    {/* Show content text only if it's not purely a music tag */}
                    {post.content && !isMusicContent && !post.musicTrackName && (
                      <div style={{ padding: "0 14px 10px", fontSize: 15, color: "#050505", lineHeight: 1.5 }}>
                        {post.content}
                      </div>
                    )}
                    {/* Show content text for posts that have both caption AND music */}
                    {post.content && post.musicTrackName && (
                      <div style={{ padding: "0 14px 10px", fontSize: 15, color: "#050505", lineHeight: 1.5 }}>
                        {post.content}
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
                <div style={{ margin: "0 0 0 0", overflow: "hidden" }}>
                  <img src={post.imageUrl} alt="" style={{ width: "100%", maxHeight: 420, objectFit: "cover", display: "block" }} />
                </div>
              )}

              {/* Stats bar */}
              {(post.likesCount > 0 || post.commentsCount > 0) && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px 6px", fontSize: 13, color: "#65676b" }}>
                  {post.likesCount > 0 ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ display: "flex" }}>
                        <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#22C55E", border: "1.5px solid #fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg viewBox="0 0 24 24" width="11" height="11" fill="#fff"><path d="M7 10v12M15 5.88L14 10h5.83A2 2 0 0 1 21.83 12.49L19.04 19.5A2 2 0 0 1 17.12 21H7a2 2 0 0 1-2-2v-8.5a2 2 0 0 1 .586-1.414L10 5H13a2 2 0 0 1 2 2v-.12z"/></svg>
                        </div>
                        {post.likesCount > 4 && (
                          <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#F43F5E", border: "1.5px solid #fff", marginLeft: -5, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg viewBox="0 0 24 24" width="11" height="11" fill="#fff"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                          </div>
                        )}
                        {post.likesCount > 10 && (
                          <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#F97316", border: "1.5px solid #fff", marginLeft: -5, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg viewBox="0 0 24 24" width="11" height="11" fill="#fff"><path d="M12 2c0 0-6 6-6 11a6 6 0 0 0 12 0c0-5-6-11-6-11z"/></svg>
                          </div>
                        )}
                      </div>
                      <span style={{ color: "#65676b" }}>{formatNumber(post.likesCount)}</span>
                    </div>
                  ) : <div />}
                  {post.commentsCount > 0 && (
                    <span style={{ cursor: "pointer", color: "#65676b" }} onClick={() => navigate(`/post/${post.id}`)}>
                      {formatNumber(post.commentsCount)} commentaire{post.commentsCount > 1 ? "s" : ""}
                    </span>
                  )}
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
      {postMenuId !== null && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200 }}
          onClick={() => setPostMenuId(null)}
        >
          <div
            style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#fff", borderRadius: "20px 20px 0 0", padding: "8px 0 32px" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 40, height: 4, background: "#e0e0e0", borderRadius: 2, margin: "8px auto 16px" }} />
            {[
              { svg: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#050505" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>, label: "Enregistrer la publication", danger: false, action: () => { if (postMenuId !== null) toggleSave(postMenuId); setPostMenuId(null); } },
              { svg: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#050505" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line x1="4" y1="4" x2="20" y2="20"/></svg>, label: "Désactiver les notifications", danger: false, action: () => setPostMenuId(null) },
              { svg: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#050505" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>, label: "Partager sur votre journal", danger: false, action: () => setPostMenuId(null) },
              { svg: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#050505" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>, label: "Copier le lien", danger: false, action: () => setPostMenuId(null) },
              { svg: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#050505" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>, label: "Masquer la publication", danger: false, action: () => setPostMenuId(null) },
              { svg: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#E53935" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>, label: "Signaler la publication", danger: true, action: () => setPostMenuId(null) },
            ].map(item => (
              <button
                key={item.label}
                onClick={item.action}
                style={{ width: "100%", background: "none", border: "none", padding: "14px 20px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", textAlign: "left" }}
              >
                <span style={{ width: 28, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{item.svg}</span>
                <span style={{ fontSize: 15, color: item.danger ? "#E53935" : "#050505" }}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
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
