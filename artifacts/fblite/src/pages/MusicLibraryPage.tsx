import { useState, useEffect, useRef, useMemo } from "react";

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  duration: string;
  genre: string;
  coverColor: string;
  coverEmoji: string;
  coverUrl: string;
  previewUrl: string;
}

const c = (s: string) => `https://picsum.photos/seed/${s}/112/112`;
const SH = (n: number) => `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${n}.mp3`;

const TRENDING: MusicTrack[] = [
  { id:"t1", title:"Ça Va Aller (It's Gonna Be Okay)", artist:"Afro Sound Machine", duration:"3:24", genre:"Afrobeats",    coverColor:"#1a472a", coverEmoji:"🎵", coverUrl:c("cavaaller22"),    previewUrl:SH(1)  },
  { id:"t2", title:"Lagos Sunrise",                    artist:"Burna Dream",         duration:"4:01", genre:"Afrofusion",   coverColor:"#F59E0B", coverEmoji:"🌅", coverUrl:c("lagossunrise"),   previewUrl:SH(2)  },
  { id:"t3", title:"Pawa Ya Sasa",                     artist:"Nairobi Vibez",       duration:"3:45", genre:"Genge",        coverColor:"#7C3AED", coverEmoji:"⚡", coverUrl:c("pawayasasa"),     previewUrl:SH(3)  },
  { id:"t4", title:"Dakar Nights",                     artist:"Youssou Project",     duration:"5:12", genre:"Mbalax",       coverColor:"#1e3a5f", coverEmoji:"🌙", coverUrl:c("dakarnights33"),  previewUrl:SH(4)  },
  { id:"t5", title:"Abidjan Flow",                     artist:"Sasha Ivoire",        duration:"3:58", genre:"Coupé-décalé", coverColor:"#0891B2", coverEmoji:"🎤", coverUrl:c("abidjanflow"),    previewUrl:SH(5)  },
  { id:"t6", title:"Kigali Love Story",                artist:"Afric Simone Jr.",    duration:"4:22", genre:"Zouk",         coverColor:"#EC4899", coverEmoji:"❤️", coverUrl:c("kigalilovestory"),previewUrl:SH(6)  },
  { id:"t7", title:"Douala Beat",                      artist:"Mac Lion Vibes",      duration:"3:37", genre:"Bikutsi",      coverColor:"#22C55E", coverEmoji:"🥁", coverUrl:c("doualabeat"),     previewUrl:SH(7)  },
  { id:"t8", title:"Nairobi Nights",                   artist:"Sauti Sol Next",      duration:"4:15", genre:"Afro-soul",    coverColor:"#0F172A", coverEmoji:"🌃", coverUrl:c("nairobinights"),  previewUrl:SH(8)  },
];

const POPULAR: MusicTrack[] = [
  { id:"p1", title:"African Queen 2.0",    artist:"2Baba Legacy",        duration:"4:10", genre:"Afropop",    coverColor:"#F97316", coverEmoji:"👑", coverUrl:c("africanqueen20"),  previewUrl:SH(9)  },
  { id:"p2", title:"Mama Africa",          artist:"Angelique Kidjo Jr.", duration:"3:33", genre:"World",      coverColor:"#10B981", coverEmoji:"🌍", coverUrl:c("mamaafrica"),      previewUrl:SH(10) },
  { id:"p3", title:"Jollof Bounce",        artist:"Timaya Next Gen",     duration:"3:15", genre:"Afrobeats",  coverColor:"#FBBF24", coverEmoji:"🎉", coverUrl:c("jollofbounce"),   previewUrl:SH(11) },
  { id:"p4", title:"Cape Town Waves",      artist:"DJ Black Coffee II",  duration:"6:44", genre:"Afro House", coverColor:"#3B82F6", coverEmoji:"🌊", coverUrl:c("capetownwaves"),  previewUrl:SH(12) },
  { id:"p5", title:"Soweto Groove",        artist:"Miriam New",          duration:"3:52", genre:"Kwaito",     coverColor:"#A78BFA", coverEmoji:"💃", coverUrl:c("sowetogroove"),   previewUrl:SH(13) },
  { id:"p6", title:"Accra Bounce",         artist:"R2Bees Jr.",          duration:"3:18", genre:"Azonto",     coverColor:"#34D399", coverEmoji:"🔥", coverUrl:c("accrabounce"),    previewUrl:SH(14) },
  { id:"p7", title:"Kampala Nights",       artist:"José Chameleón Jr.",  duration:"5:02", genre:"Afrobeats",  coverColor:"#F43F5E", coverEmoji:"🌙", coverUrl:c("kampalanights"), previewUrl:SH(15) },
  { id:"p8", title:"Harare Dreams",        artist:"Oliver Mtukudzi Jr.", duration:"4:33", genre:"Chimurenga", coverColor:"#6366F1", coverEmoji:"✨", coverUrl:c("harareddreams"), previewUrl:SH(16) },
];

