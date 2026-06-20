import { useState, useEffect, useRef } from "react";

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  duration: string;
  genre: string;
  coverColor: string;
  coverEmoji: string;
  previewUrl: string;
}

const TRENDING: MusicTrack[] = [
  { id:"t1", title:"Ça Va Aller (It's Gonna Be Okay)", artist:"Afro Sound Machine",  duration:"3:24", genre:"Afrobeats",   coverColor:"linear-gradient(135deg,#22C55E,#15803D)", coverEmoji:"🎵", previewUrl:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
  { id:"t2", title:"Lagos Sunrise",                    artist:"Burna Dream",          duration:"4:01", genre:"Afrofusion",   coverColor:"linear-gradient(135deg,#F59E0B,#D97706)", coverEmoji:"🌅", previewUrl:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
  { id:"t3", title:"Pawa Ya Sasa",                     artist:"Nairobi Vibez",        duration:"3:45", genre:"Genge",        coverColor:"linear-gradient(135deg,#8B5CF6,#7C3AED)", coverEmoji:"⚡", previewUrl:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
  { id:"t4", title:"Dakar Nights",                     artist:"Youssou Project",      duration:"5:12", genre:"Mbalax",       coverColor:"linear-gradient(135deg,#EF4444,#DC2626)", coverEmoji:"🌙", previewUrl:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" },
  { id:"t5", title:"Abidjan Flow",                     artist:"Sasha Ivoire",         duration:"3:58", genre:"Coupé-décalé", coverColor:"linear-gradient(135deg,#06B6D4,#0891B2)", coverEmoji:"🎤", previewUrl:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3" },
  { id:"t6", title:"Kigali Love Story",                artist:"Afric Simone Jr.",     duration:"4:22", genre:"Zouk",         coverColor:"linear-gradient(135deg,#EC4899,#DB2777)", coverEmoji:"❤️", previewUrl:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3" },
];

const POPULAR: MusicTrack[] = [
  { id:"p1", title:"African Queen 2.0",    artist:"2Baba Legacy",         duration:"4:10", genre:"Afropop",    coverColor:"linear-gradient(135deg,#F97316,#EA580C)", coverEmoji:"👑", previewUrl:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3" },
  { id:"p2", title:"Mama Africa",          artist:"Angelique Kidjo Jr.",  duration:"3:33", genre:"World",      coverColor:"linear-gradient(135deg,#10B981,#059669)", coverEmoji:"🌍", previewUrl:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3" },
  { id:"p3", title:"Jollof Bounce",        artist:"Timaya Next Gen",      duration:"3:15", genre:"Afrobeats",  coverColor:"linear-gradient(135deg,#FBBF24,#F59E0B)", coverEmoji:"🎉", previewUrl:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3" },
  { id:"p4", title:"Cape Town Waves",      artist:"DJ Black Coffee II",   duration:"6:44", genre:"Afro House", coverColor:"linear-gradient(135deg,#3B82F6,#2563EB)", coverEmoji:"🌊", previewUrl:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3" },
  { id:"p5", title:"Soweto Groove",        artist:"Miriam New",           duration:"3:52", genre:"Kwaito",     coverColor:"linear-gradient(135deg,#A78BFA,#8B5CF6)", coverEmoji:"💃", previewUrl:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3" },
  { id:"p6", title:"Accra Bounce",         artist:"R2Bees Jr.",           duration:"3:18", genre:"Azonto",     coverColor:"linear-gradient(135deg,#34D399,#10B981)", coverEmoji:"🔥", previewUrl:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3" },
];

const RECENT: MusicTrack[] = [
  { id:"r1", title:"Bongo Midnight",        artist:"Diamond Next",       duration:"4:30", genre:"Bongo Flava", coverColor:"linear-gradient(135deg,#6366F1,#4F46E5)", coverEmoji:"🎶", previewUrl:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3" },
  { id:"r2", title:"Congolese Dream",       artist:"Fally New Wave",     duration:"5:05", genre:"Ndombolo",    coverColor:"linear-gradient(135deg,#F43F5E,#E11D48)", coverEmoji:"🎸", previewUrl:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3" },
  { id:"r3", title:"Kinshasa Vibration",    artist:"Werrason Jr.",       duration:"4:48", genre:"Rumba",       coverColor:"linear-gradient(135deg,#14B8A6,#0D9488)", coverEmoji:"🥁", previewUrl:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3" },
  { id:"r4", title:"Marrakech Trance",      artist:"Hassan New Sound",   duration:"5:33", genre:"Gnawa",       coverColor:"linear-gradient(135deg,#D97706,#B45309)", coverEmoji:"🎺", previewUrl:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3" },
  { id:"r5", title:"Bamako Blues",          artist:"Toumani Modern",     duration:"4:17", genre:"Wassoulou",   coverColor:"linear-gradient(135deg,#64748B,#475569)", coverEmoji:"🎻", previewUrl:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-17.mp3" },
  { id:"r6", title:"Port-au-Prince Rising", artist:"Sweet Micky Remix",  duration:"3:44", genre:"Compas",      coverColor:"linear-gradient(135deg,#BE185D,#9D174D)", coverEmoji:"🌺", previewUrl:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
];

const ALL = [...TRENDING, ...POPULAR, ...RECENT];

interface Props {
  onSelect: (track: MusicTrack) => void;
  onClose: () => void;
  initialTrack?: MusicTrack | null;
}

/* ── Animated EQ bars ── */
function EqBars({ playing, color="#22C55E" }: { playing: boolean; color?: string }) {
  const heights = [10, 18, 12, 20, 8, 16, 10];
  return (
    <div style={{ display:"flex", gap:2, alignItems:"flex-end", height:22, flexShrink:0 }}>
      {heights.map((h,i) => (
        <div key={i} style={{
          width:3, borderRadius:2, background:color,
          height: playing ? h : 5,
          transition:`height ${200+i*40}ms ease-in-out`,
          animation: playing ? `mlEq 0.75s ease-in-out infinite alternate` : "none",
          animationDelay:`${i*0.09}s`,
        }}/>
      ))}
    </div>
  );
}

/* ── Play / Pause icon ── */
function PlayIcon({ size=18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <polygon points="5,3 19,12 5,21" fill="#fff" />
    </svg>
  );
}
function PauseIcon({ size=18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="6" y="4" width="4" height="16" rx="1.5" fill="#fff"/>
      <rect x="14" y="4" width="4" height="16" rx="1.5" fill="#fff"/>
    </svg>
  );
}
function LoadingSpinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"
      style={{ animation:"mlSpin 0.8s linear infinite" }}>
      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0" strokeOpacity="0.3"/>
      <path d="M21 12a9 9 0 00-9-9"/>
    </svg>
  );
}

/* ── Track row ── */
function TrackRow({ track, selected, playing, loading, onPlay, onSelect }: {
  track: MusicTrack;
  selected: boolean;
  playing: boolean;
  loading: boolean;
  onPlay: () => void;
  onSelect: () => void;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <div
      style={{
        display:"flex", alignItems:"center", gap:12,
        padding:"10px 14px",
        background: pressed ? "rgba(34,197,94,0.07)" : selected ? "rgba(34,197,94,0.05)" : "transparent",
        borderBottom:"1px solid rgba(255,255,255,0.04)",
        transition:"background 150ms",
      }}
      onPointerDown={()=>setPressed(true)}
      onPointerUp={()=>setPressed(false)}
      onPointerLeave={()=>setPressed(false)}
    >
      {/* Play / Pause button */}
      <button
        onClick={onPlay}
        style={{
          width:44, height:44, borderRadius:"50%", flexShrink:0,
          background: playing ? "linear-gradient(135deg,#22C55E,#16A34A)" : track.coverColor,
          border: selected && !playing ? "2px solid rgba(34,197,94,0.6)" : "none",
          display:"flex", alignItems:"center", justifyContent:"center",
          cursor:"pointer", fontSize:20,
          boxShadow: playing
            ? "0 4px 20px rgba(34,197,94,0.45)"
            : selected ? "0 4px 16px rgba(34,197,94,0.2)" : "0 2px 8px rgba(0,0,0,0.35)",
          transition:"all 250ms cubic-bezier(0.34,1.56,0.64,1)",
          transform: playing ? "scale(1.08)" : "scale(1)",
        }}
      >
        {loading ? <LoadingSpinner/> : playing ? <PauseIcon/> : <span>{track.coverEmoji}</span>}
      </button>

      {/* Info — tappable to select */}
      <button
        onClick={onSelect}
        style={{
          flex:1, minWidth:0, background:"none", border:"none",
          cursor:"pointer", textAlign:"left", padding:0,
        }}
      >
        <div style={{
          color: selected ? "#22C55E" : "#F1F5F9",
          fontSize:14, fontWeight: selected ? 700 : 500,
          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
          transition:"color 250ms",
        }}>{track.title}</div>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:2 }}>
          <span style={{ color:"#94A3B8", fontSize:12 }}>{track.artist}</span>
          <span style={{ color:"rgba(148,163,184,0.3)" }}>·</span>
          <span style={{
            fontSize:11, color:"#64748B",
            background:"rgba(255,255,255,0.06)",
            borderRadius:4, padding:"1px 6px",
          }}>{track.genre}</span>
        </div>
      </button>

      {/* Right: EQ bars if playing, duration otherwise + checkmark if selected */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:5, flexShrink:0 }}>
        {playing
          ? <EqBars playing color="#22C55E"/>
          : <span style={{ color:"#64748B", fontSize:12 }}>{track.duration}</span>
        }
        {selected && (
          <div style={{
            width:18, height:18, borderRadius:"50%",
            background:"linear-gradient(135deg,#22C55E,#16A34A)",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 2px 8px rgba(34,197,94,0.4)",
          }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main component ── */
export default function MusicLibraryPage({ onSelect, onClose, initialTrack }: Props) {
  const [visible, setVisible]         = useState(false);
  const [query, setQuery]             = useState("");
  const [selectedId, setSelectedId]   = useState<string|null>(initialTrack?.id ?? null);
  const [playingId, setPlayingId]     = useState<string|null>(null);
  const [loadingId, setLoadingId]     = useState<string|null>(null);
  const [tab, setTab]                 = useState<"trending"|"popular"|"recent">("trending");
  const audioRef                      = useRef<HTMLAudioElement | null>(null);
  const inputRef                      = useRef<HTMLInputElement>(null);

  /* Slide-in on mount */
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    return () => stopAudio();
  }, []);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setPlayingId(null);
    setLoadingId(null);
  };

  const handleClose = () => {
    stopAudio();
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const handlePlay = (track: MusicTrack) => {
    /* If already playing this track → pause */
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    /* Stop current audio */
    stopAudio();

    /* Start new track */
    setLoadingId(track.id);
    const audio = new Audio(track.previewUrl);
    audio.volume = 0.85;
    audioRef.current = audio;

    audio.addEventListener("canplay", () => {
      setLoadingId(null);
      setPlayingId(track.id);
      audio.play().catch(() => {
        setLoadingId(null);
        setPlayingId(null);
      });
    }, { once: true });

    audio.addEventListener("ended", () => {
      setPlayingId(null);
    });

    audio.addEventListener("error", () => {
      setLoadingId(null);
      setPlayingId(null);
    }, { once: true });

    audio.load();
  };

  const handleSelect = (track: MusicTrack) => {
    setSelectedId(track.id);
    /* Keep audio playing, select and close */
    setTimeout(() => {
      stopAudio();
      setVisible(false);
      setTimeout(() => onSelect(track), 280);
    }, 150);
  };

  /* Track list */
  const filtered = query.trim()
    ? ALL.filter(t =>
        t.title.toLowerCase().includes(query.toLowerCase()) ||
        t.artist.toLowerCase().includes(query.toLowerCase()) ||
        t.genre.toLowerCase().includes(query.toLowerCase())
      )
    : null;
  const tabData: Record<string, MusicTrack[]> = { trending:TRENDING, popular:POPULAR, recent:RECENT };
  const tracks = filtered ?? tabData[tab];

  return (
    <div style={{
      position:"absolute", inset:0, zIndex:60,
      display:"flex", flexDirection:"column",
      background:"rgba(2,15,9,0.6)",
      backdropFilter:"blur(4px)",
      opacity: visible ? 1 : 0,
      transition:"opacity 300ms ease",
    }}>
      {/* Tap-outside dismiss */}
      <div style={{ flex:1, minHeight:50 }} onClick={handleClose}/>

      {/* Sheet */}
      <div style={{
        background:"#071A0F",
        borderRadius:"28px 28px 0 0",
        height:"90vh",
        display:"flex", flexDirection:"column",
        transform: visible ? "translateY(0)" : "translateY(100%)",
        transition:"transform 300ms cubic-bezier(0.32,0.72,0,1)",
        boxShadow:"0 -20px 80px rgba(0,0,0,0.7)",
        overflow:"hidden",
        border:"1px solid rgba(255,255,255,0.07)",
        borderBottom:"none",
      }}>

        {/* Drag handle */}
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 4px" }}>
          <div style={{ width:40, height:4, borderRadius:999, background:"rgba(255,255,255,0.15)" }}/>
        </div>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", padding:"4px 16px 12px", gap:12 }}>
          <div style={{
            width:40, height:40, borderRadius:"50%",
            background:"linear-gradient(135deg,#22C55E,#15803D)",
            display:"flex", alignItems:"center", justifyContent:"center",
            flexShrink:0, boxShadow:"0 4px 16px rgba(34,197,94,0.35)",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          </div>
          <div style={{ flex:1 }}>
            <h2 style={{ margin:0, color:"#F1F5F9", fontWeight:800, fontSize:18, letterSpacing:"-0.3px" }}>
              Bibliothèque musicale
            </h2>
            <p style={{ margin:"2px 0 0", color:"#64748B", fontSize:12 }}>
              Appuie ▶ pour écouter · Appuie sur le titre pour choisir
            </p>
          </div>
          <button
            onClick={handleClose}
            style={{
              width:36, height:36, borderRadius:"50%",
              background:"rgba(255,255,255,0.07)",
              border:"1px solid rgba(255,255,255,0.08)",
              color:"#94A3B8", cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Now-playing bar */}
        {playingId && (() => {
          const t = ALL.find(x=>x.id===playingId);
          if (!t) return null;
          return (
            <div style={{
              margin:"0 14px 10px",
              background:"linear-gradient(135deg,rgba(34,197,94,0.15),rgba(22,163,74,0.08))",
              border:"1px solid rgba(34,197,94,0.3)",
              borderRadius:16, padding:"10px 14px",
              display:"flex", alignItems:"center", gap:10,
              animation:"mlSlideDown 250ms cubic-bezier(0.34,1.56,0.64,1)",
            }}>
              <div style={{
                width:34, height:34, borderRadius:9, flexShrink:0,
                background:t.coverColor, display:"flex", alignItems:"center",
                justifyContent:"center", fontSize:17,
              }}>{t.coverEmoji}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color:"#22C55E", fontSize:13, fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.title}</div>
                <div style={{ color:"#64748B", fontSize:11 }}>{t.artist}</div>
              </div>
              <EqBars playing color="#22C55E"/>
            </div>
          );
        })()}

        {/* Search */}
        <div style={{ padding:"0 16px 12px" }}>
          <div style={{
            display:"flex", alignItems:"center", gap:10,
            background:"rgba(255,255,255,0.06)",
            border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:16, padding:"10px 14px",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input
              ref={inputRef}
              value={query}
              onChange={e=>setQuery(e.target.value)}
              placeholder="Rechercher titre, artiste, genre…"
              style={{
                flex:1, background:"none", border:"none", outline:"none",
                color:"#F1F5F9", fontSize:14, fontFamily:"inherit",
              }}
            />
            {query && (
              <button onClick={()=>setQuery("")} style={{ background:"none",border:"none",cursor:"pointer",color:"#64748B",padding:0,display:"flex" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        {!query && (
          <div style={{ display:"flex", padding:"0 16px 10px" }}>
            {(["trending","popular","recent"] as const).map(t=>{
              const labels = { trending:"🔥 Tendances", popular:"⭐ Populaires", recent:"🆕 Récentes" };
              const active = tab===t;
              return (
                <button key={t} onClick={()=>setTab(t)} style={{
                  flex:1, padding:"9px 0", border:"none", cursor:"pointer",
                  background: active ? "linear-gradient(135deg,#22C55E,#16A34A)" : "rgba(255,255,255,0.04)",
                  color: active ? "#fff" : "#64748B",
                  fontWeight: active ? 700 : 500, fontSize:12,
                  borderRadius: t==="trending" ? "12px 0 0 12px" : t==="recent" ? "0 12px 12px 0" : 0,
                  transition:"all 250ms",
                  boxShadow: active ? "0 4px 12px rgba(34,197,94,0.3)" : "none",
                }}>{labels[t]}</button>
              );
            })}
          </div>
        )}

        {/* Results count when searching */}
        {query && (
          <div style={{ padding:"0 16px 8px" }}>
            <span style={{ color:"#64748B", fontSize:12, fontWeight:600 }}>
              {tracks.length} résultat{tracks.length!==1?"s":""} · « {query} »
            </span>
          </div>
        )}

        {/* List */}
        <div style={{ flex:1, overflowY:"auto", scrollbarWidth:"none" }}>
          {tracks.length === 0 ? (
            <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:180,gap:10 }}>
              <span style={{ fontSize:36 }}>🎵</span>
              <p style={{ color:"#64748B", fontSize:14, margin:0 }}>Aucun résultat</p>
            </div>
          ) : tracks.map(track=>(
            <TrackRow
              key={track.id}
              track={track}
              selected={selectedId === track.id}
              playing={playingId === track.id}
              loading={loadingId === track.id}
              onPlay={()=>handlePlay(track)}
              onSelect={()=>handleSelect(track)}
            />
          ))}
          <div style={{ height:28 }}/>
        </div>

        {/* Bottom CTA if something selected */}
        {selectedId && (() => {
          const t = ALL.find(x=>x.id===selectedId);
          if (!t) return null;
          return (
            <div style={{ padding:"10px 16px 24px" }}>
              <button
                onClick={()=>handleSelect(t)}
                style={{
                  width:"100%", padding:"15px",
                  background:"linear-gradient(135deg,#22C55E,#16A34A)",
                  border:"none", borderRadius:18, cursor:"pointer",
                  color:"#fff", fontWeight:700, fontSize:15,
                  boxShadow:"0 8px 24px rgba(34,197,94,0.4)",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:10,
                  transition:"transform 200ms",
                }}
                onPointerDown={e=>e.currentTarget.style.transform="scale(0.97)"}
                onPointerUp={e=>e.currentTarget.style.transform="scale(1)"}
                onPointerLeave={e=>e.currentTarget.style.transform="scale(1)"}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                Ajouter à la story
              </button>
            </div>
          );
        })()}
      </div>

      <style>{`
        @keyframes mlEq {
          from { transform: scaleY(0.35); }
          to   { transform: scaleY(1.0); }
        }
        @keyframes mlSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes mlSlideDown {
          from { opacity:0; transform: translateY(-8px) scale(0.97); }
          to   { opacity:1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
