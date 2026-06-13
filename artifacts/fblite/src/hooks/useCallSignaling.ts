import { useState, useEffect, useRef, useCallback } from "react";
import { getBpToken } from "../lib/api";

const BASE = "/api";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

export type CallState = "idle" | "calling" | "incoming" | "active";

export interface IncomingCallInfo {
  fromUserId: number;
  callType: "audio" | "video";
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

async function getMedia(type: "audio" | "video"): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: true,
    video: type === "video"
      ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
      : false,
  });
}

export function useCallSignaling(meId: number) {
  const [callState, setCallState]       = useState<CallState>("idle");
  const [callType, setCallType]         = useState<"audio" | "video" | null>(null);
  const [callPeerId, setCallPeerId]     = useState<number | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallInfo | null>(null);
  const [localStream, setLocalStream]   = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted]           = useState(false);
  const [cameraFront, setCameraFront]   = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [mediaError, setMediaError]     = useState<string | null>(null);

  const pcRef              = useRef<RTCPeerConnection | null>(null);
  const localStreamRef     = useRef<MediaStream | null>(null);
  const pendingCandidates  = useRef<RTCIceCandidateInit[]>([]);
  const callTimerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStateRef       = useRef<CallState>("idle");
  const callPeerIdRef      = useRef<number | null>(null);
  const handleSignalRef    = useRef<((msg: SignalMsg) => Promise<void>) | null>(null);

  interface SignalMsg {
    type: string;
    from: number;
    payload: Record<string, unknown>;
  }

  const _setCallState = (s: CallState) => { callStateRef.current = s; setCallState(s); };
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
    setIsMuted(false);
    setCameraFront(true);
    setMediaError(null);
  }, [stopTimer, stopLocal]);

  const buildPC = useCallback((stream: MediaStream): RTCPeerConnection => {
    pcRef.current?.close();
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    const remote = new MediaStream();
    pc.ontrack = e => {
      e.streams[0]?.getTracks().forEach(t => {
        if (!remote.getTracks().includes(t)) remote.addTrack(t);
      });
      setRemoteStream(new MediaStream(remote.getTracks()));
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

    // ── INCOMING INVITE ──────────────────────────────────────────
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
      return;
    }

    // ── CALLEE ACCEPTED — now caller creates offer ────────────────
    if (type === "call:accept") {
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

    // ── CALLER SENT OFFER — callee sets remote + sends answer ─────
    if (type === "call:offer") {
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

    // ── CALLEE SENT ANSWER — caller is now live ───────────────────
    if (type === "call:answer") {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp as RTCSessionDescriptionInit));
      await drainCandidates(pc);
      _setCallState("active");
      startTimer();
      return;
    }

    // ── ICE CANDIDATE ─────────────────────────────────────────────
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

    // ── REJECT / END ──────────────────────────────────────────────
    if (type === "call:reject" || type === "call:end") {
      cleanup();
      return;
    }
  }, [buildPC, drainCandidates, startTimer, cleanup]);

  // Keep the ref up to date so the stable SSE listener always calls the latest version
  useEffect(() => { handleSignalRef.current = handleSignal; }, [handleSignal]);

  // ── SSE connection (stable — created once per meId) ──────────────
  useEffect(() => {
    if (!meId) return;
    const token = getBpToken();
    if (!token) return;

    const es = new EventSource(`${BASE}/signaling/listen?token=${encodeURIComponent(token)}`);

    es.addEventListener("signal", (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data) as SignalMsg;
        handleSignalRef.current?.(msg);
      } catch { /* ignore */ }
    });

    return () => { es.close(); };
  }, [meId]);

  // ── Public API ───────────────────────────────────────────────────

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
    const peerId = callPeerIdRef.current;
    if (peerId !== null) await postSignal(peerId, "call:reject", {});
    cleanup();
  }, [cleanup]);

  const endCall = useCallback(async () => {
    const peerId = callPeerIdRef.current;
    if (peerId !== null) await postSignal(peerId, "call:end", {});
    cleanup();
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    const next = !isMuted;
    setIsMuted(next);
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !next; });
  }, [isMuted]);

  const flipCamera = useCallback(async () => {
    if (!localStreamRef.current) return;
    const newFront = !cameraFront;
    localStreamRef.current.getVideoTracks().forEach(t => t.stop());
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFront ? "user" : "environment" },
        audio: false,
      });
      const newVideoTrack  = newStream.getVideoTracks()[0];
      const audioTracks    = localStreamRef.current.getAudioTracks();
      const combined       = new MediaStream([...audioTracks, newVideoTrack]);
      localStreamRef.current = combined;
      setLocalStream(combined);

      // Replace track in peer connection
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
    cameraFront,
    callDuration,
    mediaError,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    flipCamera,
  };
}