const RECENT: MusicTrack[] = [
  { id:"r1", title:"Bongo Midnight",        artist:"Diamond Next",       duration:"4:30", genre:"Bongo Flava", coverColor:"#6366F1", coverEmoji:"🎶", coverUrl:c("bongomidnight"),     previewUrl:SH(17) },
  { id:"r2", title:"Congolese Dream",       artist:"Fally New Wave",     duration:"5:05", genre:"Ndombolo",    coverColor:"#F43F5E", coverEmoji:"🎸", coverUrl:c("congolesedream"),    previewUrl:SH(1)  },
  { id:"r3", title:"Kinshasa Vibration",    artist:"Werrason Jr.",       duration:"4:48", genre:"Rumba",       coverColor:"#14B8A6", coverEmoji:"🥁", coverUrl:c("kinshasavibration"), previewUrl:SH(2)  },
  { id:"r4", title:"Marrakech Trance",      artist:"Hassan New Sound",   duration:"5:33", genre:"Gnawa",       coverColor:"#D97706", coverEmoji:"🎺", coverUrl:c("marrakech"),         previewUrl:SH(3)  },
  { id:"r5", title:"Bamako Blues",          artist:"Toumani Modern",     duration:"4:17", genre:"Wassoulou",   coverColor:"#64748B", coverEmoji:"🎻", coverUrl:c("bamakoblues"),       previewUrl:SH(4)  },
  { id:"r6", title:"Port-au-Prince Rising", artist:"Sweet Micky Remix",  duration:"3:44", genre:"Compas",      coverColor:"#BE185D", coverEmoji:"🌺", coverUrl:c("portauprince"),      previewUrl:SH(5)  },
  { id:"r7", title:"Lomé Electronique",     artist:"African Electronic", duration:"4:58", genre:"Afroelectro", coverColor:"#7C3AED", coverEmoji:"⚡", coverUrl:c("lomeelectro"),       previewUrl:SH(6)  },
  { id:"r8", title:"Brazzaville Soir",      artist:"Papa Wemba Jr.",     duration:"3:29", genre:"Ndombolo",    coverColor:"#059669", coverEmoji:"🎵", coverUrl:c("brazzavillesoir"),   previewUrl:SH(7)  },
];

export const ALL_TRACKS = [...TRENDING, ...POPULAR, ...RECENT];

interface Props {
  onSelect: (track: MusicTrack) => void;
  onClose: () => void;
  initialTrack?: MusicTrack | null;
}

/* ── Animated EQ bars ── */
function EqBars({ playing, size = "md" }: { playing: boolean; size?: "sm"|"md" }) {
  const bars = size === "sm" ? [6,10,8,12,7] : [8,14,10,18,9,14,8];
  const w = size === "sm" ? 2 : 3;
  const h = size === "sm" ? 16 : 22;
  return (
    <div style={{ display:"flex", gap: size==="sm"?1.5:2, alignItems:"flex-end", height:h, flexShrink:0 }}>
      {bars.map((bh,i) => (
        <div key={i} style={{
          width:w, borderRadius:2, background:"#22C55E",
          height: playing ? bh : 3,
          transition:`height ${180+i*35}ms ease-in-out`,
          animation: playing ? `mlEq ${0.6+i*0.07}s ease-in-out infinite alternate` : "none",
          animationDelay:`${i*0.08}s`,
          transformOrigin:"bottom",
        }}/>
      ))}
    </div>
  );
}

/* ── Cover image with gradient fallback ── */
function CoverImg({ track, size, radius = 12 }: { track: MusicTrack; size: number; radius?: number }) {
  const [err, setErr] = useState(false);
  return err ? (
    <div style={{
      width:size, height:size, borderRadius:radius, flexShrink:0,
      background: track.coverColor,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize: size * 0.4,
    }}>{track.coverEmoji}</div>
  ) : (
    <img
      src={track.coverUrl}
      alt={track.title}
      onError={() => setErr(true)}
      style={{ width:size, height:size, borderRadius:radius, objectFit:"cover", flexShrink:0 }}
    />
  );
}

