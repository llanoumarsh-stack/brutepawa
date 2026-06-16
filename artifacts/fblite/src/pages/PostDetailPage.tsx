import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "../router";
import {
  apiFetch,
  apiGetComments,
  apiPostComment,
  apiToggleCommentLike,
  apiPostVoiceComment,
  apiUploadVoice,
  apiDeleteComment,
  type PostComment,
} from "../lib/api";
import VoiceRecorder from "../components/VoiceRecorder";
import VoicePlayer from "../components/VoicePlayer";

const REACTIONS = [
  { id: "like",  label: "J'aime",    color: "#22C55E" },
  { id: "love",  label: "J'adore",   color: "#F33E58" },
  { id: "care",  label: "Solidaire", color: "#F7B125" },
  { id: "haha",  label: "Haha",      color: "#F7B125" },
  { id: "wow",   label: "Wouah",     color: "#F7B125" },
  { id: "sad",   label: "Triste",    color: "#748FD5" },
  { id: "angry", label: "En colère", color: "#E9710F" },
];

const REACTION_ICONS: Record<string, JSX.Element> = {
  like: <svg viewBox="0 0 24 24" width="18" height="18" fill="#22C55E"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>,
  love: <svg viewBox="0 0 24 24" width="18" height="18" fill="#F33E58"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>,
  care: <svg viewBox="0 0 24 24" width="18" height="18" fill="#F7B125"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>,
  haha: <svg viewBox="0 0 24 24" width="18" height="18" fill="#F7B125"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>,
  wow:  <svg viewBox="0 0 24 24" width="18" height="18" fill="#F7B125"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm0-3.5c-1.45 0-2.76-.52-3.77-1.38l1.03-1.03C10.05 14.65 10.99 15 12 15s1.95-.35 2.74-.91l1.03 1.03C14.76 16.48 13.45 17 12 17.5zm-1-6.5c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm2 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg>,
  sad:  <svg viewBox="0 0 24 24" width="18" height="18" fill="#748FD5"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm-5-6c.78 2.34 2.72 4 5 4s4.22-1.66 5-4H7zm7.5-4c-.83 0-1.5.67-1.5 1.5S13.67 13 14.5 13s1.5-.67 1.5-1.5S15.33 10 14.5 10zm-5 0c-.83 0-1.5.67-1.5 1.5S8.67 13 9.5 13s1.5-.67 1.5-1.5S10.33 10 9.5 10z"/></svg>,
  angry:<svg viewBox="0 0 24 24" width="18" height="18" fill="#E9710F"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm4-10.5l-1.41-1.41L13 9.67l-1.59-1.58L10 9.5l1.59 1.59L10 12.68l1.41 1.41L13 12.5l1.59 1.59L16 12.68l-1.59-1.59L16 9.5zm-8 0l-1.41 1.41 1.59 1.59L6 14.09l1.41 1.41L9 13.91l1.59 1.59L12 14.09l-1.59-1.59L12 10.91l-1.41-1.41L9 11.09 7.41 9.5z"/></svg>,
};

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
interface Props { postId: number; }

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
  const [saved, setSaved]         = useState(false);
  const [comments, setComments]   = useState<PostComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo]       = useState<number | null>(null);
  const [replyName, setReplyName]         = useState("");
  const [voiceMode, setVoiceMode]         = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleVoiceSend = async (blob: Blob, duration: number) => {
    const { url } = await apiUploadVoice(blob, duration);
    const parentId = replyingTo ?? undefined;
    if (parentId) cancelReply();
    const c = await apiPostVoiceComment(postId, url, duration, parentId);
    setComments(prev => [...prev, c]);
    setVoiceMode(false);
  };

  useEffect(() => {
    apiFetch(`/posts/${postId}`).then(r => r.json()).then((data: PostData & { error?: string }) => {
      if (data.error) { setError(data.error); return; }
      setPost(data); setLiked(data.liked); setLikesCount(data.likesCount);
    }).catch(() => setError("Impossible de charger cette publication.")).finally(() => setLoading(false));
  }, [postId]);

  const loadComments = useCallback(async () => {
    try { const data = await apiGetComments(postId); setComments(data); } catch { /* silent */ }
  }, [postId]);
  useEffect(() => { loadComments(); }, [loadComments]);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 300); }, []);

  const toggleLike = () => {
    const action = liked ? "unlike" : "like";
    setLiked(!liked); setLikesCount(c => liked ? Math.max(0, c - 1) : c + 1);
    apiFetch(`/posts/${postId}/like`, { method: "POST", body: JSON.stringify({ action }) }).catch(() => {
      setLiked(liked); setLikesCount(c => liked ? c + 1 : Math.max(0, c - 1));
    });
  };
  const startReactionTimer = () => { reactionTimer.current = setTimeout(() => setShowReactions(true), 500); };
  const cancelReactionTimer = () => { if (reactionTimer.current) { clearTimeout(reactionTimer.current); reactionTimer.current = null; } };
  const pickReaction = (id: string) => { setReaction(id); setLiked(true); setShowReactions(false); };
  const startReply = (c: PostComment) => {
    setReplyingTo(c.id); setReplyName(`${c.authorFirstName} ${c.authorLastName}`);
    setNewComment(""); setTimeout(() => inputRef.current?.focus(), 80);
  };
  const cancelReply = () => { setReplyingTo(null); setReplyName(""); };
  const submit = async () => {
    const text = newComment.trim();
    if (!text || submitting) return;
    setSubmitting(true); setNewComment("");
    const parentId = replyingTo ?? undefined;
    if (parentId) cancelReply();
    try { const c = await apiPostComment(postId, text, parentId); setComments(prev => [...prev, c]); }
    catch { setNewComment(text); } finally { setSubmitting(false); }
  };
  const toggleCommentLike = async (commentId: number) => {
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, likedByMe: !c.likedByMe, likesCount: c.likedByMe ? Math.max(0, c.likesCount - 1) : c.likesCount + 1 } : c));
    try {
      const { liked: l, likesCount: lc } = await apiToggleCommentLike(postId, commentId);
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, likedByMe: l, likesCount: lc } : c));
    } catch {
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, likedByMe: !c.likedByMe, likesCount: c.likedByMe ? Math.max(0, c.likesCount - 1) : c.likesCount + 1 } : c));
    }
  };

  const topLevel = comments.filter(c => !c.parentId);
  const replies  = (parentId: number) => comments.filter(c => c.parentId === parentId);
  const activeReaction = REACTIONS.find(r => r.id === reaction) ?? REACTIONS[0];

  if (loading) return (
    <div style={{ background:"#F8F9FA", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
        <div style={{ width:36, height:36, border:"3px solid #E5E7EB", borderTopColor:"#22C55E", borderRadius:"50%", animation:"bpdp-spin 0.7s linear infinite" }} />
        <style>{`@keyframes bpdp-spin{to{transform:rotate(360deg)}}`}</style>
        <span style={{ color:"#9CA3AF", fontSize:13, fontWeight:500 }}>Chargement...</span>
      </div>
    </div>
  );

  if (error || !post) return (
    <div style={{ background:"#F8F9FA", minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16 }}>
      <div style={{ width:64, height:64, borderRadius:"50%", background:"#FEF2F2", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <svg viewBox="0 0 24 24" width="32" height="32" fill="#EF4444"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
      </div>
      <div style={{ color:"#6B7280", fontSize:15, textAlign:"center" }}>{error ?? "Publication introuvable."}</div>
      <button onClick={() => navigate(-1 as unknown as string)} style={{ background:"#22C55E", color:"#fff", border:"none", borderRadius:14, padding:"10px 24px", cursor:"pointer", fontWeight:700, fontSize:14, boxShadow:"0 4px 14px rgba(34,197,94,0.35)" }}>
        Retour
      </button>
    </div>
  );

  const authorInitials = getInitials(post.authorName);
  const authorColor   = avatarColor(post.authorName);

  return (
    <div style={{ background:"#F3F4F6", minHeight:"100vh", display:"flex", flexDirection:"column", paddingBottom: voiceMode ? 220 : 80 }}>
      <style>{`
        @keyframes bpdp-reaction-pop{0%{transform:translateY(10px) scale(.8);opacity:0}100%{transform:translateY(0) scale(1);opacity:1}}
        @keyframes bpdp-like-tap{0%,100%{transform:scale(1)}40%{transform:scale(1.35)}}
        .bpdp-action-btn{display:flex;align-items:center;justify-content:center;gap:6px;flex:1;padding:10px 4px;background:none;border:none;cursor:pointer;border-radius:12px;transition:background .14s;font-size:13px;font-weight:600;color:#4B5563}
        .bpdp-action-btn:active{background:#F3F4F6}
        .bpdp-comment-like-btn{background:none;border:none;padding:0;cursor:pointer;font-size:12px;font-weight:700;transition:color .12s}
      `}</style>

      {/* ── Header ── */}
      <div style={{ position:"sticky", top:0, zIndex:50, background:"#fff", borderBottom:"1px solid rgba(0,0,0,0.06)", display:"flex", alignItems:"center", padding:"12px 16px", gap:12, boxShadow:"0 1px 8px rgba(0,0,0,0.06)" }}>
        <button onClick={() => window.history.back()} style={{ width:38, height:38, borderRadius:"50%", background:"#F3F4F6", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M20 12H4M10 6l-6 6 6 6" stroke="#111" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:800, fontSize:16, color:"#111", lineHeight:1.2 }}>
            Publication de {post.authorFirstName ?? post.authorName.split(" ")[0]}
          </div>
        </div>
        <button style={{ width:38, height:38, borderRadius:"50%", background:"#F3F4F6", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none"><circle cx="11" cy="11" r="8" stroke="#374151" strokeWidth="2"/><path d="M21 21l-4.35-4.35" stroke="#374151" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
      </div>

      {/* ── Post card ── */}
      <div style={{ background:"#fff", margin:"10px 12px", borderRadius:24, boxShadow:"0 2px 16px rgba(0,0,0,0.07)", overflow:"hidden" }}>

        {/* Author row */}
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"16px 16px 12px" }}>
          <div style={{ position:"relative", flexShrink:0 }}>
            {post.authorAvatarUrl
              ? <img src={post.authorAvatarUrl} alt={authorInitials} style={{ width:48, height:48, borderRadius:"50%", objectFit:"cover", border:"2.5px solid #22C55E" }} />
              : <div style={{ width:48, height:48, borderRadius:"50%", background:authorColor, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:16, border:"2.5px solid #22C55E" }}>{authorInitials}</div>
            }
            <div style={{ position:"absolute", bottom:1, right:1, width:13, height:13, borderRadius:"50%", background:"#22C55E", border:"2.5px solid #fff" }} />
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontWeight:800, fontSize:15, color:"#111" }}>{post.authorName}</span>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L14.09 8.26L21 9.27L16.5 13.97L17.64 21L12 17.77L6.36 21L7.5 13.97L3 9.27L9.91 8.26L12 2Z" fill="#22C55E"/>
                <polyline points="9,12 11,14 15,10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:2 }}>
              <span style={{ fontSize:12, color:"#9CA3AF" }}>{timeAgo(post.createdAt)}</span>
              <span style={{ color:"#D1D5DB", fontSize:10 }}>·</span>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="#9CA3AF"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
            </div>
          </div>
          <button style={{ width:36, height:36, borderRadius:"50%", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="#9CA3AF"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
          </button>
        </div>

        {/* Content text */}
        {post.content && (
          <div style={{ padding:"0 16px 14px", fontSize:15, color:"#1F2937", lineHeight:1.6, fontWeight:400 }}>{post.content}</div>
        )}

        {/* Media */}
        {post.imageUrl && (
          <div style={{ margin:"0 12px 12px", borderRadius:16, overflow:"hidden" }}>
            {isVideo(post.imageUrl)
              ? <video src={post.imageUrl} poster={post.thumbnailUrl ?? undefined} controls style={{ width:"100%", maxHeight:400, objectFit:"cover", display:"block", background:"#111" }} />
              : <img src={post.imageUrl} alt="" style={{ width:"100%", maxHeight:440, objectFit:"cover", display:"block" }} />
            }
          </div>
        )}

        {/* Reactions summary bar */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"4px 16px 10px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            {(liked || likesCount > 0) && (
              <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                <div style={{ display:"flex", gap:0 }}>
                  {liked && (
                    <div style={{ width:22, height:22, borderRadius:"50%", background:activeReaction.color, border:"2px solid #fff", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {REACTION_ICONS[reaction] ?? REACTION_ICONS.like}
                    </div>
                  )}
                  {!liked && (
                    <div style={{ width:22, height:22, borderRadius:"50%", background:"#22C55E", border:"2px solid #fff", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {REACTION_ICONS.like}
                    </div>
                  )}
                </div>
                <span style={{ fontSize:13, color:"#6B7280", fontWeight:500 }}>{likesCount > 0 ? likesCount : ""}</span>
              </div>
            )}
          </div>
          {post.commentsCount > 0 && (
            <span style={{ fontSize:13, color:"#9CA3AF" }}>{post.commentsCount} commentaire{post.commentsCount > 1 ? "s" : ""}</span>
          )}
        </div>

        {/* Divider */}
        <div style={{ borderTop:"1px solid #F3F4F6", margin:"0 16px" }} />

        {/* ── Action bar ── */}
        <div style={{ display:"flex", padding:"4px 8px", position:"relative" }}>

          {/* Reactions popup */}
          {showReactions && (
            <div style={{ position:"absolute", bottom:"100%", left:8, background:"#fff", borderRadius:28, boxShadow:"0 4px 24px rgba(0,0,0,0.15)", padding:"10px 14px", display:"flex", gap:12, zIndex:100, marginBottom:6, animation:"bpdp-reaction-pop .18s ease-out" }}>
              {REACTIONS.map(r => (
                <button key={r.id} onClick={() => pickReaction(r.id)} title={r.label}
                  style={{ background:"none", border:"none", cursor:"pointer", padding:4, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", transition:"transform .12s" }}
                  onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.45)")}
                  onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                >
                  {REACTION_ICONS[r.id]}
                </button>
              ))}
            </div>
          )}

          {/* J'aime */}
          <button
            className="bpdp-action-btn"
            style={{ color: liked ? activeReaction.color : "#4B5563", fontWeight: liked ? 800 : 600 }}
            onClick={() => { cancelReactionTimer(); toggleLike(); }}
            onMouseDown={startReactionTimer} onMouseUp={cancelReactionTimer}
            onTouchStart={startReactionTimer} onTouchEnd={cancelReactionTimer}
          >
            {liked
              ? <span style={{ animation:"bpdp-like-tap .3s ease" }}>{REACTION_ICONS[reaction]}</span>
              : <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3m7-10v4a2 2 0 0 1-2 2H9l-3 9v1h1a2 2 0 0 0 2-2v-1h9a2 2 0 0 0 2-2l-1-8H14z" stroke="#4B5563" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            }
            <span>{liked ? activeReaction.label : "J'aime"}{liked && likesCount > 0 ? ` ${likesCount}` : ""}</span>
          </button>

          {/* Commenter */}
          <button className="bpdp-action-btn" onClick={() => inputRef.current?.focus()}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="#4B5563" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span>Commenter</span>
          </button>

          {/* Partager */}
          <button className="bpdp-action-btn">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" stroke="#4B5563" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span>Partager</span>
          </button>

          {/* Enregistrer */}
          <button className="bpdp-action-btn" onClick={() => setSaved(s => !s)} style={{ color: saved ? "#22C55E" : "#4B5563" }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill={saved ? "#22C55E" : "none"}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" stroke={saved ? "#22C55E" : "#4B5563"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span>Enregistrer</span>
          </button>
        </div>
      </div>

      {/* ── Comments section ── */}
      <div style={{ background:"#fff", margin:"0 12px 10px", borderRadius:24, boxShadow:"0 2px 16px rgba(0,0,0,0.07)", overflow:"hidden", padding:"4px 0 12px" }}>

        {topLevel.length > 1 && (
          <div style={{ display:"flex", justifyContent:"flex-end", padding:"8px 16px 4px" }}>
            <button style={{ background:"none", border:"none", cursor:"pointer", fontSize:13, fontWeight:700, color:"#374151", display:"flex", alignItems:"center", gap:4 }}>
              Plus pertinents
              <svg viewBox="0 0 24 24" width="14" height="14" fill="#374151"><path d="M7 10l5 5 5-5z"/></svg>
            </button>
          </div>
        )}

        <div style={{ padding:"4px 12px", display:"flex", flexDirection:"column", gap:10 }}>
          {topLevel.map(c => {
            const cInitials = getInitials(`${c.authorFirstName} ${c.authorLastName}`);
            const cColor    = avatarColor(`${c.authorFirstName} ${c.authorLastName}`);
            const cReplies  = replies(c.id);
            return (
              <div key={c.id}>
                <div style={{ display:"flex", gap:9, alignItems:"flex-start" }}>
                  {c.authorAvatarUrl
                    ? <img src={c.authorAvatarUrl} alt={cInitials} style={{ width:36, height:36, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />
                    : <div style={{ width:36, height:36, borderRadius:"50%", background:cColor, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700, fontSize:12, flexShrink:0 }}>{cInitials}</div>
                  }
                  <div style={{ flex:1 }}>
                    <div style={{ position:"relative", display:"inline-block", maxWidth:"100%" }}>
                      <div style={{ background:"#F3F4F6", borderRadius:16, padding:"10px 14px" }}>
                        <div style={{ fontWeight:700, fontSize:13, color:"#111", marginBottom:3 }}>{c.authorFirstName} {c.authorLastName}</div>
                        {c.audioUrl
                          ? <VoicePlayer url={c.audioUrl} duration={c.audioDuration} />
                          : <div style={{ fontSize:14, color:"#1F2937", lineHeight:1.5 }}>{c.content}</div>
                        }
                      </div>
                      {c.likesCount > 0 && (
                        <span style={{ position:"absolute", bottom:-7, right:-4, background:"#fff", borderRadius:12, padding:"2px 6px 2px 3px", boxShadow:"0 1px 6px rgba(0,0,0,0.15)", fontSize:11, display:"flex", alignItems:"center", gap:2 }}>
                          {REACTION_ICONS.love}
                          <span style={{ color:"#6B7280" }}>{c.likesCount}</span>
                        </span>
                      )}
                    </div>
                    <div style={{ display:"flex", gap:14, paddingLeft:4, marginTop:7, fontSize:12, fontWeight:600, color:"#9CA3AF", alignItems:"center" }}>
                      <span style={{ color:"#C4C4C4", fontWeight:400 }}>{timeAgo(c.createdAt)}</span>
                      <button className="bpdp-comment-like-btn" onClick={() => toggleCommentLike(c.id)} style={{ color: c.likedByMe ? "#22C55E" : "#6B7280" }}>J'aime</button>
                      <button className="bpdp-comment-like-btn" onClick={() => replyingTo === c.id ? cancelReply() : startReply(c)} style={{ color: replyingTo === c.id ? "#22C55E" : "#6B7280" }}>
                        {replyingTo === c.id ? "Annuler" : "Répondre"}
                      </button>
                    </div>
                  </div>
                </div>

                {cReplies.length > 0 && (
                  <div style={{ marginLeft:46, marginTop:6, display:"flex", flexDirection:"column", gap:6 }}>
                    {cReplies.map(r => {
                      const rInitials = getInitials(`${r.authorFirstName} ${r.authorLastName}`);
                      const rColor    = avatarColor(`${r.authorFirstName} ${r.authorLastName}`);
                      return (
                        <div key={r.id} style={{ display:"flex", gap:7, alignItems:"flex-start" }}>
                          {r.authorAvatarUrl
                            ? <img src={r.authorAvatarUrl} alt={rInitials} style={{ width:28, height:28, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />
                            : <div style={{ width:28, height:28, borderRadius:"50%", background:rColor, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700, fontSize:10, flexShrink:0 }}>{rInitials}</div>
                          }
                          <div style={{ flex:1 }}>
                            <div style={{ display:"inline-block", background:"#F3F4F6", borderRadius:14, padding:"8px 12px", maxWidth:"100%" }}>
                              <div style={{ fontWeight:700, fontSize:12, color:"#111", marginBottom:2 }}>{r.authorFirstName} {r.authorLastName}</div>
                              <div style={{ fontSize:13, color:"#1F2937" }}>{r.content}</div>
                            </div>
                            <div style={{ display:"flex", gap:10, paddingLeft:4, marginTop:4, fontSize:11, color:"#9CA3AF" }}>
                              <span>{timeAgo(r.createdAt)}</span>
                              <button className="bpdp-comment-like-btn" onClick={() => toggleCommentLike(r.id)} style={{ color: r.likedByMe ? "#22C55E" : "#9CA3AF" }}>J'aime</button>
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
          {topLevel.length === 0 && (
            <div style={{ textAlign:"center", padding:"20px 0", color:"#D1D5DB", fontSize:13 }}>Soyez le premier à commenter</div>
          )}
        </div>
      </div>

      {/* ── Fixed bottom comment bar ── */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"#fff", borderTop:"1px solid #F3F4F6", zIndex:40, boxShadow:"0 -2px 16px rgba(0,0,0,0.06)" }}>
        {replyingTo !== null && (
          <div style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 16px 3px", fontSize:12 }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="#22C55E"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>
            <span style={{ color:"#9CA3AF" }}>Répondre à</span>
            <span style={{ fontWeight:700, color:"#22C55E" }}>{replyName}</span>
            <button onClick={cancelReply} style={{ background:"none", border:"none", cursor:"pointer", color:"#C4C4C4", padding:"0 0 0 4px", marginLeft:"auto", display:"flex" }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
          </div>
        )}
        <div style={{ display:"flex", alignItems:voiceMode ? "flex-start" : "center", gap:10, padding:"9px 12px 14px" }}>
          {user.avatarUrl
            ? <img src={user.avatarUrl} alt="moi" style={{ width:38, height:38, borderRadius:"50%", objectFit:"cover", flexShrink:0, border:"2px solid #22C55E" }} />
            : <div style={{ width:38, height:38, borderRadius:"50%", background:"#22C55E", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:13, flexShrink:0 }}>{userInitials}</div>
          }
          {voiceMode ? (
            <VoiceRecorder onSend={handleVoiceSend} onCancel={() => setVoiceMode(false)} />
          ) : (
            <div style={{ flex:1, background:"#F3F4F6", borderRadius:24, display:"flex", alignItems:"center", padding:"0 8px 0 14px", gap:4, border:"1.5px solid transparent", transition:"border-color .15s" }}
              onFocusCapture={e => (e.currentTarget.style.borderColor = "#22C55E")}
              onBlurCapture={e => (e.currentTarget.style.borderColor = "transparent")}
            >
              <input
                ref={inputRef}
                style={{ flex:1, background:"transparent", border:"none", padding:"10px 0", fontSize:14, outline:"none", color:"#1F2937", minWidth:0 }}
                placeholder={replyingTo != null ? `Répondre à ${replyName.split(" ")[0]}…` : "Écrire un commentaire..."}
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape" && replyingTo) cancelReply(); }}
                disabled={submitting}
              />
              {!newComment.trim() ? (
                <div style={{ display:"flex", gap:2, flexShrink:0, alignItems:"center" }}>
                  <button style={{ background:"none", border:"none", padding:"6px 5px", cursor:"pointer", display:"flex", alignItems:"center" }}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="#9CA3AF"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S8.67 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>
                  </button>
                  <button style={{ background:"none", border:"none", padding:"6px 5px", cursor:"pointer", display:"flex", alignItems:"center" }}>
                    <div style={{ background:"#E5E7EB", borderRadius:4, padding:"2px 4px", fontSize:11, fontWeight:800, color:"#6B7280", letterSpacing:0.3 }}>GIF</div>
                  </button>
                  <button onClick={() => setVoiceMode(true)} style={{ background:"none", border:"none", padding:"6px 5px", cursor:"pointer", display:"flex", alignItems:"center" }}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="#9CA3AF"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28C16.28 17.23 19 14.41 19 11h-1.7z"/></svg>
                  </button>
                  <button style={{ background:"none", border:"none", padding:"6px 5px", cursor:"pointer", display:"flex", alignItems:"center" }}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="#9CA3AF"><rect x="3" y="3" width="18" height="18" rx="3" stroke="#9CA3AF" strokeWidth="1.8" fill="none"/><circle cx="8.5" cy="8.5" r="1.5" fill="#9CA3AF"/><path d="M21 15l-5-5L5 21" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>
              ) : (
                <button onClick={submit} disabled={submitting}
                  style={{ width:34, height:34, borderRadius:"50%", background:"#22C55E", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", opacity: submitting ? 0.6 : 1, boxShadow:"0 2px 8px rgba(34,197,94,0.4)", flexShrink:0 }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="#fff"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
