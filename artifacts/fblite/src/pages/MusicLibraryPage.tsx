import { useState, useEffect, useRef } from "react";

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  duration: string;
  genre: string;
  coverColor: string;
  coverEmoji: string;
}

const TRENDING: MusicTrack[] = [
  { id:"t1", title:"Ça Va Aller (It's Gonna Be Okay)", artist:"Afro Sound Machine",  duration:"3:24", genre:"Afrobeats",   coverColor:"linear-gradient(135deg,#22C55E,#15803D)", coverEmoji:"🎵" },
  { id:"t2", title:"Lagos Sunrise",                    artist:"Burna Dream",          duration:"4:01", genre:"Afrofusion",   coverColor:"linear-gradient(135deg,#F59E0B,#D97706)", coverEmoji:"🌅" },
  { id:"t3", title:"Pawa Ya Sasa",                     artist:"Nairobi Vibez",        duration:"3:45", genre:"Genge",        coverColor:"linear-gradient(135deg,#8B5CF6,#7C3AED)", coverEmoji:"⚡" },
  { id:"t4", title:"Dakar Nights",                     artist:"Youssou Project",      duration:"5:12", genre:"Mbalax",       coverColor:"linear-gradient(135deg,#EF4444,#DC2626)", coverEmoji:"🌙" },
  { id:"t5", title:"Abidjan Flow",                     artist:"Sasha Ivoire",         duration:"3:58", genre:"Coupé-décalé", coverColor:"linear-gradient(135deg,#06B6D4,#0891B2)", coverEmoji:"🎤" },
  { id:"t6", title:"Kigali Love Story",                artist:"Afric Simone Jr.",     duration:"4:22", genre:"Zouk",         coverColor:"linear-gradient(135deg,#EC4899,#DB2777)", coverEmoji:"❤️" },
];

const POPULAR: MusicTrack[] = [
  { id:"p1", title:"African Queen 2.0",                artist:"2Baba Legacy",         duration:"4:10", genre:"Afropop",     coverColor:"linear-gradient(135deg,#F97316,#EA580C)", coverEmoji:"👑" },
  { id:"p2", title:"Mama Africa",                      artist:"Angelique Kidjo Jr.",  duration:"3:33", genre:"World",       coverColor:"linear-gradient(135deg,#10B981,#059669)", coverEmoji:"🌍" },
  { id:"p3", title:"Jollof Bounce",                    artist:"Timaya Next Gen",      duration:"3:15", genre:"Afrobeats",   coverColor:"linear-gradient(135deg,#FBBF24,#F59E0B)", coverEmoji:"🎉" },
  { id:"p4", title:"Cape Town Waves",                  artist:"DJ Black Coffee II",   duration:"6:44", genre:"Afro House",  coverColor:"linear-gradient(135deg,#3B82F6,#2563EB)", coverEmoji:"🌊" },
  { id:"p5", title:"Soweto Groove",                    artist:"Miriam New",           duration:"3:52", genre:"Kwaito",      coverColor:"linear-gradient(135deg,#A78BFA,#8B5CF6)", coverEmoji:"💃" },
  { id:"p6", title:"Accra Bounce",                     artist:"R2Bees Jr.",           duration:"3:18", genre:"Azonto",      coverColor:"linear-gradient(135deg,#34D399,#10B981)", coverEmoji:"🔥" },
];

const RECENT: MusicTrack[] = [
  { id:"r1", title:"Bongo Midnight",                   artist:"Diamond Next",         duration:"4:30", genre:"Bongo Flava", coverColor:"linear-gradient(135deg,#6366F1,#4F46E5)", coverEmoji:"🎶" },
  { id:"r2", title:"Congolese Dream",                  artist:"Fally New Wave",       duration:"5:05", genre:"Ndombolo",    coverColor:"linear-gradient(135deg,#F43F5E,#E11D48)", coverEmoji:"🎸" },
  { id:"r3", title:"Kinshasa Vibration",               artist:"Werrason Jr.",         duration:"4:48", genre:"Rumba",       coverColor:"linear-gradient(135deg,#14B8A6,#0D9488)", coverEmoji:"🥁" },
  { id:"r4", title:"Marrakech Trance",                 artist:"Hassan New Sound",     duration:"5:33", genre:"Gnawa",       coverColor:"linear-gradient(135deg,#D97706,#B45309)", coverEmoji:"🎺" },
  { id:"r5", title:"Bamako Blues",                     artist:"Toumani Modern",       duration:"4:17", genre:"Wassoulou",   coverColor:"linear-gradient(135deg,#64748B,#475569)", coverEmoji:"🎻" },
  { id:"r6", title:"Port-au-Prince Rising",            artist:"Sweet Micky Remix",    duration:"3:44", genre:"Compas",      coverColor:"linear-gradient(135deg,#BE185D,#9D174D)", coverEmoji:"🌺" },
];