/* ── 3-dot menu icon ── */
function ThreeDots() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="5"  r="1.5" fill="#9CA3AF"/>
      <circle cx="12" cy="12" r="1.5" fill="#9CA3AF"/>
      <circle cx="12" cy="19" r="1.5" fill="#9CA3AF"/>
    </svg>
  );
}

/* ── Track row ── */
function TrackRow({ track, playing, loading, onPlay, onSelect }: {
  track: MusicTrack;
  playing: boolean;
  loading: boolean;
  onPlay: () => void;
  onSelect: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <div
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display:"flex", alignItems:"center", gap:12,
        padding:"14px 16px",
        background: playing ? "rgba(34,197,94,0.04)" : pressed ? "#F9FAFB" : "#FFFFFF",
        borderBottom:"1px solid #F3F4F6",
        minHeight:88,
        transform: pressed ? "scale(0.99)" : "scale(1)",
        transition:"all 150ms",
      }}
    >
      {/* Cover */}
      <div onClick={onSelect} style={{ cursor:"pointer", flexShrink:0 }}>
        <CoverImg track={track} size={56} radius={12}/>
      </div>

      {/* Info — tappable to select */}
      <button
        onClick={onSelect}
        style={{ flex:1, minWidth:0, background:"none", border:"none", cursor:"pointer", textAlign:"left", padding:0 }}
      >
        <div style={{
          fontSize:15, fontWeight:600, color: playing ? "#22C55E" : "#111827",
          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
          marginBottom:3,
        }}>{track.title}</div>
        <div style={{ fontSize:13, color:"#6B7280", marginBottom:4,
          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
        }}>{track.artist}</div>
        <span style={{
          display:"inline-block", fontSize:11, fontWeight:500,
          color:"#166534", background:"#DCFCE7",
          borderRadius:20, padding:"2px 8px", letterSpacing:"0.1px",
        }}>{track.genre}</span>
      </button>

      {/* Duration + Play + 3-dot */}
      <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
        <span style={{ fontSize:13, color:"#9CA3AF", width:30, textAlign:"right" }}>{track.duration}</span>
        <button
          onClick={onPlay}
          style={{
            width:38, height:38, borderRadius:"50%", flexShrink:0,
            background: playing ? "#22C55E" : "#FFFFFF",
            border: `2px solid ${playing ? "#22C55E" : "#22C55E"}`,
            display:"flex", alignItems:"center", justifyContent:"center",
            cursor:"pointer",
            boxShadow: playing ? "0 4px 12px rgba(34,197,94,0.35)" : "0 1px 4px rgba(0,0,0,0.08)",
            transition:"all 200ms",
          }}
        >
          {loading ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={playing?"#fff":"#22C55E"} strokeWidth="2.5" strokeLinecap="round"
              style={{ animation:"mlSpin 0.8s linear infinite" }}>
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0" strokeOpacity="0.3"/>
              <path d="M21 12a9 9 0 00-9-9"/>
            </svg>
          ) : playing ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <rect x="6" y="4" width="4" height="16" rx="1.5" fill="#fff"/>
              <rect x="14" y="4" width="4" height="16" rx="1.5" fill="#fff"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <polygon points="6,4 20,12 6,20" fill="#22C55E"/>
            </svg>
          )}
        </button>
        <button onClick={() => {}} style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 2px", display:"flex" }}>
          <ThreeDots/>
        </button>
      </div>
    </div>
  );
}

/* ── Now Playing Bar ── */
function NowPlayingBar({ track, playing, onToggle, onClose }: {
  track: MusicTrack;
  playing: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const [liked, setLiked] = useState(false);
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:12,
      padding:"12px 16px 16px",
      background:"#FFFFFF",
      borderTop:"1px solid #F3F4F6",
      boxShadow:"0 -4px 24px rgba(0,0,0,0.08)",
    }}>
      {/* Cover */}
      <CoverImg track={track} size={44} radius={10}/>

      {/* Info + EQ */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13.5, fontWeight:700, color:"#111827",
          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", marginBottom:2 }}>
          {track.title}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontSize:12, color:"#6B7280",
            whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:140 }}>
            {track.artist}
          </span>
          <EqBars playing={playing} size="sm"/>
        </div>
      </div>

      {/* Heart */}
      <button
        onClick={() => setLiked(l => !l)}
        style={{ background:"none", border:"none", cursor:"pointer", padding:6, display:"flex", flexShrink:0 }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill={liked?"#EF4444":"none"}
          stroke={liked?"#EF4444":"#9CA3AF"} strokeWidth="1.8" strokeLinecap="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </button>

      {/* Pause/Play circle */}
      <button
        onClick={onToggle}
        style={{
          width:42, height:42, borderRadius:"50%", flexShrink:0,
          background:"#22C55E", border:"none", cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"center",
          boxShadow:"0 4px 16px rgba(34,197,94,0.4)",
        }}
      >
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="6" y="4" width="4" height="16" rx="1.5" fill="#fff"/>
            <rect x="14" y="4" width="4" height="16" rx="1.5" fill="#fff"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <polygon points="6,4 20,12 6,20" fill="#fff"/>
          </svg>
        )}
      </button>

      {/* Close */}
      <button
        onClick={onClose}
        style={{ background:"none", border:"none", cursor:"pointer", padding:6, display:"flex", flexShrink:0 }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.2" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  );
}

