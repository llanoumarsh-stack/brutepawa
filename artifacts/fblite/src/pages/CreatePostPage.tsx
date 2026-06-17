import { useState, useRef, useEffect } from "react";
import { useNavigate } from "../router";
import { searchPlaces, type Place } from "../data/locations";
import { searchItunes, MUSIC_CATEGORIES, type Track } from "../data/music";
import { apiGetUsers, apiCreatePost, type PublicUser } from "../lib/api";
import { useR2Upload, phaseLabel, type UploadedMedia } from "../hooks/useR2Upload";

interface Props {
  onPublish?: (content: string, bg?: string, mood?: string, location?: string) => void;
}

const BG_OPTIONS = [
  { id: "none",       value: "none",                                             preview: "#fff"     },
  { id: "purple",     value: "linear-gradient(135deg,#9C27B0,#E91E63)",          preview: "#9C27B0"  },
  { id: "red",        value: "linear-gradient(135deg,#F44336,#FF5722)",          preview: "#F44336"  },
  { id: "black",      value: "linear-gradient(135deg,#212121,#424242)",          preview: "#212121"  },
  { id: "darkpurple", value: "linear-gradient(135deg,#4A148C,#7B1FA2)",          preview: "#4A148C"  },
  { id: "softpurple", value: "linear-gradient(135deg,#7E57C2,#9575CD)",          preview: "#7E57C2"  },
  { id: "sunset",     value: "linear-gradient(135deg,#FF6F00,#F57C00,#E65100)", preview: "#FF6F00"  },
  { id: "night",      value: "linear-gradient(160deg,#0d1b2a,#1a3a52)",         preview: "#0d1b2a"  },
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


const GENRE_COLORS: Record<string, string> = {
  "Afrobeats": "#FF6F00", "R&B Afro": "#E91E63", "Afropop": "#9C27B0",
  "Ndombolo": "#1877F2", "Soukous": "#0288D1", "Rumba": "#00897B",
  "Bongo": "#43A047", "Rap FR": "#212121", "Rap KE": "#37474F",
  "Mbalax": "#D32F2F", "Reggae": "#388E3C", "Afro": "#F57C00",
  "Highlife": "#7B1FA2", "Coupé-Décalé": "#C62828", "Zouglou": "#AD1457",
  "Dancehall": "#2E7D32", "Hiplife": "#4527A0",
};

export default function CreatePostPage({ onPublish }: Props) {
  const navigate = useNavigate();
  const rawUser = localStorage.getItem("fb_user");
  const user = rawUser ? JSON.parse(rawUser) : { name: "Moi", flag: "" };
  const userInitials = user.name ? user.name.slice(0, 2).toUpperCase() : "ME";
  const firstName = user.name?.split(" ")[0] ?? "Moi";

  const [content, setContent]     = useState("");
  const [selectedBg, setSelectedBg] = useState("none");
  const [audience, setAudience]   = useState<"public" | "friends" | "private">("public");
  const [showAudience, setShowAudience] = useState(false);

  // Mood / Activity
  const [showMood, setShowMood]     = useState(false);
  const [moodTab, setMoodTab]       = useState<"mood" | "activity">("mood");
  const [selectedMood, setSelectedMood] = useState<string | null>(null);

  // Location
  const [showLocation, setShowLocation] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState<Place[]>(searchPlaces(""));
  const [selectedLocation, setSelectedLocation] = useState<Place | null>(null);

  // Music
  const [showMusic, setShowMusic]   = useState(false);
  const [musicQuery, setMusicQuery] = useState("");
  const [musicCat, setMusicCat]     = useState("all");
  const [musicResults, setMusicResults] = useState<Track[]>([]);
  const [musicLoading, setMusicLoading] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [playingId, setPlayingId]   = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Tag people
  const [showTag, setShowTag]       = useState(false);
  const [tagQuery, setTagQuery]     = useState("");
  const [taggedUsers, setTaggedUsers] = useState<number[]>([]);

  // Create event
  const [showEvent, setShowEvent]   = useState(false);
  const [eventName, setEventName]   = useState("");
  const [eventDate, setEventDate]   = useState(new Date().toISOString().slice(0, 10));
  const [eventTime, setEventTime]   = useState("18:00");
  const [showEndTime, setShowEndTime] = useState(false);
  const [eventEndTime, setEventEndTime] = useState("20:00");
  const [eventOnline, setEventOnline] = useState(false);
  const [eventLocation, setEventLocation] = useState("");
  const [eventDesc, setEventDesc]   = useState("");
  // Photos / médias (R2)
  const [medias, setMedias]             = useState<UploadedMedia[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]); // local preview URLs
  const [mediaIsVideo, setMediaIsVideo]   = useState<boolean[]>([]); // parallel flag per preview
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [eventCoverMedia, setEventCoverMedia] = useState<UploadedMedia | null>(null);
  const [eventCoverPreview, setEventCoverPreview] = useState<string | null>(null);
  const { upload, status: uploadStatus, phase: uploadPhase, progress, error: uploadError, reset: resetUpload } = useR2Upload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setLocationResults(searchPlaces(locationQuery)); }, [locationQuery]);

  // iTunes search — debounced, async, zero storage
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

  // Stop audio when picker closes
  useEffect(() => {
    if (!showMusic) {
      audioRef.current?.pause();
      setPlayingId(null);
    }
  }, [showMusic]);

  // Cleanup on unmount
  useEffect(() => { return () => { audioRef.current?.pause(); }; }, []);

  const [allUsers, setAllUsers] = useState<PublicUser[]>([]);

  useEffect(() => {
    apiGetUsers().then(users => setAllUsers(users)).catch(() => {});
  }, []);

  const activeBg  = BG_OPTIONS.find(b => b.id === selectedBg);
  const hasBg     = selectedBg !== "none";
  const canPublish = (content.trim().length > 0 || medias.length > 0) && uploadStatus !== "uploading";

  // Build tagline for header
  const tagUsers = allUsers.map(u => ({
    id: u.id,
    name: `${u.firstName} ${u.lastName}`,
    initials: (`${u.firstName[0] ?? ""}${u.lastName[0] ?? ""}`).toUpperCase(),
    color: ["#1877F2","#E91E8C","#7B1FA2","#F57C00","#388E3C","#00838F"][u.id % 6],
    city: u.country ?? "",
    country: u.country ?? "",
  }));
  const taggedNames = taggedUsers.map(id => tagUsers.find(u => u.id === id)?.name).filter(Boolean);
  const moodEmoji   = selectedMood ? selectedMood.split(" ")[0] : null;
  const moodWord    = selectedMood ? selectedMood.slice(selectedMood.indexOf(" ") + 1) : null;

  let headerLine = firstName;
  if (moodEmoji) headerLine += ` est ${moodEmoji} ${moodWord}`;
  if (taggedNames.length > 0) {
    const avec = taggedNames.length === 1 ? taggedNames[0]
      : taggedNames.slice(0, -1).join(", ") + " et " + taggedNames[taggedNames.length - 1];
    headerLine += `, avec ${avec}`;
  }
  const hasHeaderExtra = moodEmoji || taggedNames.length > 0;

  const handlePublish = async () => {
    if (!canPublish) return;
    let finalContent = content.trim();
    if (selectedTrack) finalContent = (finalContent ? finalContent + "\n" : "") + `🎵 ${selectedTrack.title} — ${selectedTrack.artist}`;
    if (selectedLocation) finalContent += `\n📍 ${selectedLocation.city}, ${selectedLocation.country}`;

    // Persist post to backend — include first uploaded media + its thumbnail
    const firstMedia = medias[0];
    try {
      await apiCreatePost(
        finalContent,
        firstMedia?.url ?? undefined,
        firstMedia?.thumbnailUrl ?? undefined,
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
      // Show local preview immediately
      const previewUrl = URL.createObjectURL(file);
      setMediaPreviews(p => [...p, previewUrl]);
      setMediaIsVideo(v => [...v, isVid]);
      setUploadingIdx(medias.length + i);
      // Upload to R2
      const result = await upload(file);
      setUploadingIdx(null);
      if (result) {
        setMedias(m => [...m, result]);
      } else {
        // Remove preview on failure
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

  const AUDIENCE_MAP = { public: { icon: "🌐", label: "Public" }, friends: { icon: "👥", label: "Amis" }, private: { icon: "🔒", label: "Privé" } };

  const filteredUsers = tagUsers.filter(u => !tagQuery.trim() || u.name.toLowerCase().includes(tagQuery.toLowerCase()));

  // Music grouped by artist when searching
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

  const OPTIONS = [
    { icon: "🖼️", color: "#4CAF50", label: medias.length > 0 ? "Ajouter ou supprimer des photos" : "Photos/Vidéos",
      sub: medias.length > 0 ? `${medias.length} fichier${medias.length > 1 ? "s" : ""} uploadé${medias.length > 1 ? "s" : ""}` : null,
      action: () => fileInputRef.current?.click() },
    { icon: "🎵", color: "#E91E63", label: "Musique",
      sub: selectedTrack ? `${selectedTrack.title} · ${selectedTrack.artist}` : null,
      action: () => setShowMusic(true) },
    { icon: "👥", color: "#1877F2", label: "Identifier des personnes",
      sub: taggedNames.length > 0 ? taggedNames.join(", ") : null,
      action: () => setShowTag(true) },
    { icon: "📍", color: "#F44336", label: "Ajouter un lieu",
      sub: selectedLocation ? `${selectedLocation.city}, ${selectedLocation.country}` : null,
      action: () => setShowLocation(true) },
    { icon: "😊", color: "#FF9800", label: "Humeur/Activité",
      sub: selectedMood ?? null,
      action: () => setShowMood(true) },
    { icon: "📅", color: "#1565C0", label: "Créer un évènement",
      sub: null,
      action: () => setShowEvent(true) },
    { icon: "🔴", color: "#F44336", label: "Lancer un direct",
      sub: null,
      action: () => navigate("/live") },
  ];

  const COUNTRY_FLAGS: Record<string,string> = { CI:"🇨🇮",BJ:"🇧🇯",ML:"🇲🇱",SN:"🇸🇳",TG:"🇹🇬",GN:"🇬🇳",NE:"🇳🇪",BF:"🇧🇫",CM:"🇨🇲",NG:"🇳🇬",GH:"🇬🇭",MA:"🇲🇦",FR:"🇫🇷",US:"🇺🇸" };
  const userFlag = user.country ? (COUNTRY_FLAGS[user.country] ?? user.flag ?? "") : (user.flag ?? "");

  return (
    <div style={{ position: "fixed", inset: 0, background: "#F2F4F7", zIndex: 50, display: "flex", flexDirection: "column", overflowY: "auto", fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <style>{`
        @keyframes cp-in { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        .cp-opt:hover { background: #F0FDF4 !important; transform: translateX(2px); }
        .cp-opt { transition: all 0.15s ease; }
        .cp-pub:hover:not(:disabled) { transform: translateY(-1px) !important; box-shadow: 0 8px 28px rgba(34,197,94,0.5) !important; }
      `}</style>
      <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple style={{ display: "none" }} onChange={handleFileSelect} />
      <input ref={coverInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleCoverSelect} />

      {/* ── HEADER ── */}
      <div style={{ display: "flex", alignItems: "center", padding: "12px 14px 14px", background: "#fff", position: "sticky", top: 0, zIndex: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", flexShrink: 0, gap: 10 }}>
        <button onClick={() => navigate("/")} style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: "#F3F4F6", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18, color: "#374151" }}>←</button>
        <div style={{ flex: 1, fontWeight: 800, fontSize: 17, color: "#111827" }}>Créer une publication</div>
        <button onClick={handlePublish} disabled={!canPublish} className="cp-pub"
          style={{ background: canPublish ? "#22C55E" : "#E5E7EB", color: canPublish ? "#fff" : "#9CA3AF", border: "none", borderRadius: 22, padding: "9px 18px", fontWeight: 800, fontSize: 14, cursor: canPublish ? "pointer" : "not-allowed", boxShadow: canPublish ? "0 4px 16px rgba(34,197,94,0.4)" : "none", display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s", flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          PUBLIER
        </button>
      </div>

      {/* ── AUTHOR CARD ── */}
      <div style={{ margin: "12px 14px 0", background: "#fff", borderRadius: 20, padding: "14px 14px 10px", boxShadow: "0 2px 10px rgba(0,0,0,0.06)", animation: "cp-in 0.2s ease", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
          {/* Avatar */}
          <div style={{ width: 50, height: 50, borderRadius: "50%", background: "linear-gradient(135deg,#22C55E,#16A34A)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 18, flexShrink: 0, boxShadow: "0 3px 10px rgba(34,197,94,0.35)" }}>{userInitials}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#111827", lineHeight: 1.3, marginBottom: 6 }}>
              {user.name} {userFlag}
              {moodEmoji && <span style={{ fontWeight: 400, color: "#6B7280" }}> est {moodEmoji} <em>{moodWord}</em></span>}
              {taggedNames.length > 0 && (
                <span style={{ fontWeight: 400, color: "#6B7280" }}>
                  {moodEmoji ? ", " : " est "}avec{" "}
                  {taggedNames.map((n, i) => (
                    <span key={i}><strong style={{ color: "#22C55E" }}>{n}</strong>{i < taggedNames.length - 2 ? ", " : i < taggedNames.length - 1 ? " et " : ""}</span>
                  ))}
                </span>
              )}
            </div>
            {selectedTrack && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6, background: "#FDF4FF", borderRadius: 8, padding: "4px 8px", width: "fit-content" }}>
                <span style={{ fontSize: 13 }}>🎵</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#7C3AED" }}>{selectedTrack.title} · {selectedTrack.artist}</span>
                <button onClick={() => setSelectedTrack(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#9CA3AF", padding: "0 2px" }}>✕</button>
              </div>
            )}
            {/* Audience pill */}
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowAudience(v => !v)} style={{ display: "flex", alignItems: "center", gap: 5, background: "#F0FDF4", border: "1.5px solid #BBF7D0", borderRadius: 20, padding: "5px 12px", cursor: "pointer", transition: "all 0.15s" }}>
                <span style={{ fontSize: 13 }}>{AUDIENCE_MAP[audience].icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#15803D" }}>{AUDIENCE_MAP[audience].label}</span>
                <span style={{ fontSize: 10, color: "#16A34A" }}>▼</span>
              </button>
              {showAudience && (
                <div style={{ position: "absolute", top: 38, left: 0, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 20, minWidth: 150, overflow: "hidden" }}>
                  {(["public","friends","private"] as const).map(a => (
                    <div key={a} onClick={() => { setAudience(a); setShowAudience(false); }} style={{ padding: "11px 16px", cursor: "pointer", display: "flex", gap: 10, alignItems: "center", fontWeight: a === audience ? 700 : 500, background: a === audience ? "#F0FDF4" : "#fff", color: a === audience ? "#15803D" : "#374151" }}>
                      <span>{AUDIENCE_MAP[a].icon}</span><span>{AUDIENCE_MAP[a].label}</span>
                      {a === audience && <span style={{ color: "#22C55E", marginLeft: "auto", fontSize: 14 }}>✓</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Text area */}
        <div style={{ background: hasBg ? activeBg?.value : "#FAFAFA", borderRadius: 16, padding: hasBg ? "28px 16px" : "12px 14px", minHeight: hasBg ? 100 : 80, display: "flex", flexDirection: "column", alignItems: hasBg ? "center" : "stretch", justifyContent: hasBg ? "center" : "flex-start", transition: "background 0.3s", marginBottom: 8 }}>
          <textarea ref={textareaRef} value={content} onChange={e => setContent(e.target.value)}
            placeholder="Partagez un moment fort de votre journée..."
            autoFocus
            style={{ width: "100%", border: "none", outline: "none", resize: "none", fontSize: hasBg ? 22 : 16, fontWeight: hasBg ? 700 : 400, color: hasBg ? "#fff" : "#111827", background: "transparent", textAlign: hasBg ? "center" : "left", minHeight: hasBg ? 80 : 80, lineHeight: 1.6, caretColor: "#22C55E", fontFamily: "inherit", boxSizing: "border-box" }} />
          {selectedLocation && (
            <div style={{ fontSize: 12, color: hasBg ? "rgba(255,255,255,0.85)" : "#6B7280", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
              📍 <span>{selectedLocation.city}, {selectedLocation.country}</span>
            </div>
          )}
        </div>

        {/* Style bar */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", overflowX: "auto", scrollbarWidth: "none", paddingBottom: 2 }}>
          {/* Text/Style buttons */}
          {[
            { label: "Aa", title: "Texte" },
            { label: "😊", title: "Emoji" },
            { label: "GIF", title: "GIF" },
            { label: "📊", title: "Sondage" },
          ].map(b => (
            <button key={b.label} title={b.title} style={{ flexShrink: 0, height: 34, padding: "0 12px", background: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: 20, fontSize: 13, fontWeight: 700, color: "#374151", cursor: "pointer" }}>{b.label}</button>
          ))}
          <div style={{ width: 1, height: 24, background: "#E5E7EB", flexShrink: 0, margin: "0 2px" }} />
          {/* Background reset */}
          <button onClick={() => setSelectedBg("none")} style={{ width: 34, height: 34, borderRadius: "50%", border: selectedBg === "none" ? "2.5px solid #22C55E" : "2px solid #D1D5DB", background: "#fff", cursor: "pointer", fontSize: 14, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF" }}>✕</button>
          {/* Color circles */}
          {BG_OPTIONS.filter(b => b.id !== "none").map(bg => (
            <button key={bg.id} onClick={() => setSelectedBg(bg.id === selectedBg ? "none" : bg.id)}
              style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, cursor: "pointer", background: bg.preview, border: selectedBg === bg.id ? "2.5px solid #22C55E" : "2px solid rgba(0,0,0,0.08)", boxShadow: selectedBg === bg.id ? "0 0 0 2px #fff, 0 0 0 4px #22C55E" : "0 2px 4px rgba(0,0,0,0.12)", transition: "all 0.15s" }} />
          ))}
        </div>
      </div>

      {/* Upload progress bar */}
      {uploadStatus === "uploading" && (
        <div style={{ padding: "6px 14px", flexShrink: 0 }}>
          <div style={{ height: 4, background: "#E5E7EB", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: uploadPhase === "uploading" ? `${progress}%` : "100%", background: "#22C55E", borderRadius: 4, transition: "width 0.2s" }} />
          </div>
          <div style={{ fontSize: 11, color: "#6B7280", marginTop: 3 }}>{phaseLabel(uploadPhase, progress)}</div>
        </div>
      )}
      {uploadError && (
        <div style={{ padding: "6px 14px", fontSize: 12, color: "#EF4444", flexShrink: 0 }}>
          ⚠️ {uploadError} — <span onClick={resetUpload} style={{ cursor: "pointer", textDecoration: "underline" }}>Réessayer</span>
        </div>
      )}

      {/* Media previews */}
      {mediaPreviews.length > 0 && (
        <div style={{ padding: "8px 14px", display: "flex", gap: 8, overflowX: "auto", flexShrink: 0 }}>
          {mediaPreviews.map((src, i) => {
            const uploaded = medias[i];
            const isUploading = uploadingIdx === i;
            const isVideo = uploaded?.kind === "video" || mediaIsVideo[i] === true;
            return (
              <div key={i} style={{ position: "relative", flexShrink: 0 }}>
                {isVideo ? (
                  <video src={src} style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 12 }} muted playsInline />
                ) : (
                  <img src={src} alt="" style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 12, opacity: isUploading ? 0.5 : 1 }} />
                )}
                {isUploading && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)", borderRadius: 12 }}>
                    <span style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>{progress}%</span>
                  </div>
                )}
                {uploaded && (
                  <div style={{ position: "absolute", bottom: 4, left: 4, background: "#22C55E", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 10, color: "#fff" }}>✓</span>
                  </div>
                )}
                <button onClick={() => {
                  setMediaPreviews(p => p.filter((_, j) => j !== i));
                  setMediaIsVideo(v => v.filter((_, j) => j !== i));
                  setMedias(m => m.filter((_, j) => j !== i));
                }} style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 22, height: 22, color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              </div>
            );
          })}
          <button onClick={() => fileInputRef.current?.click()} style={{ width: 90, height: 90, border: "2px dashed #D1D5DB", borderRadius: 12, background: "#fff", cursor: "pointer", fontSize: 24, color: "#9CA3AF", flexShrink: 0 }}>+</button>
        </div>
      )}

      {/* ── OPTIONS LIST ── */}
      <div style={{ margin: "10px 14px 0", display: "flex", flexDirection: "column", gap: 8 }}>
        {OPTIONS.map((opt, i) => (
          <div key={i} className="cp-opt" onClick={opt.action}
            style={{ display: "flex", gap: 14, padding: "14px 16px", alignItems: "center", cursor: "pointer", background: "#fff", borderRadius: 18, boxShadow: "0 1px 6px rgba(0,0,0,0.06)", animation: `cp-in ${0.15 + i * 0.04}s ease` }}>
            {/* Icon circle */}
            <div style={{ width: 46, height: 46, borderRadius: "50%", background: opt.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0, border: `1.5px solid ${opt.color}28` }}>{opt.icon}</div>
            {/* Label */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: "#111827" }}>{opt.label}</div>
              {opt.sub && <div style={{ fontSize: 12, color: "#22C55E", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{opt.sub}</div>}
            </div>
            {/* Chevron or check */}
            {opt.sub ? (
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#DCFCE7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ color: "#22C55E", fontSize: 13, fontWeight: 900 }}>✓</span>
              </div>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="#9CA3AF" style={{ flexShrink: 0 }}><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            )}
          </div>
        ))}
      </div>

      {/* ── BOUTON PUBLIER BAS ── */}
      <div style={{ padding: "16px 14px 28px", flexShrink: 0 }}>
        <button onClick={handlePublish} disabled={!canPublish} className="cp-pub"
          style={{ width: "100%", height: 60, borderRadius: 18, border: "none", background: canPublish ? "#22C55E" : "#E5E7EB", color: canPublish ? "#fff" : "#9CA3AF", fontWeight: 900, fontSize: 17, cursor: canPublish ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: canPublish ? "0 4px 20px rgba(34,197,94,0.4)" : "none", transition: "all 0.2s", letterSpacing: "0.5px" }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          PUBLIER
        </button>
      </div>

      {/* ══════════ MOOD OVERLAY ══════════ */}
      {showMood && (
        <BottomSheet onClose={() => setShowMood(false)} title="Humeur / Activité">
          <div style={{ display: "flex", borderBottom: "2px solid var(--fb-divider)", marginBottom: 12 }}>
            {(["mood","activity"] as const).map(tab => (
              <button key={tab} onClick={() => setMoodTab(tab)} style={{ flex: 1, padding: "10px 0", border: "none", background: "none", fontWeight: 700, fontSize: 14, cursor: "pointer", color: moodTab === tab ? "var(--fb-blue)" : "var(--fb-text-secondary)", borderBottom: moodTab === tab ? "2px solid var(--fb-blue)" : "2px solid transparent", marginBottom: -2 }}>
                {tab === "mood" ? "😊 Humeur" : "🎯 Activité"}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, paddingBottom: 32 }}>
            {(moodTab === "mood" ? MOODS : ACTIVITIES).map(item => (
              <div key={item} onClick={() => { setSelectedMood(item); setShowMood(false); }} style={{ padding: "11px 14px", background: selectedMood === item ? "#E8F0FE" : "var(--fb-bg)", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600, border: selectedMood === item ? "2px solid var(--fb-blue)" : "2px solid transparent" }}>{item}</div>
            ))}
            {selectedMood && <div onClick={() => { setSelectedMood(null); setShowMood(false); }} style={{ padding: "11px 14px", background: "#FFEBEE", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#F44336" }}>✕ Supprimer</div>}
          </div>
        </BottomSheet>
      )}

      {/* ══════════ LOCATION OVERLAY premium ══════════ */}
      {showLocation && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "flex-end" }} onClick={() => setShowLocation(false)}>
          <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", width: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 -8px 40px rgba(0,0,0,0.18)" }} onClick={e => e.stopPropagation()}>
            {/* Handle bar */}
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: "#D1D5DB" }} />
            </div>
            {/* Header */}
            <div style={{ padding: "16px 20px 8px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="#EF4444"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 17 }}>Où êtes-vous ?</div>
                  <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 1 }}>Ajoutez votre position pour aider vos amis à vous retrouver.</div>
                </div>
              </div>
            </div>
            {/* Search field */}
            <div style={{ padding: "0 16px 10px", flexShrink: 0 }}>
              <div style={{ position: "relative" }}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="#94A3B8" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                <input autoFocus value={locationQuery} onChange={e => setLocationQuery(e.target.value)}
                  placeholder="Rechercher une ville ou un pays..."
                  style={{ width: "100%", padding: "12px 40px 12px 42px", border: "1.5px solid #E2E8F0", borderRadius: 24, fontSize: 15, outline: "none", background: "#F8FAFC", boxSizing: "border-box", transition: "border-color 0.2s" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#16C24A")}
                  onBlur={e => (e.currentTarget.style.borderColor = "#E2E8F0")}
                />
                {locationQuery && (
                  <button onClick={() => setLocationQuery("")}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 22, height: 22, borderRadius: "50%", background: "#94A3B8", border: "none", color: "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>✕</button>
                )}
              </div>
            </div>
            {/* GPS option */}
            <div style={{ padding: "0 16px 6px", flexShrink: 0 }}>
              <div onClick={() => {
                if (!navigator.geolocation) return;
                navigator.geolocation.getCurrentPosition(pos => {
                  const fake: Place = { city: "Ma position actuelle", country: "GPS", flag: "📡", countryCode: "GPS" };
                  setSelectedLocation(fake); setShowLocation(false); setLocationQuery("");
                }, () => {});
              }} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 14px", background: "#F0FDF4", borderRadius: 14, cursor: "pointer", border: "1.5px solid #BBF7D0" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#16C24A22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="#16C24A"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#16C24A" }}>Ma position actuelle</div>
                  <div style={{ fontSize: 12, color: "#94A3B8" }}>Utiliser ma position actuelle</div>
                </div>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="#16C24A"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
              </div>
            </div>
            {/* Divider */}
            <div style={{ padding: "0 16px 4px", flexShrink: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Suggestions</div>
            </div>
            {/* City list */}
            <div style={{ overflowY: "auto", flex: 1, paddingBottom: 20 }}>
              {locationResults.map((place, i) => {
                const sel = selectedLocation?.city === place.city && selectedLocation?.country === place.country;
                return (
                  <div key={i} onClick={() => { setSelectedLocation(place); setShowLocation(false); setLocationQuery(""); }}
                    style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 20px", cursor: "pointer", background: sel ? "#F0FDF4" : "#fff", borderBottom: "1px solid #F1F5F9", transition: "background 0.12s" }}
                    onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLDivElement).style.background = "#F8FAFC"; }}
                    onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLDivElement).style.background = "#fff"; }}>
                    <span style={{ fontSize: 24, flexShrink: 0 }}>{place.flag}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: sel ? 700 : 600, fontSize: 15, color: sel ? "#16C24A" : "#0F172A" }}>{place.city}</div>
                      <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 1 }}>{place.country}</div>
                    </div>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill={sel ? "#16C24A" : "#CBD5E1"}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>
                  </div>
                );
              })}
              {locationResults.length === 0 && (
                <div style={{ padding: "32px", textAlign: "center", color: "#94A3B8" }}>
                  <svg viewBox="0 0 24 24" width="40" height="40" fill="#CBD5E1" style={{ display: "block", margin: "0 auto 8px" }}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>
                  Aucune ville trouvée
                </div>
              )}
              {selectedLocation && (
                <div onClick={() => { setSelectedLocation(null); setShowLocation(false); }}
                  style={{ padding: "14px 20px", cursor: "pointer", fontSize: 15, fontWeight: 600, color: "#EF4444", display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid #FEE2E2" }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="#EF4444"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                  Supprimer le lieu
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ MUSIC OVERLAY ══════════ */}
      {showMusic && (
        <div style={{ position: "fixed", inset: 0, background: "var(--fb-white)", zIndex: 100, display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--fb-divider)", flexShrink: 0 }}>
            <button onClick={() => setShowMusic(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--fb-text)", padding: "4px 10px 4px 0" }}>←</button>
            <div style={{ flex: 1, fontWeight: 800, fontSize: 17 }}>Musique</div>
          </div>
          {/* Search */}
          <div style={{ padding: "10px 16px 0", flexShrink: 0 }}>
            <div style={{ position: "relative" }}>
              <input value={musicQuery} onChange={e => setMusicQuery(e.target.value)} placeholder="Recherchez de la musique"
                style={{ width: "100%", padding: "10px 36px 10px 40px", border: "none", borderRadius: 24, fontSize: 15, outline: "none", background: "var(--fb-bg)", boxSizing: "border-box" }} />
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "var(--fb-text-secondary)" }}>🔍</span>
              {musicQuery && <button onClick={() => setMusicQuery("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--fb-text-secondary)" }}>✕</button>}
            </div>
          </div>
          {/* Category chips */}
          <div style={{ display: "flex", gap: 8, padding: "10px 16px", overflowX: "auto", scrollbarWidth: "none", flexShrink: 0 }}>
            {MUSIC_CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setMusicCat(cat.id)} style={{ flexShrink: 0, padding: "7px 16px", borderRadius: 20, border: "none", background: musicCat === cat.id ? "var(--fb-blue)" : "var(--fb-bg)", color: musicCat === cat.id ? "#fff" : "var(--fb-text)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{cat.label}</button>
            ))}
          </div>
          {/* Track list */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {musicLoading && (
              <div style={{ padding: "32px", textAlign: "center", color: "var(--fb-text-secondary)" }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🎵</div>
                Chargement…
              </div>
            )}
            {!musicLoading && !musicQuery.trim() && (
              <div style={{ padding: "4px 20px 8px", fontSize: 14, fontWeight: 700 }}>
                {MUSIC_CATEGORIES.find(c => c.id === musicCat)?.label ?? "Pour vous"}
              </div>
            )}
            {!musicLoading && musicQuery.trim() && groupedMusic.length > 0 ? (
              groupedMusic.map(([artist, tracks]) => (
                <div key={artist}>
                  <div style={{ padding: "8px 20px 4px", fontSize: 12, fontWeight: 700, color: "var(--fb-text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, background: "var(--fb-bg)" }}>{artist}</div>
                  {tracks.map(t => (
                    <MusicRow key={t.id} track={t}
                      selected={selectedTrack?.id === t.id}
                      playing={playingId === t.id}
                      onSelect={() => { setSelectedTrack(t); setShowMusic(false); audioRef.current?.pause(); setPlayingId(null); }}
                      onPlayPause={() => handlePlayPause(t)}
                    />
                  ))}
                </div>
              ))
            ) : !musicLoading ? (
              musicResults.map(t => (
                <MusicRow key={t.id} track={t}
                  selected={selectedTrack?.id === t.id}
                  playing={playingId === t.id}
                  onSelect={() => { setSelectedTrack(t); setShowMusic(false); audioRef.current?.pause(); setPlayingId(null); }}
                  onPlayPause={() => handlePlayPause(t)}
                />
              ))
            ) : null}
            {!musicLoading && musicResults.length === 0 && (
              <div style={{ padding: "32px", textAlign: "center", color: "var(--fb-text-secondary)" }}>Aucun titre trouvé</div>
            )}
            {selectedTrack && (
              <div onClick={() => { setSelectedTrack(null); setShowMusic(false); }} style={{ padding: "16px 20px", cursor: "pointer", fontSize: 15, fontWeight: 600, color: "#F44336" }}>✕ Supprimer la musique</div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ TAG PEOPLE OVERLAY ══════════ */}
      {showTag && (
        <div style={{ position: "fixed", inset: 0, background: "var(--fb-white)", zIndex: 100, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--fb-divider)", flexShrink: 0 }}>
            <button onClick={() => setShowTag(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--fb-text)", padding: "4px 10px 4px 0" }}>←</button>
            <div style={{ flex: 1, fontWeight: 800, fontSize: 17, textAlign: "center" }}>Identifier des personnes</div>
            <div style={{ width: 44 }} />
          </div>
          <div style={{ padding: "10px 16px 4px", flexShrink: 0 }}>
            <div style={{ position: "relative" }}>
              <input autoFocus value={tagQuery} onChange={e => setTagQuery(e.target.value)} placeholder="Rechercher un(e) ami(e)"
                style={{ width: "100%", padding: "10px 36px 10px 14px", border: "none", borderRadius: 24, fontSize: 15, outline: "none", background: "var(--fb-bg)", boxSizing: "border-box" }} />
              <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "var(--fb-text-secondary)" }}>🔍</span>
            </div>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            <div style={{ padding: "8px 20px 4px", fontSize: 14, fontWeight: 700, color: "var(--fb-text-secondary)" }}>Suggestions</div>
            {filteredUsers.map(u => {
              const checked = taggedUsers.includes(u.id);
              return (
                <div key={u.id} onClick={() => setTaggedUsers(prev => checked ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 20px", borderBottom: "1px solid var(--fb-divider)", cursor: "pointer", background: checked ? "#E8F0FE" : "var(--fb-white)" }}>
                  <div style={{ width: 46, height: 46, borderRadius: "50%", background: u.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>{u.initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{u.name}</div>
                    <div style={{ fontSize: 12, color: "var(--fb-text-secondary)" }}>{u.city}, {u.country}</div>
                  </div>
                  <div style={{ width: 22, height: 22, border: checked ? "none" : "2px solid var(--fb-divider)", borderRadius: 4, background: checked ? "var(--fb-blue)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {checked && <span style={{ color: "#fff", fontSize: 14 }}>✓</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--fb-divider)", flexShrink: 0 }}>
            <button onClick={() => setShowTag(false)} style={{ width: "100%", padding: 14, borderRadius: 10, border: "none", background: "var(--fb-blue)", color: "#fff", fontWeight: 900, fontSize: 16, cursor: "pointer" }}>
              {taggedUsers.length > 0 ? `Terminé (${taggedUsers.length})` : "Terminé"}
            </button>
          </div>
        </div>
      )}

      {/* ══════════ CREATE EVENT OVERLAY ══════════ */}
      {showEvent && (
        <div style={{ position: "fixed", inset: 0, background: "var(--fb-white)", zIndex: 100, display: "flex", flexDirection: "column", overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--fb-divider)", flexShrink: 0, position: "sticky", top: 0, background: "var(--fb-white)", zIndex: 10 }}>
            <button onClick={() => setShowEvent(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--fb-text)", padding: "4px 10px 4px 0" }}>←</button>
            <div style={{ flex: 1, fontWeight: 800, fontSize: 17, textAlign: "center" }}>Créer un évènement</div>
            <div style={{ width: 44 }} />
          </div>

          {/* Cover photo */}
          <div onClick={() => coverInputRef.current?.click()} style={{ margin: "0", background: eventCoverPreview ? "transparent" : "#e9ebee", minHeight: 160, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, position: "relative", overflow: "hidden" }}>
            {eventCoverPreview ? (
              <img src={eventCoverPreview} alt="" style={{ width: "100%", height: 160, objectFit: "cover", opacity: eventCoverMedia ? 1 : 0.6 }} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 24 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(0,0,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>⊞</div>
                <span style={{ fontWeight: 600, fontSize: 15, color: "#444" }}>Ajouter une photo de couverture</span>
              </div>
            )}
          </div>

          <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Event name */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fb-text-secondary)", display: "block", marginBottom: 6 }}>Nom de l'évènement</label>
              <input value={eventName} onChange={e => setEventName(e.target.value)} placeholder="" style={{ width: "100%", padding: "12px 14px", border: "1px solid var(--fb-divider)", borderRadius: 8, fontSize: 16, outline: "none", boxSizing: "border-box" }} />
            </div>

            {/* Date + time */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fb-text-secondary)", display: "block", marginBottom: 6 }}>Date de début</label>
                <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} style={{ width: "100%", padding: "12px 10px", border: "1px solid var(--fb-divider)", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fb-text-secondary)", display: "block", marginBottom: 6 }}>Heure de début</label>
                <input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} style={{ width: "100%", padding: "12px 10px", border: "1px solid var(--fb-divider)", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>

            {/* End time toggle */}
            {!showEndTime ? (
              <button onClick={() => setShowEndTime(true)} style={{ background: "none", border: "none", color: "var(--fb-blue)", fontWeight: 700, fontSize: 14, cursor: "pointer", textAlign: "left", padding: 0 }}>+ Heure de fin</button>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fb-text-secondary)", display: "block", marginBottom: 6 }}>Date de fin</label>
                  <input type="date" value={eventDate} style={{ width: "100%", padding: "12px 10px", border: "1px solid var(--fb-divider)", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fb-text-secondary)", display: "block", marginBottom: 6 }}>Heure de fin</label>
                  <input type="time" value={eventEndTime} onChange={e => setEventEndTime(e.target.value)} style={{ width: "100%", padding: "12px 10px", border: "1px solid var(--fb-divider)", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>
            )}

            {/* Online toggle */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Évènement en ligne</div>
                <div style={{ fontSize: 13, color: "var(--fb-text-secondary)", marginTop: 2 }}>Créez des évènements qui se déroulent en ligne, sans adresse physique.</div>
              </div>
              <div onClick={() => setEventOnline(v => !v)} style={{ width: 22, height: 22, border: eventOnline ? "none" : "2px solid var(--fb-divider)", borderRadius: 4, background: eventOnline ? "var(--fb-blue)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, marginTop: 2 }}>
                {eventOnline && <span style={{ color: "#fff", fontSize: 14 }}>✓</span>}
              </div>
            </div>

            {/* Location */}
            {!eventOnline && (
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fb-text-secondary)", display: "block", marginBottom: 6 }}>Lieu</label>
                <div style={{ display: "flex", alignItems: "center", padding: "12px 14px", border: "1px solid var(--fb-divider)", borderRadius: 8, cursor: "pointer", justifyContent: "space-between" }}
                  onClick={() => { setShowEvent(false); setShowLocation(true); }}>
                  <span style={{ color: eventLocation ? "var(--fb-text)" : "var(--fb-text-secondary)", fontSize: 15 }}>{selectedLocation ? `📍 ${selectedLocation.city}, ${selectedLocation.country}` : "Ajouter un lieu"}</span>
                  <span style={{ color: "var(--fb-text-secondary)" }}>›</span>
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fb-text-secondary)", display: "block", marginBottom: 6 }}>Description</label>
              <textarea value={eventDesc} onChange={e => setEventDesc(e.target.value)} rows={4}
                style={{ width: "100%", padding: "12px 14px", border: "1px solid var(--fb-divider)", borderRadius: 8, fontSize: 15, outline: "none", resize: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>

            {/* Save draft */}
            <button onClick={() => {
              if (!eventName.trim()) return;
              const eventText = `📅 ${eventName}\n🗓️ ${eventDate} à ${eventTime}${showEndTime ? ` → ${eventEndTime}` : ""}${eventOnline ? "\n🌐 Évènement en ligne" : ""}${selectedLocation ? `\n📍 ${selectedLocation.city}` : ""}${eventDesc ? `\n${eventDesc}` : ""}`;
              setContent(c => c ? c + "\n" + eventText : eventText);
              setShowEvent(false);
            }} style={{ width: "100%", padding: 14, borderRadius: 10, border: "none", background: "var(--fb-blue)", color: "#fff", fontWeight: 900, fontSize: 16, cursor: "pointer", marginBottom: 8 }}>
              Enregistrer le brouillon de l'évènement
            </button>
            <div style={{ fontSize: 12, color: "var(--fb-text-secondary)", textAlign: "center", marginBottom: 20 }}>
              Cet évènement sera publié quand vous le partagerez avec le groupe.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reusable bottom sheet wrapper
function BottomSheet({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div style={{ background: "var(--fb-white)", borderRadius: "20px 20px 0 0", width: "100%", maxHeight: "82vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "16px 16px 8px", fontWeight: 700, fontSize: 17, flexShrink: 0 }}>{title}</div>
        <div style={{ overflowY: "auto", padding: "0 16px", flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

// ── Music track row with real iTunes artwork + audio preview
function MusicRow({ track, selected, playing, onSelect, onPlayPause }: {
  track: Track;
  selected: boolean;
  playing: boolean;
  onSelect: () => void;
  onPlayPause: () => void;
}) {
  const color = GENRE_COLORS[track.genre] ?? "#1877F2";
  return (
    <div onClick={onSelect} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 20px", background: selected ? "#E8F0FE" : "var(--fb-white)", borderBottom: "1px solid var(--fb-divider)", cursor: "pointer" }}>
      {/* Album art — iTunes image or gradient placeholder */}
      <div style={{ width: 46, height: 46, borderRadius: 6, overflow: "hidden", flexShrink: 0, position: "relative" }}>
        {track.artworkUrl ? (
          <img src={track.artworkUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg,${color},${color}99)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff", fontWeight: 700 }}>
            {track.artist.slice(0, 1)}
          </div>
        )}
      </div>
      {/* Title + artist */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: selected ? "var(--fb-blue)" : "var(--fb-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.title}</div>
        <div style={{ fontSize: 12, color: "var(--fb-text-secondary)" }}>{track.artist} · {track.duration}</div>
      </div>
      {/* Play/Pause button — stops propagation so it doesn't select */}
      {track.previewUrl ? (
        <button
          onClick={e => { e.stopPropagation(); onPlayPause(); }}
          style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: playing ? "var(--fb-blue)" : selected ? "#BBDEFB" : "var(--fb-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer", fontSize: playing ? 13 : 12, color: playing ? "#fff" : selected ? "var(--fb-blue)" : "var(--fb-text-secondary)", transition: "background 0.15s" }}
          aria-label={playing ? "Pause" : "Écouter un aperçu"}
        >
          {playing ? "⏸" : "▶"}
        </button>
      ) : (
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--fb-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: 0.3, fontSize: 11, color: "var(--fb-text-secondary)" }}>▶</div>
      )}
    </div>
  );
}