const ALL = [...TRENDING, ...POPULAR, ...RECENT];

interface Props {
  onSelect: (track: MusicTrack) => void;
  onClose: () => void;
  initialTrack?: MusicTrack | null;
}

function EqBars({ active, color="#22C55E" }:{ active:boolean; color?:string }) {
  const heights = [10, 18, 12, 20, 8, 16, 10];
  return (
    <div style={{ display:"flex", gap:2, alignItems:"flex-end", height:22, flexShrink:0 }}>
      {heights.map((h,i)=>(
        <div key={i} style={{
          width:3, borderRadius:2, background:color, height:active?h:6,
          transition:`height ${200+i*40}ms ease-in-out`,
          animation: active ? `mlEq 0.7s ease-in-out infinite alternate` : "none",
          animationDelay:`${i*0.09}s`,
        }}/>
      ))}
    </div>
  );
}

function TrackRow({ track, active, onTap }:{
  track:MusicTrack; active:boolean; onTap:()=>void;
}) {
  const [pressed,setPressed] = useState(false);
  return (
    <button
      onClick={onTap}
      onPointerDown={()=>setPressed(true)}
      onPointerUp={()=>setPressed(false)}
      onPointerLeave={()=>setPressed(false)}
      style={{
        display:"flex", alignItems:"center", gap:14,
        padding:"10px 16px",
        background: pressed ? "rgba(34,197,94,0.07)" : active ? "rgba(34,197,94,0.06)" : "transparent",
        border:"none", cursor:"pointer", width:"100%", textAlign:"left",
        borderBottom:"1px solid rgba(255,255,255,0.04)",
        transition:"background 150ms",
      }}
    >
      {/* Album art */}
      <div style={{
        width:50, height:50, borderRadius:12, flexShrink:0,
        background:track.coverColor,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:22,
        boxShadow: active ? "0 4px 16px rgba(34,197,94,0.25)" : "0 2px 8px rgba(0,0,0,0.35)",
        border: active ? "2px solid rgba(34,197,94,0.5)" : "none",
        transition:"box-shadow 250ms, border 250ms",
      }}>
        {track.coverEmoji}
      </div>

      {/* Info */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{
          color: active ? "#22C55E" : "#F1F5F9",
          fontSize:14, fontWeight:active?700:500,
          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
          transition:"color 250ms",
        }}>{track.title}</div>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:2 }}>
          <span style={{ color:"#94A3B8", fontSize:12 }}>{track.artist}</span>
          <span style={{ color:"rgba(148,163,184,0.4)", fontSize:12 }}>·</span>
          <span style={{
            fontSize:11, color:"#64748B",
            background:"rgba(255,255,255,0.06)",
            borderRadius:4, padding:"1px 6px",
          }}>{track.genre}</span>
        </div>
      </div>

      {/* Right side */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6, flexShrink:0 }}>
        {active
          ? <EqBars active color="#22C55E"/>
          : <span style={{ color:"#64748B", fontSize:12 }}>{track.duration}</span>
        }
        {active && (
          <div style={{
            width:20, height:20, borderRadius:"50%",
            background:"linear-gradient(135deg,#22C55E,#16A34A)",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 2px 8px rgba(34,197,94,0.4)",
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
        )}
      </div>
    </button>
  );
}

