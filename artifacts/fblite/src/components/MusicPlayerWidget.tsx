import { useState, useEffect, useRef } from "react";
import { apiToggleMusicLike } from "../lib/api";

// 56 barres — pattern waveform réaliste calqué sur la maquette
const WAVE_BARS = [
  4,6,9,13,18,23,30,35,38,34,28,22,32,37,40,37,30,24,19,27,
  33,38,36,30,24,19,15,21,28,34,39,40,37,31,25,20,29,36,40,38,
  32,25,19,15,11,15,21,30,37,40,37,31,24,19,7,4,
];

interface Props {
  trackName: string;
  artist?: string | null;
  artworkUrl?: string | null;
  duration?: string | null;
  glassmorphism?: boolean;
  audioLikes?: number;
  postId?: number;
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

function fmtK(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(".", ",") + "K";
  return String(n);
}

export default function MusicPlayerWidget({
  trackName, artist, artworkUrl, duration, glassmorphism,
  audioLikes = 0, postId,
}: Props) {
  const total = parseTotal(duration);
  const [playing,    setPlaying]    = useState(false);
  const [cur,        setCur]        = useState(0);
  const [audioLiked, setAudioLiked] = useState(false);
  const [likeCount,  setLikeCount]  = useState(audioLikes);
  const [heartAnim,  setHeartAnim]  = useState(false);
  const [haloAnim,   setHaloAnim]   = useState(false);
  const iv = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setLikeCount(audioLikes); }, [audioLikes]);

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

  const handleAudioLike = async () => {
    const wasLiked = audioLiked;
    setAudioLiked(!wasLiked);
    setLikeCount(c => wasLiked ? Math.max(0, c - 1) : c + 1);
    setHeartAnim(true); setHaloAnim(true);
    setTimeout(() => setHeartAnim(false), 500);
    setTimeout(() => setHaloAnim(false), 600);
    if (postId) {
      try {
        const res = await apiToggleMusicLike(postId);
        setAudioLiked(res.liked);
        setLikeCount(res.musicLikesCount);
      } catch {
        setAudioLiked(wasLiked);
        setLikeCount(c => wasLiked ? c + 1 : Math.max(0, c - 1));
      }
    }
  };

  // ─── Toutes les dimensions réduites de 25% (×0.75) par rapport à la maquette ───
  const S = {
    // card
    cardRadius:     11,   // 14 × 0.75
    cardPad:        "10px 10px 9px",  // 14→10, 12→9
    cardMargin:     "8px 10px 10px",  // 10→8, 14→10
    cardMarginGlass:"8px 8px 8px",
    cardPadGlass:   "9px 9px 8px",
    // artwork
    art:            64,   // 86 × 0.75 ≈ 64
    artRadius:      8,    // 10 × 0.75
    // typography
    titleSize:      11,   // 14.5 × 0.75 ≈ 11
    artistSize:     9.5,  // 12.5 × 0.75
    badgeSize:      11,   // 14 × 0.75
    timeSize:       8.5,  // 11 × 0.75
    counterSize:    10.5, // 13.5 × 0.75
    labelSize:      7.5,  // 10 × 0.75
    // waveform
    waveHeight:     27,   // 36 × 0.75
    barWidth:       2,    // 2.5 × 0.75
    barGap:         1,    // 1.5 × 0.75
    // progress
    progressH:      2,    // 3 × 0.75
    thumb:          8,    // 11 × 0.75
    progressMT:     5,    // 7 × 0.75
    // controls
    playBtn:        40,   // 54 × 0.75 ≈ 40
    iconSize:       16,   // 21 × 0.75 ≈ 16
    iconPad:        6,    // 8 × 0.75
    heartIcon:      15,   // 20 × 0.75
    // gaps
    topGap:         8,    // 10 × 0.75
    topMB:          8,    // 10 × 0.75
    artistMB:       6,    // 8 × 0.75
    counterMinW:    46,   // 62 × 0.75
  };

  const cardStyle = glassmorphism ? {
    margin: S.cardMarginGlass,
    background: "rgba(14,4,30,0.52)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    borderRadius: S.cardRadius,
    border: "1px solid rgba(255,255,255,0.13)",
    boxShadow: "0 4px 24px rgba(0,0,0,0.40)",
    padding: S.cardPadGlass,
    overflow: "hidden" as const,
  } : {
    margin: S.cardMargin,
    background: "#160720",
    borderRadius: S.cardRadius,
    border: "1px solid rgba(168,85,247,.28)",
    boxShadow: "0 0 0 1px rgba(168,85,247,.08), 0 6px 24px rgba(139,92,246,.20)",
    padding: S.cardPad,
    overflow: "hidden" as const,
  };

  return (
    <>
      <style>{`
        @keyframes bp-wave {
          from { transform: scaleY(1); }
          to   { transform: scaleY(1.55); }
        }
        @keyframes bp-glow {
          0%,100% { box-shadow: 0 0 0 2px rgba(139,92,246,.20), 0 0 14px rgba(139,92,246,.55); }
          50%     { box-shadow: 0 0 0 4px rgba(139,92,246,.30), 0 0 22px rgba(139,92,246,.75); }
        }
        @keyframes bp-heart-pop {
          0%   { transform: scale(1); }
          35%  { transform: scale(1.45); }
          65%  { transform: scale(0.88); }
          100% { transform: scale(1); }
        }
        @keyframes bp-halo {
          0%   { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(2.8); opacity: 0; }
        }
      `}</style>

      <div style={cardStyle}>

        {/* ── Top row : artwork | title+artist+waveform | audio-like counter ── */}
        <div style={{ display: "flex", gap: S.topGap, marginBottom: S.topMB, alignItems: "flex-start" }}>

          {/* Artwork */}
          {artworkUrl ? (
            <img src={artworkUrl} alt="" style={{
              width: S.art, height: S.art, borderRadius: S.artRadius,
              objectFit: "cover", flexShrink: 0, display: "block",
            }} />
          ) : (
            <div style={{
              width: S.art, height: S.art, borderRadius: S.artRadius, flexShrink: 0,
              background: "linear-gradient(160deg,#C4472A 0%,#8B3010 45%,#5C1A06 100%)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
            }}>🎵</div>
          )}

          {/* Title + artist + waveform */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 700, fontSize: S.titleSize, color: "#FFFFFF",
              lineHeight: 1.3, marginBottom: 2,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>{trackName}</div>

            {artist && (
              <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: S.artistSize, color: "#9CA3AF", marginBottom: S.artistMB }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{artist}</span>
                <svg width={S.badgeSize} height={S.badgeSize} viewBox="0 0 24 24" fill="#3B82F6" style={{ flexShrink: 0 }}>
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
            )}

            {/* Waveform 56 barres */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: S.barGap, height: S.waveHeight }}>
              {WAVE_BARS.map((h, i) => {
                const bp      = i / WAVE_BARS.length;
                const active  = bp <= pct;
                const nearTip = playing && Math.abs(bp - pct) < 0.06;
                return (
                  <div key={i} style={{
                    width: S.barWidth,
                    height: Math.round(h * 0.66),  // 0.88×0.75 = 0.66
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

          {/* ── Audio Like Counter ── */}
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", flexShrink: 0,
            gap: 1, minWidth: S.counterMinW,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {haloAnim && (
                  <div style={{
                    position: "absolute", inset: -2, borderRadius: "50%",
                    background: "rgba(168,85,247,0.45)",
                    animation: "bp-halo 0.55s ease-out forwards",
                    pointerEvents: "none",
                  }} />
                )}
                <button onClick={handleAudioLike} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
                  <svg
                    width={S.heartIcon} height={S.heartIcon} viewBox="0 0 24 24"
                    fill={audioLiked ? "#A855F7" : "none"}
                    stroke={audioLiked ? "#A855F7" : "rgba(168,85,247,.6)"}
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{
                      animation: heartAnim ? "bp-heart-pop 0.45s cubic-bezier(.36,.07,.19,.97)" : "none",
                      filter: audioLiked ? "drop-shadow(0 0 4px rgba(168,85,247,0.7))" : "none",
                      transition: "fill .15s ease, filter .15s ease",
                    }}
                  >
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                </button>
              </div>
              <span style={{ fontSize: S.counterSize, fontWeight: 700, color: "#FFFFFF", lineHeight: 1 }}>
                {fmtK(likeCount)}
              </span>
            </div>
            <span style={{ fontSize: S.labelSize, color: "#9CA3AF", textAlign: "center", lineHeight: 1.3, whiteSpace: "nowrap" }}>
              personnes ont aimé
            </span>
          </div>
        </div>

        {/* ── Barre de progression ── */}
        <div style={{ marginBottom: 6 }}>
          <div
            style={{ position: "relative", height: S.progressH, background: "rgba(139,92,246,.18)", borderRadius: 2, cursor: "pointer" }}
            onClick={e => {
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              setCur(Math.max(0, Math.min(total, Math.round(((e.clientX - rect.left) / rect.width) * total))));
            }}
          >
            <div style={{
              height: "100%", width: `${pct * 100}%`,
              background: "#8B5CF6", borderRadius: 2,
              transition: "width .8s linear",
            }} />
            <div style={{
              position: "absolute", top: "50%", left: `${pct * 100}%`,
              transform: "translate(-50%,-50%)",
              width: S.thumb, height: S.thumb, borderRadius: "50%",
              background: "#FFFFFF",
              boxShadow: "0 0 0 2px rgba(139,92,246,.4), 0 0 8px rgba(139,92,246,.8)",
              pointerEvents: "none",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: S.progressMT, fontSize: S.timeSize, color: "#6B7280", fontWeight: 500 }}>
            <span>{fmt(cur)}</span>
            <span>{fmt(total)}</span>
          </div>
        </div>

        {/* ── Contrôles ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3px 1px 0" }}>

          {/* Shuffle */}
          <button style={{ background: "none", border: "none", cursor: "pointer", padding: S.iconPad, color: "#7C3AED", display: "flex" }}>
            <svg width={S.iconSize} height={S.iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 3 21 3 21 8"/>
              <line x1="4" y1="20" x2="21" y2="3"/>
              <polyline points="21 16 21 21 16 21"/>
              <line x1="15" y1="15" x2="21" y2="21"/>
            </svg>
          </button>

          {/* Précédent */}
          <button onClick={() => setCur(0)} style={{ background: "none", border: "none", cursor: "pointer", padding: S.iconPad, color: "#FFFFFF", display: "flex" }}>
            <svg width={S.iconSize} height={S.iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="19 20 9 12 19 4 19 20"/>
              <line x1="5" y1="19" x2="5" y2="5"/>
            </svg>
          </button>

          {/* Play / Pause */}
          <button
            onClick={() => setPlaying(p => !p)}
            style={{
              width: S.playBtn, height: S.playBtn, borderRadius: "50%",
              background: "transparent",
              border: "2px solid #8B5CF6",
              animation: playing ? "bp-glow 2s ease-in-out infinite" : "none",
              boxShadow: playing
                ? "0 0 0 2px rgba(139,92,246,.20), 0 0 16px rgba(139,92,246,.60)"
                : "0 0 6px rgba(139,92,246,.30)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#FFFFFF", flexShrink: 0,
              transition: "box-shadow .25s ease",
            }}
          >
            {playing ? (
              <svg width={15} height={15} viewBox="0 0 24 24" fill="white">
                <rect x="6" y="4" width="4" height="16" rx="1"/>
                <rect x="14" y="4" width="4" height="16" rx="1"/>
              </svg>
            ) : (
              <svg width={15} height={15} viewBox="0 0 24 24" fill="white">
                <polygon points="6 3 20 12 6 21 6 3"/>
              </svg>
            )}
          </button>

          {/* Suivant */}
          <button onClick={() => setCur(s => Math.min(s + 30, total))} style={{ background: "none", border: "none", cursor: "pointer", padding: S.iconPad, color: "#FFFFFF", display: "flex" }}>
            <svg width={S.iconSize} height={S.iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 4 15 12 5 20 5 4"/>
              <line x1="19" y1="5" x2="19" y2="19"/>
            </svg>
          </button>

          {/* Repeat */}
          <button style={{ background: "none", border: "none", cursor: "pointer", padding: S.iconPad, color: "#7C3AED", display: "flex" }}>
            <svg width={S.iconSize} height={S.iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
