import { useState, useRef, useEffect } from "react";
import { useNavigate } from "../router";
import { searchPlaces, type Place } from "../data/locations";
import { searchItunes, MUSIC_CATEGORIES, type Track } from "../data/music";
import { apiGetUsers, apiCreatePost, type PublicUser } from "../lib/api";
import { useR2Upload, phaseLabel, type UploadedMedia } from "../hooks/useR2Upload";
import VoiceRecorder from "../components/VoiceRecorder";
import { ArrowLeft, Send, Check, Globe, Users, ChevronDown, ChevronRight, MapPin, Music, Eye } from "lucide-react";

interface Props {
  onPublish?: (content: string, bg?: string, mood?: string, location?: string) => void;
}

const G = "#22C55E";
const GD = "#16A34A";

const BG_CHIPS = [
  { id: "none",      label: "Aucun",       value: "none" },
  { id: "purple",    label: "Violet",      value: "linear-gradient(135deg,#9C27B0,#E91E63)" },
  { id: "rose",      label: "Rose",        value: "linear-gradient(135deg,#EC4899,#F43F5E)" },
  { id: "black",     label: "Noir",        value: "linear-gradient(135deg,#0F172A,#374151)" },
  { id: "instagram", label: "Instagram",   value: "linear-gradient(135deg,#F97316,#EC4899,#8B5CF6)" },
  { id: "pink",      label: "Rose clair",  value: "linear-gradient(135deg,#F472B6,#C084FC)" },
  { id: "orange",    label: "Orange",      value: "linear-gradient(135deg,#F97316,#EAB308)" },
  { id: "night",     label: "Nuit",        value: "linear-gradient(135deg,#1E3A5F,#0F172A)" },
];

const MOODS = [
  "😊 Heureux", "😍 Amoureux", "😎 Cool", "🎉 En fête",
  "💪 Motivé", "😴 Fatigué", "🙏 Reconnaissant", "😤 En colère",
  "🥹 Ému", "🤩 Excité", "😔 Triste", "🤔 Pensif",
  "🥳 Festif", "😌 Apaisé", "🔥 En forme", "🤗 Câlin",
];

const ACTIVITIES = [
  "✈️ En voyage", "🍽 En train de manger", "📚 En train de lire",
  "🎬 Regarde un film", "🏋 S'entraîne", "🎮 Joue à un jeu",
  "🎶 Écoute de la musique", "☕ Prend un café", "🛒 Fait du shopping",
  "🏖 À la plage", "💼 Au travail", "🎓 Étudie",
];

const POPULAR_MOODS = [
  { emoji: "😊", label: "Heureux" },
  { emoji: "❤️", label: "Amoureux" },
  { emoji: "😴", label: "Fatigué" },
  { emoji: "🔴", label: "En live" },
  { emoji: "💼", label: "Au travail" },
  { emoji: "🏖", label: "En vacances" },
  { emoji: "⚽", label: "Regarde un match" },
  { emoji: "🎮", label: "Joue à un jeu" },
];

const COUNTRY_FLAGS: Record<string, string> = {
  CI: "🇨🇮", BJ: "🇧🇯", ML: "🇲🇱", SN: "🇸🇳", TG: "🇹🇬",
  GN: "🇬🇳", NE: "🇳🇪", BF: "🇧🇫", CM: "🇨🇲", NG: "🇳🇬",
  GH: "🇬🇭", MA: "🇲🇦", FR: "🇫🇷", US: "🇺🇸",
};

/* ─── Sub-page wrapper ────────────────────────────────────── */
function SubPage({ title, onClose, children, rightAction }: {
  title: string; onClose: () => void; children: React.ReactNode;
  rightAction?: { label: string; action: () => void };
}) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 200, display: "flex", flexDirection: "column", fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <div style={{
        display: "flex", alignItems: "center", padding: "14px 16px",
        borderBottom: "1.5px solid #F1F5F9", flexShrink: 0,
        position: "sticky", top: 0, background: "#fff", zIndex: 10,
      }}>
        <button onClick={onClose} style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: "#F8FAFC", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#374151" }}>
          <ArrowLeft size={20} strokeWidth={2.5} />
        </button>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 17, color: "#111827", textAlign: "center" }}>{title}</div>
        {rightAction ? (
          <button onClick={rightAction.action} style={{ padding: "8px 14px", border: "none", background: G, color: "#fff", borderRadius: 20, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{rightAction.label}</button>
        ) : <div style={{ width: 38 }} />}
      </div>
      <div style={{ overflowY: "auto", flex: 1 }}>{children}</div>
    </div>
  );
}

/* ─── Music row ───────────────────────────────────────────── */
function MusicRow({ track, selected, playing, onSelect, onPlayPause }: {
  track: Track; selected: boolean; playing: boolean;
  onSelect: () => void; onPlayPause: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: "1px solid #F8FAFC", background: selected ? "#F0FDF4" : "#fff", cursor: "pointer" }} onClick={onSelect}>
      <img src={track.artworkUrl} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: selected ? G : "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.title}</div>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{track.artist}</div>
      </div>
      {track.previewUrl && (
        <button onClick={e => { e.stopPropagation(); onPlayPause(); }}
          style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: playing ? G : "#F0FDF4", color: playing ? "#fff" : G, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
          {playing ? "⏸" : "▶"}
        </button>
      )}
      {selected && <div style={{ width: 22, height: 22, borderRadius: "50%", background: G, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Check size={12} color="#fff" /></div>}
    </div>
  );
}

/* ─── Toggle switch ───────────────────────────────────────── */
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!value)} style={{ width: 46, height: 26, borderRadius: 13, background: value ? G : "#E5E7EB", cursor: "pointer", position: "relative", transition: "background .2s", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 3, left: value ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,.2)", transition: "left .2s" }} />
    </div>
  );
}