/* ── Main component ── */
export default function MusicLibraryPage({ onSelect, onClose, initialTrack }: Props) {
  const [visible, setVisible]       = useState(false);
  const [query, setQuery]           = useState("");
  const [tab, setTab]               = useState<"trending"|"popular"|"recent">("trending");
  const [playingId, setPlayingId]   = useState<string|null>(null);
  const [loadingId, setLoadingId]   = useState<string|null>(null);
  const [nowPlaying, setNowPlaying] = useState<MusicTrack|null>(null);
  const audioRef                    = useRef<HTMLAudioElement|null>(null);
  const inputRef                    = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    return () => stopAudio();
  }, []);

  const stopAudio = () => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.src = "";
    audioRef.current = null;
    setPlayingId(null);
    setLoadingId(null);
  };

  const handleClose = () => {
    stopAudio();
    setNowPlaying(null);
    setVisible(false);
    setTimeout(onClose, 310);
  };

  const handlePlay = (track: MusicTrack) => {
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    stopAudio();
    setLoadingId(track.id);
    setNowPlaying(track);
    const audio = new Audio(track.previewUrl);
    audio.volume = 0.85;
    audioRef.current = audio;
    audio.addEventListener("canplay", () => {
      setLoadingId(null);
      setPlayingId(track.id);
      audio.play().catch(() => { setLoadingId(null); setPlayingId(null); });
    }, { once: true });
    audio.addEventListener("ended", () => setPlayingId(null));
    audio.addEventListener("error", () => { setLoadingId(null); setPlayingId(null); }, { once: true });
    audio.load();
  };

  const handleToggleNowPlaying = () => {
    if (!nowPlaying) return;
    if (playingId === nowPlaying.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.play().catch(() => {});
        setPlayingId(nowPlaying.id);
      } else {
        handlePlay(nowPlaying);
      }
    }
  };

  const handleSelect = (track: MusicTrack) => {
    stopAudio();
    setVisible(false);
    setTimeout(() => onSelect(track), 280);
  };

  const tabData = { trending: TRENDING, popular: POPULAR, recent: RECENT };

  const tracks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tabData[tab];
    return ALL_TRACKS.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.genre.toLowerCase().includes(q)
    );
  }, [query, tab]);

  const TABS = [
    { key: "trending" as const, label: "Tendances", icon: "🔥" },
    { key: "popular"  as const, label: "Populaires", icon: "☆" },
    { key: "recent"   as const, label: "Récentes",   icon: "🕐" },
  ];

  return (
    <div style={{
      position:"absolute", inset:0, zIndex:60,
      display:"flex", flexDirection:"column",
      background:"rgba(15,23,42,0.55)",
      backdropFilter:"blur(20px)",
      WebkitBackdropFilter:"blur(20px)",
      opacity: visible ? 1 : 0,
      transition:"opacity 300ms ease",
    }}>
      {/* Tap-outside dismiss */}
      <div style={{ flex:1, minHeight:"8vh" }} onClick={handleClose}/>

      {/* Sheet */}
      <div style={{
        background:"#FFFFFF",
        borderRadius:"32px 32px 0 0",
        height:"92vh",
        display:"flex", flexDirection:"column",
        transform: visible ? "translateY(0)" : "translateY(100%)",
        transition:"transform 310ms cubic-bezier(0.32,0.72,0,1)",
        boxShadow:"0 -8px 40px rgba(0,0,0,0.18)",
        overflow:"hidden",
      }}>

        {/* Drag handle */}
        <div style={{ display:"flex", justifyContent:"center", padding:"14px 0 6px" }}>
          <div style={{ width:36, height:4, borderRadius:999, background:"#E5E7EB" }}/>
        </div>

        {/* Header row: back + BrutePawa + close */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"4px 16px 12px" }}>
          <button onClick={handleClose} style={{
            width:36, height:36, borderRadius:"50%", background:"#F3F4F6",
            border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
            <div style={{
              width:28, height:28, borderRadius:"50%",
              background:"linear-gradient(135deg,#22C55E,#16A34A)",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            </div>
            <span style={{ fontWeight:800, fontSize:16, color:"#111827" }}>BrutePawa</span>
          </div>
          <button onClick={handleClose} style={{
            width:36, height:36, borderRadius:"50%", background:"#F3F4F6",
            border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Title section */}
        <div style={{ display:"flex", alignItems:"center", gap:14, padding:"0 20px 16px" }}>
          <div style={{
            width:52, height:52, borderRadius:"50%", flexShrink:0,
            background:"linear-gradient(135deg,#22C55E,#16A34A)",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 4px 16px rgba(34,197,94,0.3)",
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          </div>
          <div>
            <h2 style={{ margin:0, fontWeight:800, fontSize:20, color:"#111827", letterSpacing:"-0.4px" }}>
              Bibliothèque musicale
            </h2>
            <p style={{ margin:"3px 0 0", fontSize:12.5, color:"#6B7280", lineHeight:1.4 }}>
              Appuie ▶ pour écouter · Appuie sur le titre pour choisir
            </p>
          </div>
        </div>

        {/* Search + Filter */}
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"0 16px 14px" }}>
          <div style={{
            flex:1, display:"flex", alignItems:"center", gap:10,
            background:"#F3F4F6", borderRadius:18, padding:"0 16px",
            height:56,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" style={{ flexShrink:0 }}>
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher titre, artiste, genre..."
              style={{
                flex:1, background:"none", border:"none", outline:"none",
                fontSize:14.5, color:"#111827", fontFamily:"inherit",
              }}
            />
            {query && (
              <button onClick={() => setQuery("")} style={{ background:"none",border:"none",cursor:"pointer",padding:0,display:"flex" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            )}
          </div>
          <button style={{
            width:56, height:56, borderRadius:18, flexShrink:0,
            background:"#F3F4F6", border:"none", cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="6"  x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="18" x2="10" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        {!query && (
          <div style={{ padding:"0 16px 14px" }}>
            <div style={{
              display:"flex", background:"#F3F4F6", borderRadius:16, padding:4, gap:2, height:52,
            }}>
              {TABS.map(t => {
                const active = tab === t.key;
                return (
                  <button key={t.key} onClick={() => setTab(t.key)} style={{
                    flex:1, border:"none", cursor:"pointer",
                    background: active ? "#FFFFFF" : "transparent",
                    borderRadius:12,
                    color: active ? "#22C55E" : "#9CA3AF",
                    fontWeight: active ? 700 : 500, fontSize:13,
                    display:"flex", alignItems:"center", justifyContent:"center", gap:5,
                    boxShadow: active ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
                    transition:"all 250ms",
                  }}>
                    <span style={{ fontSize:14 }}>{t.icon}</span>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Search info */}
        {query && (
          <div style={{ padding:"0 16px 10px" }}>
            <span style={{ fontSize:13, color:"#6B7280", fontWeight:500 }}>
              {tracks.length} résultat{tracks.length!==1?"s":""} pour « {query} »
            </span>
          </div>
        )}

        {/* Track list */}
        <div style={{ flex:1, overflowY:"auto", scrollbarWidth:"none" }}>
          {tracks.length === 0 ? (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:200, gap:12 }}>
              <div style={{
                width:64, height:64, borderRadius:"50%", background:"#F3F4F6",
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                </svg>
              </div>
              <div style={{ textAlign:"center" }}>
                <p style={{ color:"#374151", fontWeight:600, fontSize:15, margin:"0 0 4px" }}>Aucun résultat</p>
                <p style={{ color:"#9CA3AF", fontSize:13, margin:0 }}>Essaie un autre mot-clé</p>
              </div>
            </div>
          ) : tracks.map(track => (
            <TrackRow
              key={track.id}
              track={track}
              playing={playingId === track.id}
              loading={loadingId === track.id}
              onPlay={() => handlePlay(track)}
              onSelect={() => handleSelect(track)}
            />
          ))}
          <div style={{ height: nowPlaying ? 80 : 24 }}/>
        </div>

        {/* Now Playing bar */}
        {nowPlaying && (
          <NowPlayingBar
            track={nowPlaying}
            playing={playingId === nowPlaying.id}
            onToggle={handleToggleNowPlaying}
            onClose={() => { stopAudio(); setNowPlaying(null); }}
          />
        )}
      </div>

      <style>{`
        @keyframes mlEq {
          from { transform: scaleY(0.3); }
          to   { transform: scaleY(1.0); }
        }
        @keyframes mlSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
