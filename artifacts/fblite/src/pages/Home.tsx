import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "../router";
import { Post } from "../lib/store";
import { formatNumber } from "../data/mock";
import { apiGetStories, apiGetComments, apiPostComment, apiPostVoiceComment, apiUploadVoice, apiDeleteComment, apiToggleCommentLike, apiToggleSaved, apiReportPost, type StoryGroup, type PostComment } from "../lib/api";
import StoryViewer from "../components/StoryViewer";
import VoiceRecorder from "../components/VoiceRecorder";
import VoicePlayer from "../components/VoicePlayer";
import { storyDraftStore } from "../lib/storyDraft";

const AVATAR_COLORS = ["#42B72A","#E91E63","#9C27B0","#F57C00","#388E3C","#212121","#D32F2F","#00838F"];

function getInitials(name?: string) {
  if (!name) return "??";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

const REACTIONS = [
  { id: "like",  label: "J'aime",    emoji: "👍", color: "#1877F2" },
  { id: "love",  label: "J'adore",   emoji: "❤️", color: "#F33E58" },
  { id: "care",  label: "Solidaire", emoji: "🫂", color: "#F7B125" },
  { id: "haha",  label: "Haha",      emoji: "😆", color: "#F7B125" },
  { id: "wow",   label: "Wouah",     emoji: "😮", color: "#F7B125" },
  { id: "sad",   label: "Triste",    emoji: "😢", color: "#748FD5" },
  { id: "angry", label: "En colère", emoji: "😡", color: "#E9710F" },
];

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return "À l'instant";
  if (s < 3600)  return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} j`;
}

interface Props {
  posts?: Post[];
  postsLoading?: boolean;
  onLike?: (id: number) => void;
  onNewPost?: (content: string) => void;
  newPosts?: Post[];
}


type PostMenu = {
  postId: number;
  authorName: string;
};

export default function Home({ posts = [], postsLoading = false, onLike, newPosts = [] }: Props) {
  const navigate = useNavigate();
  const rawUser = localStorage.getItem("fb_user");
  const user = rawUser ? JSON.parse(rawUser) as { name: string; email: string; avatarUrl?: string; flag?: string; id?: number } : { name: "Moi", email: "" };
  const userInitials = user.name ? user.name.slice(0, 2).toUpperCase() : "ME";

  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerGroupIdx, setViewerGroupIdx] = useState(0);
  const storyFileRef = useRef<HTMLInputElement>(null);

  const handleStoryFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (e.target) e.target.value = "";
    const previewUrl = URL.createObjectURL(file);
    storyDraftStore.set({ file, previewUrl });
    navigate("/create-story");
  };

  const loadStories = useCallback(async () => {
    try { setStoryGroups(await apiGetStories()); } catch { setStoryGroups([]); }
  }, []);

  useEffect(() => { loadStories(); }, [loadStories]);

  const allPosts = [...newPosts, ...posts];

  const [showComments, setShowComments] = useState<number | null>(null);
  const [comments, setComments] = useState<Record<number, PostComment[]>>({});
  const [newComment, setNewComment] = useState<Record<number, string>>({});
  const [submittingComment, setSubmittingComment] = useState<number | null>(null);
  // reply state
  const [replyingTo, setReplyingTo]           = useState<number | null>(null);
  const [replyContextName, setReplyContextName] = useState<string>("");
  const [replyContextPostId, setReplyContextPostId] = useState<number | null>(null);
  const commentInputRef = useRef<Record<number, HTMLInputElement | null>>({});

  // Voice recorder
  const [voiceMode, setVoiceMode] = useState<number | null>(null);

  // Reaction picker
  const [reactionType, setReactionType] = useState<Record<number, string>>({});
  const [showReactionPicker, setShowReactionPicker] = useState<number | null>(null);
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadComments = useCallback(async (postId: number) => {
    try {
      const data = await apiGetComments(postId);
      setComments(prev => ({ ...prev, [postId]: data }));
    } catch { /* silent */ }
  }, []);

  const toggleComments = (postId: number) => {
    if (showComments === postId) {
      setShowComments(null);
    } else {
      setShowComments(postId);
      loadComments(postId);
    }
  };

  const startReply = (comment: PostComment, postId: number) => {
    setReplyingTo(comment.id);
    setReplyContextName(`${comment.authorFirstName} ${comment.authorLastName}`);
    setReplyContextPostId(postId);
    setNewComment(prev => ({ ...prev, [postId]: "" }));
    setTimeout(() => commentInputRef.current[postId]?.focus(), 80);
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setReplyContextName("");
    setReplyContextPostId(null);
  };

  const toggleCommentLike = async (postId: number, commentId: number) => {
    // Optimistic update
    setComments(prev => ({
      ...prev,
      [postId]: (prev[postId] ?? []).map(c =>
        c.id === commentId
          ? { ...c, likedByMe: !c.likedByMe, likesCount: c.likedByMe ? Math.max(0, c.likesCount - 1) : c.likesCount + 1 }
          : c,
      ),
    }));
    try {
      const { liked, likesCount } = await apiToggleCommentLike(postId, commentId);
      setComments(prev => ({
        ...prev,
        [postId]: (prev[postId] ?? []).map(c =>
          c.id === commentId ? { ...c, likedByMe: liked, likesCount } : c,
        ),
      }));
    } catch {
      // Revert optimistic update on error
      setComments(prev => ({
        ...prev,
        [postId]: (prev[postId] ?? []).map(c =>
          c.id === commentId
            ? { ...c, likedByMe: !c.likedByMe, likesCount: c.likedByMe ? c.likesCount + 1 : Math.max(0, c.likesCount - 1) }
            : c,
        ),
      }));
    }
  };

  // Post menu & actions
  const [openMenu, setOpenMenu] = useState<PostMenu | null>(null);
  const [savedPosts, setSavedPosts] = useState<Set<number>>(new Set());
  const [notifPosts, setNotifPosts] = useState<Set<number>>(new Set());
  const [hiddenPosts, setHiddenPosts] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  // Lock body scroll when bottom sheet is open to prevent layout shift
  useEffect(() => {
    if (openMenu) {
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
  }, [openMenu]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const closeMenu = () => setOpenMenu(null);

  const handleSave = (postId: number) => {
    const alreadySaved = savedPosts.has(postId);
    setSavedPosts(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId); else next.add(postId);
      return next;
    });
    showToast(alreadySaved ? "Publication retirée des enregistrements" : "✅ Publication enregistrée");
    apiToggleSaved(postId).catch(() => {
      setSavedPosts(prev => {
        const next = new Set(prev);
        if (alreadySaved) next.add(postId); else next.delete(postId);
        return next;
      });
    });
    closeMenu();
  };

  const handleNotif = (postId: number) => {
    setNotifPosts(prev => {
      const next = new Set(prev);
      if (next.has(postId)) { next.delete(postId); showToast("🔕 Notifications désactivées pour cette publication"); }
      else { next.add(postId); showToast("🔔 Vous recevrez des notifications pour cette publication"); }
      return next;
    });
    closeMenu();
  };

  const handleHide = (postId: number) => {
    setHiddenPosts(prev => new Set([...prev, postId]));
    showToast("Publication masquée. Vous verrez moins de contenus similaires.");
    closeMenu();
  };

  const handleReport = (authorName: string, postId: number) => {
    showToast(`🚩 Publication signalée. ${authorName} ne saura pas qui l'a signalé(e).`);
    apiReportPost(postId, "inappropriate").catch(() => {});
    closeMenu();
  };

  const handleCopyLink = (postId: number) => {
    const link = `https://brutepawa.app/post/${postId}`;
    navigator.clipboard?.writeText(link).catch(() => {});
    showToast("🔗 Lien copié dans le presse-papier");
    closeMenu();
  };

  const handleShare = (postId: number) => {
    const link = `https://brutepawa.app/post/${postId}`;
    if (navigator.share) {
      navigator.share({ title: "Publication Brute Pawa", url: link }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(link).catch(() => {});
      showToast("↗️ Lien copié pour partage");
    }
    closeMenu();
  };

  const handleInterest = (interested: boolean) => {
    showToast(interested
      ? "👍 Vous verrez plus de publications de ce type"
      : "👎 Vous verrez moins de publications de ce type");
    closeMenu();
  };

  const toggleLike = (id: number) => {
    onLike?.(id);
  };

  const quickLike = (postId: number, isLiked: boolean) => {
    if (showReactionPicker === postId) { setShowReactionPicker(null); return; }
    if (!isLiked) {
      setReactionType(prev => ({ ...prev, [postId]: "like" }));
    } else {
      setReactionType(prev => { const n = { ...prev }; delete n[postId]; return n; });
    }
    onLike?.(postId);
  };

  const selectReaction = (postId: number, reactionId: string, isLiked: boolean) => {
    const current = reactionType[postId];
    if (current === reactionId) {
      setReactionType(prev => { const n = { ...prev }; delete n[postId]; return n; });
      if (isLiked) onLike?.(postId);
    } else if (!isLiked) {
      setReactionType(prev => ({ ...prev, [postId]: reactionId }));
      onLike?.(postId);
    } else {
      setReactionType(prev => ({ ...prev, [postId]: reactionId }));
    }
    setShowReactionPicker(null);
  };

  const startReactionTimer = (postId: number) => {
    reactionTimerRef.current = setTimeout(() => setShowReactionPicker(postId), 500);
  };
  const cancelReactionTimer = () => {
    if (reactionTimerRef.current) { clearTimeout(reactionTimerRef.current); reactionTimerRef.current = null; }
  };

  const submitComment = async (postId: number) => {
    const text = (newComment[postId] ?? "").trim();
    if (!text || submittingComment === postId) return;
    setSubmittingComment(postId);
    setNewComment(prev => ({ ...prev, [postId]: "" }));
    const parentId = replyContextPostId === postId && replyingTo != null ? replyingTo : undefined;
    if (parentId != null) cancelReply();
    try {
      const comment = await apiPostComment(postId, text, parentId);
      setComments(prev => ({ ...prev, [postId]: [...(prev[postId] ?? []), comment] }));
    } catch {
      setNewComment(prev => ({ ...prev, [postId]: text }));
    } finally {
      setSubmittingComment(null);
    }
  };

  const submitVoiceComment = async (postId: number, blob: Blob, duration: number) => {
    const parentId = replyContextPostId === postId && replyingTo != null ? replyingTo : undefined;
    if (parentId != null) cancelReply();
    const { url } = await apiUploadVoice(blob, duration);
    const comment = await apiPostVoiceComment(postId, url, Math.round(duration), parentId);
    setComments(prev => ({ ...prev, [postId]: [...(prev[postId] ?? []), comment] }));
    setVoiceMode(null);
  };

  const deleteComment = async (postId: number, commentId: number) => {
    try {
      await apiDeleteComment(postId, commentId);
      setComments(prev => ({ ...prev, [postId]: (prev[postId] ?? []).filter(c => c.id !== commentId) }));
    } catch { /* silent */ }
  };


  const visiblePosts = allPosts.filter(p => !hiddenPosts.has(p.id));

  return (
    <div className="feed-container" style={{ paddingBottom: 80 }}>

      {viewerOpen && storyGroups.length > 0 && (
        <StoryViewer
          groups={storyGroups}
          initialGroupIndex={viewerGroupIdx}
          onClose={() => { setViewerOpen(false); loadStories(); }}
          onAuthorClick={authorId => {
            setViewerOpen(false);
            navigate(authorId === user.id ? "/profile" : `/user/${authorId}`);
          }}
        />
      )}

      {/* ─── Create post card ─── */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e4e6eb", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        {/* Top row: avatar + input + icons */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px 10px" }}>
          {user.avatarUrl
            ? <img src={user.avatarUrl} alt="Avatar" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
            : <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#42B72A", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>{userInitials}</div>
          }
          <div
            onClick={() => navigate("/create-post")}
            style={{ flex: 1, background: "#f0f2f5", borderRadius: 30, padding: "11px 16px", fontSize: 15, color: "#8a8d91", cursor: "pointer", fontWeight: 400, lineHeight: 1 }}
          >
            Quoi de neuf, {user.name.split(" ")[0]} ?
          </div>
          {/* Photo icon */}
          <button onClick={() => navigate("/create-post")} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="16" rx="3" stroke="#65676b" strokeWidth="1.8"/><circle cx="9" cy="12" r="3" stroke="#65676b" strokeWidth="1.8"/><path d="M2 9l5-5 3 4" stroke="#65676b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="17" cy="8" r="1.5" fill="#65676b"/></svg>
          </button>
          {/* Mic icon */}
          <button onClick={() => navigate("/create-post")} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><rect x="9" y="2" width="6" height="12" rx="3" stroke="#42B72A" strokeWidth="1.8"/><path d="M5 11a7 7 0 0 0 14 0" stroke="#42B72A" strokeWidth="1.8" strokeLinecap="round"/><path d="M12 18v4M9 22h6" stroke="#42B72A" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "#e4e6eb", margin: "0 14px" }} />

        {/* Action buttons row */}
        <div style={{ display: "flex", overflowX: "auto", scrollbarWidth: "none" as const }}>
          {[
            { label: "Photo",       icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="3" fill="#45BD62"/><circle cx="12" cy="12" r="4" fill="#fff" fillOpacity=".9"/><circle cx="9" cy="7" r="1.5" fill="#fff" fillOpacity=".7"/></svg>, action: "/create-post" },
            { label: "Vocal",       icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="8" y="2" width="8" height="12" rx="4" fill="#E91E63"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>, action: "/create-post" },
            { label: "Vidéo",       icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="2" y="6" width="14" height="12" rx="2" fill="#E53935"/><path d="M16 9l5-3v12l-5-3V9z" fill="#E53935"/></svg>, action: "/create-post" },
            { label: "Localisation", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#E91E63"/><circle cx="12" cy="9" r="2.5" fill="#fff"/></svg>, action: "/create-post" },
            { label: "Humeur",      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#FFC107"/><path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/><circle cx="9" cy="10" r="1.5" fill="#fff"/><circle cx="15" cy="10" r="1.5" fill="#fff"/></svg>, action: "/create-post" },
            { label: "Sondage",     icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="4" y="15" width="4" height="6" rx="1" fill="#1877F2"/><rect x="10" y="10" width="4" height="11" rx="1" fill="#1877F2"/><rect x="16" y="5" width="4" height="16" rx="1" fill="#1877F2"/></svg>, action: "/create-post" },
          ].map((btn, i, arr) => (
            <button
              key={btn.label}
              onClick={() => navigate(btn.action)}
              style={{ flex: "0 0 auto", display: "flex", flexDirection: "column" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 4, padding: "10px 14px 12px", background: "none", border: "none", cursor: "pointer", borderRight: i < arr.length - 1 ? "1px solid #e4e6eb" : "none", minWidth: 80 }}
            >
              {btn.icon}
              <span style={{ fontSize: 12, fontWeight: 600, color: "#444", whiteSpace: "nowrap" as const }}>{btn.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Stories Row ─── */}
      <input ref={storyFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleStoryFileSelect} />
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e4e6eb", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "12px 10px 10px" }}>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none" as const, alignItems: "flex-start" }}>

          {/* ── Créer une story — rectangle vert ── */}
          <div onClick={() => storyFileRef.current?.click()} style={{ flex: "0 0 auto", cursor: "pointer", display: "flex", flexDirection: "column" as const, alignItems: "center" as const }}>
            <div style={{
              width: 92, height: 130, borderRadius: 12, overflow: "hidden", position: "relative",
              background: "linear-gradient(175deg, #42B72A 0%, #2a7d18 100%)",
              display: "flex", flexDirection: "column" as const, alignItems: "center" as const, justifyContent: "center",
            }}>
              {user.avatarUrl && <img src={user.avatarUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.25 }} />}
              <div style={{ position: "relative", zIndex: 1, color: "#fff", fontWeight: 900, fontSize: 28, lineHeight: 1, marginBottom: 12 }}>{userInitials}</div>
              <div style={{ position: "relative", zIndex: 1, width: 30, height: 30, borderRadius: "50%", background: "#42B72A", border: "2.5px solid #fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              </div>
            </div>
            <div style={{ marginTop: 5, textAlign: "center" as const }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#050505", lineHeight: 1.3 }}>Créer</div>
              <div style={{ fontSize: 11, color: "#65676b", lineHeight: 1.3 }}>une story</div>
            </div>
          </div>

          {/* ── User story cards — CIRCULAIRES ── */}
          {storyGroups.map((group, idx) => {
            const initials = group.authorName.slice(0, 2).toUpperCase();
            const avatarBg = AVATAR_COLORS[group.authorId % AVATAR_COLORS.length];
            const preview = group.stories[0];
            const ringColors = ["#42B72A","#1877F2","#E91E63","#FF9800","#9C27B0","#E53935"];
            const ring = ringColors[group.authorId % ringColors.length];
            return (
              <div key={group.authorId} onClick={() => { setViewerGroupIdx(idx); setViewerOpen(true); }}
                style={{ flex: "0 0 auto", cursor: "pointer", display: "flex", flexDirection: "column" as const, alignItems: "center" as const }}>
                {/* Circular avatar with colored ring */}
                <div style={{ width: 76, height: 76, borderRadius: "50%", padding: 3, background: `linear-gradient(135deg, ${ring}, ${ring}99)`, boxSizing: "border-box" as const, position: "relative" }}>
                  <div style={{ width: "100%", height: "100%", borderRadius: "50%", border: "2.5px solid #fff", overflow: "hidden", background: avatarBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {group.authorAvatarUrl
                      ? <img src={group.authorAvatarUrl} alt={group.authorName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : (preview?.mediaUrl
                          ? <img src={preview.mediaUrl} alt={group.authorName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <span style={{ color: "#fff", fontWeight: 800, fontSize: 22 }}>{initials}</span>)
                    }
                  </div>
                  {/* Online dot */}
                  <div style={{ position: "absolute", bottom: 3, right: 3, width: 14, height: 14, borderRadius: "50%", background: "#42B72A", border: "2px solid #fff" }} />
                </div>
                <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: "#050505", textAlign: "center" as const, maxWidth: 76, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                  {group.authorName.split(" ")[0]}
                </div>
              </div>
            );
          })}

          {/* ── Voir plus ── */}
          {storyGroups.length >= 3 && (
            <div style={{ flex: "0 0 auto", cursor: "pointer", display: "flex", flexDirection: "column" as const, alignItems: "center" as const }}>
              <div style={{ width: 76, height: 76, borderRadius: "50%", background: "#f0f2f5", border: "1px solid #e4e6eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="5" cy="12" r="1.8" fill="#65676b"/><circle cx="12" cy="12" r="1.8" fill="#65676b"/><circle cx="19" cy="12" r="1.8" fill="#65676b"/></svg>
              </div>
              <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: "#65676b", textAlign: "center" as const }}>Voir plus</div>
            </div>
          )}

          {storyGroups.length === 0 && (
            <div style={{ display: "flex", alignItems: "center", height: 76, padding: "0 8px", color: "#65676b", fontSize: 12, fontStyle: "italic" }}>
              Sois le premier à publier une story !
            </div>
          )}
        </div>
      </div>

      {/* Loading skeleton */}
      {postsLoading && (
        <div style={{ textAlign: "center", padding: "32px 20px", color: "var(--fb-text-secondary)" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
          <div style={{ fontSize: 14 }}>Chargement des publications…</div>
        </div>
      )}

      {/* Posts Feed */}
      {!postsLoading && visiblePosts.map(post => {
        const displayName = post.authorName ?? "Utilisateur";
        const displayInitials = getInitials(displayName);
        const displayColor = post.authorAvatarUrl ? undefined : "#42B72A";
        const postComments = comments[post.id] ?? [];
        return (
          <div key={post.id} className="post-card">
            {post.sponsored && (
              <div style={{ padding: "6px 16px 0", fontSize: 12, color: "var(--fb-text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
                <span>📢</span> {post.sponsorTag}
              </div>
            )}
            <div className="post-header">
              {post.authorAvatarUrl ? (
                <img
                  src={post.authorAvatarUrl} alt={displayName} className="avatar"
                  style={{ width: 40, height: 40, objectFit: "cover", flexShrink: 0, borderRadius: "50%", cursor: "pointer" }}
                  onClick={() => navigate(post.authorId === user.id ? "/profile" : `/user/${post.authorId}`)}
                />
              ) : (
                <div
                  className="avatar" style={{ background: displayColor, cursor: "pointer" }}
                  onClick={() => navigate(post.authorId === user.id ? "/profile" : `/user/${post.authorId}`)}
                >{displayInitials}</div>
              )}
              <div className="post-meta">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div
                    className="post-author"
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate(post.authorId === user.id ? "/profile" : `/user/${post.authorId}`)}
                  >{displayName}</div>
                  {!post.sponsored && (
                    <span style={{ color: "#42B72A", fontSize: 12, fontWeight: 700, cursor: "pointer", marginLeft: 2 }}>
                      · Suivre
                    </span>
                  )}
                </div>
                <div className="post-time">🌐 {post.time}</div>
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <button
                  className="post-more"
                  onClick={e => { e.stopPropagation(); setOpenMenu({ postId: post.id, authorName: displayName }); }}
                  style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", padding: "4px 8px", borderRadius: "50%", color: "var(--fb-text-secondary)", lineHeight: 1 }}
                >
                  ···
                </button>
                <button
                  onClick={() => handleHide(post.id)}
                  style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", padding: "4px 6px", borderRadius: "50%", color: "var(--fb-text-secondary)", lineHeight: 1, fontWeight: 700 }}
                >
                  ✕
                </button>
              </div>
            </div>
            {post.content && <div className="post-content">{post.content}</div>}
            {post.emoji && (
              <div className="post-image-emoji" style={{ background: "var(--fb-bg)" }}>{post.emoji}</div>
            )}
            {(post.imageUrl || post.thumbnailUrl) && (() => {
              const mediaUrl = post.imageUrl ?? "";
              const thumb    = post.thumbnailUrl;
              const isVideo  = thumb != null || /\.(mp4|mov|webm|ogg|m4v)(\?.*)?$/i.test(mediaUrl);
              if (isVideo) {
                return (
                  <div
                    onClick={() => navigate(`/video/${post.id}`)}
                    style={{ position: "relative", cursor: "pointer", background: "#000", lineHeight: 0 }}
                  >
                    {thumb
                      ? <img src={thumb} alt="" style={{ width: "100%", maxHeight: 420, objectFit: "cover", display: "block" }} />
                      : <div style={{ width: "100%", height: 260, background: "#111", display: "block" }} />
                    }
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 58, height: 58, borderRadius: "50%", background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <img
                  src={mediaUrl}
                  alt=""
                  style={{ width: "100%", maxHeight: 420, objectFit: "cover", display: "block", borderRadius: 0 }}
                />
              );
            })()}
            {/* ── Stats bar ── */}
            {(post.likes > 0 || (post.comments + postComments.length) > 0 || post.shares > 0) && (
              <div style={{ padding: "6px 14px 4px", display: "flex", alignItems: "center", gap: 12, fontSize: 13.5, color: "#65676b" }}>
                {post.likes > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ display: "inline-flex", position: "relative", width: post.likes > 5 ? 36 : 22, height: 22, flexShrink: 0 }}>
                      <span style={{ position: "absolute", left: 0, fontSize: 17 }}>👍</span>
                      {post.likes > 5 && <span style={{ position: "absolute", left: 15, fontSize: 17 }}>❤️</span>}
                    </span>
                    <span style={{ marginLeft: post.likes > 5 ? 2 : 0 }}>{formatNumber(post.likes)}</span>
                  </div>
                )}
                {(post.comments + postComments.length) > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 3, cursor: "pointer" }} onClick={() => toggleComments(post.id)}>
                    <span style={{ fontSize: 15 }}>💬</span>
                    <span>{formatNumber(post.comments + postComments.length)}</span>
                  </div>
                )}
                {post.shares > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <span style={{ fontSize: 15 }}>↗</span>
                    <span>{formatNumber(post.shares)}</span>
                  </div>
                )}
              </div>
            )}

            {/* ── Action bar ── */}
            <div style={{ display: "flex", borderTop: "1px solid #e4e6eb", borderBottom: "1px solid #e4e6eb", position: "relative" }}>
              {/* Reaction picker backdrop */}
              {showReactionPicker === post.id && (
                <div style={{ position: "fixed", inset: 0, zIndex: 98 }} onClick={() => setShowReactionPicker(null)} />
              )}
              {/* Reaction picker popup */}
              {showReactionPicker === post.id && (
                <div style={{
                  position: "absolute", bottom: "calc(100% + 8px)", left: 4, zIndex: 99,
                  background: "#fff", borderRadius: 30, padding: "8px 14px",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.22)",
                  display: "flex", gap: 8, alignItems: "flex-end",
                }}>
                  {REACTIONS.map(r => (
                    <div
                      key={r.id}
                      onClick={() => selectReaction(post.id, r.id, post.liked)}
                      style={{ textAlign: "center", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}
                    >
                      <div
                        style={{ fontSize: 28, lineHeight: 1, transition: "transform 0.12s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.35) translateY(-4px)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
                      >{r.emoji}</div>
                      <div style={{ fontSize: 10, color: r.color, fontWeight: 700, whiteSpace: "nowrap" }}>{r.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* J'aime */}
              {(() => {
                const rx = REACTIONS.find(r => r.id === (reactionType[post.id] ?? "like")) ?? REACTIONS[0];
                const liked = post.liked;
                return (
                  <button
                    className="post-btn"
                    style={{ flex: 1, borderRight: "1px solid #e4e6eb", color: liked ? rx.color : "#65676b", fontWeight: liked ? 700 : 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                    onClick={() => quickLike(post.id, liked)}
                    onMouseDown={() => startReactionTimer(post.id)}
                    onMouseUp={cancelReactionTimer}
                    onMouseLeave={cancelReactionTimer}
                    onTouchStart={() => startReactionTimer(post.id)}
                    onTouchEnd={cancelReactionTimer}
                    onTouchMove={cancelReactionTimer}
                  >
                    {liked
                      ? <span style={{ fontSize: 17 }}>{rx.emoji}</span>
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                    }
                    {liked ? rx.label : "J'aime"}
                  </button>
                );
              })()}

              {/* Commenter */}
              <button className="post-btn" style={{ flex: 1, borderRight: "1px solid #e4e6eb", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={() => navigate(`/post/${post.id}`)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Commenter
              </button>

              {/* Partager */}
              <button className="post-btn" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={() => handleShare(post.id)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                Partager
              </button>
            </div>

            {/* ── Comment section ── */}
            {showComments === post.id && (() => {
              const topLevel = postComments.filter(c => !c.parentId);
              const replies  = postComments.filter(c => c.parentId);
              return (
                <div style={{ background: "var(--fb-white)" }}>
                  {/* Sort selector */}
                  {topLevel.length > 1 && (
                    <div style={{ padding: "8px 14px 2px" }}>
                      <button style={{ background: "none", border: "none", fontSize: 13, fontWeight: 700, color: "#050505", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
                        Plus pertinents <span style={{ fontSize: 10 }}>▼</span>
                      </button>
                    </div>
                  )}

                  {/* Empty state */}
                  {topLevel.length === 0 && (
                    <div style={{ textAlign: "center", padding: "14px 14px 6px", color: "#65676b", fontSize: 13 }}>
                      Soyez le premier à commenter 💬
                    </div>
                  )}

                  {/* Comment list */}
                  {topLevel.map(c => {
                    const cInitials = getInitials(`${c.authorFirstName} ${c.authorLastName}`);
                    const cReplies  = replies.filter(r => r.parentId === c.id);
                    return (
                      <div key={c.id} style={{ padding: "6px 12px 2px" }}>
                        {/* Comment row */}
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                          {c.authorAvatarUrl
                            ? <img src={c.authorAvatarUrl} alt={cInitials} style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                            : <div className="avatar xs" style={{ width: 34, height: 34, fontSize: 12, flexShrink: 0 }}>{cInitials}</div>
                          }
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Bubble */}
                            <div style={{ display: "inline-block", background: "#f0f2f5", borderRadius: 18, padding: "8px 12px", maxWidth: "calc(100% - 32px)" }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: "#050505", marginBottom: 2 }}>{c.authorFirstName} {c.authorLastName}</div>
                              {c.audioUrl
                                ? <VoicePlayer url={c.audioUrl} duration={c.audioDuration} />
                                : <div style={{ fontSize: 14, color: "#050505", lineHeight: 1.4 }}>{c.content}</div>
                              }
                            </div>
                            {/* Like count badge */}
                            {c.likesCount > 0 && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 2, background: "#fff", borderRadius: 10, padding: "1px 5px 1px 3px", boxShadow: "0 1px 3px rgba(0,0,0,0.18)", fontSize: 12, marginLeft: 4, verticalAlign: "middle" }}>
                                <span>❤️</span><span style={{ color: "#65676b", fontWeight: 600 }}>{c.likesCount}</span>
                              </span>
                            )}
                            {/* Time · J'aime · Répondre · Supprimer */}
                            <div style={{ display: "flex", gap: 12, paddingLeft: 4, marginTop: 3, fontSize: 12, fontWeight: 600, color: "#65676b", alignItems: "center" }}>
                              <span style={{ color: "#aaa", fontWeight: 400 }}>{timeAgo(c.createdAt)}</span>
                              <button onClick={() => toggleCommentLike(post.id, c.id)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, fontWeight: 700, color: c.likedByMe ? "#1877F2" : "#65676b" }}>
                                J'aime
                              </button>
                              <button onClick={() => replyingTo === c.id ? cancelReply() : startReply(c, post.id)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, fontWeight: 700, color: replyingTo === c.id ? "#1877F2" : "#65676b" }}>
                                {replyingTo === c.id ? "Annuler" : "Répondre"}
                              </button>
                              {c.authorId === user.id && (
                                <button onClick={() => deleteComment(post.id, c.id)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#e53935" }}>
                                  Supprimer
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Replies */}
                        {cReplies.length > 0 && (
                          <div style={{ marginLeft: 42, marginTop: 4, display: "flex", flexDirection: "column", gap: 4 }}>
                            {cReplies.map(r => {
                              const rInitials = getInitials(`${r.authorFirstName} ${r.authorLastName}`);
                              return (
                                <div key={r.id} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                                  {r.authorAvatarUrl
                                    ? <img src={r.authorAvatarUrl} alt={rInitials} style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                                    : <div className="avatar xs" style={{ width: 26, height: 26, fontSize: 9, flexShrink: 0 }}>{rInitials}</div>
                                  }
                                  <div style={{ flex: 1 }}>
                                    <div style={{ display: "inline-block", background: "#f0f2f5", borderRadius: 14, padding: "6px 10px", maxWidth: "100%" }}>
                                      <div style={{ fontWeight: 700, fontSize: 12, color: "#050505", marginBottom: 1 }}>{r.authorFirstName} {r.authorLastName}</div>
                                      <div style={{ fontSize: 13, color: "#050505" }}>{r.content}</div>
                                    </div>
                                    {r.likesCount > 0 && (
                                      <span style={{ display: "inline-flex", alignItems: "center", gap: 1, background: "#fff", borderRadius: 10, padding: "1px 4px 1px 2px", boxShadow: "0 1px 3px rgba(0,0,0,0.15)", fontSize: 11, marginLeft: 3, verticalAlign: "middle" }}>
                                        <span>❤️</span><span style={{ color: "#65676b" }}>{r.likesCount}</span>
                                      </span>
                                    )}
                                    <div style={{ display: "flex", gap: 10, paddingLeft: 4, marginTop: 2, fontSize: 11, fontWeight: 600, color: "#65676b" }}>
                                      <span style={{ color: "#aaa", fontWeight: 400 }}>{timeAgo(r.createdAt)}</span>
                                      <button onClick={() => toggleCommentLike(post.id, r.id)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, fontWeight: 700, color: r.likedByMe ? "#1877F2" : "#65676b" }}>J'aime</button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                      </div>
                    );
                  })}

                  {/* ── Reply chip ── */}
                  {replyContextPostId === post.id && replyingTo !== null && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px 2px", fontSize: 12, color: "#65676b" }}>
                      <span>↩️ Répondre à</span>
                      <span style={{ fontWeight: 700, color: "#1877F2" }}>{replyContextName}</span>
                      <button
                        onClick={cancelReply}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: 15, padding: "0 0 0 4px", lineHeight: 1, marginLeft: "auto" }}
                        aria-label="Annuler la réponse"
                      >✕</button>
                    </div>
                  )}

                  {/* ── Bottom comment input bar (Facebook style) ── */}
                  <div style={{ display: "flex", alignItems: voiceMode === post.id ? "flex-start" : "center", gap: 8, padding: "8px 12px 12px", borderTop: topLevel.length > 0 ? "1px solid #e4e6eb" : "none", marginTop: 6 }}>
                    {voiceMode !== post.id && (
                      user.avatarUrl
                        ? <img src={user.avatarUrl} alt="moi" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                        : <div className="avatar xs" style={{ width: 34, height: 34, fontSize: 12, flexShrink: 0, background: "#42B72A" }}>{userInitials}</div>
                    )}

                    {voiceMode === post.id ? (
                      <VoiceRecorder
                        onSend={(blob, dur) => submitVoiceComment(post.id, blob, dur)}
                        onCancel={() => setVoiceMode(null)}
                        disabled={submittingComment === post.id}
                      />
                    ) : (
                      <div style={{ flex: 1, background: "#f0f2f5", borderRadius: 22, display: "flex", alignItems: "center", padding: "0 6px 0 14px", gap: 4 }}>
                        <input
                          ref={el => { commentInputRef.current[post.id] = el; }}
                          style={{ flex: 1, background: "transparent", border: "none", padding: "9px 0", fontSize: 14, outline: "none", color: "#050505", minWidth: 0 }}
                          placeholder={replyContextPostId === post.id && replyingTo != null ? `Répondre à ${replyContextName.split(" ")[0]}…` : `Commenter en tant que ${user.name.split(" ")[0]}…`}
                          value={newComment[post.id] ?? ""}
                          onChange={e => setNewComment(prev => ({ ...prev, [post.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === "Enter") submitComment(post.id); if (e.key === "Escape" && replyingTo) cancelReply(); }}
                          disabled={submittingComment === post.id}
                        />
                        {!(newComment[post.id] ?? "").trim() ? (
                          <div style={{ display: "flex", gap: 0, flexShrink: 0 }}>
                            {[{ icon: "🙂", key: "emoji" }, { icon: "GIF", key: "gif" }, { icon: "😊", key: "sticker" }].map(b => (
                              <button key={b.key} style={{ background: "none", border: "none", padding: "6px 6px", cursor: "pointer", fontSize: b.key === "gif" ? 10 : 16, fontWeight: b.key === "gif" ? 700 : 400, color: "#65676b" }}>{b.icon}</button>
                            ))}
                            <VoiceRecorder
                              onSend={(blob, dur) => submitVoiceComment(post.id, blob, dur)}
                              onCancel={() => setVoiceMode(null)}
                              disabled={submittingComment === post.id}
                            />
                          </div>
                        ) : (
                          <button
                            onClick={() => submitComment(post.id)}
                            disabled={submittingComment === post.id}
                            style={{ background: "none", border: "none", padding: "6px 8px", cursor: "pointer", color: "#1877F2", fontSize: 18, opacity: submittingComment === post.id ? 0.6 : 1, flexShrink: 0 }}
                          >➤</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })}

      {/* Empty state after hiding all */}
      {!postsLoading && visiblePosts.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--fb-text-secondary)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Aucune publication à afficher</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Revenez plus tard ou ajoutez des amis !</div>
        </div>
      )}


      <div style={{ textAlign: "center", padding: "20px 0", color: "var(--fb-text-secondary)", fontSize: 13 }}>
        Vous avez vu toutes les nouvelles publications ✓
      </div>

      {/* ── POST MENU BOTTOM SHEET ──────────────────────────── */}
      {openMenu && createPortal(
        <>
          {/* Backdrop */}
          <div onClick={closeMenu} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", zIndex: 9000 }} />
          {/* Sheet */}
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9001, background: "#fff", borderRadius: "28px 28px 0 0", boxShadow: "0 -8px 40px rgba(0,0,0,0.18)", maxHeight: "88vh", overflowY: "auto", animation: "slideUpSheet 0.28s cubic-bezier(0.32,0.72,0,1)" }}>
            {/* Handle */}
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 6 }}>
              <div style={{ width: 44, height: 5, background: "#E2E8F0", borderRadius: 99 }} />
            </div>

            <div style={{ padding: "4px 14px 32px", display: "flex", flexDirection: "column", gap: 10 }}>

              {/* ── Group 1: positive (green) ── */}
              <div style={{ background: "#F8FAFC", borderRadius: 20, overflow: "hidden" }}>
                {[
                  { svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#16C24A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>, iconBg: "#DCFCE7", label: "Ça m'intéresse", desc: "Vous verrez plus de publications de ce type.", action: () => handleInterest(true) },
                  { svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#16C24A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>, iconBg: "#DCFCE7", label: savedPosts.has(openMenu.postId) ? "Retirer des enregistrements" : "Enregistrer la publication", desc: savedPosts.has(openMenu.postId) ? "Retirer de vos éléments enregistrés." : "Ajoutez ceci à vos éléments enregistrés.", action: () => handleSave(openMenu.postId) },
                  { svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={notifPosts.has(openMenu.postId) ? "#64748B" : "#16C24A"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>{notifPosts.has(openMenu.postId) && <line x1="4" y1="4" x2="20" y2="20"/>}</svg>, iconBg: notifPosts.has(openMenu.postId) ? "#F1F5F9" : "#DCFCE7", label: notifPosts.has(openMenu.postId) ? "Désactiver les notifications" : "Activer les notifications", desc: "Recevez des notifications pour cette publication.", action: () => handleNotif(openMenu.postId) },
                ].map((item, i, arr) => (
                  <button key={i} onClick={item.action} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", borderBottom: i < arr.length - 1 ? "1px solid #F1F5F9" : "none", textAlign: "left" }}>
                    <div style={{ width: 42, height: 42, borderRadius: "50%", background: item.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{item.svg}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>{item.label}</div>
                      <div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 2 }}>{item.desc}</div>
                    </div>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                ))}
              </div>

              {/* ── Group 2: neutral (blue) ── */}
              <div style={{ background: "#F8FAFC", borderRadius: 20, overflow: "hidden" }}>
                {[
                  { svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#3B82F6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>, iconBg: "#DBEAFE", label: "Partager", desc: "Envoyez cette publication à vos amis.", action: () => handleShare(openMenu.postId) },
                  { svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#3B82F6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>, iconBg: "#DBEAFE", label: "Copier le lien", desc: "Copiez le lien de cette publication.", action: () => handleCopyLink(openMenu.postId) },
                ].map((item, i, arr) => (
                  <button key={i} onClick={item.action} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", borderBottom: i < arr.length - 1 ? "1px solid #F1F5F9" : "none", textAlign: "left" }}>
                    <div style={{ width: 42, height: 42, borderRadius: "50%", background: item.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{item.svg}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>{item.label}</div>
                      <div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 2 }}>{item.desc}</div>
                    </div>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                ))}
              </div>

              {/* ── Group 3: control (dark) ── */}
              <div style={{ background: "#F8FAFC", borderRadius: 20, overflow: "hidden" }}>
                {[
                  { svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#475569" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>, iconBg: "#F1F5F9", label: "Masquer cette publication", desc: "Moins de publications comme celle-ci.", action: () => handleHide(openMenu.postId) },
                  { svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#475569" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>, iconBg: "#F1F5F9", label: "Ne plus voir ce type de contenu", desc: "Vous verrez moins de publications de ce type.", action: () => handleInterest(false) },
                ].map((item, i, arr) => (
                  <button key={i} onClick={item.action} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", borderBottom: i < arr.length - 1 ? "1px solid #F1F5F9" : "none", textAlign: "left" }}>
                    <div style={{ width: 42, height: 42, borderRadius: "50%", background: item.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{item.svg}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>{item.label}</div>
                      <div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 2 }}>{item.desc}</div>
                    </div>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                ))}
              </div>

              {/* ── Group 4: danger (red) ── */}
              <div style={{ background: "#FFF5F5", borderRadius: 20, overflow: "hidden" }}>
                {[
                  { svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="#EF4444"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15" stroke="#EF4444" strokeWidth="2"/></svg>, iconBg: "#FEE2E2", label: "Signaler la publication", desc: `${openMenu.authorName} ne saura pas qui l'a signalé(e).`, action: () => handleReport(openMenu.authorName, openMenu.postId) },
                  { svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>, iconBg: "#FEE2E2", label: `Bloquer ${openMenu.authorName}`, desc: "Vous ne verrez plus ses publications.", action: closeMenu },
                ].map((item, i, arr) => (
                  <button key={i} onClick={item.action} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", borderBottom: i < arr.length - 1 ? "1px solid #FEE2E2" : "none", textAlign: "left" }}>
                    <div style={{ width: 42, height: 42, borderRadius: "50%", background: item.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{item.svg}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#EF4444" }}>{item.label}</div>
                      <div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 2 }}>{item.desc}</div>
                    </div>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#FCA5A5" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                ))}
              </div>

              {/* ── Annuler ── */}
              <button onClick={closeMenu} style={{ width: "100%", background: "#F8FAFC", border: "none", borderRadius: 20, padding: "16px", fontWeight: 700, fontSize: 16, color: "#475569", cursor: "pointer" }}>
                Annuler
              </button>

            </div>
          </div>
        </>,
        document.body
      )}

      {/* ── TOAST ──────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
          background: "#333", color: "#fff", borderRadius: 22, padding: "10px 18px",
          fontSize: 13, fontWeight: 600, zIndex: 200, whiteSpace: "nowrap",
          boxShadow: "0 4px 16px rgba(0,0,0,0.3)", maxWidth: "calc(100vw - 32px)",
          textAlign: "center", pointerEvents: "none",
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
