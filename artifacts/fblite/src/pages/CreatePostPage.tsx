import { useState, useRef, useEffect } from "react";
import { useNavigate } from "../router";
import { searchPlaces, type Place } from "../data/locations";
import { searchItunes, MUSIC_CATEGORIES, type Track } from "../data/music";
import { apiGetUsers, apiCreatePost, type PublicUser } from "../lib/api";
import { useR2Upload, phaseLabel, type UploadedMedia } from "../hooks/useR2Upload";
import {
  ArrowLeft, Send, Type, Smile, List, Palette, AtSign, Hash, BarChart2,
  ImagePlus, Music, Users, MapPin, SmilePlus, CalendarDays, Video,
  Globe, ChevronDown, ChevronRight, Eye, Check, PlaySquare,
} from "lucide-react";

interface Props {
  onPublish?: (content: string, bg?: string, mood?: string, location?: string) => void;
}

const BG_OPTIONS = [
  { id: "none",       value: "none",                                             preview: "#fff",      label: "Aucun"    },
  { id: "purple",     value: "linear-gradient(135deg,#9C27B0,#E91E63)",          preview: "#9C27B0",   label: "Violet"   },
  { id: "red",        value: "linear-gradient(135deg,#EF4444,#F97316)",          preview: "#EF4444",   label: "Rouge"    },
  { id: "orange",     value: "linear-gradient(135deg,#F97316,#EAB308)",          preview: "#F97316",   label: "Orange"   },
  { id: "black",      value: "linear-gradient(135deg,#0F172A,#374151)",          preview: "#0F172A",   label: "Noir"     },
  { id: "blue",       value: "linear-gradient(135deg,#3B82F6,#06B6D4)",          preview: "#3B82F6",   label: "Bleu"     },
  { id: "darkpurple", value: "linear-gradient(135deg,#7C3AED,#8B5CF6)",          preview: "#7C3AED",   label: "Violet foncé" },
  { id: "green",      value: "linear-gradient(135deg,#22C55E,#16A34A)",          preview: "#22C55E",   label: "Vert"     },
  { id: "rainbow",    value: "linear-gradient(135deg,#EF4444,#F97316,#EAB308,#22C55E,#3B82F6,#8B5CF6)", preview: "rainbow", label: "Arc-en-ciel" },
];

const MOODS = [
  "😊 heureux(se)", "😍 amoureux(se)", "😎 cool", "🎉 en fête",
  "💪 motivé(e)", "😴 fatigué(e)", "🙏 reconnaissant(e)", "😤 en colère",
  "🥹 ému(e)", "🤩 excité(e)", "😔 triste", "🤔 pensif(ve)",
  "🥳 festif(ve)", "😌 apaisé(e)", "🔥 en forme", "❤️ amoureux(se)",
  "🤗 câlin(e)", "😤 frustré(e)", "🥰 comblé(e)", "🤯 choqué(e)",
];

const ACTIVITIES = [
  "✈️ en voyage", "🍽️ en train de manger", "📚 en train de lire",
  "🎬 en train de regarder un film", "🏋️ en train de s'entraîner",
  "🎮 en train de jouer", "🎶 en train d'écouter de la musique",
  "☕ en train de prendre un café", "🛒 en train de faire du shopping",
  "🏖️ à la plage", "🎤 en train de chanter", "💼 au travail",
  "🎓 en train d'étudier", "🤝 en réunion", "🌿 dans la nature",
];

const COUNTRY_FLAGS: Record<string, string> = {
  CI:"🇨🇮", BJ:"🇧🇯", ML:"🇲🇱", SN:"🇸🇳", TG:"🇹🇬", GN:"🇬🇳", NE:"🇳🇪",
  BF:"🇧🇫", CM:"🇨🇲", NG:"🇳🇬", GH:"🇬🇭", MA:"🇲🇦", FR:"🇫🇷", US:"🇺🇸",
};

function BottomSheet({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", width: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 -8px 40px rgba(0,0,0,0.18)" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "#E5E7EB" }} />
        </div>
        <div style={{ padding: "14px 20px 8px", fontWeight: 800, fontSize: 17 }}>{title}</div>
        <div style={{ overflowY: "auto", flex: 1, padding: "0 16px" }}>{children}</div>
      </div>
    </div>
  );
}

