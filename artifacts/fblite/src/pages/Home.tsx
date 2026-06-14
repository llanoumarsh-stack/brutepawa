import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "../router";
import { Post } from "../lib/store";
import { formatNumber } from "../data/mock";
import { apiGetStories, apiGetComments, apiPostComment, apiToggleCommentLike, apiToggleSaved, apiReportPost, type StoryGroup, type PostComment } from "../lib/api";
import StoryViewer from "../components/StoryViewer";
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

  const visiblePosts = allPosts.filter(p => !hiddenPosts.has(p.id));

  return (
    <div className="feed-container">

      {viewerOpen && storyGroups.length > 0 && (
        <StoryViewer
          groups={storyGroups}
          initialGroupIndex={viewerGroupIdx}
          onClose={() => { setViewerOpen(false); loadStories(); }}
        />
      )}

      {/* ─── Stories Row ─── */}
      <input ref={storyFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleStoryFileSelect} />
      <div className="stories-row">
        {/* Add story — triggers gallery directly */}
        <div className="story-card" onClick={() => storyFileRef.current?.click()} style={{ cursor: "pointer" }}>
          <div className="story-bg" style={{ background: "#e4e6e9", position: "relative", overflow: "hidden" }}>
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt="moi" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <div style={{ width: "100%", height: "100%", background: "#42B72A", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 22 }}>{userInitials}</div>
            }
            <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", width: 28, height: 28, borderRadius: "50%", background: "#42B72A", border: "3px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 16, fontWeight: 900, lineHeight: 1 }}>+</div>
          </div>
          <div className="story-label">Créer une story</div>
        </div>

        {/* Real story groups */}
        {storyGroups.map((group, idx) => {
          const initials = group.authorName.slice(0, 2).toUpperCase();
          const avatarBg = AVATAR_COLORS[group.authorId % AVATAR_COLORS.length];
          const preview = group.stories[0];
          return (
            <div key={group.authorId} className="story-card" onClick={() => { setViewerGroupIdx(idx); setViewerOpen(true); }} style={{ cursor: "pointer" }}>
              <div className="story-bg" style={{ background: preview?.mediaUrl ? `url(${preview.mediaUrl}) center/cover no-repeat` : (preview?.bgColor ?? "#1877F2"), position: "relative", overflow: "hidden" }}>
                {preview?.emoji && !preview?.mediaUrl && (
                  <div style={{ fontSize: 32, position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{preview.emoji}</div>
                )}
                {preview?.content && !preview?.mediaUrl && !preview?.emoji && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", padding: "4px 6px", textAlign: "center", position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>{preview.content.slice(0, 40)}</div>
                )}
                <div style={{ position: "absolute", top: 8, left: 8, width: 34, height: 34, borderRadius: "50%", border: "3px solid #42B72A", background: avatarBg, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {group.authorAvatarUrl
                    ? <img src={group.authorAvatarUrl} alt={group.authorName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ color: "#fff", fontWeight: 700, fontSize: 12 }}>{initials}</span>}
                </div>
                {group.storiesCount > 1 && (
                  <div style={{ position: "absolute", top: 6, right: 6, background: "#42B72A", color: "#fff", borderRadius: 10, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, padding: "0 4px" }}>{group.storiesCount}</div>
                )}
              </div>
              <div className="story-label">{group.authorName.split(" ")[0]}</div>
            </div>
          );
        })}

        {/* No stories yet */}
        {storyGroups.length === 0 && (
          <div style={{ display: "flex", alignItems: "center", padding: "0 8px", color: "var(--fb-text-secondary)", fontSize: 12, fontStyle: "italic" }}>
            Sois le premier à partager une story !
          </div>
        )}
      </div>

      {/* Create post bar */}
      <div
        onClick={() => navigate("/create-post")}
        style={{
          background: "var(--fb-white)", borderRadius: 10,
          border: "1px solid var(--fb-divider)", padding: "10px 14px",
          display: "flex", gap: 10, alignItems: "center", cursor: "pointer",
        }}
      >
        {user.avatarUrl
          ? <img src={user.avatarUrl} alt="Avatar" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
          : <div className="avatar" style={{ background: "#42B72A", width: 40, height: 40, fontSize: 15, flexShrink: 0 }}>{userInitials}</div>
        }
        <div style={{
          flex: 1, background: "var(--fb-bg)", borderRadius: 22, padding: "10px 16px",
          fontSize: 15, color: "var(--fb-text-secondary)", fontWeight: 400,
          border: "1px solid var(--fb-divider)",
        }}>
          Quoi de neuf, {user.name.split(" ")[0]} ?
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
                    <span style={{ color: "var(--fb-blue)", fontSize: 12, fontWeight: 600, cursor: "pointer", marginLeft: 2 }}>
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
              <div style={{ padding: "6px 14px 6px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13.5, color: "#65676b" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {post.likes > 0 && (
                    <>
                      <span style={{ display: "inline-flex", position: "relative", width: post.likes > 5 ? 36 : 20, height: 20, flexShrink: 0 }}>
                        <span style={{ position: "absolute", left: 0, fontSize: 16 }}>👍</span>
                        {post.likes > 5 && <span style={{ position: "absolute", left: 14, fontSize: 16 }}>❤️</span>}
                      </span>
                      <span style={{ marginLeft: post.likes > 5 ? 2 : 0 }}>{formatNumber(post.likes)}</span>
                    </>
                  )}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  {(post.comments + postComments.length) > 0 && (
                    <span style={{ cursor: "pointer" }} onClick={() => toggleComments(post.id)}>
                      {formatNumber(post.comments + postComments.length)} commentaire{(post.comments + postComments.length) > 1 ? "s" : ""}
                    </span>
                  )}
                  {post.shares > 0 && <span>{formatNumber(post.shares)} partages</span>}
                </div>
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
                return (
                  <button
                    className="post-btn"
                    style={{ flex: 1, borderRight: "1px solid #e4e6eb", color: post.liked ? rx.color : "#65676b", fontWeight: post.liked ? 700 : 400 }}
                    onClick={() => quickLike(post.id, post.liked)}
                    onMouseDown={() => startReactionTimer(post.id)}
                    onMouseUp={cancelReactionTimer}
                    onMouseLeave={cancelReactionTimer}
                    onTouchStart={() => startReactionTimer(post.id)}
                    onTouchEnd={cancelReactionTimer}
                    onTouchMove={cancelReactionTimer}
                  >
                    {post.liked ? rx.emoji : "👍"} {post.liked ? rx.label : "J'aime"}
                  </button>
                );
              })()}

              {/* Commenter */}
              <button className="post-btn" style={{ flex: 1, borderRight: "1px solid #e4e6eb" }} onClick={() => navigate(`/post/${post.id}`)}>
                💬 Commenter
              </button>

              {/* Partager */}
              <button className="post-btn" style={{ flex: 1 }} onClick={() => handleShare(post.id)}>
                ↗️ Partager
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
                              <div style={{ fontSize: 14, color: "#050505", lineHeight: 1.4 }}>{c.content}</div>
                            </div>
                            {/* Like count badge */}
                            {c.likesCount > 0 && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 2, background: "#fff", borderRadius: 10, padding: "1px 5px 1px 3px", boxShadow: "0 1px 3px rgba(0,0,0,0.18)", fontSize: 12, marginLeft: 4, verticalAlign: "middle" }}>
                                <span>❤️</span><span style={{ color: "#65676b", fontWeight: 600 }}>{c.likesCount}</span>
                              </span>
                            )}
                            {/* Time · J'aime · Répondre */}
                            <div style={{ display: "flex", gap: 12, paddingLeft: 4, marginTop: 3, fontSize: 12, fontWeight: 600, color: "#65676b", alignItems: "center" }}>
                              <span style={{ color: "#aaa", fontWeight: 400 }}>{timeAgo(c.createdAt)}</span>
                              <button onClick={() => toggleCommentLike(post.id, c.id)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, fontWeight: 700, color: c.likedByMe ? "#1877F2" : "#65676b" }}>
                                J'aime
                              </button>
                              <button onClick={() => replyingTo === c.id ? cancelReply() : startReply(c, post.id)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, fontWeight: 700, color: replyingTo === c.id ? "#1877F2" : "#65676b" }}>
                                {replyingTo === c.id ? "Annuler" : "Répondre"}
                              </button>
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
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px 12px", borderTop: topLevel.length > 0 ? "1px solid #e4e6eb" : "none", marginTop: 6 }}>
                    {user.avatarUrl
                      ? <img src={user.avatarUrl} alt="moi" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                      : <div className="avatar xs" style={{ width: 34, height: 34, fontSize: 12, flexShrink: 0, background: "#42B72A" }}>{userInitials}</div>
                    }
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
                        </div>
                      ) : (
                        <button
                          onClick={() => submitComment(post.id)}
                          disabled={submittingComment === post.id}
                          style={{ background: "none", border: "none", padding: "6px 8px", cursor: "pointer", color: "#1877F2", fontSize: 18, opacity: submittingComment === post.id ? 0.6 : 1, flexShrink: 0 }}
                        >➤</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })}

      {/* Empty state after hiding all */}
      {visiblePosts.length === 0 && (
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
      {openMenu && (
        <>
          {/* Backdrop */}
          <div
            onClick={closeMenu}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 90 }}
          />
          {/* Sheet */}
          <div style={{
            position: "fixed", bottom: 60, left: 0, right: 0, zIndex: 100,
            background: "var(--fb-white)", borderRadius: "20px 20px 0 0",
            boxShadow: "0 -4px 32px rgba(0,0,0,0.18)",
            maxHeight: "80vh", overflowY: "auto",
          }}>
            {/* Handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
              <div style={{ width: 40, height: 5, background: "var(--fb-divider)", borderRadius: 4 }} />
            </div>

            {/* Interest section */}
            <div style={{ margin: "8px 12px", background: "var(--fb-bg)", borderRadius: 14, overflow: "hidden" }}>
              {[
                {
                  icon: "➕", iconBg: "#000",
                  label: "Ça m'intéresse",
                  desc: "Vous verrez plus de publications de ce type.",
                  action: () => handleInterest(true),
                },
                {
                  icon: "➖", iconBg: "#000",
                  label: "Ça ne m'intéresse pas",
                  desc: "Vous verrez moins de publications de ce type.",
                  action: () => handleInterest(false),
                },
              ].map((item, i) => (
                <div
                  key={i}
                  onClick={item.action}
                  style={{
                    display: "flex", gap: 14, padding: "14px 16px", cursor: "pointer", alignItems: "flex-start",
                    borderBottom: i === 0 ? "1px solid var(--fb-divider)" : "none",
                  }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: item.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff", flexShrink: 0 }}>
                    {item.icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{item.label}</div>
                    <div style={{ fontSize: 13, color: "var(--fb-text-secondary)", marginTop: 2 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions section */}
            <div style={{ margin: "8px 12px 20px", background: "var(--fb-bg)", borderRadius: 14, overflow: "hidden" }}>
              {[
                {
                  icon: "🔖",
                  label: savedPosts.has(openMenu.postId) ? "Retirer des enregistrements" : "Enregistrer la publication",
                  desc: savedPosts.has(openMenu.postId) ? "Retirer de vos éléments enregistrés." : "Ajoutez ceci à vos éléments enregistrés.",
                  action: () => handleSave(openMenu.postId),
                  arrow: false,
                },
                {
                  icon: "↗️",
                  label: "Partager",
                  desc: null,
                  action: () => handleShare(openMenu.postId),
                  arrow: true,
                },
                {
                  icon: "🚫",
                  label: "Je ne veux pas voir ça",
                  desc: null,
                  action: () => handleHide(openMenu.postId),
                  arrow: true,
                },
                {
                  icon: "🚩",
                  label: "Signaler la publication",
                  desc: `${openMenu.authorName} ne saura pas qui l'a signalé(e).`,
                  action: () => handleReport(openMenu.authorName, openMenu.postId),
                  arrow: true,
                },
                {
                  icon: notifPosts.has(openMenu.postId) ? "🔕" : "🔔",
                  label: notifPosts.has(openMenu.postId)
                    ? "Désactiver les notifications"
                    : "Activer les notifications pour cette publication",
                  desc: null,
                  action: () => handleNotif(openMenu.postId),
                  arrow: false,
                },
                {
                  icon: "🔗",
                  label: "Copier le lien",
                  desc: null,
                  action: () => handleCopyLink(openMenu.postId),
                  arrow: false,
                },
              ].map((item, i, arr) => (
                <div
                  key={i}
                  onClick={item.action}
                  style={{
                    display: "flex", gap: 14, padding: "13px 16px", cursor: "pointer", alignItems: "center",
                    borderBottom: i < arr.length - 1 ? "1px solid var(--fb-divider)" : "none",
                  }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{item.label}</div>
                    {item.desc && <div style={{ fontSize: 13, color: "var(--fb-text-secondary)", marginTop: 2 }}>{item.desc}</div>}
                  </div>
                  {item.arrow && <span style={{ color: "var(--fb-text-secondary)", fontSize: 18 }}>›</span>}
                </div>
              ))}
            </div>
          </div>
        </>
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
