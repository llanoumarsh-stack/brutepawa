import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "../router";
import {
  apiFetch,
  apiGetComments,
  apiPostComment,
  apiToggleCommentLike,
  apiPostVoiceComment,
  apiUploadVoice,
  type PostComment,
} from "../lib/api";
import VoiceRecorder from "../components/VoiceRecorder";
import VoicePlayer from "../components/VoicePlayer";

/* ─── Reactions ─────────────────────────────────────────────── */
const REACTIONS = [
  {
    id: "like", label: "J'aime", color: "#22C55E",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" width="20" height="20" fill={active ? "#22C55E" : "none"} stroke={active ? "#22C55E" : "#4B5563"} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 10v12M15 5.88L14 10h5.83A2 2 0 0 1 21.83 12.49L19.04 19.5A2 2 0 0 1 17.12 21H7a2 2 0 0 1-2-2v-8.5a2 2 0 0 1 .586-1.414L10 5H13a2 2 0 0 1 2 2v-.12z"/>
      </svg>
    ),
    badge: <svg viewBox="0 0 24 24" width="14" height="14" fill="#22C55E"><path d="M7 10v12M15 5.88L14 10h5.83A2 2 0 0 1 21.83 12.49L19.04 19.5A2 2 0 0 1 17.12 21H7a2 2 0 0 1-2-2v-8.5a2 2 0 0 1 .586-1.414L10 5H13a2 2 0 0 1 2 2v-.12z"/></svg>,
  },
  {
    id: "love", label: "J'adore", color: "#F43F5E",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" width="20" height="20" fill={active ? "#F43F5E" : "none"} stroke={active ? "#F43F5E" : "#4B5563"} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    ),
    badge: <svg viewBox="0 0 24 24" width="14" height="14" fill="#F43F5E"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  },
  {
    id: "fire", label: "Top", color: "#F97316",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" width="20" height="20" fill={active ? "#F97316" : "none"} stroke={active ? "#F97316" : "#4B5563"} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2c0 0-6 6-6 11a6 6 0 0 0 12 0c0-5-6-11-6-11z"/><path d="M12 12c0 0-3 2-3 4a3 3 0 0 0 6 0c0-2-3-4-3-4z" strokeWidth="1.5"/>
      </svg>
    ),
    badge: <svg viewBox="0 0 24 24" width="14" height="14" fill="#F97316"><path d="M12 2c0 0-6 6-6 11a6 6 0 0 0 12 0c0-5-6-11-6-11z"/></svg>,
  },
  {
    id: "clap", label: "Bravo", color: "#A855F7",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" width="20" height="20" fill={active ? "#A855F7" : "none"} stroke={active ? "#A855F7" : "#4B5563"} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.5 14.5l-2-2a2 2 0 0 0-2.828 2.828L8 19.657A8 8 0 0 0 20 12c0-4.418-3.582-8-8-8a8 8 0 0 0-3.5.804"/>
        <path d="M7.5 10.5l4 4M10.5 7.5l4 4M13.5 4.5l4 4" strokeWidth="1.7"/>
      </svg>
    ),
    badge: <svg viewBox="0 0 24 24" width="14" height="14" fill="#A855F7"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  },
];

