import { useState, useRef } from "react";

interface Props {
  url: string;
  duration: number | null;
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function VoicePlayer({ url, duration }: Props) {
  const [playing, setPlaying]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent]   = useState(0);
  const [loaded, setLoaded]     = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const getAudio = () => {
    if (!audioRef.current) {
      const a = new Audio(url);
      a.preload = "metadata";
      a.onloadedmetadata = () => setLoaded(true);
      a.ontimeupdate = () => {
        setCurrent(a.currentTime);
        setProgress(a.duration ? a.currentTime / a.duration : 0);
      };
      a.onended = () => { setPlaying(false); setProgress(0); setCurrent(0); };
      audioRef.current = a;
    }
    return audioRef.current;
  };

  const togglePlay = () => {
    const a = getAudio();
    if (playing) { a.pause(); setPlaying(false); }
    else         { a.play().catch(() => {}); setPlaying(true); }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = getAudio();
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    if (a.duration) { a.currentTime = ratio * a.duration; }
  };

  const totalSec = (loaded && audioRef.current?.duration) ? audioRef.current.duration : (duration ?? 0);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f0f2f5", borderRadius: 20, padding: "7px 12px", minWidth: 200, maxWidth: "100%" }}>
      {/* Play/Pause */}
      <button
        onClick={togglePlay}
        style={{
          background: "#42B72A", border: "none", borderRadius: "50%",
          width: 34, height: 34, cursor: "pointer", color: "#fff",
          fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}
        aria-label={playing ? "Pause" : "Lire"}
      >
        {playing ? "⏸" : "▶"}
      </button>

      {/* Waveform bar */}
      <div
        onClick={seek}
        title="Chercher"
        style={{ flex: 1, height: 6, background: "#d0d2d8", borderRadius: 4, overflow: "hidden", cursor: "pointer", position: "relative" }}
      >
        <div style={{ height: "100%", width: `${progress * 100}%`, background: "#42B72A", borderRadius: 4, transition: playing ? "width 0.1s linear" : "none" }} />
      </div>

      {/* Duration */}
      <span style={{ fontSize: 12, color: "#65676b", fontWeight: 600, minWidth: 36, textAlign: "right", flexShrink: 0 }}>
        {playing ? fmtTime(current) : fmtTime(totalSec)}
      </span>
    </div>
  );
}
