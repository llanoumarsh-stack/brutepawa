import { useState, useRef, useEffect, useCallback } from "react";

export interface VoiceRecorderProps {
  onSend: (blob: Blob, duration: number) => Promise<void>;
  onCancel?: () => void;
  disabled?: boolean;
}

type RecordState = "idle" | "recording" | "preview";

const MAX_DURATION = 60;

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function VoiceRecorder({ onSend, onCancel, disabled }: VoiceRecorderProps) {
  const [state, setState] = useState<RecordState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRef     = useRef<MediaRecorder | null>(null);
  const chunksRef    = useRef<Blob[]>([]);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const audioRef     = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      startTimeRef.current = Date.now();
      setElapsed(0);

      // Pick best supported codec (Opus > AAC > default)
      const mimeType = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"].find(
        m => MediaRecorder.isTypeSupported(m)
      ) ?? "";

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRef.current = mr;

      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const recorded = Math.round((Date.now() - startTimeRef.current) / 1000);
        const finalDuration = Math.min(recorded, MAX_DURATION);
        const b = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        setBlob(b);
        setDuration(finalDuration);
        setState("preview");
      };

      mr.start(250);
      setState("recording");

      timerRef.current = setInterval(() => {
        const s = Math.round((Date.now() - startTimeRef.current) / 1000);
        setElapsed(s);
        if (s >= MAX_DURATION) stopRecording();
      }, 500);

    } catch {
      setError("Microphone non accessible. Vérifiez les autorisations.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    stopTimer();
    mediaRef.current?.stop();
  }, []);

  const cancelRecording = useCallback(() => {
    stopTimer();
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.stream?.getTracks().forEach(t => t.stop());
      mediaRef.current.ondataavailable = null;
      mediaRef.current.onstop = null;
      mediaRef.current.stop();
    }
    setBlob(null);
    setElapsed(0);
    setState("idle");
    onCancel?.();
  }, [onCancel]);

  const togglePlay = () => {
    if (!blob) return;
    if (!audioRef.current) {
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      audioRef.current = a;
      a.onended = () => { setPlaying(false); setProgress(0); };
      a.ontimeupdate = () => { setProgress(a.duration ? a.currentTime / a.duration : 0); };
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setPlaying(true);
    }
  };

  const handleSend = async () => {
    if (!blob || sending) return;
    setSending(true);
    try {
      await onSend(blob, duration);
      setBlob(null);
      setDuration(0);
      setState("idle");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur envoi");
    } finally {
      setSending(false);
    }
  };

  const discard = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setBlob(null);
    setDuration(0);
    setPlaying(false);
    setProgress(0);
    setState("idle");
  };

  useEffect(() => () => { stopTimer(); }, []);

  if (state === "idle") {
    return (
      <button
        onClick={startRecording}
        disabled={disabled}
        title="Enregistrer un vocal"
        style={{
          background: "none", border: "none", cursor: disabled ? "not-allowed" : "pointer",
          color: "#65676b", fontSize: 20, padding: "6px 6px", lineHeight: 1, opacity: disabled ? 0.4 : 1,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}
      >🎤</button>
    );
  }

  if (state === "recording") {
    const pct = Math.min((elapsed / MAX_DURATION) * 100, 100);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
        {/* Red pulsing dot */}
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#e53935", animation: "voicePulse 1s ease-in-out infinite", flexShrink: 0 }} />
        {/* Timer */}
        <span style={{ fontWeight: 700, fontSize: 14, color: "#e53935", minWidth: 38 }}>{fmtTime(elapsed)}</span>
        {/* Bar */}
        <div style={{ flex: 1, height: 4, background: "#e4e6eb", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "#e53935", borderRadius: 4, transition: "width 0.5s linear" }} />
        </div>
        {/* Stop */}
        <button
          onClick={stopRecording}
          title="Arrêter"
          style={{ background: "#e53935", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", color: "#fff", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >■</button>
        {/* Cancel */}
        <button onClick={cancelRecording} style={{ background: "none", border: "none", cursor: "pointer", color: "#65676b", fontSize: 18, padding: "0 4px" }}>✕</button>
      </div>
    );
  }

  // preview
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
      {/* Player row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f0f2f5", borderRadius: 20, padding: "6px 10px" }}>
        <button
          onClick={togglePlay}
          style={{ background: "#42B72A", border: "none", borderRadius: "50%", width: 34, height: 34, cursor: "pointer", color: "#fff", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >{playing ? "⏸" : "▶"}</button>
        <div style={{ flex: 1, height: 4, background: "#ccc", borderRadius: 4, overflow: "hidden", cursor: "pointer" }}>
          <div style={{ height: "100%", width: `${progress * 100}%`, background: "#42B72A", borderRadius: 4, transition: "width 0.1s" }} />
        </div>
        <span style={{ fontSize: 12, color: "#65676b", minWidth: 34, textAlign: "right" }}>{fmtTime(duration)}</span>
      </div>

      {error && <div style={{ fontSize: 12, color: "#e53935", paddingLeft: 4 }}>{error}</div>}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={discard}
          style={{ background: "#f0f2f5", border: "none", borderRadius: 20, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#65676b" }}
        >🗑 Supprimer</button>
        <button
          onClick={handleSend}
          disabled={sending}
          style={{ background: sending ? "#ccc" : "#42B72A", border: "none", borderRadius: 20, padding: "6px 16px", cursor: sending ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, color: "#fff" }}
        >{sending ? "Envoi…" : "➤ Envoyer"}</button>
      </div>
    </div>
  );
}