const AVATAR_COLORS = ["#16A34A","#0284C7","#9333EA","#EA580C","#DC2626","#0891B2","#059669","#4F46E5"];
function getInitials(name?: string) {
  if (!name) return "?";
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

/* ─── Avatar with green border + online dot ─────────────────── */
function Avatar({ url, name, size = 48, borderWidth = 3, online = false }: {
  url?: string | null; name?: string; size?: number; borderWidth?: number; online?: boolean;
}) {
  const initials = getInitials(name);
  const color    = avatarColor(name);
  const inner    = size - borderWidth * 2;
  return (
    <div style={{ position:"relative", flexShrink:0, width:size, height:size }}>
      <div style={{ width:size, height:size, borderRadius:"50%", background:"linear-gradient(135deg,#22C55E 0%,#16A34A 50%,#86EFAC 100%)", padding:borderWidth, boxSizing:"border-box" }}>
        <div style={{ width:inner, height:inner, borderRadius:"50%", overflow:"hidden", background:color, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:Math.round(inner * 0.33) }}>
          {url
            ? <img src={url} alt={initials} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            : initials}
        </div>
      </div>
      {online && (
        <div style={{ position:"absolute", bottom:1, right:1, width:Math.round(size * 0.25), height:Math.round(size * 0.25), borderRadius:"50%", background:"#22C55E", border:`${borderWidth - 1}px solid #fff`, boxShadow:"0 0 6px rgba(34,197,94,0.6)" }} />
      )}
    </div>
  );
}

interface PostData {
  id: number; authorId: number; authorName: string;
  authorFirstName: string | null; authorLastName: string | null;
  authorAvatarUrl: string | null; content: string;
  imageUrl: string | null; thumbnailUrl: string | null;
  musicTrackName: string | null; musicArtist: string | null;
  musicUrl: string | null; musicArtworkUrl: string | null; musicDuration: string | null;
  likesCount: number; commentsCount: number; createdAt: string; liked: boolean;
}

/* ─── Music Player Card (white, premium) ────────────────────── */
function MusicPlayer({ trackName, artist, artworkUrl, url, duration }: {
  trackName: string; artist: string; artworkUrl: string | null; url: string | null; duration: string | null;
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

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().catch(() => {}); setPlaying(true); }
  };

  const total = duration ?? "0:00";

  return (
    <div style={{ margin:"0 14px 14px", background:"#fff", borderRadius:20, padding:"12px 14px", display:"flex", alignItems:"center", gap:12, border:"1px solid #E2E8F0", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
      {/* Album art */}
      <div style={{ width:56, height:56, borderRadius:12, overflow:"hidden", background:"#F1F5F9", flexShrink:0, position:"relative" }}>
        {artworkUrl
          ? <img src={artworkUrl} alt={trackName} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
          : (
            <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", background:"#E2E8F0" }}>
              <svg viewBox="0 0 24 24" width="26" height="26" fill="#94A3B8"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
            </div>
          )}
      </div>

      {/* Info + progress */}
      <div style={{ flex:1, minWidth:0 }}>
        {/* Title row */}
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
          <div style={{ width:17, height:17, borderRadius:"50%", background:"#22C55E", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <svg viewBox="0 0 24 24" width="10" height="10" fill="#fff"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
          </div>
          <span style={{ fontSize:13, fontWeight:800, color:"#0F172A", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{trackName}</span>
        </div>
        <div style={{ fontSize:11.5, color:"#94A3B8", marginBottom:8, paddingLeft:23, fontWeight:500 }}>{artist}</div>

        {/* Progress row */}
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <span style={{ fontSize:10, color:"#94A3B8", flexShrink:0, minWidth:26, fontWeight:600 }}>{current}</span>
          <div
            style={{ flex:1, height:4, background:"#E2E8F0", borderRadius:4, position:"relative", cursor:"pointer" }}
            onClick={e => {
              if (!audioRef.current?.duration) return;
              const rect = e.currentTarget.getBoundingClientRect();
              audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * audioRef.current.duration;
            }}
          >
            <div style={{ width:`${progress}%`, height:"100%", background:"linear-gradient(90deg,#22C55E,#16A34A)", borderRadius:4, position:"relative" }}>
              <div style={{ position:"absolute", right:-5, top:"50%", transform:"translateY(-50%)", width:11, height:11, borderRadius:"50%", background:"#22C55E", boxShadow:"0 0 6px rgba(34,197,94,0.5)" }} />
            </div>
          </div>
          <span style={{ fontSize:10, color:"#94A3B8", flexShrink:0, minWidth:26, textAlign:"right", fontWeight:600 }}>{total}</span>
        </div>
      </div>

      {/* Play / Pause button */}
      <button
        onClick={toggle}
        style={{ width:40, height:40, borderRadius:"50%", background:"#0F172A", border:"none", cursor: url ? "pointer" : "default", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, opacity: url ? 1 : 0.35, boxShadow:"0 2px 8px rgba(0,0,0,0.18)" }}
      >
        {playing
          ? <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          : <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
        }
      </button>

      {/* Animated visualizer bars */}
      <div style={{ display:"flex", alignItems:"flex-end", gap:2, flexShrink:0, height:22 }}>
        {[10, 18, 14, 20, 12].map((h, i) => (
          <div
            key={i}
            style={{
              width:3, borderRadius:3, background:"#22C55E",
              height: playing ? h : 5,
              transition:`height ${0.2 + i * 0.07}s ease`,
              animation: playing ? `bp-bar ${0.5 + i * 0.13}s ease-in-out infinite alternate` : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface Props { postId: number; }

export default function PostDetailPage({ postId }: Props) {
  const navigate = useNavigate();
  const rawUser  = localStorage.getItem("bp_user");
  const user     = rawUser ? JSON.parse(rawUser) as { name: string; email: string; avatarUrl?: string; id?: number } : { name: "Moi", email: "" };

  const [post, setPost]               = useState<PostData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [liked, setLiked]             = useState(false);
  const [likesCount, setLikesCount]   = useState(0);
  const [reaction, setReaction]       = useState<string>("like");
  const [showReactions, setShowReactions] = useState(false);
  const reactionTimer                 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saved, setSaved]             = useState(false);
  const [comments, setComments]       = useState<PostComment[]>([]);
  const [newComment, setNewComment]   = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [replyingTo, setReplyingTo]   = useState<number | null>(null);
  const [replyName, setReplyName]     = useState("");
  const [voiceMode, setVoiceMode]     = useState(false);
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
    try { setComments(await apiGetComments(postId)); } catch { /* silent */ }
  }, [postId]);
  useEffect(() => { loadComments(); }, [loadComments]);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 300); }, []);

  const toggleLike = () => {
    const action = liked ? "unlike" : "like";
    setLiked(!liked); setLikesCount(c => liked ? Math.max(0, c - 1) : c + 1);
    apiFetch(`/posts/${postId}/like`, { method:"POST", body:JSON.stringify({ action }) }).catch(() => {
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
    try {
      const c = await apiPostComment(postId, text, parentId);
      setComments(prev => [...prev, c]);
    } catch { setNewComment(text); } finally { setSubmitting(false); }
  };

  const toggleCommentLike = async (commentId: number) => {
    setComments(prev => prev.map(c => c.id === commentId
      ? { ...c, likedByMe: !c.likedByMe, likesCount: c.likedByMe ? Math.max(0, c.likesCount - 1) : c.likesCount + 1 }
      : c
    ));
    try {
      const { liked: l, likesCount: lc } = await apiToggleCommentLike(postId, commentId);
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, likedByMe: l, likesCount: lc } : c));
    } catch {
      setComments(prev => prev.map(c => c.id === commentId
        ? { ...c, likedByMe: !c.likedByMe, likesCount: c.likedByMe ? Math.max(0, c.likesCount - 1) : c.likesCount + 1 }
        : c
      ));
    }
  };

  const topLevel = comments.filter(c => !c.parentId);
  const replies  = (pid: number) => comments.filter(c => c.parentId === pid);
  const activeReaction = REACTIONS.find(r => r.id === reaction) ?? REACTIONS[0];

  if (loading) return (
    <div style={{ background:"#F7F9FB", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <style>{`@keyframes bp-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:14 }}>
        <div style={{ width:40, height:40, border:"3px solid #DCFCE7", borderTopColor:"#22C55E", borderRadius:"50%", animation:"bp-spin .7s linear infinite" }} />
        <span style={{ color:"#9CA3AF", fontSize:13, fontWeight:600 }}>Chargement...</span>
      </div>
    </div>
  );

  if (error || !post) return (
    <div style={{ background:"#F7F9FB", minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, padding:24 }}>
      <div style={{ width:64, height:64, borderRadius:20, background:"#FEF2F2", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none"><circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth="2"/><path d="M12 8v4M12 16h.01" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"/></svg>
      </div>
      <p style={{ color:"#6B7280", fontSize:15, textAlign:"center", margin:0 }}>{error ?? "Publication introuvable."}</p>
      <button onClick={() => navigate(-1 as unknown as string)} style={{ background:"linear-gradient(135deg,#22C55E,#16A34A)", color:"#fff", border:"none", borderRadius:16, padding:"12px 28px", cursor:"pointer", fontWeight:700, fontSize:14, boxShadow:"0 4px 16px rgba(34,197,94,0.35)" }}>Retour</button>
    </div>
  );

  const authorName = post.authorFirstName ?? post.authorName.split(" ")[0];

  return (
    <div style={{ background:"#F7F9FB", minHeight:"100vh", display:"flex", flexDirection:"column", paddingBottom: voiceMode ? 224 : 84 }}>
      <style>{`
        @keyframes bp-spin  { to { transform: rotate(360deg) } }
        @keyframes bp-pop   { 0% { transform:scale(.7) translateY(8px);opacity:0 } 100% { transform:scale(1) translateY(0);opacity:1 } }
        @keyframes bp-like  { 0%,100% { transform:scale(1) } 35% { transform:scale(1.4) } }
        @keyframes bp-item  { from { opacity:0;transform:translateY(6px) } to { opacity:1;transform:translateY(0) } }
        @keyframes bp-bar   { 0% { opacity:.6 } 100% { opacity:1 } }
        .bp-cmnt-like { background:none;border:none;cursor:pointer;font-size:12px;font-weight:700;transition:color .12s;padding:0 }
        .bp-action    { flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:11px 4px;background:none;border:none;cursor:pointer;font-size:13px;font-weight:700;color:#374151;transition:color .13s,background .13s;white-space:nowrap;min-width:0 }
        .bp-action:active { background:#F8FAFC }
        .bp-action-active { color:#22C55E!important }
        .bp-input-wrap:focus-within { border-color:#22C55E!important;box-shadow:0 0 0 3px rgba(34,197,94,0.12)!important }
      `}</style>

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div style={{ position:"sticky", top:0, zIndex:50, background:"rgba(247,249,251,0.92)", backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)", borderBottom:"1px solid rgba(0,0,0,0.05)", display:"flex", alignItems:"center", padding:"12px 16px", gap:12 }}>
        <button onClick={() => window.history.back()} style={{ width:40, height:40, borderRadius:12, background:"#fff", border:"1px solid rgba(0,0,0,0.07)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 1px 4px rgba(0,0,0,0.06)", flexShrink:0 }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M20 12H4M10 6l-6 6 6 6" stroke="#111" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:900, fontSize:17, color:"#0F172A" }}>Publication de {authorName}</div>
        </div>
        <button style={{ width:40, height:40, borderRadius:12, background:"#fff", border:"1px solid rgba(0,0,0,0.07)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none"><circle cx="11" cy="11" r="8" stroke="#374151" strokeWidth="2"/><path d="M21 21l-4.35-4.35" stroke="#374151" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
      </div>

      {/* ── POST CARD ───────────────────────────────────────────── */}
      <div style={{ background:"#fff", margin:"14px 14px 0", borderRadius:24, boxShadow:"0 4px 24px rgba(0,0,0,0.07)", overflow:"visible" }}>

        {/* Author row */}
        <div style={{ display:"flex", alignItems:"center", gap:13, padding:"16px 16px 12px" }}>
          <Avatar url={post.authorAvatarUrl} name={post.authorName} size={52} borderWidth={3} online />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
              <span style={{ fontWeight:900, fontSize:16.5, color:"#0F172A" }}>{post.authorName}</span>
              <div style={{ width:18, height:18, borderRadius:"50%", background:"linear-gradient(135deg,#22C55E,#16A34A)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <svg viewBox="0 0 12 12" width="10" height="10" fill="none"><path d="M2 6l2.5 2.5L10 3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:3 }}>
              <span style={{ fontSize:12, color:"#94A3B8", fontWeight:500 }}>{timeAgo(post.createdAt)}</span>
              <span style={{ color:"#CBD5E1", fontSize:10 }}>·</span>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="#94A3B8"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
            </div>
          </div>
          <button style={{ width:36, height:36, borderRadius:10, background:"#F8FAFC", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="#94A3B8"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
          </button>
        </div>

        {/* Text content */}
        {post.content && (
          <div style={{ padding:"0 16px 14px", fontSize:15, color:"#1E293B", lineHeight:1.65 }}>{post.content}</div>
        )}

        {/* Music player (white card) */}
        {post.musicTrackName && (
          <MusicPlayer
            trackName={post.musicTrackName}
            artist={post.musicArtist ?? "Artiste inconnu"}
            artworkUrl={post.musicArtworkUrl}
            url={post.musicUrl}
            duration={post.musicDuration}
          />
        )}

        {/* Media image/video */}
        {post.imageUrl && (
          <div style={{ margin:"0 14px 14px", borderRadius:20, overflow:"hidden", boxShadow:"0 2px 12px rgba(0,0,0,0.08)" }}>
            {isVideo(post.imageUrl)
              ? <video src={post.imageUrl} poster={post.thumbnailUrl ?? undefined} controls style={{ width:"100%", maxHeight:420, objectFit:"cover", display:"block", background:"#0F172A" }} />
              : <img src={post.imageUrl} alt="" style={{ width:"100%", maxHeight:480, objectFit:"cover", display:"block" }} />
            }
          </div>
        )}

        {/* Reactions summary bar */}
        {(liked || likesCount > 0) && (
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"4px 16px 10px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              {/* Stacked badge circles */}
              <div style={{ display:"flex" }}>
                {[activeReaction, REACTIONS[1], REACTIONS[2]].slice(0, liked ? 3 : 2).map((r, i) => (
                  <div key={r.id} style={{ width:22, height:22, borderRadius:"50%", background:r.color, border:"2px solid #fff", display:"flex", alignItems:"center", justifyContent:"center", marginLeft: i === 0 ? 0 : -7, zIndex: 3 - i, boxShadow:"0 1px 4px rgba(0,0,0,0.1)" }}>
                    {r.badge}
                  </div>
                ))}
              </div>
              <span style={{ fontSize:13, color:"#64748B", fontWeight:600 }}>
                {likesCount} réaction{likesCount > 1 ? "s" : ""}
              </span>
            </div>
            {/* Mini-avatar stack + chevron */}
            {comments.length > 0 && (
              <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                <div style={{ display:"flex" }}>
                  {comments.slice(0, 3).map((c, i) => {
                    const n = `${c.authorFirstName} ${c.authorLastName}`;
                    return (
                      <div key={c.id} style={{ width:24, height:24, borderRadius:"50%", marginLeft: i === 0 ? 0 : -8, border:"2px solid #fff", overflow:"hidden", background:avatarColor(n), display:"flex", alignItems:"center", justifyContent:"center", zIndex: 3 - i, flexShrink:0, boxShadow:"0 1px 3px rgba(0,0,0,0.1)" }}>
                        {c.authorAvatarUrl
                          ? <img src={c.authorAvatarUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                          : <span style={{ fontSize:8, fontWeight:800, color:"#fff" }}>{getInitials(n)}</span>
                        }
                      </div>
                    );
                  })}
                </div>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#94A3B8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        <div style={{ borderTop:"1px solid #F1F5F9", margin:"0 14px" }} />

        {/* ── 4 Action buttons — equal width, no text cut ─────── */}
        <div style={{ display:"flex", position:"relative" }}>

          {/* Reactions popup */}
          {showReactions && (
            <div style={{ position:"absolute", bottom:"calc(100% + 8px)", left:0, background:"#fff", borderRadius:28, boxShadow:"0 8px 32px rgba(0,0,0,0.14)", padding:"12px 16px", display:"flex", gap:10, zIndex:200, animation:"bp-pop .18s cubic-bezier(.22,1,.36,1)", border:"1px solid rgba(0,0,0,0.05)" }}>
              {REACTIONS.map(r => (
                <button key={r.id} onClick={() => pickReaction(r.id)} title={r.label}
                  style={{ background: reaction === r.id ? r.color + "18" : "none", border:"none", cursor:"pointer", padding:"6px 8px", borderRadius:12, display:"flex", flexDirection:"column", alignItems:"center", gap:4, transition:"transform .12s,background .12s" }}
                  onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.25)")}
                  onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                >
                  {r.icon(reaction === r.id)}
                  <span style={{ fontSize:9, fontWeight:700, color:r.color }}>{r.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* J'aime */}
          <button
            className={`bp-action${liked ? " bp-action-active" : ""}`}
            style={{ color: liked ? activeReaction.color : "#374151", animation: liked ? "bp-like .3s ease" : undefined, borderRadius:"0 0 0 24px" }}
            onClick={() => { cancelReactionTimer(); toggleLike(); }}
            onMouseDown={startReactionTimer} onMouseUp={cancelReactionTimer}
            onTouchStart={startReactionTimer} onTouchEnd={cancelReactionTimer}
          >
            {activeReaction.icon(liked)}
            <span style={{ fontSize:13, fontWeight:700 }}>
              {liked ? activeReaction.label : "J'aime"}
              {likesCount > 0 ? ` ${likesCount}` : ""}
            </span>
          </button>

          <div style={{ width:1, background:"#F1F5F9", alignSelf:"stretch", margin:"8px 0" }} />

          {/* Commenter */}
          <button className="bp-action" onClick={() => inputRef.current?.focus()}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#374151" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>Commenter</span>
          </button>

          <div style={{ width:1, background:"#F1F5F9", alignSelf:"stretch", margin:"8px 0" }} />

          {/* Partager */}
          <button className="bp-action">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#374151" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>
            <span>Partager</span>
          </button>

          <div style={{ width:1, background:"#F1F5F9", alignSelf:"stretch", margin:"8px 0" }} />

          {/* Enregistrer */}
          <button className={`bp-action${saved ? " bp-action-active" : ""}`} onClick={() => setSaved(s => !s)} style={{ borderRadius:"0 0 24px 0" }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill={saved ? "#22C55E" : "none"} stroke={saved ? "#22C55E" : "#374151"} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            <span>Enregistrer</span>
          </button>
        </div>
      </div>

      {/* ── COMMENTS CARD ───────────────────────────────────────── */}
      <div style={{ background:"#fff", margin:"12px 14px", borderRadius:24, boxShadow:"0 4px 24px rgba(0,0,0,0.07)", overflow:"hidden", padding:"4px 0 16px" }}>
        {topLevel.length > 1 && (
          <div style={{ display:"flex", justifyContent:"flex-end", padding:"10px 16px 4px" }}>
            <button style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, fontWeight:800, color:"#374151", display:"flex", alignItems:"center", gap:4 }}>
              Plus pertinents
              <svg viewBox="0 0 24 24" width="13" height="13" fill="#374151"><path d="M7 10l5 5 5-5z"/></svg>
            </button>
          </div>
        )}

        <div style={{ padding:"4px 14px", display:"flex", flexDirection:"column", gap:12 }}>
          {topLevel.map((c, idx) => {
            const cName    = `${c.authorFirstName} ${c.authorLastName}`;
            const cReplies = replies(c.id);
            return (
              <div key={c.id} style={{ animation:`bp-item .25s ${idx * 0.04}s both` }}>
                <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                  <Avatar url={c.authorAvatarUrl} name={cName} size={38} borderWidth={2} />
                  <div style={{ flex:1 }}>
                    <div style={{ position:"relative", display:"inline-block", maxWidth:"100%" }}>
                      <div style={{ background:"#F8FAFC", borderRadius:18, padding:"10px 14px", border:"1px solid rgba(0,0,0,0.04)" }}>
                        <div style={{ fontWeight:800, fontSize:13, color:"#0F172A", marginBottom:3 }}>{cName}</div>
                        {c.audioUrl
                          ? <VoicePlayer url={c.audioUrl} duration={c.audioDuration} />
                          : <div style={{ fontSize:14, color:"#334155", lineHeight:1.55 }}>{c.content}</div>
                        }
                      </div>
                      {c.likesCount > 0 && (
                        <div style={{ position:"absolute", bottom:-8, right:0, background:"#fff", borderRadius:12, padding:"2px 6px 2px 4px", boxShadow:"0 2px 8px rgba(0,0,0,0.12)", fontSize:11, display:"flex", alignItems:"center", gap:3, border:"1px solid #F1F5F9" }}>
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="#F43F5E"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                          <span style={{ color:"#64748B", fontWeight:700 }}>{c.likesCount}</span>
                        </div>
                      )}
                    </div>
                    <div style={{ display:"flex", gap:14, paddingLeft:6, marginTop:9, fontSize:12, alignItems:"center" }}>
                      <span style={{ color:"#CBD5E1", fontWeight:500 }}>{timeAgo(c.createdAt)}</span>
                      <button className="bp-cmnt-like" onClick={() => toggleCommentLike(c.id)} style={{ color: c.likedByMe ? "#22C55E" : "#94A3B8" }}>J'aime</button>
                      <button className="bp-cmnt-like" onClick={() => replyingTo === c.id ? cancelReply() : startReply(c)} style={{ color: replyingTo === c.id ? "#22C55E" : "#94A3B8" }}>
                        {replyingTo === c.id ? "Annuler" : "Répondre"}
                      </button>
                    </div>
                  </div>
                </div>

                {cReplies.length > 0 && (
                  <div style={{ marginLeft:50, marginTop:8, display:"flex", flexDirection:"column", gap:8 }}>
                    {cReplies.map(r => {
                      const rName = `${r.authorFirstName} ${r.authorLastName}`;
                      return (
                        <div key={r.id} style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
                          <Avatar url={r.authorAvatarUrl} name={rName} size={30} borderWidth={2} />
                          <div style={{ flex:1 }}>
                            <div style={{ display:"inline-block", background:"#F8FAFC", borderRadius:14, padding:"8px 12px", border:"1px solid rgba(0,0,0,0.04)", maxWidth:"100%" }}>
                              <div style={{ fontWeight:800, fontSize:12, color:"#0F172A", marginBottom:2 }}>{rName}</div>
                              <div style={{ fontSize:13, color:"#334155" }}>{r.content}</div>
                            </div>
                            <div style={{ display:"flex", gap:10, paddingLeft:4, marginTop:5, fontSize:11 }}>
                              <span style={{ color:"#CBD5E1" }}>{timeAgo(r.createdAt)}</span>
                              <button className="bp-cmnt-like" onClick={() => toggleCommentLike(r.id)} style={{ color: r.likedByMe ? "#22C55E" : "#94A3B8" }}>J'aime</button>
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

          {topLevel.length === 0 && !loading && (
            <div style={{ textAlign:"center", padding:"24px 0 12px" }}>
              <div style={{ width:44, height:44, borderRadius:"50%", background:"#F0FDF4", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 10px" }}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#86EFAC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <p style={{ color:"#CBD5E1", fontSize:13, margin:0 }}>Soyez le premier à commenter</p>
            </div>
          )}
        </div>
      </div>

      {/* ── FIXED COMMENT BAR ───────────────────────────────────── */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"rgba(247,249,251,0.95)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", borderTop:"1px solid rgba(0,0,0,0.06)", zIndex:40, boxShadow:"0 -4px 24px rgba(0,0,0,0.07)" }}>

        {replyingTo !== null && (
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 16px 4px", fontSize:12 }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#22C55E" strokeWidth="2.2" strokeLinecap="round"><path d="M9 15L3 9l6-6M3 9h12a6 6 0 0 1 0 12h-3"/></svg>
            <span style={{ color:"#94A3B8" }}>Répondre à</span>
            <span style={{ fontWeight:800, color:"#22C55E" }}>{replyName}</span>
            <button onClick={cancelReply} style={{ background:"none", border:"none", cursor:"pointer", marginLeft:"auto", display:"flex", padding:2 }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="#CBD5E1" strokeWidth="2.2" strokeLinecap="round"/></svg>
            </button>
          </div>
        )}

        <div style={{ display:"flex", alignItems: voiceMode ? "flex-start" : "center", gap:10, padding:"10px 14px 16px" }}>
          {/* Current user avatar */}
          <Avatar url={user.avatarUrl} name={user.name} size={40} borderWidth={2} online />

          {voiceMode ? (
            <VoiceRecorder onSend={handleVoiceSend} onCancel={() => setVoiceMode(false)} />
          ) : (
            <div
              className="bp-input-wrap"
              style={{ flex:1, background:"#fff", borderRadius:24, display:"flex", alignItems:"center", padding:"0 8px 0 16px", gap:2, border:"1.5px solid #E2E8F0", transition:"border-color .15s,box-shadow .15s" }}
            >
              <input
                ref={inputRef}
                style={{ flex:1, background:"transparent", border:"none", padding:"11px 0", fontSize:14, outline:"none", color:"#1E293B", minWidth:0 }}
                placeholder={replyingTo != null ? `Répondre à ${replyName.split(" ")[0]}…` : "Écrire un commentaire..."}
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape" && replyingTo) cancelReply(); }}
                disabled={submitting}
              />
              {!newComment.trim() ? (
                <div style={{ display:"flex", gap:0, flexShrink:0, alignItems:"center" }}>
                  {/* Emoji */}
                  <button style={{ background:"none", border:"none", padding:"7px 7px", cursor:"pointer", display:"flex", alignItems:"center" }}>
                    <svg viewBox="0 0 24 24" width="21" height="21" fill="none"><circle cx="12" cy="12" r="10" stroke="#CBD5E1" strokeWidth="1.8"/><path d="M8.5 11a1 1 0 1 1 0-2 1 1 0 0 1 0 2zM15.5 11a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" fill="#CBD5E1"/><path d="M8 15c.667 1.333 2 2 4 2s3.333-.667 4-2" stroke="#CBD5E1" strokeWidth="1.7" strokeLinecap="round"/></svg>
                  </button>
                  {/* GIF */}
                  <button style={{ background:"none", border:"none", padding:"7px 5px", cursor:"pointer", display:"flex", alignItems:"center" }}>
                    <div style={{ background:"#F1F5F9", borderRadius:5, padding:"2px 5px", fontSize:10, fontWeight:900, color:"#94A3B8", letterSpacing:0.5 }}>GIF</div>
                  </button>
                  {/* Mic */}
                  <button onClick={() => setVoiceMode(true)} style={{ background:"none", border:"none", padding:"7px 7px", cursor:"pointer", display:"flex", alignItems:"center" }}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#CBD5E1" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>
                  </button>
                  {/* Photo */}
                  <button style={{ background:"none", border:"none", padding:"7px 7px", cursor:"pointer", display:"flex", alignItems:"center" }}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#CBD5E1" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={submit}
                  disabled={submitting}
                  style={{ width:36, height:36, borderRadius:"50%", background:"linear-gradient(135deg,#22C55E,#16A34A)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", opacity: submitting ? 0.6 : 1, boxShadow:"0 3px 12px rgba(34,197,94,0.45)", flexShrink:0, transition:"transform .1s,opacity .1s" }}
                  onMouseDown={e => (e.currentTarget.style.transform = "scale(.9)")}
                  onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
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
