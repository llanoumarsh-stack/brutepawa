import { useState, useEffect, useRef, useCallback } from "react";
import { getBpToken } from "../lib/api";

const BASE = "/api";

// ─── ICE servers ─────────────────────────────────────────────────────────────
// STUN (free) + public TURN relay as fallback for symmetric NAT (MTN/Orange/Moov).
// Replace open-relay credentials with Cloudflare Calls TURN when CF_TURN_KEY_ID
// is configured via the /api/turn-credentials endpoint.
const DEFAULT_ICE: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  {
    urls: [
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
      "turn:openrelay.metered.ca:443?transport=tcp",
    ],
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const token = getBpToken();
    const res = await fetch(`${BASE}/turn-credentials`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.ok) {
      const data = await res.json() as { iceServers?: RTCIceServer[] };
      if (data.iceServers?.length) return data.iceServers;
    }
  } catch { /* fall through */ }
  return DEFAULT_ICE;
}

// ─── Ringtone (plays through loudspeaker on mobile) ──────────────────────────
let _ringtoneCtx: AudioContext | null = null;
let _ringtoneNode: OscillatorNode | null = null;
let _ringtoneGain: GainNode | null = null;
let _ringtoneTimer: ReturnType<typeof setTimeout> | null = null;
let _ringtonePlaying = false;

function playRingtone() {
  if (_ringtonePlaying) return;
  _ringtonePlaying = true;
  try {
    const ctx = new AudioContext();
    _ringtoneCtx = ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.6;
    gain.connect(ctx.destination);
    _ringtoneGain = gain;

    function beep() {
      if (!_ringtonePlaying) return;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 480;
      osc.connect(gain);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
      _ringtoneNode = osc;
      _ringtoneTimer = setTimeout(() => { if (_ringtonePlaying) beep(); }, 1800);
    }
    beep();
  } catch { /* ignore if AudioContext unavailable */ }
}

function stopRingtone() {
  _ringtonePlaying = false;
  if (_ringtoneTimer) { clearTimeout(_ringtoneTimer); _ringtoneTimer = null; }
  try { _ringtoneNode?.stop(); } catch { /* ignore */ }
  try { _ringtoneCtx?.close(); } catch { /* ignore */ }
  _ringtoneCtx = null;
  _ringtoneNode = null;
  _ringtoneGain = null;
}

// ─── Media constraints ───────────────────────────────────────────────────────
// Start at 480p (good quality, reasonable bandwidth for 4G Africa).
// Browser will negotiate down if bandwidth is insufficient.
async function getMedia(type: "audio" | "video"): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 48000,
      channelCount: 1,
    },
    video: type === "video"
      ? {
          facingMode: "user",
          width:     { ideal: 640, max: 1280 },
          height:    { ideal: 480, max: 720 },
          frameRate: { ideal: 24, max: 30 },
        }
      : false,
  });
}

export type CallState = "idle" | "calling" | "incoming" | "active";

export interface IncomingCallInfo {
  fromUserId: number;
  callType: "audio" | "video";
}

export interface NewMessagePayload {
  id: number;
  fromUserId: number;
  toUserId: number;
  content: string;
  createdAt: string;
}