function MusicRow({ track, selected, playing, onSelect, onPlayPause }: {
  track: Track; selected: boolean; playing: boolean;
  onSelect: () => void; onPlayPause: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", borderBottom: "1px solid #F1F5F9", background: selected ? "#F0FDF4" : "#fff", cursor: "pointer" }} onClick={onSelect}>
      <img src={track.artworkUrl} alt="" style={{ width: 46, height: 46, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: selected ? "#22C55E" : "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.title}</div>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{track.artist} · {track.duration}s</div>
      </div>
      {track.previewUrl && (
        <button onClick={e => { e.stopPropagation(); onPlayPause(); }}
          style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: playing ? "#22C55E" : "#F0FDF4", color: playing ? "#fff" : "#22C55E", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {playing ? "⏸" : "▶"}
        </button>
      )}
      {selected && <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#22C55E", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={12} color="#fff" /></div>}
    </div>
  );
}

export default function CreatePostPage({ onPublish }: Props) {
  const navigate = useNavigate();
  const rawUser = localStorage.getItem("fb_user");
  const user = rawUser ? JSON.parse(rawUser) : { name: "Pat Pat", flag: "🇧🇯" };
  const userInitials = user.name ? user.name.slice(0, 2).toUpperCase() : "PA";
  const firstName = user.name?.split(" ")[0] ?? "Moi";

  const [content, setContent]     = useState("");
  const [selectedBg, setSelectedBg] = useState("none");
  const [audience, setAudience]   = useState<"public" | "friends" | "private">("public");
  const [showAudience, setShowAudience] = useState(false);
  const [mounted, setMounted]     = useState(false);

  const [showMood, setShowMood]     = useState(false);
  const [moodTab, setMoodTab]       = useState<"mood" | "activity">("mood");
  const [selectedMood, setSelectedMood] = useState<string | null>(null);

  const [showLocation, setShowLocation] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState<Place[]>(searchPlaces(""));
  const [selectedLocation, setSelectedLocation] = useState<Place | null>(null);

  const [showMusic, setShowMusic]   = useState(false);
  const [musicQuery, setMusicQuery] = useState("");
  const [musicCat, setMusicCat]     = useState("all");
  const [musicResults, setMusicResults] = useState<Track[]>([]);
  const [musicLoading, setMusicLoading] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [playingId, setPlayingId]   = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [showTag, setShowTag]       = useState(false);
  const [tagQuery, setTagQuery]     = useState("");
  const [taggedUsers, setTaggedUsers] = useState<number[]>([]);

  const [showEvent, setShowEvent]   = useState(false);
  const [eventName, setEventName]   = useState("");
  const [eventDate, setEventDate]   = useState(new Date().toISOString().slice(0, 10));
  const [eventTime, setEventTime]   = useState("18:00");
  const [showEndTime, setShowEndTime] = useState(false);
  const [eventEndTime, setEventEndTime] = useState("20:00");
  const [eventOnline, setEventOnline] = useState(false);
  const [eventLocation, setEventLocation] = useState("");
  const [eventDesc, setEventDesc]   = useState("");

  const [medias, setMedias]             = useState<UploadedMedia[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [mediaIsVideo, setMediaIsVideo]   = useState<boolean[]>([]);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [eventCoverMedia, setEventCoverMedia] = useState<UploadedMedia | null>(null);
  const [eventCoverPreview, setEventCoverPreview] = useState<string | null>(null);
  const { upload, status: uploadStatus, phase: uploadPhase, progress, error: uploadError, reset: resetUpload } = useR2Upload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);

  const [allUsers, setAllUsers] = useState<PublicUser[]>([]);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setLocationResults(searchPlaces(locationQuery)); }, [locationQuery]);
  useEffect(() => {
    apiGetUsers().then(users => setAllUsers(users)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!showMusic) return;
    const term = musicQuery.trim()
      ? musicQuery.trim()
      : (MUSIC_CATEGORIES.find(c => c.id === musicCat)?.term ?? "afrobeats");
    setMusicLoading(true);
    const delay = musicQuery.trim() ? 400 : 0;
    const timer = setTimeout(() => {
      searchItunes(term, 100)
        .then(tracks => { setMusicResults(tracks); setMusicLoading(false); })
        .catch(() => setMusicLoading(false));
    }, delay);
    return () => clearTimeout(timer);
  }, [musicQuery, musicCat, showMusic]);

  useEffect(() => {
    if (!showMusic) { audioRef.current?.pause(); setPlayingId(null); }
  }, [showMusic]);

  useEffect(() => { return () => { audioRef.current?.pause(); }; }, []);

  const activeBg  = BG_OPTIONS.find(b => b.id === selectedBg);
  const hasBg     = selectedBg !== "none";
  const canPublish = (content.trim().length > 0 || medias.length > 0 || selectedTrack !== null) && uploadStatus !== "uploading";

  const tagUsers = allUsers.map(u => ({
    id: u.id,
    name: `${u.firstName} ${u.lastName}`,
    initials: (`${u.firstName[0] ?? ""}${u.lastName[0] ?? ""}`).toUpperCase(),
    color: ["#22C55E","#EC4899","#8B5CF6","#D97706","#388E3C","#00838F"][u.id % 6],
    city: u.country ?? "",
    country: u.country ?? "",
  }));
  const taggedNames = taggedUsers.map(id => tagUsers.find(u => u.id === id)?.name).filter(Boolean);
  const moodEmoji   = selectedMood ? selectedMood.split(" ")[0] : null;
  const moodWord    = selectedMood ? selectedMood.slice(selectedMood.indexOf(" ") + 1) : null;
  const userFlag = user.country ? (COUNTRY_FLAGS[user.country] ?? user.flag ?? "") : (user.flag ?? "🇧🇯");

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
        selectedTrack ? {
          trackName:  selectedTrack.title,
          artist:     selectedTrack.artist,
          url:        selectedTrack.previewUrl,
          artworkUrl: selectedTrack.artworkUrl,
          duration:   selectedTrack.duration,
        } : undefined,
      );
    } catch (err) {
      alert((err as Error).message ?? "Erreur lors de la publication.");
      return;
    }
    onPublish?.(finalContent, hasBg ? activeBg?.value : undefined, selectedMood ?? undefined, selectedLocation ? `${selectedLocation.city}` : undefined);
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
      if (result) {
        setMedias(m => [...m, result]);
      } else {
        setMediaPreviews(p => p.filter(u => u !== previewUrl));
        setMediaIsVideo(v => v.filter((_, j) => j !== mediaPreviews.length + i));
      }
    }
  };

  const handleCoverSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (e.target) e.target.value = "";
    const previewUrl = URL.createObjectURL(file);
    setEventCoverPreview(previewUrl);
    const result = await upload(file);
    if (result) setEventCoverMedia(result);
  };

  const AUDIENCE_MAP = {
    public:  { icon: <Globe size={13} color="#16A34A" />, label: "Public" },
    friends: { icon: <Users size={13} color="#16A34A" />, label: "Amis" },
    private: { icon: <span style={{ fontSize: 12 }}>🔒</span>, label: "Privé" },
  };

  const filteredUsers = tagUsers.filter(u => !tagQuery.trim() || u.name.toLowerCase().includes(tagQuery.toLowerCase()));
  const groupedMusic = musicQuery.trim()
    ? Object.entries(musicResults.reduce<Record<string, Track[]>>((acc, t) => { (acc[t.artist] ??= []).push(t); return acc; }, {}))
    : [];

  function handlePlayPause(track: Track) {
    if (!track.previewUrl) return;
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      audioRef.current?.pause();
      const audio = new Audio(track.previewUrl);
      audioRef.current = audio;
      audio.play().catch(() => {});
      audio.addEventListener("ended", () => setPlayingId(null));
      setPlayingId(track.id);
    }
  }

  const TOOLBAR_ITEMS = [
    { id: "texte",   icon: <Type size={22} strokeWidth={2} />,       label: "Texte",   color: "#22C55E", bg: "#DCFCE7" },
    { id: "emoji",   icon: <Smile size={22} strokeWidth={2} />,      label: "Emoji",   color: "#F59E0B", bg: "#FEF3C7" },
    { id: "gif",     icon: <PlaySquare size={22} strokeWidth={2} />, label: "GIF",     color: "#7C3AED", bg: "#EDE9FE" },
    { id: "liste",   icon: <List size={22} strokeWidth={2} />,       label: "Liste",   color: "#0EA5E9", bg: "#DBEAFE" },
    { id: "couleur", icon: <Palette size={22} strokeWidth={2} />,    label: "Couleur", color: "#EC4899", bg: "#FCE7F3" },
    { id: "mention", icon: <AtSign size={22} strokeWidth={2} />,     label: "Mention", color: "#8B5CF6", bg: "#EDE9FE" },
    { id: "hashtag", icon: <Hash size={22} strokeWidth={2} />,       label: "Hashtag", color: "#06B6D4", bg: "#CFFAFE" },
    { id: "sondage", icon: <BarChart2 size={22} strokeWidth={2} />,  label: "Sondage", color: "#EF4444", bg: "#FEE2E2" },
  ];

  const OPTIONS = [
    {
      icon: <ImagePlus size={24} strokeWidth={2} color="#22C55E" />,
      iconBg: "#DCFCE7", iconShadow: "0 4px 12px rgba(34,197,94,.14)",
      label: medias.length > 0 ? "Ajouter ou supprimer des photos" : "Photos/Vidéos",
      sub: medias.length > 0 ? `${medias.length} fichier${medias.length > 1 ? "s" : ""} uploadé${medias.length > 1 ? "s" : ""}` : "Ajoutez des photos ou vidéos",
      action: () => fileInputRef.current?.click(),
    },
    {
      icon: <Music size={24} strokeWidth={2} color="#EC4899" />,
      iconBg: "#FCE7F3", iconShadow: "0 4px 12px rgba(236,72,153,.14)",
      label: "Musique",
      sub: selectedTrack ? `${selectedTrack.title} · ${selectedTrack.artist}` : "Ajoutez une musique à votre publication",
      action: () => setShowMusic(true),
    },
    {
      icon: <Users size={24} strokeWidth={2} color="#3B82F6" />,
      iconBg: "#DBEAFE", iconShadow: "0 4px 12px rgba(59,130,246,.14)",
      label: "Identifier des personnes",
      sub: taggedNames.length > 0 ? taggedNames.join(", ") : "Mentionnez des amis",
      action: () => setShowTag(true),
    },
    {
      icon: <MapPin size={24} strokeWidth={2} color="#F97316" />,
      iconBg: "#FFEDD5", iconShadow: "0 4px 12px rgba(249,115,22,.14)",
      label: "Ajouter un lieu",
      sub: selectedLocation ? `${selectedLocation.city}, ${selectedLocation.country}` : "Indiquez où vous êtes",
      action: () => setShowLocation(true),
    },
    {
      icon: <SmilePlus size={24} strokeWidth={2} color="#EAB308" />,
      iconBg: "#FEF9C3", iconShadow: "0 4px 12px rgba(234,179,8,.14)",
      label: "Humeur/Activité",
      sub: selectedMood ?? "Exprimez votre humeur",
      action: () => setShowMood(true),
    },
    {
      icon: <CalendarDays size={24} strokeWidth={2} color="#8B5CF6" />,
      iconBg: "#EDE9FE", iconShadow: "0 4px 12px rgba(139,92,246,.14)",
      label: "Créer un évènement",
      sub: "Organisez un évènement",
      action: () => setShowEvent(true),
    },
    {
      icon: (
        <div style={{ position: "relative" }}>
          <Video size={24} strokeWidth={2} color="#EF4444" />
          <div style={{ position: "absolute", top: -6, right: -8, background: "#EF4444", borderRadius: 4, padding: "1px 4px" }}>
            <span style={{ fontSize: 8, fontWeight: 900, color: "#fff", letterSpacing: 0.5 }}>LIVE</span>
          </div>
        </div>
      ),
      iconBg: "#FEE2E2", iconShadow: "0 4px 12px rgba(239,68,68,.14)",
      label: "Lancer un direct",
      sub: "Diffusez en direct",
      action: () => navigate("/live"),
    },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#F8FAFC", zIndex: 50,
      display: "flex", flexDirection: "column", overflowY: "auto",
      fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      opacity: mounted ? 1 : 0,
      transform: mounted ? "translateY(0)" : "translateY(20px)",
      transition: "opacity 300ms cubic-bezier(0.22,1,0.36,1), transform 300ms cubic-bezier(0.22,1,0.36,1)",
    }}>
      <style>{`
        @keyframes bp-in { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .bp-card { transition: transform 200ms cubic-bezier(0.22,1,0.36,1), box-shadow 200ms ease; }
        .bp-card:hover { transform: scale(1.02); }
        .bp-card:active { transform: scale(0.97) !important; }
        .bp-btn { transition: filter 200ms ease; }
        .bp-btn:hover { filter: brightness(1.05); }
        .bp-btn:active { filter: brightness(0.95); }
        .bp-tool { transition: transform 150ms cubic-bezier(0.22,1,0.36,1); cursor: pointer; }
        .bp-tool:active { transform: scale(0.92) !important; }
        .bp-col { transition: transform 150ms ease, box-shadow 150ms ease; cursor: pointer; }
        .bp-col:active { transform: scale(0.88) !important; }
        textarea::placeholder { color: #94A3B8; }
        ::-webkit-scrollbar { display: none; }
      `}</style>
      <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple style={{ display: "none" }} onChange={handleFileSelect} />
      <input ref={coverInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleCoverSelect} />

      {/* ══ HEADER ══ */}
      <div style={{
        display: "flex", alignItems: "center", padding: "14px 16px 16px",
        background: "linear-gradient(135deg,#22C55E 0%,#16A34A 100%)",
        position: "sticky", top: 0, zIndex: 10,
        boxShadow: "0 4px 20px rgba(34,197,94,.30)", flexShrink: 0, gap: 12,
      }}>
        <button onClick={() => navigate("/")} className="bp-btn" style={{
          width: 40, height: 40, borderRadius: "50%", border: "none",
          background: "rgba(255,255,255,0.20)", backdropFilter: "blur(8px)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, color: "#fff",
        }}>
          <ArrowLeft size={20} strokeWidth={2.5} />
        </button>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 18, color: "#fff", letterSpacing: "-0.1px" }}>
          Créer une publication
        </div>
        <button onClick={handlePublish} disabled={!canPublish} className="bp-btn" style={{
          background: "#fff", color: "#16A34A", border: "none", borderRadius: 999,
          padding: "10px 18px", fontWeight: 700, fontSize: 14,
          cursor: canPublish ? "pointer" : "not-allowed",
          boxShadow: "0 8px 24px rgba(0,0,0,.08)",
          display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
          opacity: canPublish ? 1 : 0.5,
        }}>
          <Send size={15} strokeWidth={2.5} color="#16A34A" />
          PUBLIER
        </button>
      </div>

      {/* ══ COMPOSER CARD ══ */}
      <div style={{
        margin: "16px 14px 0", background: "#fff", borderRadius: 32,
        padding: "20px 20px 0",
        boxShadow: "0 12px 40px rgba(15,23,42,.06)",
        animation: "bp-in 300ms cubic-bezier(0.22,1,0.36,1) both",
        flexShrink: 0, overflow: "visible",
      }}>
        {/* Author row */}
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            background: "linear-gradient(135deg,#22C55E,#16A34A)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 800, fontSize: 18, flexShrink: 0,
            boxShadow: "0 4px 14px rgba(34,197,94,.32)", position: "relative",
          }}>
            {userInitials}
            <div style={{
              position: "absolute", bottom: 0, right: 0, width: 18, height: 18,
              background: "#fff", borderRadius: "50%", border: "2px solid #fff",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ width: 10, height: 10, background: "#22C55E", borderRadius: "50%" }} />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15.5, color: "#0F172A", lineHeight: 1.3, marginBottom: 8 }}>
              {user.name} {userFlag}
              {moodEmoji && <span style={{ fontWeight: 400, color: "#64748B" }}> est {moodEmoji} <em>{moodWord}</em></span>}
              {taggedNames.length > 0 && (
                <span style={{ fontWeight: 400, color: "#64748B" }}>
                  {moodEmoji ? ", " : " est "}avec{" "}
                  {taggedNames.map((n, i) => (
                    <span key={i}><strong style={{ color: "#22C55E" }}>{n}</strong>{i < taggedNames.length - 2 ? ", " : i < taggedNames.length - 1 ? " et " : ""}</span>
                  ))}
                </span>
              )}
            </div>
            {selectedTrack && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8, background: "#EDE9FE", borderRadius: 8, padding: "4px 10px", width: "fit-content" }}>
                <Music size={12} color="#7C3AED" />
                <span style={{ fontSize: 12, fontWeight: 600, color: "#7C3AED" }}>{selectedTrack.title} · {selectedTrack.artist}</span>
                <button onClick={() => setSelectedTrack(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#9CA3AF", padding: "0 2px" }}>✕</button>
              </div>
            )}
            {/* Audience selector */}
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowAudience(v => !v)} style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "#F0FDF4", border: "1.5px solid #BBF7D0",
                borderRadius: 20, padding: "5px 12px", cursor: "pointer",
              }}>
                {AUDIENCE_MAP[audience].icon}
                <span style={{ fontSize: 13, fontWeight: 700, color: "#16A34A" }}>{AUDIENCE_MAP[audience].label}</span>
                <ChevronDown size={12} color="#16A34A" />
              </button>
              {showAudience && (
                <div style={{ position: "absolute", top: 38, left: 0, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, boxShadow: "0 8px 24px rgba(0,0,0,.12)", zIndex: 20, minWidth: 160, overflow: "hidden" }}>
                  {(["public","friends","private"] as const).map(a => (
                    <div key={a} onClick={() => { setAudience(a); setShowAudience(false); }} style={{ padding: "12px 16px", cursor: "pointer", display: "flex", gap: 10, alignItems: "center", fontWeight: a === audience ? 700 : 500, background: a === audience ? "#F0FDF4" : "#fff", color: a === audience ? "#16A34A" : "#64748B" }}>
                      {AUDIENCE_MAP[a].icon}
                      <span style={{ fontSize: 14 }}>{AUDIENCE_MAP[a].label}</span>
                      {a === audience && <Check size={14} color="#22C55E" style={{ marginLeft: "auto" }} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Textarea */}
        <div style={{
          background: hasBg ? activeBg?.value : "transparent",
          borderRadius: hasBg ? 16 : 0, padding: hasBg ? "24px 16px 20px" : "0 2px",
          minHeight: hasBg ? 90 : 70, display: "flex", flexDirection: "column",
          alignItems: hasBg ? "center" : "stretch", justifyContent: hasBg ? "center" : "flex-start",
          transition: "background 0.3s", marginBottom: 0,
        }}>
          <textarea
            ref={textareaRef} value={content}
            onChange={e => { setContent(e.target.value); if (textareaRef.current) { textareaRef.current.style.height = "auto"; textareaRef.current.style.height = textareaRef.current.scrollHeight + "px"; } }}
            placeholder="Partagez un moment fort de votre journée..."
            autoFocus
            style={{
              width: "100%", border: "none", outline: "none", resize: "none",
              fontSize: hasBg ? 20 : 20, fontWeight: 500,
              color: hasBg ? "#fff" : "#0F172A",
              background: "transparent", textAlign: hasBg ? "center" : "left",
              minHeight: 70, lineHeight: 1.6,
              caretColor: "#22C55E", fontFamily: "inherit", boxSizing: "border-box",
            }}
          />
          {selectedLocation && (
            <div style={{ fontSize: 12, color: hasBg ? "rgba(255,255,255,.85)" : "#64748B", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <MapPin size={12} /> <span>{selectedLocation.city}, {selectedLocation.country}</span>
            </div>
          )}
        </div>

        {/* ── TOOLBAR 8 boutons ── */}
        <div style={{ borderTop: "1px solid #F1F5F9", marginTop: 8, padding: "14px 0 16px" }}>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 2 }}>
            {TOOLBAR_ITEMS.map(item => (
              <div key={item.id} className="bp-tool" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: item.bg, border: `1px solid ${item.color}22`,
                  boxShadow: "0 4px 12px rgba(0,0,0,.04)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: item.color,
                }}>
                  {item.icon}
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, color: "#64748B", whiteSpace: "nowrap" }}>{item.label}</span>
              </div>
            ))}
          </div>

          {/* ── PALETTE DE COULEURS ── */}
          <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center", overflowX: "auto", paddingBottom: 2 }}>
            {BG_OPTIONS.map(bg => {
              const isActive = selectedBg === bg.id;
              if (bg.id === "none") return null;
              const isRainbow = bg.id === "rainbow";
              return (
                <div key={bg.id} className="bp-col" onClick={() => setSelectedBg(bg.id === selectedBg ? "none" : bg.id)}
                  style={{
                    width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
                    background: isRainbow ? "linear-gradient(135deg,#EF4444,#F97316,#EAB308,#22C55E,#3B82F6,#8B5CF6)" : bg.preview,
                    border: isActive ? "3px solid #fff" : "2px solid rgba(0,0,0,.08)",
                    boxShadow: isActive ? `0 0 0 3px #22C55E, 0 6px 20px rgba(34,197,94,.35)` : "0 2px 8px rgba(0,0,0,.12)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "box-shadow 200ms ease, border 200ms ease",
                    position: "relative",
                  }}>
                  {isActive && (
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Check size={13} color="#22C55E" strokeWidth={3} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Upload progress */}
      {uploadStatus === "uploading" && (
        <div style={{ padding: "8px 14px", flexShrink: 0 }}>
          <div style={{ height: 3, background: "#E5E7EB", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: uploadPhase === "uploading" ? `${progress}%` : "100%", background: "linear-gradient(90deg,#22C55E,#16A34A)", borderRadius: 4, transition: "width 0.2s" }} />
          </div>
          <div style={{ fontSize: 11, color: "#64748B", marginTop: 3 }}>{phaseLabel(uploadPhase, progress)}</div>
        </div>
      )}
      {uploadError && (
        <div style={{ padding: "6px 14px", fontSize: 12, color: "#EF4444", flexShrink: 0 }}>
          ⚠️ {uploadError} — <span onClick={resetUpload} style={{ cursor: "pointer", textDecoration: "underline" }}>Réessayer</span>
        </div>
      )}

      {/* Media previews */}
      {mediaPreviews.length > 0 && (
        <div style={{ padding: "10px 14px", display: "flex", gap: 8, overflowX: "auto", flexShrink: 0 }}>
          {mediaPreviews.map((src, i) => {
            const uploaded = medias[i];
            const isUploading = uploadingIdx === i;
            const isVideo = uploaded?.kind === "video" || mediaIsVideo[i] === true;
            return (
              <div key={i} style={{ position: "relative", flexShrink: 0 }}>
                {isVideo ? (
                  <video src={src} style={{ width: 88, height: 88, objectFit: "cover", borderRadius: 14 }} muted playsInline />
                ) : (
                  <img src={src} alt="" style={{ width: 88, height: 88, objectFit: "cover", borderRadius: 14, opacity: isUploading ? 0.5 : 1 }} />
                )}
                {isUploading && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.3)", borderRadius: 14 }}>
                    <span style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>{progress}%</span>
                  </div>
                )}
                {uploaded && (
                  <div style={{ position: "absolute", bottom: 4, left: 4, background: "#22C55E", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Check size={10} color="#fff" />
                  </div>
                )}
                <button onClick={() => {
                  setMediaPreviews(p => p.filter((_, j) => j !== i));
                  setMediaIsVideo(v => v.filter((_, j) => j !== i));
                  setMedias(m => m.filter((_, j) => j !== i));
                }} style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,.55)", border: "none", borderRadius: "50%", width: 22, height: 22, color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              </div>
            );
          })}
          <button onClick={() => fileInputRef.current?.click()} style={{ width: 88, height: 88, border: "2px dashed #BBF7D0", borderRadius: 14, background: "#F0FDF4", cursor: "pointer", fontSize: 24, color: "#22C55E", flexShrink: 0 }}>+</button>
        </div>
      )}

      {/* ══ OPTIONS ══ */}
      <div style={{ margin: "14px 14px 0", display: "flex", flexDirection: "column", gap: 8 }}>
        {OPTIONS.map((opt, i) => (
          <div key={i} className="bp-card" onClick={opt.action}
            style={{
              display: "flex", gap: 16, padding: "0 16px",
              alignItems: "center", cursor: "pointer",
              background: "#fff", borderRadius: 28, height: 92,
              boxShadow: "0 8px 24px rgba(0,0,0,.05)",
              animation: `bp-in ${300 + i * 40}ms cubic-bezier(0.22,1,0.36,1) both`,
            }}>
            <div style={{
              width: 56, height: 56, borderRadius: 18, flexShrink: 0,
              background: opt.iconBg,
              boxShadow: opt.iconShadow,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {opt.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#0F172A", marginBottom: 3 }}>{opt.label}</div>
              <div style={{ fontSize: 13, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opt.sub}</div>
            </div>
            <ChevronRight size={18} color="#E2E8F0" strokeWidth={2.5} style={{ flexShrink: 0 }} />
          </div>
        ))}
      </div>

      {/* ══ CARTE APERÇU ══ */}
      <div style={{
        margin: "14px 14px 32px",
        background: "#F0FDF4", border: "1.5px solid #BBF7D0",
        borderRadius: 24, padding: "18px 20px",
        display: "flex", alignItems: "center", gap: 16,
        animation: `bp-in 620ms cubic-bezier(0.22,1,0.36,1) both`,
        flexShrink: 0,
      }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: "#DCFCE7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Eye size={22} strokeWidth={2} color="#22C55E" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#166534", marginBottom: 3 }}>Aperçu de votre publication</div>
          <div style={{ fontSize: 12.5, color: "#15803D", lineHeight: 1.4 }}>Voyez exactement ce que vos abonnés verront.</div>
        </div>
        {/* Illustration */}
        <div style={{ width: 64, height: 48, borderRadius: 12, background: "linear-gradient(135deg,#BBF7D0,#86EFAC)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", bottom: 6, left: 8, right: 8, height: 6, background: "rgba(255,255,255,.6)", borderRadius: 3 }} />
          <div style={{ position: "absolute", bottom: 14, left: 8, right: 16, height: 4, background: "rgba(255,255,255,.4)", borderRadius: 2 }} />
          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,.7)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#16A34A" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
          </div>
        </div>
      </div>

      {/* ══ MOOD OVERLAY ══ */}
      {showMood && (
        <BottomSheet onClose={() => setShowMood(false)} title="Humeur / Activité">
          <div style={{ display: "flex", borderBottom: "2px solid #F1F5F9", marginBottom: 12 }}>
            {(["mood","activity"] as const).map(tab => (
              <button key={tab} onClick={() => setMoodTab(tab)} style={{ flex: 1, padding: "10px 0", border: "none", background: "none", fontWeight: 700, fontSize: 14, cursor: "pointer", color: moodTab === tab ? "#22C55E" : "#64748B", borderBottom: moodTab === tab ? "2px solid #22C55E" : "2px solid transparent", marginBottom: -2 }}>
                {tab === "mood" ? "😊 Humeur" : "🎯 Activité"}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, paddingBottom: 32 }}>
            {(moodTab === "mood" ? MOODS : ACTIVITIES).map(item => (
              <div key={item} onClick={() => { setSelectedMood(item); setShowMood(false); }} style={{ padding: "11px 14px", background: selectedMood === item ? "#DCFCE7" : "#F8FAFC", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600, border: selectedMood === item ? "2px solid #22C55E" : "2px solid transparent" }}>{item}</div>
            ))}
            {selectedMood && <div onClick={() => { setSelectedMood(null); setShowMood(false); }} style={{ padding: "11px 14px", background: "#FEE2E2", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#EF4444" }}>✕ Supprimer</div>}
          </div>
        </BottomSheet>
      )}

      {/* ══ LOCATION OVERLAY ══ */}
      {showLocation && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "flex-end" }} onClick={() => setShowLocation(false)}>
          <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", width: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 -8px 40px rgba(0,0,0,.18)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: "#E5E7EB" }} />
            </div>
            <div style={{ padding: "16px 20px 8px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#FFEDD5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <MapPin size={20} color="#F97316" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 17 }}>Où êtes-vous ?</div>
                  <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 1 }}>Ajoutez votre position pour aider vos amis à vous retrouver.</div>
                </div>
              </div>
            </div>
            <div style={{ padding: "0 16px 10px", flexShrink: 0 }}>
              <div style={{ position: "relative" }}>
                <input autoFocus value={locationQuery} onChange={e => setLocationQuery(e.target.value)}
                  placeholder="Rechercher une ville ou un pays..."
                  style={{ width: "100%", padding: "12px 40px 12px 42px", border: "1.5px solid #E5E7EB", borderRadius: 24, fontSize: 15, outline: "none", background: "#F8FAFC", boxSizing: "border-box" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#22C55E")}
                  onBlur={e => (e.currentTarget.style.borderColor = "#E5E7EB")}
                />
                {locationQuery && (
                  <button onClick={() => setLocationQuery("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 22, height: 22, borderRadius: "50%", background: "#9CA3AF", border: "none", color: "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                )}
              </div>
            </div>
            <div style={{ padding: "0 16px 4px", flexShrink: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Suggestions</div>
            </div>
            <div style={{ overflowY: "auto", flex: 1, paddingBottom: 20 }}>
              {locationResults.map((place, i) => {
                const sel = selectedLocation?.city === place.city && selectedLocation?.country === place.country;
                return (
                  <div key={i} onClick={() => { setSelectedLocation(place); setShowLocation(false); setLocationQuery(""); }}
                    style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 20px", cursor: "pointer", background: sel ? "#F0FDF4" : "#fff", borderBottom: "1px solid #F1F5F9" }}>
                    <span style={{ fontSize: 24, flexShrink: 0 }}>{place.flag}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: sel ? 700 : 600, fontSize: 15, color: sel ? "#22C55E" : "#111827" }}>{place.city}</div>
                      <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 1 }}>{place.country}</div>
                    </div>
                    <MapPin size={18} color={sel ? "#22C55E" : "#E5E7EB"} />
                  </div>
                );
              })}
              {locationResults.length === 0 && (
                <div style={{ padding: "32px", textAlign: "center", color: "#9CA3AF" }}>
                  <MapPin size={40} color="#E5E7EB" style={{ display: "block", margin: "0 auto 8px" }} />
                  Aucune ville trouvée
                </div>
              )}
              {selectedLocation && (
                <div onClick={() => { setSelectedLocation(null); setShowLocation(false); }}
                  style={{ padding: "14px 20px", cursor: "pointer", fontSize: 15, fontWeight: 600, color: "#EF4444", display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid #FEE2E2" }}>
                  ✕ Supprimer le lieu
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ MUSIC OVERLAY ══ */}
      {showMusic && (
        <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 100, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
            <button onClick={() => setShowMusic(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#0F172A", padding: "4px 10px 4px 0" }}><ArrowLeft size={22} /></button>
            <div style={{ flex: 1, fontWeight: 800, fontSize: 17 }}>Musique</div>
          </div>
          <div style={{ padding: "10px 16px 0", flexShrink: 0 }}>
            <div style={{ position: "relative" }}>
              <input value={musicQuery} onChange={e => setMusicQuery(e.target.value)} placeholder="Recherchez de la musique"
                style={{ width: "100%", padding: "10px 36px 10px 40px", border: "none", borderRadius: 24, fontSize: 15, outline: "none", background: "#F8FAFC", boxSizing: "border-box" }} />
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "#64748B" }}>🔍</span>
              {musicQuery && <button onClick={() => setMusicQuery("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#64748B" }}>✕</button>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, padding: "10px 16px", overflowX: "auto", scrollbarWidth: "none", flexShrink: 0 }}>
            {MUSIC_CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setMusicCat(cat.id)} style={{ flexShrink: 0, padding: "7px 16px", borderRadius: 20, border: "none", background: musicCat === cat.id ? "#22C55E" : "#F8FAFC", color: musicCat === cat.id ? "#fff" : "#0F172A", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{cat.label}</button>
            ))}
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {musicLoading && <div style={{ padding: "32px", textAlign: "center", color: "#64748B" }}>🎵 Chargement…</div>}
            {!musicLoading && !musicQuery.trim() && <div style={{ padding: "4px 20px 8px", fontSize: 14, fontWeight: 700 }}>{MUSIC_CATEGORIES.find(c => c.id === musicCat)?.label ?? "Pour vous"}</div>}
            {!musicLoading && musicQuery.trim() && groupedMusic.length > 0 ? (
              groupedMusic.map(([artist, tracks]) => (
                <div key={artist}>
                  <div style={{ padding: "8px 20px 4px", fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, background: "#F8FAFC" }}>{artist}</div>
                  {tracks.map(t => (<MusicRow key={t.id} track={t} selected={selectedTrack?.id === t.id} playing={playingId === t.id} onSelect={() => { setSelectedTrack(t); setShowMusic(false); audioRef.current?.pause(); setPlayingId(null); }} onPlayPause={() => handlePlayPause(t)} />))}
                </div>
              ))
            ) : !musicLoading ? (
              musicResults.map(t => (<MusicRow key={t.id} track={t} selected={selectedTrack?.id === t.id} playing={playingId === t.id} onSelect={() => { setSelectedTrack(t); setShowMusic(false); audioRef.current?.pause(); setPlayingId(null); }} onPlayPause={() => handlePlayPause(t)} />))
            ) : null}
            {!musicLoading && musicResults.length === 0 && <div style={{ padding: "32px", textAlign: "center", color: "#64748B" }}>Aucun titre trouvé</div>}
            {selectedTrack && <div onClick={() => { setSelectedTrack(null); setShowMusic(false); }} style={{ padding: "16px 20px", cursor: "pointer", fontSize: 15, fontWeight: 600, color: "#EF4444" }}>✕ Supprimer la musique</div>}
          </div>
        </div>
      )}

      {/* ══ TAG PEOPLE OVERLAY ══ */}
      {showTag && (
        <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 100, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
            <button onClick={() => setShowTag(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#0F172A", padding: "4px 10px 4px 0" }}><ArrowLeft size={22} /></button>
            <div style={{ flex: 1, fontWeight: 800, fontSize: 17, textAlign: "center" }}>Identifier des personnes</div>
            <div style={{ width: 44 }} />
          </div>
          <div style={{ padding: "10px 16px 4px", flexShrink: 0 }}>
            <div style={{ position: "relative" }}>
              <input autoFocus value={tagQuery} onChange={e => setTagQuery(e.target.value)} placeholder="Rechercher un(e) ami(e)"
                style={{ width: "100%", padding: "10px 36px 10px 14px", border: "none", borderRadius: 24, fontSize: 15, outline: "none", background: "#F8FAFC", boxSizing: "border-box" }} />
              <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "#64748B" }}>🔍</span>
            </div>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            <div style={{ padding: "8px 20px 4px", fontSize: 14, fontWeight: 700, color: "#64748B" }}>Suggestions</div>
            {filteredUsers.map(u => {
              const checked = taggedUsers.includes(u.id);
              return (
                <div key={u.id} onClick={() => setTaggedUsers(prev => checked ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 20px", borderBottom: "1px solid #F1F5F9", cursor: "pointer", background: checked ? "#DCFCE7" : "#fff" }}>
                  <div style={{ width: 46, height: 46, borderRadius: "50%", background: u.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>{u.initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{u.name}</div>
                    <div style={{ fontSize: 12, color: "#64748B" }}>{u.city}, {u.country}</div>
                  </div>
                  <div style={{ width: 22, height: 22, border: checked ? "none" : "2px solid #E5E7EB", borderRadius: 4, background: checked ? "#22C55E" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {checked && <Check size={14} color="#fff" />}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ padding: "12px 16px", borderTop: "1px solid #F1F5F9", flexShrink: 0 }}>
            <button onClick={() => setShowTag(false)} style={{ width: "100%", padding: 14, borderRadius: 10, border: "none", background: "#22C55E", color: "#fff", fontWeight: 900, fontSize: 16, cursor: "pointer" }}>
              {taggedUsers.length > 0 ? `Terminé (${taggedUsers.length})` : "Terminé"}
            </button>
          </div>
        </div>
      )}

      {/* ══ CREATE EVENT OVERLAY ══ */}
      {showEvent && (
        <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 100, display: "flex", flexDirection: "column", overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #F1F5F9", flexShrink: 0, position: "sticky", top: 0, background: "#fff", zIndex: 10 }}>
            <button onClick={() => setShowEvent(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#0F172A", padding: "4px 10px 4px 0" }}><ArrowLeft size={22} /></button>
            <div style={{ flex: 1, fontWeight: 800, fontSize: 17, textAlign: "center" }}>Créer un évènement</div>
            <div style={{ width: 44 }} />
          </div>
          <div onClick={() => coverInputRef.current?.click()} style={{ margin: "0", background: eventCoverPreview ? "transparent" : "#E5E7EB", minHeight: 160, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, position: "relative", overflow: "hidden" }}>
            {eventCoverPreview ? (
              <img src={eventCoverPreview} alt="" style={{ width: "100%", height: 160, objectFit: "cover", opacity: eventCoverMedia ? 1 : 0.6 }} />
            ) : (
              <div style={{ textAlign: "center", color: "#9CA3AF" }}>
                <ImagePlus size={32} color="#9CA3AF" />
                <div style={{ marginTop: 8, fontWeight: 600 }}>Ajouter une couverture</div>
              </div>
            )}
          </div>
          <div style={{ padding: "0 16px 24px" }}>
            {[
              { label: "Nom de l'évènement", value: eventName, set: setEventName, placeholder: "Ex: Soirée anniversaire" },
              { label: "Date", value: eventDate, set: setEventDate, type: "date", placeholder: "" },
              { label: "Heure de début", value: eventTime, set: setEventTime, type: "time", placeholder: "" },
              ...(showEndTime ? [{ label: "Heure de fin", value: eventEndTime, set: setEventEndTime, type: "time", placeholder: "" }] : []),
              { label: "Lieu", value: eventLocation, set: setEventLocation, placeholder: "Ex: Cotonou, Bénin" },
              { label: "Description", value: eventDesc, set: setEventDesc, placeholder: "Décrivez votre évènement" },
            ].map((f, i) => (
              <div key={i} style={{ marginTop: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 4 }}>{f.label}</label>
                <input value={f.value} onChange={e => f.set(e.target.value)} type={(f as any).type ?? "text"} placeholder={f.placeholder}
                  style={{ width: "100%", padding: "12px 14px", border: "1.5px solid #E5E7EB", borderRadius: 14, fontSize: 15, outline: "none", background: "#F8FAFC", boxSizing: "border-box", fontFamily: "inherit" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#22C55E")}
                  onBlur={e => (e.currentTarget.style.borderColor = "#E5E7EB")} />
              </div>
            ))}
            {!showEndTime && (
              <button onClick={() => setShowEndTime(true)} style={{ marginTop: 10, background: "none", border: "none", color: "#22C55E", fontSize: 14, fontWeight: 600, cursor: "pointer", padding: "4px 0" }}>+ Ajouter une heure de fin</button>
            )}
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12 }}>
              <div onClick={() => setEventOnline(v => !v)} style={{ width: 42, height: 24, borderRadius: 12, background: eventOnline ? "#22C55E" : "#E5E7EB", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                <div style={{ position: "absolute", top: 2, left: eventOnline ? 20 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,.2)", transition: "left 0.2s" }} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#0F172A" }}>Évènement en ligne</span>
            </div>
            <button onClick={() => { setShowEvent(false); }} style={{ marginTop: 20, width: "100%", padding: 14, borderRadius: 14, border: "none", background: "linear-gradient(135deg,#22C55E,#16A34A)", color: "#fff", fontWeight: 900, fontSize: 16, cursor: "pointer" }}>
              Créer l'évènement
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