export default function MusicLibraryPage({ onSelect, onClose, initialTrack }: Props) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string|null>(initialTrack?.id ?? null);
  const [tab, setTab] = useState<"trending"|"popular"|"recent">("trending");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const handleSelect = (track: MusicTrack) => {
    setActiveId(track.id);
    setTimeout(() => {
      setVisible(false);
      setTimeout(() => onSelect(track), 280);
    }, 180);
  };

  const filtered = query.trim()
    ? ALL.filter(t =>
        t.title.toLowerCase().includes(query.toLowerCase()) ||
        t.artist.toLowerCase().includes(query.toLowerCase()) ||
        t.genre.toLowerCase().includes(query.toLowerCase())
      )
    : null;

  const tabData: Record<string,MusicTrack[]> = { trending:TRENDING, popular:POPULAR, recent:RECENT };
  const tracks = filtered ?? tabData[tab];

  return (
    <div style={{
      position:"absolute", inset:0, zIndex:60,
      display:"flex", flexDirection:"column",
      background:"rgba(2,15,9,0.55)",
      backdropFilter:"blur(4px)",
      transition:"opacity 300ms ease",
      opacity: visible ? 1 : 0,
    }}>
      {/* Tap-outside to close */}
      <div style={{ flex:1, minHeight:60 }} onClick={handleClose}/>

      {/* Main sheet */}
      <div style={{
        background:"#071A0F",
        borderRadius:"28px 28px 0 0",
        height:"88vh",
        display:"flex", flexDirection:"column",
        transform: visible ? "translateY(0)" : "translateY(100%)",
        transition:"transform 300ms cubic-bezier(0.32,0.72,0,1)",
        boxShadow:"0 -20px 80px rgba(0,0,0,0.7)",
        overflow:"hidden",
        border:"1px solid rgba(255,255,255,0.07)",
        borderBottom:"none",
      }}>

        {/* Handle */}
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
            <h2 style={{ margin:0, color:"#F1F5F9", fontWeight:800, fontSize:18, letterSpacing:"-0.3px" }}>Bibliothèque musicale</h2>
            <p style={{ margin:0, color:"#64748B", fontSize:12, marginTop:1 }}>Ajouter une musique à ta story</p>
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

        {/* Search */}
        <div style={{ padding:"0 16px 14px" }}>
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
              placeholder="Rechercher un titre, artiste ou genre…"
              style={{
                flex:1, background:"none", border:"none", outline:"none",
                color:"#F1F5F9", fontSize:14, fontFamily:"inherit",
              }}
            />
            {query && (
              <button
                onClick={()=>setQuery("")}
                style={{ background:"none", border:"none", cursor:"pointer", color:"#64748B", padding:0, display:"flex" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            )}
          </div>
        </div>

        {/* Tabs (hidden when searching) */}
        {!query && (
          <div style={{ display:"flex", gap:0, padding:"0 16px 12px" }}>
            {(["trending","popular","recent"] as const).map(t => {
              const labels = { trending:"🔥 Tendances", popular:"⭐ Populaires", recent:"🆕 Récentes" };
              const active = tab === t;
              return (
                <button
                  key={t}
                  onClick={()=>setTab(t)}
                  style={{
                    flex:1, padding:"9px 0", border:"none", cursor:"pointer",
                    background: active ? "linear-gradient(135deg,#22C55E,#16A34A)" : "rgba(255,255,255,0.04)",
                    color: active ? "#fff" : "#64748B",
                    fontWeight: active ? 700 : 500, fontSize:12,
                    borderRadius: t==="trending" ? "12px 0 0 12px" : t==="recent" ? "0 12px 12px 0" : 0,
                    transition:"all 250ms",
                    boxShadow: active ? "0 4px 12px rgba(34,197,94,0.3)" : "none",
                  }}
                >
                  {labels[t]}
                </button>
              );
            })}
          </div>
        )}

        {/* Section label */}
        {query && (
          <div style={{ padding:"0 16px 8px" }}>
            <span style={{ color:"#64748B", fontSize:12, fontWeight:600 }}>
              {tracks.length} résultat{tracks.length!==1?"s":""} pour « {query} »
            </span>
          </div>
        )}

        {/* Track list */}
        <div style={{ flex:1, overflowY:"auto", scrollbarWidth:"none" }}>
          {tracks.length === 0 ? (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:200, gap:12 }}>
              <div style={{ fontSize:40 }}>🎵</div>
              <p style={{ color:"#64748B", fontSize:14, margin:0 }}>Aucun résultat trouvé</p>
            </div>
          ) : tracks.map(track => (
            <TrackRow
              key={track.id}
              track={track}
              active={activeId === track.id}
              onTap={()=>handleSelect(track)}
            />
          ))}
          <div style={{ height:32 }}/>
        </div>
      </div>

      <style>{`
        @keyframes mlEq {
          from { transform: scaleY(0.4); }
          to   { transform: scaleY(1.0); }
        }
      `}</style>
    </div>
  );
}
