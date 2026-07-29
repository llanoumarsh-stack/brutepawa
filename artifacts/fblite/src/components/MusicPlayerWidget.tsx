import { useState, useEffect, useRef } from "react";

// 56 barres — pattern waveform réaliste
const WAVE_BARS = [
  4,6,9,13,18,23,30,35,38,34,28,22,32,37,40,37,30,24,19,27,
  33,38,36,30,24,19,15,21,28,34,39,40,37,31,25,20,29,36,40,38,
  32,25,19,15,11,15,21,30,37,40,37,31,24,19,7,4,
];

interface Props {
  trackName: string;
  artist?: string | null;
  artworkUrl?: string | null;
  duration?: string | null; // "3:28"
}

function parseTotal(d: string | null | undefined): number {
  if (!d) return 208;
  const p = d.split(":").map(Number);
  return p.length === 2 ? p[0] * 60 + p[1] : 208;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function MusicPlayerWidget({ trackName, artist, artworkUrl, duration }: Props) {
  const total   = parseTotal(duration);
  const [playing, setPlaying] = useState(false);
  const [cur,     setCur]     = useState(0);
  const [liked,   setLiked]   = useState(false);
  const iv = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (playing) {
      iv.current = setInterval(() =>
        setCur(s => { if (s >= total) { setPlaying(false); return 0; } return s + 1; }), 1000);
    } else {
      if (iv.current) clearInterval(iv.current);
    }
    return () => { if (iv.current) clearInterval(iv.current); };
  }, [playing, total]);

  const pct = total > 0 ? cur / total : 0;

  return (
    <>
      <style>{`
        @keyframes bp-wave {
          from { transform: scaleY(1); }
          to   { transform: scaleY(1.55); }
        }
        @keyframes bp-glow {
          0%,100% { box-shadow: 0 0 0 3px rgba(139,92,246,.20), 0 0 18px rgba(139,92,246,.55); }
          50%     { box-shadow: 0 0 0 5px rgba(139,92,246,.30), 0 0 28px rgba(139,92,246,.75); }
        }
      `}</style>

      <div style={{
        margin: "10px 14px 14px",
        background: "#160720",
        borderRadius: 14,
        border: "1px solid rgba(168,85,247,.28)",
        boxShadow: "0 0 0 1px rgba(168,85,247,.08), 0 8px 32px rgba(139,92,246,.20)",
        padding: "14px 14px 12px",
        overflow: "hidden",
      }}>

        {/* ── Top : artwork | info | heart ── */}
        <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>

          {/* Artwork */}
          {artworkUrl ? (
            <img src={artworkUrl} alt="" style={{
              width: 82, height: 82, borderRadius: 10,
              objectFit: "cover", flexShrink: 0, display: "block",
            }} />
          ) : (
            <div style={{
              width: 82, height: 82, borderRadius: 10, flexShrink: 0,
              background: "linear-gradient(160deg,#C4472A 0%,#8B3010 45%,#5C1A06 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28,
            }}>🎵</div>
          )}

          {/* Info + waveform */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Title */}
            <div style={{
              fontWeight: 700, fontSize: 14.5, color: "#FFFFFF",
              lineHeight: 1.3, marginBottom: 3,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>{trackName}</div>

            {/* Artist + verified */}
            {artist && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, color: "#9CA3AF", marginBottom: 8 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{artist}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#3B82F6" style={{ flexShrink: 0 }}>
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
            )}

            {/* Waveform */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 1.5, height: 36 }}>
              {WAVE_BARS.map((h, i) => {
                const bp      = i / WAVE_BARS.length;
                const active  = bp <= pct;
                const nearTip = playing && Math.abs(bp - pct) < 0.06;
                return (
                  <div key={i} style={{
                    width: 2.5,
                    height: Math.round(h * 0.88),
                    borderRadius: 2,
                    background: active
                      ? (nearTip ? "#C084FC" : "#A855F7")
                      : "rgba(139,92,246,.22)",
                    flexShrink: 0,
                    transformOrigin: "center bottom",
                    animation: nearTip
                      ? `bp-wave ${.38 + (i % 5) * .06}s ease-in-out infinite alternate`
                      : "none",
                  }} />
                );
              })}
            </div>
          </div>

          {/* Heart */}
          <button onClick={() => setLiked(l => !l)} style={{
            background: "none", border: "none", cursor: "pointer",
            padding: 2, flexShrink: 0, alignSelf: "flex-start",
          }}>
            <svg width="21" height="21" viewBox="0 0 24 24"
              fill={liked ? "#A855F7" : "none"}
              stroke={liked ? "#A855F7" : "rgba(168,85,247,.55)"}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
        </div>

        {/* ── Progress bar ── */}
        <div style={{ marginBottom: 8 }}>
          <div
            style={{ position: "relative", height: 3, background: "rgba(139,92,246,.18)", borderRadius: 3, cursor: "pointer" }}
            onClick={e => {
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              setCur(Math.max(0, Math.min(total, Math.round(((e.clientX - rect.left) / rect.width) * total))));
            }}
          >
            <div style={{
              height: "100%", width: `${pct * 100}%`,
              background: "#8B5CF6", borderRadius: 3,
              transition: "width .8s linear",
            }} />
            <div style={{
              position: "absolute", top: "50%", left: `${pct * 100}%`,
              transform: "translate(-50%,-50%)",
              width: 11, height: 11, borderRadius: "50%",
              background: "#FFFFFF",
              boxShadow: "0 0 0 2px rgba(139,92,246,.4), 0 0 10px rgba(139,92,246,.8)",
              pointerEvents: "none",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7, fontSize: 11, color: "#6B7280", fontWeight: 500 }}>
            <span>{fmt(cur)}</span>
            <span>{fmt(total)}</span>
          </div>
        </div>

        {/* ── Controls ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 2px 0" }}>

          {/* Shuffle */}
          <button style={{ background: "none", border: "none", cursor: "pointer", padding: 8, color: "#7C3AED", display: "flex" }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 3 21 3 21 8"/>
              <line x1="4" y1="20" x2="21" y2="3"/>
              <polyline points="21 16 21 21 16 21"/>
              <line x1="15" y1="15" x2="21" y2="21"/>
            </svg>
          </button>

          {/* Skip back */}
          <button onClick={() => setCur(0)} style={{ background: "none", border: "none", cursor: "pointer", padding: 8, color: "#FFFFFF", display: "flex" }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="19 20 9 12 19 4 19 20"/>
              <line x1="5" y1="19" x2="5" y2="5"/>
            </svg>
          </button>

          {/* Play / Pause */}
          <button
            onClick={() => setPlaying(p => !p)}
            style={{
              width: 54, height: 54, borderRadius: "50%",
              background: "transparent",
              border: "2px solid #8B5CF6",
              animation: playing ? "bp-glow 2s ease-in-out infinite" : "none",
              boxShadow: playing
                ? "0 0 0 3px rgba(139,92,246,.20), 0 0 20px rgba(139,92,246,.60)"
                : "0 0 8px rgba(139,92,246,.30)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#FFFFFF", flexShrink: 0,
              transition: "box-shadow .25s ease",
            }}
          >
            {playing ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <rect x="6" y="4" width="4" height="16" rx="1"/>
                <rect x="14" y="4" width="4" height="16" rx="1"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <polygon points="6 3 20 12 6 21 6 3"/>
              </svg>
            )}
          </button>

          {/* Skip forward */}
          <button onClick={() => setCur(s => Math.min(s + 30, total))} style={{ background: "none", border: "none", cursor: "pointer", padding: 8, color: "#FFFFFF", display: "flex" }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 4 15 12 5 20 5 4"/>
              <line x1="19" y1="5" x2="19" y2="19"/>
            </svg>
          </button>

          {/* Repeat */}
          <button style={{ background: "none", border: "none", cursor: "pointer", padding: 8, color: "#7C3AED", display: "flex" }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9"/>
              <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
              <polyline points="7 23 3 19 7 15"/>
              <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
