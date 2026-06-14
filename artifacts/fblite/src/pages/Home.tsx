import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "../router";
import { Post } from "../lib/store";
import { formatNumber } from "../data/mock";
import { apiGetStories, apiGetComments, apiPostComment, type StoryGroup, type PostComment } from "../lib/api";
import StoryViewer from "../components/StoryViewer";
import { storyDraftStore } from "../lib/storyDraft";

const AVATAR_COLORS = ["#1877F2","#E91E63","#9C27B0","#F57C00","#388E3C","#212121","#D32F2F","#00838F"];

function getInitials(name?: string) {
  if (!name) return "??";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
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
  // reply state: keyed by parent comment id
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [newReply, setNewReply] = useState<Record<number, string>>({});
  const [submittingReply, setSubmittingReply] = useState<number | null>(null);

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

  const startReply = (comment: PostComment) => {
    setReplyingTo(comment.id);
    setNewReply(prev => ({ ...prev, [comment.id]: `@${comment.authorFirstName} ` }));
  };

  const cancelReply = () => setReplyingTo(null);

  const submitReply = async (postId: number, parentId: number) => {
    const text = (newReply[parentId] ?? "").trim();
    if (!text || submittingReply === parentId) return;
    setSubmittingReply(parentId);
    setNewReply(prev => ({ ...prev, [parentId]: "" }));
    try {
      const comment = await apiPostComment(postId, text, parentId);
      setComments(prev => ({ ...prev, [postId]: [...(prev[postId] ?? []), comment] }));
      setReplyingTo(null);
    } catch {
      setNewReply(prev => ({ ...prev, [parentId]: text }));
    } finally {
      setSubmittingReply(null);
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
    setSavedPosts(prev => {
      const next = new Set(prev);
      if (next.has(postId)) { next.delete(postId); showToast("Publication retirée des enregistrements"); }
      else { next.add(postId); showToast("✅ Publication enregistrée"); }
      return next;
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

  const handleReport = (authorName: string) => {
    showToast(`🚩 Publication signalée. ${authorName} ne saura pas qui l'a signalé(e).`);
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

  const submitComment = async (postId: number) => {
    const text = (newComment[postId] ?? "").trim();
    if (!text || submittingComment === postId) return;
    setSubmittingComment(postId);
    setNewComment(prev => ({ ...prev, [postId]: "" }));
    try {
      const comment = await apiPostComment(postId, text);
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
              : <div style={{ width: "100%", height: "100%", background: "#1877F2", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 22 }}>{userInitials}</div>
            }
            <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", width: 28, height: 28, borderRadius: "50%", background: "#1877F2", border: "3px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 16, fontWeight: 900, lineHeight: 1 }}>+</div>
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
                <div style={{ position: "absolute", top: 8, left: 8, width: 34, height: 34, borderRadius: "50%", border: "3px solid #1877F2", background: avatarBg, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {group.authorAvatarUrl
                    ? <img src={group.authorAvatarUrl} alt={group.authorName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ color: "#fff", fontWeight: 700, fontSize: 12 }}>{initials}</span>}
                </div>
                {group.storiesCount > 1 && (
                  <div style={{ position: "absolute", top: 6, right: 6, background: "#1877F2", color: "#fff", borderRadius: 10, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, padding: "0 4px" }}>{group.storiesCount}</div>
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
          : <div className="avatar" style={{ background: "#1877F2", width: 40, height: 40, fontSize: 15, flexShrink: 0 }}>{userInitials}</div>
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
        const displayColor = post.authorAvatarUrl ? undefined : "#1877F2";
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
                <img src={post.authorAvatarUrl} alt={displayName} className="avatar" style={{ width: 40, height: 40, objectFit: "cover", flexShrink: 0, borderRadius: "50%" }} />
              ) : (
                <div className="avatar" style={{ background: displayColor }}>{displayInitials}</div>
              )}
              <div className="post-meta">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div className="post-author">{displayName}</div>
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
            <div className="post-content">{post.content}</div>
            {post.emoji && (
              <div className="post-image-emoji" style={{ background: "var(--fb-bg)" }}>{post.emoji}</div>
            )}
            <div className="post-stats">
              <span>{post.liked ? "❤️" : "👍"} {formatNumber(post.likes)}</span>
              <span>
                {(post.comments + postComments.length) > 0 && `${formatNumber(post.comments + postComments.length)} commentaires`}
                {(post.comments + postComments.length) > 0 && post.shares > 0 && " · "}
                {post.shares > 0 && `${formatNumber(post.shares)} partages`}
              </span>
            </div>
            <div className="post-actions">
              <button className={`post-btn${post.liked ? " liked" : ""}`} onClick={() => toggleLike(post.id)}>
                {post.liked ? "❤️" : "👍"} J'aime
              </button>
              <button className="post-btn" onClick={() => toggleComments(post.id)}>
                💬 Commenter
              </button>
              <button className="post-btn" onClick={() => handleShare(post.id)}>↗️ Partager</button>
              {post.imageUrl && (
                <button className="post-btn" onClick={() => navigate(`/video/${post.id}`)}>🎁 Cadeau</button>
              )}
            </div>
            {showComments === post.id && (() => {
              const topLevel = postComments.filter(c => !c.parentId);
              const replies = postComments.filter(c => c.parentId);
              return (
                <div style={{ padding: "8px 16px", borderTop: "1px solid var(--fb-divider)" }}>
                  {topLevel.length === 0 && (
                    <div style={{ fontSize: 13, color: "var(--fb-text-secondary)", textAlign: "center", padding: "8px 0" }}>
                      Soyez le premier à commenter 💬
                    </div>
                  )}
                  {topLevel.map(c => {
                    const cInitials = getInitials(`${c.authorFirstName} ${c.authorLastName}`);
                    const cReplies = replies.filter(r => r.parentId === c.id);
                    return (
                      <div key={c.id} style={{ marginBottom: 10 }}>
                        {/* Top-level comment */}
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                          {c.authorAvatarUrl
                            ? <img src={c.authorAvatarUrl} alt={cInitials} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                            : <div className="avatar xs">{cInitials}</div>
                          }
                          <div style={{ flex: 1 }}>
                            <div style={{ background: "var(--fb-bg)", borderRadius: 16, padding: "7px 12px", fontSize: 13 }}>
                              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 2 }}>{c.authorFirstName} {c.authorLastName}</div>
                              {c.content}
                            </div>
                            <button
                              onClick={() => replyingTo === c.id ? cancelReply() : startReply(c)}
                              style={{ background: "none", border: "none", fontSize: 12, fontWeight: 600, color: "var(--fb-text-secondary)", cursor: "pointer", padding: "2px 4px", marginTop: 2 }}
                            >
                              {replyingTo === c.id ? "Annuler" : "↩️ Répondre"}
                            </button>
                          </div>
                        </div>
                        {/* Nested replies */}
                        {cReplies.length > 0 && (
                          <div style={{ marginLeft: 36, marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
                            {cReplies.map(r => {
                              const rInitials = getInitials(`${r.authorFirstName} ${r.authorLastName}`);
                              return (
                                <div key={r.id} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                                  {r.authorAvatarUrl
                                    ? <img src={r.authorAvatarUrl} alt={rInitials} style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                                    : <div className="avatar xs" style={{ width: 24, height: 24, fontSize: 10 }}>{rInitials}</div>
                                  }
                                  <div style={{ background: "var(--fb-bg)", borderRadius: 14, padding: "6px 10px", fontSize: 13, flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 11, marginBottom: 1 }}>{r.authorFirstName} {r.authorLastName}</div>
                                    {r.content}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {/* Reply input */}
                        {replyingTo === c.id && (
                          <div style={{ marginLeft: 36, marginTop: 6, display: "flex", gap: 6, alignItems: "center" }}>
                            <div className="avatar xs" style={{ width: 24, height: 24, fontSize: 10 }}>{userInitials}</div>
                            <input
                              autoFocus
                              style={{ flex: 1, background: "var(--fb-bg)", border: "1px solid var(--fb-divider)", borderRadius: 18, padding: "6px 12px", fontSize: 13, outline: "none" }}
                              placeholder={`Répondre à ${c.authorFirstName}…`}
                              value={newReply[c.id] ?? ""}
                              onChange={e => setNewReply(prev => ({ ...prev, [c.id]: e.target.value }))}
                              onKeyDown={e => { if (e.key === "Enter") submitReply(post.id, c.id); if (e.key === "Escape") cancelReply(); }}
                              disabled={submittingReply === c.id}
                            />
                            <button
                              onClick={() => submitReply(post.id, c.id)}
                              disabled={submittingReply === c.id}
                              style={{ background: "var(--fb-blue)", border: "none", borderRadius: "50%", width: 28, height: 28, color: "#fff", cursor: "pointer", fontSize: 13, opacity: submittingReply === c.id ? 0.6 : 1 }}
                            >➤</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {/* New top-level comment box */}
                  <div className="comment-box" style={{ marginTop: 4 }}>
                    <div className="avatar xs">{userInitials}</div>
                    <div style={{ flex: 1, display: "flex", gap: 8 }}>
                      <input
                        style={{ flex: 1, background: "var(--fb-bg)", border: "none", borderRadius: 20, padding: "8px 14px", fontSize: 14, outline: "none" }}
                        placeholder="Écrire un commentaire..."
                        value={newComment[post.id] ?? ""}
                        onChange={e => setNewComment(prev => ({ ...prev, [post.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === "Enter") submitComment(post.id); }}
                        disabled={submittingComment === post.id}
                      />
                      <button
                        onClick={() => submitComment(post.id)}
                        disabled={submittingComment === post.id}
                        style={{ background: "var(--fb-blue)", border: "none", borderRadius: "50%", width: 32, height: 32, color: "#fff", cursor: "pointer", opacity: submittingComment === post.id ? 0.6 : 1 }}
                      >➤</button>
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
                  action: () => handleReport(openMenu.authorName),
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