async function postSignal(to: number, type: string, payload: unknown = {}) {
  const token = getBpToken();
  try {
    await fetch(`${BASE}/signaling/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ to, type, payload }),
    });
  } catch { /* network error */ }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useCallSignaling(
  meId: number,
  onNewMessage?: (msg: NewMessagePayload) => void,
) {
  const [callState, setCallState]       = useState<CallState>("idle");
  const [callType, setCallType]         = useState<"audio" | "video" | null>(null);
  const [callPeerId, setCallPeerId]     = useState<number | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallInfo | null>(null);
  const [localStream, setLocalStream]   = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted]           = useState(false);
  const [isSpeaker, setIsSpeaker]       = useState(true);
  const [cameraFront, setCameraFront]   = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [mediaError, setMediaError]     = useState<string | null>(null);

  const pcRef             = useRef<RTCPeerConnection | null>(null);
  const localStreamRef    = useRef<MediaStream | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const callTimerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStateRef      = useRef<CallState>("idle");
  const callPeerIdRef     = useRef<number | null>(null);
  const handleSignalRef   = useRef<((msg: SignalMsg) => Promise<void>) | null>(null);
  const isMutedRef        = useRef(false);
  const onNewMessageRef   = useRef(onNewMessage);
  const iceServersRef     = useRef<RTCIceServer[]>(DEFAULT_ICE);

  useEffect(() => { onNewMessageRef.current = onNewMessage; }, [onNewMessage]);

  // Prefetch ICE servers (may include Cloudflare TURN)
  useEffect(() => {
    fetchIceServers().then((servers) => { iceServersRef.current = servers; });
  }, []);

  interface SignalMsg {
    type: string;
    from: number;
    payload: Record<string, unknown>;
  }

  const _setCallState  = (s: CallState)     => { callStateRef.current = s; setCallState(s); };
  const _setCallPeerId = (id: number | null) => { callPeerIdRef.current = id; setCallPeerId(id); };

  const stopTimer = useCallback(() => {
    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
    setCallDuration(0);
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
  }, [stopTimer]);

  const stopLocal = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
  }, []);

  const cleanup = useCallback(() => {
    stopRingtone();
    stopTimer();
    stopLocal();
    pcRef.current?.close();
    pcRef.current = null;
    pendingCandidates.current = [];
    setRemoteStream(null);
    _setCallState("idle");
    _setCallPeerId(null);
    setCallType(null);
    setIncomingCall(null);
    isMutedRef.current = false;
    setIsMuted(false);
    setIsSpeaker(true);
    setCameraFront(true);
    setMediaError(null);
  }, [stopTimer, stopLocal]);

  // ─── Limit video bitrate after connection ──────────────────────────────────
  function applyBitrateLimit(pc: RTCPeerConnection) {
    pc.getSenders().forEach(async (sender) => {
      if (sender.track?.kind !== "video") return;
      const params = sender.getParameters();
      if (!params.encodings?.length) params.encodings = [{}];
      params.encodings[0].maxBitrate = 600_000; // 600 kbps max for video
      params.encodings[0].scaleResolutionDownBy = 1;
      try { await sender.setParameters(params); } catch { /* ignore */ }
    });
    pc.getSenders().forEach(async (sender) => {
      if (sender.track?.kind !== "audio") return;
      const params = sender.getParameters();
      if (!params.encodings?.length) params.encodings = [{}];
      params.encodings[0].maxBitrate = 64_000; // 64 kbps for audio (Opus)
      try { await sender.setParameters(params); } catch { /* ignore */ }
    });
  }

  const buildPC = useCallback((stream: MediaStream): RTCPeerConnection => {
    pcRef.current?.close();
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
    pcRef.current = pc;

    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    const remote = new MediaStream();
    pc.ontrack = e => {
      e.streams[0]?.getTracks().forEach(t => {
        if (!remote.getTracks().find(x => x.id === t.id)) remote.addTrack(t);
      });
      // Keep the SAME MediaStream object — React will only trigger a re-render
      // on the first call (null → remote). Subsequent ontrack events (audio/video)
      // mutate `remote` in-place; the <video> srcObject picks up new tracks
      // automatically without needing a re-assignment, preventing black flashes.
      setRemoteStream(prev => (prev === remote ? remote : remote));
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") applyBitrateLimit(pc);
    };

    return pc;
  }, []);

  const drainCandidates = useCallback(async (pc: RTCPeerConnection) => {
    const pending = pendingCandidates.current.splice(0);
    for (const c of pending) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ }
    }
  }, []);

  const handleSignal = useCallback(async (msg: SignalMsg) => {
    const { type, from, payload } = msg;

    if (type === "call:invite") {
      if (callStateRef.current !== "idle") {
        await postSignal(from, "call:reject", { reason: "busy" });
        return;
      }
      const ct = (payload.callType as "audio" | "video") ?? "audio";
      setIncomingCall({ fromUserId: from, callType: ct });
      _setCallPeerId(from);
      setCallType(ct);
      _setCallState("incoming");
      playRingtone();
      return;
    }

    if (type === "call:accept") {
      stopRingtone();
      const stream = localStreamRef.current;
      if (!stream) return;

      const pc = buildPC(stream);
      pc.onicecandidate = ({ candidate }) => {
        if (candidate && callPeerIdRef.current !== null)
          postSignal(callPeerIdRef.current, "call:ice", { candidate: candidate.toJSON() });
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await postSignal(from, "call:offer", { sdp: pc.localDescription });
      return;
    }

    if (type === "call:offer") {
      stopRingtone();
      const stream = localStreamRef.current;
      const pc     = pcRef.current;
      if (!stream || !pc) return;

      pc.onicecandidate = ({ candidate }) => {
        if (candidate && callPeerIdRef.current !== null)
          postSignal(callPeerIdRef.current, "call:ice", { candidate: candidate.toJSON() });
      };

      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp as RTCSessionDescriptionInit));
      await drainCandidates(pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await postSignal(from, "call:answer", { sdp: pc.localDescription });
      _setCallState("active");
      startTimer();
      return;
    }

    if (type === "call:answer") {
      stopRingtone();
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp as RTCSessionDescriptionInit));
      await drainCandidates(pc);
      _setCallState("active");
      startTimer();
      return;
    }

    if (type === "call:ice") {
      const pc        = pcRef.current;
      const candidate = payload.candidate as RTCIceCandidateInit;
      if (pc && pc.remoteDescription) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch { /* ignore */ }
      } else {
        pendingCandidates.current.push(candidate);
      }
      return;
    }

    if (type === "call:reject" || type === "call:end") {
      cleanup();
      return;
    }
  }, [buildPC, drainCandidates, startTimer, cleanup]);

  useEffect(() => { handleSignalRef.current = handleSignal; }, [handleSignal]);

  // ─── SSE listener with auto-reconnect ─────────────────────────────────────
  useEffect(() => {
    if (!meId) return;
    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;
    let retryDelay = 1000;

    function connect() {
      if (destroyed) return;
      const token = getBpToken();
      if (!token) return;

      es = new EventSource(`${BASE}/signaling/listen?token=${encodeURIComponent(token)}`);

      es.addEventListener("signal", (e: MessageEvent) => {
        retryDelay = 1000;
        try { handleSignalRef.current?.(JSON.parse(e.data) as SignalMsg); } catch { /* ignore */ }
      });

      es.addEventListener("message:new", (e: MessageEvent) => {
        retryDelay = 1000;
        try { onNewMessageRef.current?.(JSON.parse(e.data) as NewMessagePayload); } catch { /* ignore */ }
      });

      es.addEventListener("connected", () => { retryDelay = 1000; });

      es.onerror = () => {
        es?.close();
        es = null;
        if (destroyed) return;
        retryDelay = Math.min(retryDelay * 2, 30_000);
        retryTimeout = setTimeout(connect, retryDelay);
      };
    }

    connect();

    return () => {
      destroyed = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      es?.close();
    };
  }, [meId]);

  const startCall = useCallback(async (toUserId: number, type: "audio" | "video") => {
    if (callStateRef.current !== "idle") return;
    setMediaError(null);
    _setCallState("calling");
    _setCallPeerId(toUserId);
    setCallType(type);
    setCameraFront(true);

    try {
      const stream = await getMedia(type);
      localStreamRef.current = stream;
      setLocalStream(stream);
      await postSignal(toUserId, "call:invite", { callType: type });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Permission") || msg.includes("NotAllowed"))
        setMediaError("Accès refusé — autorisez la caméra/micro dans les paramètres.");
      else if (msg.includes("NotFound"))
        setMediaError("Caméra ou micro introuvable.");
      else
        setMediaError("Impossible d'accéder à la caméra/micro.");
      cleanup();
    }
  }, [cleanup]);

  const acceptCall = useCallback(async () => {
    const ic = incomingCall;
    if (!ic) return;
    stopRingtone();
    setMediaError(null);

    try {
      const stream = await getMedia(ic.callType);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = buildPC(stream);
      pc.onicecandidate = ({ candidate }) => {
        if (candidate && callPeerIdRef.current !== null)
          postSignal(callPeerIdRef.current, "call:ice", { candidate: candidate.toJSON() });
      };

      _setCallState("active");
      await postSignal(ic.fromUserId, "call:accept", {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Permission") || msg.includes("NotAllowed"))
        setMediaError("Accès refusé — autorisez la caméra/micro dans les paramètres.");
      else
        setMediaError("Impossible d'accéder à la caméra/micro.");
      await postSignal(ic.fromUserId, "call:reject", { reason: "media_error" });
      cleanup();
    }
  }, [incomingCall, buildPC, cleanup]);

  const rejectCall = useCallback(async () => {
    stopRingtone();
    const peerId = callPeerIdRef.current;
    if (peerId !== null) await postSignal(peerId, "call:reject", {});
    cleanup();
  }, [cleanup]);

  const endCall = useCallback(async () => {
    stopRingtone();
    const peerId = callPeerIdRef.current;
    if (peerId !== null) await postSignal(peerId, "call:end", {});
    cleanup();
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    const next = !isMutedRef.current;
    isMutedRef.current = next;
    setIsMuted(next);
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !next; });
  }, []);

  const toggleSpeaker = useCallback(async (audioEl: HTMLAudioElement | null) => {
    const next = !isSpeaker;
    setIsSpeaker(next);
    if (!audioEl) return;
    // setSinkId routes audio output: "" = default earpiece, "speaker" = loudspeaker
    const el = audioEl as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
    if (typeof el.setSinkId === "function") {
      try { await el.setSinkId(next ? "speaker" : ""); } catch { /* not supported */ }
    }
  }, [isSpeaker]);

  const flipCamera = useCallback(async () => {
    if (!localStreamRef.current) return;
    const newFront = !cameraFront;
    localStreamRef.current.getVideoTracks().forEach(t => t.stop());
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFront ? "user" : "environment", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      const audioTracks   = localStreamRef.current.getAudioTracks();
      const combined      = new MediaStream([...audioTracks, newVideoTrack]);
      localStreamRef.current = combined;
      setLocalStream(combined);
      const sender = pcRef.current?.getSenders().find(s => s.track?.kind === "video");
      if (sender && newVideoTrack) await sender.replaceTrack(newVideoTrack);
      setCameraFront(newFront);
    } catch { /* ignore */ }
  }, [cameraFront]);

  return {
    callState,
    callType,
    callPeerId,
    incomingCall,
    localStream,
    remoteStream,
    isMuted,
    isSpeaker,
    cameraFront,
    callDuration,
    mediaError,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleSpeaker,
    flipCamera,
  };
}