/* ─── Option row ──────────────────────────────────────────── */
function OptionRow({ icon, color, bg, label, sub, onClick, rightEl }: {
  icon: React.ReactNode; color: string; bg: string;
  label: string; sub: string;
  onClick?: () => void; rightEl?: React.ReactNode;
}) {
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 14, padding: "13px 20px",
      borderBottom: "1px solid #F8FAFC", background: "#fff", cursor: onClick ? "pointer" : "default",
    }}>
      <div style={{ width: 44, height: 44, borderRadius: 14, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{label}</div>
        <div style={{ fontSize: 12.5, color: "#9CA3AF", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>
      </div>
      {rightEl ?? <ChevronRight size={16} color="#D1D5DB" strokeWidth={2.5} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
export default function CreatePostPage({ onPublish }: Props) {
  const navigate = useNavigate();
  const rawUser = localStorage.getItem("fb_user");
  const user = rawUser ? JSON.parse(rawUser) : { name: "Utilisateur", flag: "🇧🇯" };
  const userInitials = user.name ? user.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() : "US";
  const userFlag = user.country ? (COUNTRY_FLAGS[user.country] ?? user.flag ?? "") : (user.flag ?? "🇧🇯");

  /* ─── Core state ────────────────────────────────── */
  const [content, setContent] = useState("");
  const [selectedBg, setSelectedBg] = useState("none");
  const [audience, setAudience] = useState<"public" | "friends" | "subscribers" | "groups" | "private">("public");
  const [showAudience, setShowAudience] = useState(false);
  const [allowMessages, setAllowMessages] = useState(true);
  const [commentAudience, setCommentAudience] = useState<"public" | "friends" | "nobody">("public");
  const [showCommentAudience, setShowCommentAudience] = useState(false);
  const [mounted, setMounted] = useState(false);

  /* ─── Sub-pages ─────────────────────────────────── */
  const [showVisibility, setShowVisibility] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showMood, setShowMood] = useState(false);
  const [moodTab, setMoodTab] = useState<"mood" | "activity">("mood");
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [showLocation, setShowLocation] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState<Place[]>(searchPlaces(""));
  const [selectedLocation, setSelectedLocation] = useState<Place | null>(null);
  const [showMusic, setShowMusic] = useState(false);
  const [musicQuery, setMusicQuery] = useState("");
  const [musicCat, setMusicCat] = useState("all");
  const [musicResults, setMusicResults] = useState<Track[]>([]);
  const [musicLoading, setMusicLoading] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [showTag, setShowTag] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const [taggedUsers, setTaggedUsers] = useState<number[]>([]);
  const [showEvent, setShowEvent] = useState(false);
  const [showLive, setShowLive] = useState(false);
  const [showMessagesSettings, setShowMessagesSettings] = useState(false);

  /* ─── Event form ─────────────────────────────────── */
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [eventTime, setEventTime] = useState("18:00");
  const [eventLocation, setEventLocation] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [eventPaid, setEventPaid] = useState(false);
  const [eventCoverPreview, setEventCoverPreview] = useState<string | null>(null);
  const [eventCoverMedia, setEventCoverMedia] = useState<UploadedMedia | null>(null);

  /* ─── Live form ──────────────────────────────────── */
  const [liveTitle, setLiveTitle] = useState("");
  const [liveDesc, setLiveDesc] = useState("");
  const [liveCategory, setLiveCategory] = useState("");
  const [liveGifts, setLiveGifts] = useState(true);
  const [liveComments, setLiveComments] = useState(true);

  /* ─── Media ──────────────────────────────────────── */
  const [medias, setMedias] = useState<UploadedMedia[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [mediaIsVideo, setMediaIsVideo] = useState<boolean[]>([]);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const { upload, status: uploadStatus, phase: uploadPhase, progress, error: uploadError, reset: resetUpload } = useR2Upload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ─── Nearby places ──────────────────────────────── */
  interface NearbyPlace { name: string; type: string; dist: number; lat: number; lng: number; }
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyCity, setNearbyCity] = useState<string | null>(null);

  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [allUsers, setAllUsers] = useState<PublicUser[]>([]);

  /* ─── Effects ─────────────────────────────────────── */
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setLocationResults(searchPlaces(locationQuery)); }, [locationQuery]);
  useEffect(() => { apiGetUsers().then(setAllUsers).catch(() => {}); }, []);

  useEffect(() => {
    if (!showMusic) return;
    const term = musicQuery.trim() ? musicQuery.trim() : (MUSIC_CATEGORIES.find(c => c.id === musicCat)?.term ?? "afrobeats");
    setMusicLoading(true);
    const timer = setTimeout(() => {
      searchItunes(term, 100).then(t => { setMusicResults(t); setMusicLoading(false); }).catch(() => setMusicLoading(false));
    }, musicQuery.trim() ? 400 : 0);
    return () => clearTimeout(timer);
  }, [musicQuery, musicCat, showMusic]);

  useEffect(() => { if (!showMusic) { audioRef.current?.pause(); setPlayingId(null); } }, [showMusic]);
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const fetchNearbyPlaces = async (lat: number, lng: number) => {
    setNearbyLoading(true); setShowLocation(true);
    try {
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=fr`);
      const geoData = await geoRes.json() as { address?: Record<string, string> };
      const city = geoData.address?.city ?? geoData.address?.town ?? geoData.address?.village ?? "Votre position";
      setNearbyCity(`${city}${geoData.address?.country ? `, ${geoData.address.country}` : ""}`);
      const q = `[out:json][timeout:20];(node["amenity"~"restaurant|bar|cafe|cinema"](around:2000,${lat},${lng});node["leisure"~"park|sports_centre"](around:2000,${lat},${lng}););out body 20;`;
      const ovRes = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`);
      const ovData = await ovRes.json() as { elements: { lat: number; lon: number; tags: Record<string, string> }[] };
      setNearbyPlaces(ovData.elements.filter(e => e.tags?.name).map(e => ({
        name: e.tags.name!, type: e.tags.amenity ?? e.tags.leisure ?? "lieu",
        dist: Math.round(Math.sqrt(((e.lat - lat) * 111000) ** 2 + ((e.lon - lng) * 111000 * Math.cos(lat * Math.PI / 180)) ** 2)),
        lat: e.lat, lng: e.lon,
      })).sort((a, b) => a.dist - b.dist).slice(0, 20));
    } catch { /* ignore */ }
    setNearbyLoading(false);
  };

  /* ─── Derived ─────────────────────────────────────── */
  const activeBg = BG_CHIPS.find(b => b.id === selectedBg);
  const hasBg = selectedBg !== "none";
  const canPublish = (content.trim().length > 0 || medias.length > 0 || selectedTrack) && uploadStatus !== "uploading";
  const moodEmoji = selectedMood ? selectedMood.split(" ")[0] : null;
  const moodWord = selectedMood ? selectedMood.slice(selectedMood.indexOf(" ") + 1) : null;
  const tagUsers = allUsers.map(u => ({
    id: u.id, name: `${u.firstName} ${u.lastName}`,
    initials: `${u.firstName[0] ?? ""}${u.lastName[0] ?? ""}`.toUpperCase(),
    color: ["#22C55E", "#EC4899", "#8B5CF6", "#F97316", "#0EA5E9"][u.id % 5],
    country: u.country ?? "",
  }));
  const taggedNames = taggedUsers.map(id => tagUsers.find(u => u.id === id)?.name).filter(Boolean);
  const filteredUsers = tagUsers.filter(u => !tagQuery.trim() || u.name.toLowerCase().includes(tagQuery.toLowerCase()));

  const AUDIENCE_MAP = {
    public:      { icon: <Globe size={14} color={GD} />,           label: "Public" },
    friends:     { icon: <Users size={14} color={GD} />,           label: "Amis" },
    subscribers: { icon: <span style={{ fontSize: 13 }}>📣</span>, label: "Abonnés" },
    groups:      { icon: <span style={{ fontSize: 13 }}>👥</span>, label: "Groupes" },
    private:     { icon: <span style={{ fontSize: 13 }}>🔒</span>, label: "Privé" },
  };

  const COMMENT_MAP = {
    public:  "Tout le monde",
    friends: "Mes amis",
    nobody:  "Personne",
  };

  /* ─── Handlers ────────────────────────────────────── */
  const handlePublish = async () => {
    if (!canPublish) return;
    let finalContent = content.trim();
    if (selectedLocation) finalContent += `\n📍 ${selectedLocation.city}, ${selectedLocation.country}`;
    const firstMedia = medias[0];
    try {
      await apiCreatePost(
        finalContent,
        firstMedia?.url ?? undefined,
        firstMedia?.thumbnailUrl ?? undefined,
        selectedTrack ? { trackName: selectedTrack.title, artist: selectedTrack.artist, url: selectedTrack.previewUrl, artworkUrl: selectedTrack.artworkUrl, duration: selectedTrack.duration } : undefined,
      );
    } catch (err) {
      alert((err as Error).message ?? "Erreur lors de la publication.");
      return;
    }
    onPublish?.(finalContent, hasBg ? activeBg?.value : undefined, selectedMood ?? undefined, selectedLocation ? selectedLocation.city : undefined);
    navigate("/");
  };

  const VIDEO_EXTS = /\.(mp4|mov|avi|mkv|webm|3gp|3gpp|m4v|ogv|flv|wmv)$/i;
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (e.target) e.target.value = "";
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isVid = file.type.startsWith("video/") || VIDEO_EXTS.test(file.name);
      const previewUrl = URL.createObjectURL(file);
      setMediaPreviews(p => [...p, previewUrl]);
      setMediaIsVideo(v => [...v, isVid]);
      setUploadingIdx(medias.length + i);
      const result = await upload(file);
      setUploadingIdx(null);
      if (result) { setMedias(m => [...m, result]); } else {
        setMediaPreviews(p => p.filter(u => u !== previewUrl));
        setMediaIsVideo(v => v.filter((_, j) => j !== i));
      }
    }
  };

  const handleCoverSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (e.target) e.target.value = "";
    setEventCoverPreview(URL.createObjectURL(file));
    const result = await upload(file);
    if (result) setEventCoverMedia(result);
  };

  function handlePlayPause(track: Track) {
    if (!track.previewUrl) return;
    if (playingId === track.id) { audioRef.current?.pause(); setPlayingId(null); return; }
    audioRef.current?.pause();
    const audio = new Audio(track.previewUrl);
    audioRef.current = audio;
    audio.play().catch(() => {});
    audio.addEventListener("ended", () => setPlayingId(null));
    setPlayingId(track.id);
  }

  const groupedMusic = musicQuery.trim()
    ? Object.entries(musicResults.reduce<Record<string, Track[]>>((acc, t) => { (acc[t.artist] ??= []).push(t); return acc; }, {}))
    : [];

  /* ─── Toolbar quick actions ──────────────────────── */
  const TOOLBAR = [
    {
      id: "photo", label: "Photo",
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5" fill="#22C55E"/><path d="m21 15-5-5L5 21"/>
        </svg>
      ),
      color: "#22C55E", bg: "#F0FDF4",
      action: () => photoInputRef.current?.click(),
    },
    {
      id: "video", label: "Vidéo",
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round">
          <rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3V10z"/>
        </svg>
      ),
      color: "#EF4444", bg: "#FEF2F2",
      action: () => videoInputRef.current?.click(),
    },
    {
      id: "music", label: "Musique",
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#EC4899" strokeWidth="2" strokeLinecap="round">
          <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
        </svg>
      ),
      color: "#EC4899", bg: "#FDF2F8",
      action: () => setShowMusic(true),
    },
    {
      id: "location", label: "Lieu",
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
      ),
      color: "#F97316", bg: "#FFF7ED",
      action: () => setShowLocation(true),
    },
    {
      id: "mood", label: "Humeur",
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#EAB308" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="3"/><line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="3"/>
        </svg>
      ),
      color: "#EAB308", bg: "#FFFBEB",
      action: () => setShowMood(true),
    },
    {
      id: "more", label: "Plus",
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
      ),
      color: "#3B82F6", bg: "#EFF6FF",
      action: () => setShowMoreOptions(true),
    },
  ];

  /* ─── More options grid ──────────────────────────── */
  const MORE_OPTIONS = [
    { icon: "📊", label: "Sondage",               color: "#6366F1", bg: "#EEF2FF" },
    { icon: "💼", label: "Offre d'emploi",         color: "#0EA5E9", bg: "#E0F2FE" },
    { icon: "🛒", label: "Vente Marketplace",      color: "#22C55E", bg: "#F0FDF4" },
    { icon: "🔧", label: "Service professionnel",  color: "#F97316", bg: "#FFF7ED" },
    { icon: "📝", label: "Article long",           color: "#8B5CF6", bg: "#F5F3FF" },
    { icon: "🎁", label: "Collecte de fonds",      color: "#EC4899", bg: "#FDF2F8" },
    { icon: "📢", label: "Offre promotionnelle",   color: "#EF4444", bg: "#FEF2F2" },
    { icon: "📄", label: "Fichier PDF",            color: "#64748B", bg: "#F8FAFC" },
    { icon: "🎵", label: "Audio",                  color: "#A855F7", bg: "#F3E8FF" },
    { icon: "📁", label: "Document",               color: "#0EA5E9", bg: "#E0F2FE" },
  ];

  /* ═══════════════════════════════════════════════════════════ */
  return (
    <div style={{
      position: "fixed", inset: 0, background: "#F8FAFC", zIndex: 50,
      display: "flex", flexDirection: "column",
      fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      opacity: mounted ? 1 : 0,
      transform: mounted ? "translateY(0)" : "translateY(18px)",
      transition: "opacity 280ms ease, transform 280ms ease",
    }}>
      <style>{`
        @keyframes cp-in { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        textarea::placeholder { color: #9CA3AF; }
        ::-webkit-scrollbar { display: none; }
        .cp-row:hover { background: #FAFAFA !important; }
        .cp-row:active { background: #F1F5F9 !important; }
        .cp-chip:active { transform: scale(0.92) !important; }
        .cp-tool:active { transform: scale(0.88) !important; }
      `}</style>

      <input ref={fileInputRef}  type="file" accept="image/*,video/*" multiple style={{ display: "none" }} onChange={handleFileSelect} />
      <input ref={photoInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFileSelect} />
      <input ref={videoInputRef} type="file" accept="video/*" multiple style={{ display: "none" }} onChange={handleFileSelect} />
      <input ref={coverInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleCoverSelect} />

      {/* ══ HEADER ══ */}
      <div style={{
        display: "flex", alignItems: "center", padding: "14px 16px 16px",
        background: `linear-gradient(135deg,${G} 0%,${GD} 100%)`,
        position: "sticky", top: 0, zIndex: 10, flexShrink: 0, gap: 12,
        boxShadow: "0 2px 16px rgba(34,197,94,.25)",
      }}>
        <button onClick={() => navigate("/")} style={{
          width: 40, height: 40, borderRadius: "50%", border: "none",
          background: "rgba(255,255,255,.20)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0,
        }}>
          <ArrowLeft size={20} strokeWidth={2.5} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: "#fff", letterSpacing: "-.2px" }}>Créer une publication</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.75)", marginTop: 1 }}>Partagez avec votre communauté</div>
        </div>
        <button onClick={handlePublish} disabled={!canPublish} style={{
          background: "#fff", color: GD, border: "none", borderRadius: 999,
          padding: "10px 18px", fontWeight: 700, fontSize: 13,
          cursor: canPublish ? "pointer" : "not-allowed",
          display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
          opacity: canPublish ? 1 : 0.55,
          boxShadow: "0 4px 14px rgba(0,0,0,.1)",
        }}>
          <Send size={14} strokeWidth={2.5} color={GD} />
          PUBLIER
        </button>
      </div>

      {/* ══ SCROLLABLE CONTENT ══ */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 80 }}>

        {/* ── COMPOSER CARD ── */}
        <div style={{
          margin: "16px 14px 0", background: "#fff", borderRadius: 24,
          boxShadow: "0 8px 30px rgba(0,0,0,.06)",
          animation: "cp-in 300ms ease both",
        }}>
          {/* Author row */}
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "20px 20px 0" }}>
            {/* Avatar */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                background: `linear-gradient(135deg,${G},${GD})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 800, fontSize: 18,
                boxShadow: `0 4px 14px rgba(34,197,94,.3)`,
              }}>
                {user.avatarUrl
                  ? <img src={user.avatarUrl} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                  : userInitials}
              </div>
              <div style={{
                position: "absolute", bottom: 1, right: 1,
                width: 14, height: 14, borderRadius: "50%",
                background: G, border: "2px solid #fff",
              }} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Name + mood */}
              <div style={{ fontWeight: 700, fontSize: 15.5, color: "#111827", lineHeight: 1.3, marginBottom: 8 }}>
                {user.name} {userFlag}
                {moodEmoji && <span style={{ fontWeight: 400, color: "#64748B" }}> est {moodEmoji} <em>{moodWord}</em></span>}
                {taggedNames.length > 0 && (
                  <span style={{ fontWeight: 400, color: "#64748B" }}>
                    {" "}avec{" "}
                    {taggedNames.map((n, i) => (
                      <span key={i}><strong style={{ color: G }}>{n}</strong>{i < taggedNames.length - 2 ? ", " : i < taggedNames.length - 1 ? " et " : ""}</span>
                    ))}
                  </span>
                )}
              </div>
              {/* Music badge */}
              {selectedTrack && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8, background: "#F5F3FF", borderRadius: 8, padding: "4px 10px", width: "fit-content" }}>
                  <Music size={11} color="#8B5CF6" />
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#8B5CF6" }}>{selectedTrack.title} · {selectedTrack.artist}</span>
                  <button onClick={() => setSelectedTrack(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#9CA3AF", padding: "0 2px" }}>✕</button>
                </div>
              )}
              {/* Audience badge */}
              <button onClick={() => setShowVisibility(true)} style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "#F0FDF4", border: "1.5px solid #BBF7D0",
                borderRadius: 20, padding: "5px 12px 5px 9px", cursor: "pointer",
              }}>
                {AUDIENCE_MAP[audience].icon}
                <span style={{ fontSize: 13, fontWeight: 700, color: GD }}>{AUDIENCE_MAP[audience].label}</span>
                <ChevronDown size={12} color={GD} />
              </button>
            </div>
          </div>

          {/* Textarea */}
          <div style={{ padding: "14px 20px 8px" }}>
            <div style={{
              background: hasBg ? activeBg?.value : "transparent",
              borderRadius: hasBg ? 16 : 0,
              padding: hasBg ? "24px 16px" : 0,
              minHeight: hasBg ? 100 : 0,
              display: "flex", flexDirection: "column",
              alignItems: hasBg ? "center" : "stretch",
              justifyContent: hasBg ? "center" : "flex-start",
              transition: "background .3s",
            }}>
              {showVoiceRecorder ? (
                <div style={{ padding: "8px 0" }}>
                  <VoiceRecorder
                    onSend={async (blob, _dur) => {
                      const file = new File([blob], `vocal_${Date.now()}.webm`, { type: blob.type || "audio/webm" });
                      const result = await upload(file);
                      if (result) {
                        setMedias(m => [...m, result]);
                        setMediaPreviews(p => [...p, "__audio__"]);
                        setMediaIsVideo(v => [...v, false]);
                      }
                      setShowVoiceRecorder(false);
                    }}
                    onCancel={() => setShowVoiceRecorder(false)}
                  />
                </div>
              ) : (
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={e => {
                    setContent(e.target.value);
                    if (textareaRef.current) {
                      textareaRef.current.style.height = "auto";
                      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
                    }
                  }}
                  placeholder="Partagez un moment fort de votre journée..."
                  autoFocus
                  maxLength={5000}
                  style={{
                    width: "100%", border: "none", outline: "none", resize: "none",
                    fontSize: hasBg ? 20 : 19, fontWeight: 500,
                    color: hasBg ? "#fff" : "#111827",
                    background: "transparent", textAlign: hasBg ? "center" : "left",
                    minHeight: 72, lineHeight: 1.6,
                    caretColor: G, fontFamily: "inherit", boxSizing: "border-box",
                    overflow: "hidden",
                  }}
                />
              )}
            </div>

            {/* Location tag */}
            {selectedLocation && (
              <div style={{ fontSize: 12.5, color: "#64748B", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                <MapPin size={11} color="#F97316" />
                <span>{selectedLocation.city}, {selectedLocation.country}</span>
                <button onClick={() => setSelectedLocation(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#9CA3AF" }}>✕</button>
              </div>
            )}

            {/* Counter + Aa */}
            {!showVoiceRecorder && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                <span style={{ fontSize: 12, color: "#9CA3AF" }}>{content.length} / 5000</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: G, cursor: "pointer" }}>Aa</span>
              </div>
            )}
          </div>

          {/* Media previews */}
          {mediaPreviews.length > 0 && (
            <div style={{ padding: "0 16px 12px", display: "flex", gap: 8, overflowX: "auto" }}>
              {mediaPreviews.map((src, i) => {
                const uploaded = medias[i];
                const isUploading = uploadingIdx === i;
                const isAudio = src === "__audio__" || uploaded?.kind === "audio";
                const isVideo = !isAudio && (uploaded?.kind === "video" || mediaIsVideo[i]);
                return (
                  <div key={i} style={{ position: "relative", flexShrink: 0 }}>
                    {isAudio ? (
                      <div style={{ width: 80, height: 80, borderRadius: 12, background: "#FCE4EC", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 28 }}>🎙</span>
                      </div>
                    ) : isVideo ? (
                      <video src={src} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 12 }} muted playsInline />
                    ) : (
                      <img src={src} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 12, opacity: isUploading ? 0.5 : 1 }} />
                    )}
                    {isUploading && (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.3)", borderRadius: 12 }}>
                        <span style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>{progress}%</span>
                      </div>
                    )}
                    {uploaded && (
                      <div style={{ position: "absolute", bottom: 4, left: 4, background: G, borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Check size={9} color="#fff" />
                      </div>
                    )}
                    <button onClick={() => {
                      setMediaPreviews(p => p.filter((_, j) => j !== i));
                      setMediaIsVideo(v => v.filter((_, j) => j !== i));
                      setMedias(m => m.filter((_, j) => j !== i));
                    }} style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,.5)", border: "none", borderRadius: "50%", width: 20, height: 20, color: "#fff", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                  </div>
                );
              })}
              <button onClick={() => fileInputRef.current?.click()} style={{ width: 80, height: 80, border: "2px dashed #BBF7D0", borderRadius: 12, background: "#F0FDF4", cursor: "pointer", fontSize: 22, color: G, flexShrink: 0 }}>+</button>
            </div>
          )}

          {/* Upload progress */}
          {uploadStatus === "uploading" && (
            <div style={{ padding: "0 16px 10px" }}>
              <div style={{ height: 3, background: "#E5E7EB", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${progress}%`, background: `linear-gradient(90deg,${G},${GD})`, borderRadius: 4, transition: "width .2s" }} />
              </div>
              <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{phaseLabel(uploadPhase, progress)}</div>
            </div>
          )}
          {uploadError && (
            <div style={{ padding: "0 16px 8px", fontSize: 12, color: "#EF4444" }}>
              ⚠️ {uploadError} — <span onClick={resetUpload} style={{ cursor: "pointer", textDecoration: "underline" }}>Réessayer</span>
            </div>
          )}

          {/* ── QUICK TOOLBAR ── */}
          <div style={{ padding: "14px 16px 16px", borderTop: "1.5px solid #F8FAFC" }}>
            <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
              {TOOLBAR.map(item => (
                <div key={item.id} className="cp-tool" onClick={item.action}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer", flex: 1 }}>
                  <div style={{
                    width: 50, height: 50, borderRadius: 14,
                    background: item.bg, border: `1px solid ${item.color}18`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 2px 8px rgba(0,0,0,.04)",
                    transition: "transform .15s ease",
                  }}>
                    {item.icon}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 500, color: "#64748B", whiteSpace: "nowrap" }}>{item.label}</span>
                </div>
              ))}
            </div>

            {/* ── COLOR CHIPS ── */}
            <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center", overflowX: "auto", scrollbarWidth: "none" }}>
              {/* Pencil chip (clear bg) */}
              <div className="cp-chip" onClick={() => setSelectedBg("none")}
                style={{
                  width: 52, height: 36, borderRadius: 10, flexShrink: 0,
                  background: "#fff",
                  border: selectedBg === "none" ? `2px solid ${G}` : "1.5px solid #E5E7EB",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", transition: "transform .15s",
                  boxShadow: selectedBg === "none" ? `0 0 0 3px rgba(34,197,94,.15)` : "none",
                }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={selectedBg === "none" ? G : "#9CA3AF"} strokeWidth="2" strokeLinecap="round">
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
              </div>
              {BG_CHIPS.filter(b => b.id !== "none").map(bg => {
                const isActive = selectedBg === bg.id;
                return (
                  <div key={bg.id} className="cp-chip" onClick={() => setSelectedBg(bg.id === selectedBg ? "none" : bg.id)}
                    style={{
                      width: 52, height: 36, borderRadius: 10, flexShrink: 0,
                      background: bg.value,
                      border: isActive ? "2.5px solid #fff" : "2px solid transparent",
                      boxShadow: isActive ? `0 0 0 3px ${G}, 0 4px 12px rgba(0,0,0,.15)` : "0 2px 6px rgba(0,0,0,.12)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", transition: "transform .15s, box-shadow .15s",
                    }}>
                    {isActive && (
                      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(255,255,255,.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Check size={10} color={G} strokeWidth={3} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── OPTIONS LIST ── */}
        <div style={{ margin: "12px 14px 0", background: "#fff", borderRadius: 24, overflow: "hidden", boxShadow: "0 8px 30px rgba(0,0,0,.06)", animation: "cp-in 380ms ease both" }}>
          <OptionRow
            icon={<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
            color="#3B82F6" bg="#EFF6FF"
            label="Identifier des personnes"
            sub={taggedNames.length > 0 ? taggedNames.join(", ") : "Mentionnez des amis"}
            onClick={() => setShowTag(true)}
          />
          <OptionRow
            icon={<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#EC4899" strokeWidth="2" strokeLinecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>}
            color="#EC4899" bg="#FDF2F8"
            label="Musique"
            sub={selectedTrack ? `${selectedTrack.title} · ${selectedTrack.artist}` : "Ajoutez une musique à votre publication"}
            onClick={() => setShowMusic(true)}
          />
          <OptionRow
            icon={<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>}
            color="#F97316" bg="#FFF7ED"
            label="Ajouter un lieu"
            sub={selectedLocation ? `${selectedLocation.city}, ${selectedLocation.country}` : "Indiquez où vous êtes"}
            onClick={() => setShowLocation(true)}
          />
          <OptionRow
            icon={<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#EAB308" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="3"/><line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="3"/></svg>}
            color="#EAB308" bg="#FFFBEB"
            label="Humeur / Activité"
            sub={selectedMood ?? "Exprimez ce que vous faites"}
            onClick={() => setShowMood(true)}
          />
          <OptionRow
            icon={<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
            color="#22C55E" bg="#F0FDF4"
            label="Recevoir des messages"
            sub="Autorisez les messages privés"
            rightEl={<Toggle value={allowMessages} onChange={setAllowMessages} />}
          />
          <OptionRow
            icon={<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
            color="#8B5CF6" bg="#F5F3FF"
            label="Créer un évènement"
            sub="Organisez un évènement"
            onClick={() => setShowEvent(true)}
          />
          <OptionRow
            icon={<div style={{ position: "relative" }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3V10z"/></svg>
              <div style={{ position: "absolute", top: -5, right: -6, background: "#EF4444", borderRadius: 4, padding: "1px 4px" }}>
                <span style={{ fontSize: 7, fontWeight: 900, color: "#fff" }}>LIVE</span>
              </div>
            </div>}
            color="#EF4444" bg="#FEF2F2"
            label="Lancer un direct"
            sub="Diffusez en direct maintenant"
            onClick={() => setShowLive(true)}
          />
        </div>
      </div>

      {/* ══ BOTTOM BAR ══ */}
      <div style={{
        position: "sticky", bottom: 0, background: "#fff", borderTop: "1.5px solid #F1F5F9",
        padding: "12px 16px", display: "flex", gap: 12, alignItems: "center", flexShrink: 0,
        boxShadow: "0 -4px 20px rgba(0,0,0,.06)",
      }}>
        {/* Comment audience */}
        <div style={{ position: "relative", flex: 1 }}>
          <button onClick={() => setShowCommentAudience(v => !v)} style={{
            display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: 0,
          }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#64748B" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <div>
              <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600 }}>Qui peut commenter ?</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", display: "flex", alignItems: "center", gap: 3 }}>
                {COMMENT_MAP[commentAudience]} <ChevronDown size={12} color="#9CA3AF" />
              </div>
            </div>
          </button>
          {showCommentAudience && (
            <div style={{ position: "absolute", bottom: 40, left: 0, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, boxShadow: "0 8px 24px rgba(0,0,0,.12)", zIndex: 20, overflow: "hidden", minWidth: 180 }}>
              {(["public", "friends", "nobody"] as const).map(a => (
                <div key={a} onClick={() => { setCommentAudience(a); setShowCommentAudience(false); }} style={{ padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontWeight: commentAudience === a ? 700 : 500, background: commentAudience === a ? "#F0FDF4" : "#fff" }}>
                  <span style={{ fontSize: 14, color: "#374151" }}>{COMMENT_MAP[a]}</span>
                  {commentAudience === a && <Check size={14} color={G} style={{ marginLeft: "auto" }} />}
                </div>
              ))}
            </div>
          )}
        </div>

        <button onClick={handlePublish} disabled={!canPublish} style={{
          background: canPublish ? `linear-gradient(135deg,${G},${GD})` : "#E5E7EB",
          color: canPublish ? "#fff" : "#9CA3AF",
          border: "none", borderRadius: 14, padding: "13px 28px",
          fontWeight: 700, fontSize: 16, cursor: canPublish ? "pointer" : "not-allowed",
          display: "flex", alignItems: "center", gap: 7,
          boxShadow: canPublish ? `0 4px 16px rgba(34,197,94,.4)` : "none",
          transition: "all .2s",
        }}>
          <Send size={16} strokeWidth={2.5} />
          PUBLIER
        </button>
      </div>

      {/* ══ SOUS-PAGE : VISIBILITÉ ══ */}
      {showVisibility && (
        <SubPage title="Qui peut voir votre publication ?" onClose={() => setShowVisibility(false)}>
          <div style={{ padding: "8px 0 20px" }}>
            {(["public", "friends", "subscribers", "groups", "private"] as const).map(a => {
              const icons: Record<string, string> = { public: "🌍", friends: "👥", subscribers: "📣", groups: "👨‍👩‍👧‍👦", private: "🔒" };
              const descs: Record<string, string> = {
                public: "Tout le monde sur et en dehors de BrutePawa",
                friends: "Vos amis sur BrutePawa",
                subscribers: "Vos abonnés",
                groups: "Les membres de vos groupes",
                private: "Seulement moi",
              };
              return (
                <div key={a} onClick={() => { setAudience(a); setShowVisibility(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", cursor: "pointer", borderBottom: "1px solid #F8FAFC", background: audience === a ? "#F0FDF4" : "#fff" }}>
                  <div style={{ width: 48, height: 48, borderRadius: 16, background: audience === a ? "#DCFCE7" : "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{icons[a]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: audience === a ? GD : "#111827" }}>{AUDIENCE_MAP[a].label}</div>
                    <div style={{ fontSize: 12.5, color: "#9CA3AF", marginTop: 2 }}>{descs[a]}</div>
                  </div>
                  {audience === a && <Check size={20} color={G} strokeWidth={2.5} />}
                </div>
              );
            })}
          </div>
        </SubPage>
      )}

      {/* ══ SOUS-PAGE : PLUS D'OPTIONS ══ */}
      {showMoreOptions && (
        <SubPage title="Plus d'options" onClose={() => setShowMoreOptions(false)}>
          <div style={{ padding: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {MORE_OPTIONS.map((opt, i) => (
                <div key={i} onClick={() => setShowMoreOptions(false)} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                  padding: "16px 8px", background: "#fff", borderRadius: 16,
                  boxShadow: "0 2px 10px rgba(0,0,0,.06)", cursor: "pointer",
                  border: "1.5px solid #F1F5F9",
                  transition: "transform .15s",
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "scale(1.03)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "scale(1)"; }}
                >
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: opt.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                    {opt.icon}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", textAlign: "center", lineHeight: 1.3 }}>{opt.label}</span>
                </div>
              ))}
            </div>
          </div>
        </SubPage>
      )}

      {/* ══ SOUS-PAGE : HUMEUR / ACTIVITÉ ══ */}
      {showMood && (
        <SubPage title="Humeur / Activité" onClose={() => setShowMood(false)}>
          {/* Search */}
          <div style={{ padding: "12px 16px 0" }}>
            <div style={{ position: "relative" }}>
              <input placeholder="Rechercher une humeur ou activité" style={{ width: "100%", padding: "11px 36px 11px 40px", border: "1.5px solid #E5E7EB", borderRadius: 24, fontSize: 14, outline: "none", background: "#F8FAFC", boxSizing: "border-box" }} onFocus={e => (e.currentTarget.style.borderColor = G)} onBlur={e => (e.currentTarget.style.borderColor = "#E5E7EB")} />
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}>🔍</span>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "2px solid #F1F5F9", margin: "12px 16px 0" }}>
            {(["mood", "activity"] as const).map(tab => (
              <button key={tab} onClick={() => setMoodTab(tab)} style={{ flex: 1, padding: "10px 0", border: "none", background: "none", fontWeight: 700, fontSize: 14, cursor: "pointer", color: moodTab === tab ? G : "#64748B", borderBottom: moodTab === tab ? `2.5px solid ${G}` : "2.5px solid transparent", marginBottom: -2 }}>
                {tab === "mood" ? "😊 Humeur" : "🎯 Activité"}
              </button>
            ))}
          </div>

          <div style={{ padding: "16px" }}>
            {moodTab === "mood" && (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#64748B", marginBottom: 12 }}>Humeurs populaires</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
                  {POPULAR_MOODS.map(m => (
                    <div key={m.label} onClick={() => { setSelectedMood(`${m.emoji} ${m.label}`); setShowMood(false); }}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "10px 4px", background: selectedMood?.includes(m.label) ? "#DCFCE7" : "#F8FAFC", borderRadius: 12, cursor: "pointer", border: selectedMood?.includes(m.label) ? `2px solid ${G}` : "2px solid transparent" }}>
                      <span style={{ fontSize: 24 }}>{m.emoji}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#64748B", textAlign: "center" }}>{m.label}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#64748B", marginBottom: 8 }}>Toutes les humeurs</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {MOODS.map(item => (
                    <div key={item} onClick={() => { setSelectedMood(item); setShowMood(false); }} style={{ padding: "11px 14px", background: selectedMood === item ? "#DCFCE7" : "#F8FAFC", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600, border: selectedMood === item ? `2px solid ${G}` : "2px solid transparent" }}>{item}</div>
                  ))}
                </div>
              </>
            )}
            {moodTab === "activity" && (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#64748B", marginBottom: 12 }}>Activités populaires</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {ACTIVITIES.map(act => (
                    <div key={act} onClick={() => { setSelectedMood(act); setShowMood(false); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 12px", borderRadius: 12, cursor: "pointer", background: selectedMood === act ? "#F0FDF4" : "#fff", border: selectedMood === act ? `1.5px solid ${G}` : "1.5px solid transparent" }}>
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{act.split(" ")[0]}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>{act.slice(act.indexOf(" ") + 1)}</span>
                      {selectedMood === act && <Check size={16} color={G} style={{ marginLeft: "auto" }} />}
                    </div>
                  ))}
                </div>
              </>
            )}
            {selectedMood && (
              <div onClick={() => { setSelectedMood(null); setShowMood(false); }} style={{ marginTop: 12, padding: "11px 14px", background: "#FEF2F2", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#EF4444", textAlign: "center" }}>
                ✕ Supprimer
              </div>
            )}
          </div>
        </SubPage>
      )}

      {/* ══ SOUS-PAGE : LIEU ══ */}
      {showLocation && (
        <SubPage title="Ajouter un lieu" onClose={() => setShowLocation(false)}>
          <div style={{ padding: "12px 16px 0" }}>
            <div style={{ position: "relative" }}>
              <input value={locationQuery} onChange={e => setLocationQuery(e.target.value)} placeholder="Rechercher un lieu"
                style={{ width: "100%", padding: "12px 36px 12px 42px", border: "1.5px solid #E5E7EB", borderRadius: 24, fontSize: 14, outline: "none", background: "#F8FAFC", boxSizing: "border-box" }}
                onFocus={e => (e.currentTarget.style.borderColor = G)}
                onBlur={e => (e.currentTarget.style.borderColor = "#E5E7EB")} />
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}>🔍</span>
              {locationQuery && <button onClick={() => setLocationQuery("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 22, height: 22, borderRadius: "50%", background: "#9CA3AF", border: "none", color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>}
            </div>
          </div>

          {/* GPS */}
          <div onClick={() => navigator.geolocation?.getCurrentPosition(p => fetchNearbyPlaces(p.coords.latitude, p.coords.longitude))}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", cursor: "pointer", borderBottom: "1px solid #F8FAFC" }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "#FFF7ED", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MapPin size={20} color="#F97316" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>Ma position actuelle</div>
              <div style={{ fontSize: 12, color: "#9CA3AF" }}>Utiliser ma localisation</div>
            </div>
          </div>

          {nearbyCity && (
            <div style={{ padding: "4px 20px 6px", fontSize: 12, fontWeight: 700, color: "#F97316", display: "flex", alignItems: "center", gap: 5 }}>
              📍 {nearbyCity}
            </div>
          )}
          {nearbyLoading && <div style={{ padding: "20px", textAlign: "center", color: "#F97316", fontSize: 13 }}>📍 Chargement…</div>}

          {nearbyPlaces.length > 0 && !locationQuery && (
            <>
              <div style={{ padding: "8px 20px 4px", fontSize: 12, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".04em" }}>Lieux proches</div>
              {nearbyPlaces.map((p, i) => (
                <div key={i} onClick={() => { setSelectedLocation({ city: p.name, country: nearbyCity?.split(", ").slice(1).join(", ") ?? "", flag: "📍" }); setShowLocation(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", cursor: "pointer", borderBottom: "1px solid #F8FAFC" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: "#FFF7ED", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16 }}>📌</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>{p.dist < 1000 ? `${p.dist} m` : `${(p.dist / 1000).toFixed(1)} km`}</div>
                  </div>
                </div>
              ))}
            </>
          )}

          {locationQuery && (
            <>
              <div style={{ padding: "8px 20px 4px", fontSize: 12, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".04em" }}>Villes & pays</div>
              {locationResults.map((place, i) => (
                <div key={i} onClick={() => { setSelectedLocation(place); setShowLocation(false); setLocationQuery(""); }}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 20px", cursor: "pointer", borderBottom: "1px solid #F8FAFC", background: selectedLocation?.city === place.city ? "#F0FDF4" : "#fff" }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{place.flag}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{place.city}</div>
                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>{place.country}</div>
                  </div>
                  <MapPin size={16} color={selectedLocation?.city === place.city ? G : "#E5E7EB"} />
                </div>
              ))}
            </>
          )}

          {!locationQuery && !nearbyLoading && nearbyPlaces.length === 0 && (
            <>
              <div style={{ padding: "8px 20px 4px", fontSize: 12, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".04em" }}>Lieux populaires</div>
              {locationResults.slice(0, 10).map((place, i) => (
                <div key={i} onClick={() => { setSelectedLocation(place); setShowLocation(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", cursor: "pointer", borderBottom: "1px solid #F8FAFC" }}>
                  <span style={{ fontSize: 22 }}>{place.flag}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{place.city}</div>
                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>{place.country}</div>
                  </div>
                </div>
              ))}
            </>
          )}

          {selectedLocation && (
            <div onClick={() => { setSelectedLocation(null); setShowLocation(false); }}
              style={{ padding: "14px 20px", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#EF4444", borderTop: "1px solid #FEF2F2" }}>
              ✕ Supprimer le lieu
            </div>
          )}
        </SubPage>
      )}

      {/* ══ SOUS-PAGE : MUSIQUE ══ */}
      {showMusic && (
        <SubPage title="Musique" onClose={() => setShowMusic(false)}>
          <div style={{ padding: "10px 16px 0" }}>
            <div style={{ position: "relative" }}>
              <input value={musicQuery} onChange={e => setMusicQuery(e.target.value)} placeholder="Recherchez de la musique"
                style={{ width: "100%", padding: "11px 36px 11px 40px", border: "none", borderRadius: 24, fontSize: 14, outline: "none", background: "#F8FAFC", boxSizing: "border-box" }} />
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#64748B" }}>🔍</span>
              {musicQuery && <button onClick={() => setMusicQuery("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 15, color: "#64748B" }}>✕</button>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, padding: "10px 16px", overflowX: "auto", scrollbarWidth: "none" }}>
            {MUSIC_CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setMusicCat(cat.id)} style={{ flexShrink: 0, padding: "7px 16px", borderRadius: 20, border: "none", background: musicCat === cat.id ? G : "#F8FAFC", color: musicCat === cat.id ? "#fff" : "#0F172A", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{cat.label}</button>
            ))}
          </div>
          <div style={{ overflowY: "auto" }}>
            {musicLoading && <div style={{ padding: "32px", textAlign: "center", color: "#64748B" }}>🎵 Chargement…</div>}
            {!musicLoading && !musicQuery.trim() && <div style={{ padding: "4px 20px 8px", fontSize: 14, fontWeight: 700 }}>{MUSIC_CATEGORIES.find(c => c.id === musicCat)?.label ?? "Pour vous"}</div>}
            {!musicLoading && musicQuery.trim() && Object.entries(musicResults.reduce<Record<string, Track[]>>((acc, t) => { (acc[t.artist] ??= []).push(t); return acc; }, {})).map(([artist, tracks]) => (
              <div key={artist}>
                <div style={{ padding: "8px 20px 4px", fontSize: 12, fontWeight: 700, color: "#64748B", background: "#F8FAFC" }}>{artist}</div>
                {tracks.map(t => <MusicRow key={t.id} track={t} selected={selectedTrack?.id === t.id} playing={playingId === t.id} onSelect={() => { setSelectedTrack(t); setShowMusic(false); audioRef.current?.pause(); setPlayingId(null); }} onPlayPause={() => handlePlayPause(t)} />)}
              </div>
            ))}
            {!musicLoading && !musicQuery.trim() && musicResults.map(t => <MusicRow key={t.id} track={t} selected={selectedTrack?.id === t.id} playing={playingId === t.id} onSelect={() => { setSelectedTrack(t); setShowMusic(false); audioRef.current?.pause(); setPlayingId(null); }} onPlayPause={() => handlePlayPause(t)} />)}
            {!musicLoading && musicResults.length === 0 && <div style={{ padding: "32px", textAlign: "center", color: "#64748B" }}>Aucun titre trouvé</div>}
            {selectedTrack && <div onClick={() => { setSelectedTrack(null); setShowMusic(false); }} style={{ padding: "16px 20px", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#EF4444" }}>✕ Supprimer la musique</div>}
          </div>
        </SubPage>
      )}

      {/* ══ SOUS-PAGE : IDENTIFIER DES PERSONNES ══ */}
      {showTag && (
        <SubPage title="Identifier des personnes" onClose={() => setShowTag(false)} rightAction={taggedUsers.length > 0 ? { label: `Terminé (${taggedUsers.length})`, action: () => setShowTag(false) } : undefined}>
          <div style={{ padding: "10px 16px 4px" }}>
            <div style={{ position: "relative" }}>
              <input autoFocus value={tagQuery} onChange={e => setTagQuery(e.target.value)} placeholder="Rechercher des amis"
                style={{ width: "100%", padding: "11px 36px 11px 40px", border: "none", borderRadius: 24, fontSize: 14, outline: "none", background: "#F8FAFC", boxSizing: "border-box" }} />
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#64748B" }}>🔍</span>
            </div>
          </div>
          {taggedUsers.length > 0 && (
            <div style={{ display: "flex", gap: 8, padding: "10px 16px", overflowX: "auto", scrollbarWidth: "none" }}>
              {taggedUsers.map(id => {
                const u = tagUsers.find(u => u.id === id);
                if (!u) return null;
                return (
                  <div key={id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ position: "relative" }}>
                      <div style={{ width: 46, height: 46, borderRadius: "50%", background: u.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16 }}>{u.initials}</div>
                      <button onClick={() => setTaggedUsers(p => p.filter(i => i !== id))} style={{ position: "absolute", top: -2, right: -2, width: 18, height: 18, borderRadius: "50%", background: "#EF4444", border: "2px solid #fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9, fontWeight: 700 }}>✕</button>
                    </div>
                    <span style={{ fontSize: 10, color: "#64748B", maxWidth: 46, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name.split(" ")[0]}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ padding: "8px 20px 4px", fontSize: 13, fontWeight: 700, color: "#64748B" }}>Suggestions</div>
          {filteredUsers.map(u => {
            const checked = taggedUsers.includes(u.id);
            return (
              <div key={u.id} onClick={() => setTaggedUsers(prev => checked ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 20px", borderBottom: "1px solid #F8FAFC", cursor: "pointer", background: checked ? "#F0FDF4" : "#fff" }}>
                <div style={{ width: 46, height: 46, borderRadius: "50%", background: u.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>{u.initials}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>{u.country}</div>
                </div>
                <div style={{ width: 22, height: 22, border: checked ? "none" : "2px solid #E5E7EB", borderRadius: 5, background: checked ? G : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {checked && <Check size={13} color="#fff" />}
                </div>
              </div>
            );
          })}
          <div style={{ padding: "12px 16px" }}>
            <button onClick={() => setShowTag(false)} style={{ width: "100%", padding: 14, borderRadius: 14, border: "none", background: G, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
              {taggedUsers.length > 0 ? `${taggedUsers.length} personne${taggedUsers.length > 1 ? "s" : ""} identifiée${taggedUsers.length > 1 ? "s" : ""}` : "Terminé"}
            </button>
          </div>
        </SubPage>
      )}

      {/* ══ SOUS-PAGE : RECEVOIR DES MESSAGES ══ */}
      {showMessagesSettings && (
        <SubPage title="Recevoir des messages" onClose={() => setShowMessagesSettings(false)}>
          <div style={{ padding: "12px 0 20px" }}>
            {[
              { label: "Autoriser les messages", sub: "Tout le monde peut vous envoyer des messages", key: "allow" },
              { label: "Désactiver les messages", sub: "Personne ne peut vous envoyer de messages", key: "disable" },
              { label: "Uniquement les abonnés", sub: "Seuls vos abonnés peuvent vous envoyer des messages", key: "subscribers" },
              { label: "Uniquement les amis", sub: "Seuls vos amis peuvent vous envoyer des messages", key: "friends" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", borderBottom: "1px solid #F8FAFC" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{item.label}</div>
                  <div style={{ fontSize: 12.5, color: "#9CA3AF", marginTop: 2 }}>{item.sub}</div>
                </div>
                <Toggle value={item.key === "allow" ? allowMessages : !allowMessages && item.key === "disable"} onChange={v => { if (item.key === "allow") setAllowMessages(v); if (item.key === "disable") setAllowMessages(!v); }} />
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", borderBottom: "1px solid #F8FAFC", cursor: "pointer" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>Réponses automatiques</div>
                <div style={{ fontSize: 12.5, color: "#9CA3AF", marginTop: 2 }}>Configurez un message automatique</div>
              </div>
              <ChevronRight size={16} color="#D1D5DB" />
            </div>
          </div>
        </SubPage>
      )}

      {/* ══ SOUS-PAGE : CRÉER UN ÉVÈNEMENT ══ */}
      {showEvent && (
        <SubPage title="Créer un évènement" onClose={() => setShowEvent(false)}>
          {/* Cover */}
          <div onClick={() => coverInputRef.current?.click()} style={{ background: eventCoverPreview ? "transparent" : "#E5E7EB", minHeight: 160, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative", overflow: "hidden" }}>
            {eventCoverPreview ? (
              <img src={eventCoverPreview} alt="" style={{ width: "100%", height: 160, objectFit: "cover", opacity: eventCoverMedia ? 1 : .7 }} />
            ) : (
              <div style={{ textAlign: "center", color: "#9CA3AF" }}>
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#9CA3AF" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5" fill="#9CA3AF"/><path d="m21 15-5-5L5 21"/></svg>
                <div style={{ marginTop: 8, fontWeight: 600, fontSize: 14 }}>Ajouter une bannière</div>
              </div>
            )}
            <div style={{ position: "absolute", bottom: 10, right: 10, background: G, color: "#fff", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>📷 Modifier</div>
          </div>

          <div style={{ padding: "16px 16px 40px" }}>
            {[
              { label: "Nom de l'évènement", placeholder: "Ex: Soirée anniversaire", value: eventName, set: setEventName },
              { label: "Description", placeholder: "Décrivez votre évènement", value: eventDesc, set: setEventDesc },
            ].map((f, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 5 }}>{f.label}</label>
                <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                  style={{ width: "100%", padding: "13px 14px", border: "1.5px solid #E5E7EB", borderRadius: 14, fontSize: 15, outline: "none", background: "#F8FAFC", boxSizing: "border-box", fontFamily: "inherit" }}
                  onFocus={e => (e.currentTarget.style.borderColor = G)}
                  onBlur={e => (e.currentTarget.style.borderColor = "#E5E7EB")} />
              </div>
            ))}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              {[
                { label: "Date", value: eventDate, set: setEventDate, type: "date" },
                { label: "Heure", value: eventTime, set: setEventTime, type: "time" },
              ].map((f, i) => (
                <div key={i}>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 5 }}>{f.label}</label>
                  <input value={f.value} onChange={e => f.set(e.target.value)} type={f.type}
                    style={{ width: "100%", padding: "13px 12px", border: "1.5px solid #E5E7EB", borderRadius: 14, fontSize: 14, outline: "none", background: "#F8FAFC", boxSizing: "border-box", fontFamily: "inherit" }}
                    onFocus={e => (e.currentTarget.style.borderColor = G)}
                    onBlur={e => (e.currentTarget.style.borderColor = "#E5E7EB")} />
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12.5, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 5 }}>Lieu</label>
              <input value={eventLocation} onChange={e => setEventLocation(e.target.value)} placeholder="Ex: Cotonou, Bénin"
                style={{ width: "100%", padding: "13px 14px", border: "1.5px solid #E5E7EB", borderRadius: 14, fontSize: 15, outline: "none", background: "#F8FAFC", boxSizing: "border-box", fontFamily: "inherit" }}
                onFocus={e => (e.currentTarget.style.borderColor = G)}
                onBlur={e => (e.currentTarget.style.borderColor = "#E5E7EB")} />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderTop: "1px solid #F1F5F9", borderBottom: "1px solid #F1F5F9", marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>Évènement payant</div>
                <div style={{ fontSize: 12.5, color: "#9CA3AF" }}>Activer les paiements Mobile Money</div>
              </div>
              <Toggle value={eventPaid} onChange={setEventPaid} />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid #F1F5F9", marginBottom: 20 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>Participants</div>
                <div style={{ fontSize: 12.5, color: "#9CA3AF" }}>Limiter le nombre de places</div>
              </div>
              <ChevronRight size={16} color="#D1D5DB" />
            </div>

            <button onClick={() => setShowEvent(false)} style={{
              width: "100%", padding: 16, borderRadius: 16, border: "none",
              background: `linear-gradient(135deg,${G},${GD})`, color: "#fff",
              fontWeight: 700, fontSize: 16, cursor: "pointer",
              boxShadow: `0 6px 20px rgba(34,197,94,.3)`,
            }}>
              CRÉER L'ÉVÈNEMENT
            </button>
          </div>
        </SubPage>
      )}

      {/* ══ SOUS-PAGE : LANCER UN DIRECT ══ */}
      {showLive && (
        <SubPage title="Lancer un direct" onClose={() => setShowLive(false)}>
          {/* Thumbnail */}
          <div style={{ background: "#1a1a2e", minHeight: 180, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(239,68,68,.2)", border: "2px solid #EF4444", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 28 }}>📷</span>
            </div>
            <div style={{ color: "rgba(255,255,255,.6)", fontSize: 13 }}>Ajouter une miniature</div>
            <div style={{ position: "absolute", top: 12, right: 12, background: "#EF4444", borderRadius: 8, padding: "3px 10px" }}>
              <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>● LIVE</span>
            </div>
          </div>

          <div style={{ padding: "16px 16px 40px" }}>
            {[
              { label: "Titre du direct", placeholder: "Ex: Concert live de ce soir", value: liveTitle, set: setLiveTitle },
              { label: "Description", placeholder: "Décrivez votre live", value: liveDesc, set: setLiveDesc },
              { label: "Catégorie", placeholder: "Sélectionner une catégorie", value: liveCategory, set: setLiveCategory },
            ].map((f, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 5 }}>{f.label}</label>
                <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                  style={{ width: "100%", padding: "13px 14px", border: "1.5px solid #E5E7EB", borderRadius: 14, fontSize: 15, outline: "none", background: "#F8FAFC", boxSizing: "border-box", fontFamily: "inherit" }}
                  onFocus={e => (e.currentTarget.style.borderColor = G)}
                  onBlur={e => (e.currentTarget.style.borderColor = "#E5E7EB")} />
              </div>
            ))}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12.5, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 5 }}>Public cible</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["Public", "Amis", "Abonnés"].map(opt => (
                  <button key={opt} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: opt === "Public" ? `2px solid ${G}` : "2px solid #E5E7EB", background: opt === "Public" ? "#F0FDF4" : "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", color: opt === "Public" ? GD : "#64748B" }}>{opt}</button>
                ))}
              </div>
            </div>

            {[
              { label: "Activer les cadeaux", sub: "Les spectateurs peuvent envoyer des cadeaux", value: liveGifts, set: setLiveGifts },
              { label: "Activer les commentaires", sub: "Les spectateurs peuvent commenter", value: liveComments, set: setLiveComments },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid #F1F5F9" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{item.label}</div>
                  <div style={{ fontSize: 12.5, color: "#9CA3AF", marginTop: 2 }}>{item.sub}</div>
                </div>
                <Toggle value={item.value} onChange={item.set} />
              </div>
            ))}

            <button onClick={() => { setShowLive(false); navigate("/live"); }} style={{
              marginTop: 24, width: "100%", padding: 16, borderRadius: 16, border: "none",
              background: "linear-gradient(135deg,#EF4444,#DC2626)", color: "#fff",
              fontWeight: 700, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: "0 6px 20px rgba(239,68,68,.35)",
            }}>
              <span>●</span> COMMENCER LE DIRECT
            </button>
          </div>
        </SubPage>
      )}
    </div>
  );
}
