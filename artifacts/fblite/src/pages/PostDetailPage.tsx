import { useState, useEffect, useRef, useCallback } from "react";
import {
  apiFetch,
  apiGetComments,
  apiPostComment,
  apiToggleCommentLike,
  type PostComment,
} from "../lib/api";

const REACTIONS = [
  { id: "like",  label: "J'aime",    emoji: "👍", color: "#1877F2" },
  { id: "love",  label: "J'adore",   emoji: "❤️", color: "#F33E58" },
  { id: "care",  label: "Solidaire", emoji: "🫂", color: "#F7B125" },
  { id: "haha",  label: "Haha",      emoji: "😆", color: "#F7B125" },
  { id: "wow",   label: "Wouah",     emoji: "😮", color: "#F7B125" },
  { id: "sad",   label: "Triste",    emoji: "😢", color: "#748FD5" },
  { id: "angry", label: "En colère", emoji: "😡", color: "#E9710F" },
];

const AVATAR_COLORS = ["#1877F2","#E91E63","#9C27B0","#F57C00","#388E3C","#212121","#D32F2F","#00838F"];

function getInitials(name?: string) {
  if (!name) return "??";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function avatarColor(name?: string) {
  if (!name) return AVATAR_COLORS[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return "À l'instant";
  if (s < 3600)  return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} j`;
}

function isVideo(url: string | null) {
  if (!url) return false;
  return /\.(mp4|mov|webm|ogg|m4v)(\?.*)?$/i.test(url);
}

interface PostData {
  id: number;
  authorId: number;
  authorName: string;
  authorFirstName: string | null;
  authorLastName: string | null;
  authorAvatarUrl: string | null;
  content: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  liked: boolean;
}

interface Props {
  postId: number;
}

export default function PostDetailPage({ postId }: Props) {
  const navigate = useNavigate();
  const rawUser = localStorage.getItem("bp_user");
  const user = rawUser ? JSON.parse(rawUser) as { name: string; email: string; avatarUrl?: string; id?: number } : { name: "Moi", email: "" };
  const userInitials = user.name ? user.name.slice(0, 2).toUpperCase() : "ME";

  const [post, setPost]           = useState<PostData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const [liked, setLiked]         = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [reaction, setReaction]   = useState<string>("like");
  const [showReactions, setShowReactions] = useState(false);
  const reactionTimer             = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [comments, setComments]   = useState<PostComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [replyingTo, setReplyingTo]       = useState<number | null>(null);
  const [replyName, setReplyName]         = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch(`/posts/${postId}`)
      .then(r => r.json())
      .then((data: PostData & { error?: string }) => {
        if (data.error) { setError(data.error); return; }
        setPost(data);
        setLiked(data.liked);
        setLikesCount(data.likesCount);
      })
      .catch(() => setError("Impossible de charger cette publication."))
      .finally(() => setLoading(false));
  }, [postId]);

  const loadComments = useCallback(async () => {
    try {
      const data = await apiGetComments(postId);
      setComments(data);
    } catch { /* silent */ }
  }, [postId]);

  useEffect(() => { loadComments(); }, [loadComments]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  const toggleLike = () => {
    const action = liked ? "unlike" : "like";
    setLiked(!liked);
    setLikesCount(c => liked ? Math.max(0, c - 1) : c + 1);
    apiFetch(`/posts/${postId}/like`, { method: "POST", body: JSON.stringify({ action }) }).catch(() => {
      setLiked(liked);
      setLikesCount(c => liked ? c + 1 : Math.max(0, c - 1));
    });
  };

  const startReactionTimer = () => { reactionTimer.current = setTimeout(() => setShowReactions(true), 500); };
  const cancelReactionTimer = () => { if (reactionTimer.current) { clearTimeout(reactionTimer.current); reactionTimer.current = null; } };
  const pickReaction = (id: string) => { setReaction(id); setLiked(true); setShowReactions(false); };

  const startReply = (c: PostComment) => {
    setReplyingTo(c.id);
    setReplyName(`${c.authorFirstName} ${c.authorLastName}`);
    setNewComment("");
    setTimeout(() => inputRef.current?.focus(), 80);
  };
  const cancelReply = () => { setReplyingTo(null); setReplyName(""); };

  const submit = async () => {
    const text = newComment.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    setNewComment("");
    const parentId = replyingTo ?? undefined;
    if (parentId) cancelReply();
    try {
      const c = await apiPostComment(postId, text, parentId);
      setComments(prev => [...prev, c]);
    } catch {
      setNewComment(text);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCommentLike = async (commentId: number) => {
    setComments(prev => prev.map(c =>
      c.id === commentId ? { ...c, likedByMe: !c.likedByMe, likesCount: c.likedByMe ? Math.max(0, c.likesCount - 1) : c.likesCount + 1 } : c
    ));
    try {
      const { liked: l, likesCount: lc } = await apiToggleCommentLike(postId, commentId);
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, likedByMe: l, likesCount: lc } : c));
    } catch {
      setComments(prev => prev.map(c =>
        c.id === commentId ? { ...c, likedByMe: !c.likedByMe, likesCount: c.likedByMe ? Math.max(0, c.likesCount - 1) : c.likesCount + 1 } : c
      ));
    }
  };

  const topLevel = comments.filter(c => !c.parentId);
  const replies  = (parentId: number) => comments.filter(c => c.parentId === parentId);

  const activeReaction = REACTIONS.find(r => r.id === reaction) ?? REACTIONS[0];

  if (loading) return (
    <div style={{ background: "#fff", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#888" }}>
      Chargement…
    </div>
  );

  if (error || !post) return (
    <div style={{ background: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
      <div style={{ color: "#888" }}>{error ?? "Publication introuvable."}</div>
      <button onClick={() => navigate(-1 as unknown as string)} style={{ background: "#1877F2", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer" }}>Retour</button>
    </div>
  );

  const authorInitials = getInitials(post.authorName);
  const authorColor   = avatarColor(post.authorName);

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100vh", display: "flex", flexDirection: "column", paddingBottom: 72 }}>

      {/* ── Header ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "#fff", borderBottom: "1px solid #e4e6eb", display: "flex", alignItems: "center", padding: "10px 14px", gap: 10 }}>
        <button onClick={() => window.history.back()} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#050505", padding: 0, lineHeight: 1 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#050505", lineHeight: 1.2 }}>publication de {post.authorFirstName ?? post.authorName}</div>
        </div>
        <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#050505", padding: 0 }}>🔍</button>
      </div>

      {/* ── Post card ── */}
      <div style={{ background: "#fff", marginBottom: 8 }}>

        {/* Author row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px 8px" }}>
          {post.authorAvatarUrl
            ? <img src={post.authorAvatarUrl} alt={authorInitials} style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover" }} />
            : <div style={{ width: 42, height: 42, borderRadius: "50%", background: authorColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{authorInitials}</div>
          }
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#050505" }}>{post.authorName}</div>
            <div style={{ fontSize: 12, color: "#65676b" }}>{timeAgo(post.createdAt)} · 🌐</div>
          </div>
          <button style={{ background: "none", border: "none", fontSize: 20, color: "#65676b", cursor: "pointer", padding: 4 }}>···</button>
        </div>

        {/* Content */}
        {post.content && (
          <div style={{ padding: "0 14px 10px", fontSize: 15, color: "#050505", lineHeight: 1.5 }}>{post.content}</div>
        )}

        {/* Media */}
        {post.imageUrl && (
          isVideo(post.imageUrl)
            ? <video src={post.imageUrl} poster={post.thumbnailUrl ?? undefined} controls style={{ width: "100%", maxHeight: 380, objectFit: "cover", display: "block" }} />
            : <img src={post.imageUrl} alt="" style={{ width: "100%", maxHeight: 400, objectFit: "cover", display: "block" }} />
        )}

        {/* Stats bar */}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 14px", fontSize: 13, color: "#65676b" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {liked && <span style={{ fontSize: 14 }}>{activeReaction.emoji}</span>}
            {!liked && likesCount > 0 && <span>👍</span>}
            <span>{likesCount > 0 ? likesCount : ""}</span>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {post.commentsCount > 0 && <span>{post.commentsCount} commentaires</span>}
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: "1px solid #e4e6eb", margin: "0 14px" }} />

        {/* Action bar */}
        <div style={{ display: "flex", padding: "2px 0" }}>

          {/* J'aime */}
          <div style={{ flex: 1, position: "relative" }}>
            {showReactions && (
              <div style={{ position: "absolute", bottom: "100%", left: 0, background: "#fff", borderRadius: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.18)", padding: "8px 12px", display: "flex", gap: 10, zIndex: 100, marginBottom: 4 }}>
                {REACTIONS.map(r => (
                  <button key={r.id} onClick={() => pickReaction(r.id)} title={r.label}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 26, padding: 2, transition: "transform .1s" }}
                    onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.4)")}
                    onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                  >{r.emoji}</button>
                ))}
              </div>
            )}
            <button
              className="post-btn"
              style={{ width: "100%", color: liked ? activeReaction.color : "#65676b", fontWeight: liked ? 700 : 400 }}
              onClick={() => { cancelReactionTimer(); toggleLike(); }}
              onMouseDown={startReactionTimer}
              onMouseUp={cancelReactionTimer}
              onTouchStart={startReactionTimer}
              onTouchEnd={cancelReactionTimer}
            >
              {liked ? `${activeReaction.emoji} ${activeReaction.label}` : "👍 J'aime"}
            </button>
          </div>

          <div style={{ width: 1, background: "#e4e6eb", margin: "8px 0" }} />

          {/* Commenter */}
          <button className="post-btn" style={{ flex: 1 }} onClick={() => inputRef.current?.focus()}>
            💬 Commenter
          </button>

          <div style={{ width: 1, background: "#e4e6eb", margin: "8px 0" }} />

          {/* Partager */}
          <button className="post-btn" style={{ flex: 1 }}>
            ↗️ Partager
          </button>
        </div>
      </div>

      {/* ── Comments section ── */}
      <div style={{ background: "#fff", flex: 1 }}>

        {/* Sort header */}
        {topLevel.length > 1 && (
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 14px 4px" }}>
            <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#050505", display: "flex", alignItems: "center", gap: 4 }}>
              Plus pertinents <span style={{ fontSize: 10 }}>▼</span>
            </button>
          </div>
        )}

        <div style={{ padding: "0 10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          {topLevel.map(c => {
            const cInitials = getInitials(`${c.authorFirstName} ${c.authorLastName}`);
            const cColor    = avatarColor(`${c.authorFirstName} ${c.authorLastName}`);
            const cReplies  = replies(c.id);
            return (
              <div key={c.id}>
                {/* Comment bubble */}
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  {c.authorAvatarUrl
                    ? <img src={c.authorAvatarUrl} alt={cInitials} style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                    : <div style={{ width: 34, height: 34, borderRadius: "50%", background: cColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 11, flexShrink: 0 }}>{cInitials}</div>
                  }
                  <div style={{ flex: 1 }}>
                    <div style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
                      <div style={{ background: "#f0f2f5", borderRadius: 14, padding: "8px 12px" }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#050505", marginBottom: 1 }}>{c.authorFirstName} {c.authorLastName}</div>
                        <div style={{ fontSize: 14, color: "#050505" }}>{c.content}</div>
                      </div>
                      {c.likesCount > 0 && (
                        <span style={{ position: "absolute", bottom: -6, right: -4, background: "#fff", borderRadius: 10, padding: "1px 4px 1px 2px", boxShadow: "0 1px 3px rgba(0,0,0,0.18)", fontSize: 11, display: "flex", alignItems: "center", gap: 1 }}>
                          <span>❤️</span><span style={{ color: "#65676b" }}>{c.likesCount}</span>
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 12, paddingLeft: 4, marginTop: 6, fontSize: 12, fontWeight: 600, color: "#65676b", alignItems: "center" }}>
                      <span style={{ color: "#aaa", fontWeight: 400 }}>{timeAgo(c.createdAt)}</span>
                      <button onClick={() => toggleCommentLike(c.id)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, fontWeight: 700, color: c.likedByMe ? "#1877F2" : "#65676b" }}>J'aime</button>
                      <button onClick={() => replyingTo === c.id ? cancelReply() : startReply(c)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, fontWeight: 700, color: replyingTo === c.id ? "#1877F2" : "#65676b" }}>
                        {replyingTo === c.id ? "Annuler" : "Répondre"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Replies */}
                {cReplies.length > 0 && (
                  <div style={{ marginLeft: 44, marginTop: 4, display: "flex", flexDirection: "column", gap: 4 }}>
                    {cReplies.map(r => {
                      const rInitials = getInitials(`${r.authorFirstName} ${r.authorLastName}`);
                      const rColor    = avatarColor(`${r.authorFirstName} ${r.authorLastName}`);
                      return (
                        <div key={r.id} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                          {r.authorAvatarUrl
                            ? <img src={r.authorAvatarUrl} alt={rInitials} style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                            : <div style={{ width: 26, height: 26, borderRadius: "50%", background: rColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 9, flexShrink: 0 }}>{rInitials}</div>
                          }
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "inline-block", background: "#f0f2f5", borderRadius: 14, padding: "6px 10px", maxWidth: "100%" }}>
                              <div style={{ fontWeight: 700, fontSize: 12, color: "#050505", marginBottom: 1 }}>{r.authorFirstName} {r.authorLastName}</div>
                              <div style={{ fontSize: 13, color: "#050505" }}>{r.content}</div>
                            </div>
                            {r.likesCount > 0 && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 1, background: "#fff", borderRadius: 10, padding: "1px 4px 1px 2px", boxShadow: "0 1px 3px rgba(0,0,0,0.15)", fontSize: 11, marginLeft: 3 }}>
                                <span>❤️</span><span style={{ color: "#65676b" }}>{r.likesCount}</span>
                              </span>
                            )}
                            <div style={{ display: "flex", gap: 10, paddingLeft: 4, marginTop: 2, fontSize: 11, fontWeight: 600, color: "#65676b" }}>
                              <span style={{ color: "#aaa", fontWeight: 400 }}>{timeAgo(r.createdAt)}</span>
                              <button onClick={() => toggleCommentLike(r.id)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, fontWeight: 700, color: r.likedByMe ? "#1877F2" : "#65676b" }}>J'aime</button>
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
        </div>
      </div>

      {/* ── Fixed bottom input bar ── */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid #e4e6eb", zIndex: 40 }}>

        {/* Reply chip */}
        {replyingTo !== null && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px 2px", fontSize: 12, color: "#65676b" }}>
            <span>↩️ Répondre à</span>
            <span style={{ fontWeight: 700, color: "#1877F2" }}>{replyName}</span>
            <button onClick={cancelReply} style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: 15, padding: "0 0 0 4px", lineHeight: 1, marginLeft: "auto" }}>✕</button>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px 12px" }}>
          {user.avatarUrl
            ? <img src={user.avatarUrl} alt="moi" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
            : <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#1877F2", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{userInitials}</div>
          }
          <div style={{ flex: 1, background: "#f0f2f5", borderRadius: 22, display: "flex", alignItems: "center", padding: "0 6px 0 14px", gap: 4 }}>
            <input
              ref={inputRef}
              style={{ flex: 1, background: "transparent", border: "none", padding: "9px 0", fontSize: 14, outline: "none", color: "#050505", minWidth: 0 }}
              placeholder={replyingTo != null ? `Répondre à ${replyName.split(" ")[0]}…` : `Commenter en tant que ${user.name.split(" ")[0]}…`}
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape" && replyingTo) cancelReply(); }}
              disabled={submitting}
            />
            {!newComment.trim() ? (
              <div style={{ display: "flex", gap: 0, flexShrink: 0 }}>
                {[{ icon: "🙂", key: "emoji" }, { icon: "GIF", key: "gif" }, { icon: "😊", key: "sticker" }].map(b => (
                  <button key={b.key} style={{ background: "none", border: "none", padding: "6px 6px", cursor: "pointer", fontSize: b.key === "gif" ? 10 : 16, fontWeight: b.key === "gif" ? 700 : 400, color: "#65676b" }}>{b.icon}</button>
                ))}
              </div>
            ) : (
              <button onClick={submit} disabled={submitting}
                style={{ background: "none", border: "none", padding: "6px 8px", cursor: "pointer", color: "#1877F2", fontSize: 18, opacity: submitting ? 0.6 : 1, flexShrink: 0 }}
              >➤</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
