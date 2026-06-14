import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "../router";
import { apiGetConversations, apiGetMessages, apiSendMessage, apiGetUsers, apiGetUserPresence, type PublicUser } from "../lib/api";
import { useCallSignaling, type NewMessagePayload } from "../hooks/useCallSignaling";

function presenceLabel(online: boolean, lastSeenAt: string | null): string {
  if (online) return "En ligne";
  if (!lastSeenAt) return "Hors ligne";
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `En ligne il y a ${secs} s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `En ligne il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `En ligne il y a ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `En ligne il y a ${days} j`;
}

interface Message {
  id: number;
  text: string;
  mine: boolean;
  time: string;
  status?: "sent" | "read";
  attachment?: { type: "image" | "doc" | "location" | "audio"; label: string };
}

interface NormConv {
  id: number;
  user: { name: string; initials: string; color: string };
  lastMessage: string;
  unread: number;
  time: string;
}

const CONV_COLORS = ["#1877F2","#E91E8C","#7B1FA2","#F57C00","#388E3C","#00838F","#D32F2F"];
const mkInitials = (name: string) =>
  name.split(" ").filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";

type Overlay = "none" | "info" | "attach";

export default function Messages({ initialUserId }: { initialUserId?: number }) {
  const navigate = useNavigate();
  const meId = (() => { try { return (JSON.parse(localStorage.getItem("fb_user") ?? "{}") as { id?: number }).id ?? 0; } catch { return 0; } })();

  const [activeConv, setActiveConv]   = useState<number | null>(initialUserId ?? null);
  const [messages, setMessages]       = useState<Record<number, Message[]>>({});
  const [convList, setConvList]       = useState<NormConv[]>([]);
  const [allUsers, setAllUsers]       = useState<PublicUser[]>([]);
  const [newMsg, setNewMsg]           = useState("");
  const [search, setSearch]           = useState("");
  const [overlay, setOverlay]         = useState<Overlay>("none");

  // ── Selection mode (long-press) ──────────────────────────────────────────
  const [selectionMode, setSelectionMode]       = useState(false);
  const [selectedMsgs, setSelectedMsgs]         = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteForAll, setDeleteForAll]         = useState(false);
  const [presence, setPresence] = useState<{ online: boolean; lastSeenAt: string | null }>({ online: false, lastSeenAt: null });
  const [presenceTick, setPresenceTick] = useState(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bottomRef      = useRef<HTMLDivElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const activeConvRef  = useRef<number | null>(null);
  const allUsersRef    = useRef<PublicUser[]>([]);

  useEffect(() => { activeConvRef.current = activeConv; }, [activeConv]);
  useEffect(() => { allUsersRef.current = allUsers; }, [allUsers]);

  const onNewMessage = useCallback((data: NewMessagePayload) => {
    const fromId = data.fromUserId;
    const time   = new Date(data.createdAt).toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" });
    const msg: Message = { id: data.id, text: data.content, mine: false, time, status: "sent" };

    setMessages(prev => ({
      ...prev,
      [fromId]: [...(prev[fromId] ?? []), msg],
    }));

    setConvList(prev => {
      const exists = prev.find(c => c.id === fromId);
      if (exists) {
        return prev.map(c => c.id === fromId
          ? { ...c, lastMessage: data.content, time, unread: activeConvRef.current === fromId ? 0 : c.unread + 1 }
          : c
        );
      }
      const u = allUsersRef.current.find(x => x.id === fromId);
      const name = u ? `${u.firstName} ${u.lastName}` : `Utilisateur #${fromId}`;
      return [{
        id: fromId,
        user: { name, initials: mkInitials(name), color: CONV_COLORS[fromId % CONV_COLORS.length] },
        lastMessage: data.content, unread: 1, time,
      }, ...prev];
    });
  }, []);

  const sig = useCallSignaling(meId, onNewMessage);

  // Wire remoteStream → <audio> element for AUDIO-ONLY calls.
  // For VIDEO calls the <video ref={remoteVideoRef}> already carries both audio
  // and video tracks from the same stream. Attaching the stream to the <audio>
  // element simultaneously would play the remote audio TWICE — the doubled output
  // saturates the AEC reference and causes the whistling/echo on Android.
  useEffect(() => {
    const el = remoteAudioRef.current;
    if (!el) return;
    if (sig.remoteStream && sig.callType === "audio") {
      // Audio-only call — play remote audio through the hidden <audio> element.
      if (el.srcObject !== sig.remoteStream) {
        el.srcObject = sig.remoteStream;
        el.play().catch(() => {});
      }
    } else {
      // Video call (audio handled by <video>) or call ended — silence this element.
      el.srcObject = null;
    }
  }, [sig.remoteStream, sig.callType]);

  // Attach local stream to <video> only when stream reference actually changes.
  // Using a stable ref + useEffect prevents srcObject from being re-assigned on
  // every render (which happens every second via the callDuration timer) and
  // eliminates the black-flash / flicker bug.
  useEffect(() => {
    const el = localVideoRef.current;
    if (!el) return;
    if (sig.localStream) {
      if (el.srcObject !== sig.localStream) {
        el.srcObject = sig.localStream;
        el.play().catch(() => {});
      }
    } else {
      el.srcObject = null;
    }
  }, [sig.localStream]);

  useEffect(() => {
    const el = remoteVideoRef.current;
    if (!el) return;
    if (sig.remoteStream) {
      if (el.srcObject !== sig.remoteStream) {
        el.srcObject = sig.remoteStream;
        el.play().catch(() => {});
      }
    } else {
      el.srcObject = null;
    }
  }, [sig.remoteStream]);

  const activeUser   = activeConv ? (convList.find(c => c.id === activeConv)?.user ?? null) : null;
  const callPeerUser = sig.callPeerId ? (convList.find(c => c.id === sig.callPeerId)?.user
    ?? (() => {
      const u = allUsers.find(x => x.id === sig.callPeerId);
      if (!u) return null;
      const name = `${u.firstName} ${u.lastName}`;
      return { name, initials: mkInitials(name), color: CONV_COLORS[sig.callPeerId % CONV_COLORS.length] };
    })()) : null;

  const currentMessages = activeConv ? (messages[activeConv] ?? []) : [];
  const filteredConvs   = convList.filter(c => c.user.name.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [currentMessages]);

  useEffect(() => {
    Promise.all([apiGetConversations(), apiGetUsers()])
      .then(([convs, users]) => {
        setAllUsers(users);
        const normalized: NormConv[] = convs.map(c => {
          const u    = users.find(u => u.id === c.userId);
          const name = u ? `${u.firstName} ${u.lastName}` : `Utilisateur #${c.userId}`;
          return {
            id: c.userId,
            user: { name, initials: mkInitials(name), color: CONV_COLORS[c.userId % CONV_COLORS.length] },
            lastMessage: c.lastMessage,
            unread: c.unreadCount,
            time: new Date(c.updatedAt).toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" }),
          };
        });
        if (initialUserId && !normalized.find(c => c.id === initialUserId)) {
          const u = users.find(u => u.id === initialUserId);
          if (u) {
            const name = `${u.firstName} ${u.lastName}`;
            normalized.unshift({
              id: initialUserId,
              user: { name, initials: mkInitials(name), color: CONV_COLORS[initialUserId % CONV_COLORS.length] },
              lastMessage: "", unread: 0, time: "",
            });
          }
        }
        setConvList(normalized);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeConv || messages[activeConv]) return;
    apiGetMessages(activeConv).then(msgs => {
      setMessages(prev => ({
        ...prev,
        [activeConv]: msgs.map(m => ({
          id:     m.id,
          text:   m.content,
          mine:   m.fromUserId === meId,
          time:   new Date(m.createdAt).toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" }),
          status: m.isRead ? "read" as const : "sent" as const,
        })),
      }));
    }).catch(() => {});
  }, [activeConv]);

  /* Fetch & poll presence every 30s when a conversation is open */
  useEffect(() => {
    if (!activeConv) { setPresence({ online: false, lastSeenAt: null }); return; }
    let cancelled = false;
    const fetch = () => apiGetUserPresence(activeConv).then(p => { if (!cancelled) setPresence(p); }).catch(() => {});
    fetch();
    // tick every second to re-render relative time label without re-fetching
    const ticker = setInterval(() => setPresenceTick(t => t + 1), 5000);
    const poller = setInterval(fetch, 30000);
    return () => { cancelled = true; clearInterval(ticker); clearInterval(poller); };
  }, [activeConv]);

  const presText = presenceLabel(presence.online, presence.lastSeenAt);
  void presenceTick; // used to trigger re-render for relative time

  /* Polling: refresh messages every 3s for open conversation, convList every 10s */
  useEffect(() => {
    if (!activeConv) return;
    const poll = setInterval(() => {
      apiGetMessages(activeConv).then(msgs => {
        setMessages(prev => {
          const next = msgs.map(m => ({
            id:     m.id,
            text:   m.content,
            mine:   m.fromUserId === meId,
            time:   new Date(m.createdAt).toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" }),
            status: m.isRead ? "read" as const : "sent" as const,
          }));
          if (JSON.stringify(next.map(x => x.id)) === JSON.stringify((prev[activeConv] ?? []).map(x => x.id))) return prev;
          return { ...prev, [activeConv]: next };
        });
      }).catch(() => {});
    }, 3000);
    return () => clearInterval(poll);
  }, [activeConv, meId]);

  useEffect(() => {
    const poll = setInterval(() => {
      if (allUsersRef.current.length === 0) return;
      apiGetConversations().then(convs => {
        setConvList(prev => {
          const updated: NormConv[] = convs.map(c => {
            const existing = prev.find(p => p.id === c.userId);
            const u    = allUsersRef.current.find(u => u.id === c.userId);
            const name = u ? `${u.firstName} ${u.lastName}` : `Utilisateur #${c.userId}`;
            return {
              id: c.userId,
              user: existing?.user ?? { name, initials: mkInitials(name), color: CONV_COLORS[c.userId % CONV_COLORS.length] },
              lastMessage: c.lastMessage,
              unread: activeConvRef.current === c.userId ? 0 : c.unreadCount,
              time: new Date(c.updatedAt).toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" }),
            };
          });
          return updated;
        });
      }).catch(() => {});
    }, 10000);
    return () => clearInterval(poll);
  }, []);

  const fmtTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const sendMsg = (text?: string, attachment?: Message["attachment"]) => {
    const content = text ?? newMsg.trim();
    if (!content && !attachment) return;
    if (!activeConv) return;
    const now = new Date().toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" });
    const msg: Message = { id: Date.now(), text: content, mine: true, time: now, status: "sent", attachment };
    setMessages(ms => ({ ...ms, [activeConv]: [...(ms[activeConv] ?? []), msg] }));
    setConvList(prev => prev.map(c => c.id === activeConv ? { ...c, lastMessage: content, time: now } : c));
    if (!text) setNewMsg("");
    apiSendMessage(activeConv, content).catch(() => {});
  };

  // ── Long-press / selection helpers ───────────────────────────────────────
  const startLongPress = (msgId: number) => {
    longPressTimer.current = setTimeout(() => {
      setSelectionMode(true);
      setSelectedMsgs(new Set([msgId]));
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const toggleSelect = (msgId: number) => {
    setSelectedMsgs(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId); else next.add(msgId);
      return next;
    });
  };

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedMsgs(new Set());
    setShowDeleteConfirm(false);
    setDeleteForAll(false);
  };

  const copySelected = () => {
    if (!activeConv) return;
    const texts = (messages[activeConv] ?? [])
      .filter(m => selectedMsgs.has(m.id))
      .map(m => m.text)
      .join("\n");
    navigator.clipboard.writeText(texts).catch(() => {});
    exitSelection();
  };

  const confirmDelete = () => {
    if (!activeConv) return;
    setMessages(prev => ({
      ...prev,
      [activeConv]: (prev[activeConv] ?? []).filter(m => !selectedMsgs.has(m.id)),
    }));
    exitSelection();
  };

  navigate;

  /* ══════════════════════════════════════════════════════════════
     INCOMING CALL OVERLAY
  ══════════════════════════════════════════════════════════════ */
  if (sig.callState === "incoming" && sig.incomingCall) {
    const caller     = allUsers.find(u => u.id === sig.incomingCall!.fromUserId);
    const callerName = caller ? `${caller.firstName} ${caller.lastName}` : `Utilisateur #${sig.incomingCall.fromUserId}`;
    const callerColor = CONV_COLORS[sig.incomingCall.fromUserId % CONV_COLORS.length];
    const isVideo     = sig.incomingCall.callType === "video";

    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "linear-gradient(160deg, #0d1b2a 0%, #1a3a52 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "48px 32px",
      }}>
        <style>{`@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.08);opacity:.85}}`}</style>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, letterSpacing: 1, textTransform: "uppercase", marginBottom: 28 }}>
          {isVideo ? "📹 Appel vidéo entrant" : "📞 Appel audio entrant"}
        </div>
        <div style={{
          width: 110, height: 110, borderRadius: "50%", background: callerColor,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 40, color: "#fff", fontWeight: 800,
          boxShadow: `0 0 0 14px ${callerColor}44, 0 0 0 28px ${callerColor}22`,
          animation: "pulse 1.5s infinite", marginBottom: 20,
        }}>{mkInitials(callerName)}</div>
        <div style={{ color: "#fff", fontWeight: 900, fontSize: 26, marginBottom: 6 }}>{callerName}</div>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 15, marginBottom: 56 }}>
          {isVideo ? "Appel vidéo" : "Appel audio"}
        </div>
        {sig.mediaError && (
          <div style={{ background: "rgba(244,67,54,0.2)", color: "#FF6B6B", borderRadius: 12, padding: "10px 20px", marginBottom: 24, fontSize: 13, textAlign: "center" }}>
            {sig.mediaError}
          </div>
        )}
        <div style={{ display: "flex", gap: 60 }}>
          <div style={{ textAlign: "center", cursor: "pointer" }} onClick={() => sig.rejectCall()}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#F44336", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 10px", boxShadow: "0 4px 16px rgba(244,67,54,0.5)" }}>📵</div>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>Refuser</div>
          </div>
          <div style={{ textAlign: "center", cursor: "pointer" }} onClick={() => sig.acceptCall()}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#42B72A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 10px", boxShadow: "0 4px 16px rgba(66,183,42,0.5)" }}>
              {isVideo ? "📹" : "📞"}
            </div>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>Accepter</div>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     ACTIVE / CALLING CALL — FULL SCREEN
  ══════════════════════════════════════════════════════════════ */
  if (sig.callState === "calling" || sig.callState === "active") {
    const peer    = callPeerUser;
    const isVideo = sig.callType === "video";

    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#000", overflow: "hidden" }}>

        {/* Hidden audio for voice calls */}
        <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: "none" }} />

        {/* Remote video — fills entire screen */}
        {isVideo && (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover",
            }}
          />
        )}

        {/* Audio call — dark gradient bg with avatar */}
        {!isVideo && (
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              width: 130, height: 130, borderRadius: "50%",
              background: peer?.color ?? "#1877F2",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 48, color: "#fff", fontWeight: 800,
              boxShadow: sig.callState === "active"
                ? `0 0 0 16px ${peer?.color ?? "#1877F2"}44, 0 0 0 32px ${peer?.color ?? "#1877F2"}22`
                : "none",
            }}>{peer?.initials ?? "?"}</div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 24, marginTop: 24 }}>{peer?.name ?? "Appel en cours"}</div>
          </div>
        )}

        {/* Top gradient overlay — name + status */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          padding: "52px 20px 40px",
          background: "linear-gradient(180deg, rgba(0,0,0,0.75) 0%, transparent 100%)",
          zIndex: 10, textAlign: "center",
        }}>
          {isVideo && (
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 20, textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
              {peer?.name ?? "Appel en cours"}
            </div>
          )}
          <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, marginTop: 4, fontWeight: 600 }}>
            {sig.callState === "active"
              ? <span style={{ color: "#42B72A" }}>● {fmtTime(sig.callDuration)}</span>
              : <span>Connexion en cours…</span>
            }
          </div>
          {sig.isMuted && (
            <div style={{ display: "inline-block", marginTop: 8, background: "rgba(244,67,54,0.85)", borderRadius: 20, padding: "3px 12px", color: "#fff", fontSize: 12, fontWeight: 700 }}>
              🔇 Micro coupé
            </div>
          )}
          {sig.mediaError && (
            <div style={{ marginTop: 8, background: "rgba(244,67,54,0.85)", borderRadius: 12, padding: "6px 14px", color: "#fff", fontSize: 12 }}>
              {sig.mediaError}
            </div>
          )}
        </div>

        {/* Local video PiP — top right */}
        {isVideo && (
          <div style={{
            position: "absolute", top: 72, right: 16,
            width: 110, height: 155, borderRadius: 14,
            overflow: "hidden", border: "2px solid rgba(255,255,255,0.5)",
            zIndex: 15, boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          }}>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: "100%", height: "100%", objectFit: "cover", display: "block",
                transform: sig.cameraFront ? "scaleX(-1)" : "scaleX(1)",
              }}
            />
          </div>
        )}

        {/* Bottom gradient overlay — controls */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          padding: "40px 32px 54px",
          background: "linear-gradient(0deg, rgba(0,0,0,0.8) 0%, transparent 100%)",
          zIndex: 10,
        }}>
          {/* Control buttons */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 28, marginBottom: 28 }}>
            {/* Mute */}
            <div onClick={() => sig.toggleMute()} style={{ textAlign: "center", cursor: "pointer" }}>
              <div style={{
                width: 54, height: 54, borderRadius: "50%",
                background: sig.isMuted ? "rgba(244,67,54,0.9)" : "rgba(255,255,255,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, margin: "0 auto 6px",
                border: `2px solid ${sig.isMuted ? "#F44336" : "rgba(255,255,255,0.35)"}`,
                backdropFilter: "blur(4px)",
                transition: "all 0.2s",
              }}>
                {sig.isMuted ? "🔇" : "🎙️"}
              </div>
              <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: 600 }}>
                {sig.isMuted ? "Activé" : "Muet"}
              </div>
            </div>

            {/* Flip camera (video only) */}
            {isVideo && (
              <div onClick={() => sig.flipCamera()} style={{ textAlign: "center", cursor: "pointer" }}>
                <div style={{
                  width: 54, height: 54, borderRadius: "50%",
                  background: "rgba(255,255,255,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, margin: "0 auto 6px",
                  border: "2px solid rgba(255,255,255,0.35)",
                  backdropFilter: "blur(4px)",
                }}>🔁</div>
                <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: 600 }}>
                  {sig.cameraFront ? "Frontale" : "Arrière"}
                </div>
              </div>
            )}

            {/* Speaker */}
            <div onClick={() => sig.toggleSpeaker(remoteAudioRef.current)} style={{ textAlign: "center", cursor: "pointer" }}>
              <div style={{
                width: 54, height: 54, borderRadius: "50%",
                background: sig.isSpeaker ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, margin: "0 auto 6px",
                border: `2px solid ${sig.isSpeaker ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.35)"}`,
                backdropFilter: "blur(4px)",
                transition: "all 0.2s",
              }}>{sig.isSpeaker ? "🔊" : "🔈"}</div>
              <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: 600 }}>
                {sig.isSpeaker ? "HP actif" : "Écouteur"}
              </div>
            </div>
          </div>

          {/* Hang up */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div onClick={() => sig.endCall()} style={{
              width: 68, height: 68, borderRadius: "50%", background: "#F44336",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, cursor: "pointer",
              boxShadow: "0 4px 20px rgba(244,67,54,0.6)",
            }}>📵</div>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     INFO OVERLAY — WhatsApp × BP style
  ══════════════════════════════════════════════════════════════ */
  if (activeConv && activeUser && overlay === "info") {
    return (
      <div style={{ position: "fixed", top: 56, bottom: 60, left: 0, right: 0, background: "#f0f2f5", zIndex: 10, overflowY: "auto" }}>
        {/* Header */}
        <div style={{
          background: "#1877F2", padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <button onClick={() => setOverlay("none")} style={{
            background: "none", border: "none", fontSize: 20, cursor: "pointer",
            color: "#fff", display: "flex", alignItems: "center", padding: 4,
          }}>←</button>
          <div style={{ fontWeight: 700, fontSize: 17, color: "#fff" }}>Infos du contact</div>
        </div>
        {/* Profile card */}
        <div style={{ background: "#fff", padding: "28px 20px 24px", textAlign: "center" }}>
          <div style={{ position: "relative", display: "inline-block", marginBottom: 14 }}>
            <div className="avatar" style={{ width: 96, height: 96, fontSize: 34, background: activeUser.color }}>{activeUser.initials}</div>
            <div style={{ position: "absolute", bottom: 5, right: 5, width: 20, height: 20, background: "#42B72A", borderRadius: "50%", border: "3px solid #fff" }} />
          </div>
          <div style={{ fontWeight: 900, fontSize: 23, color: "#111", marginBottom: 4 }}>{activeUser.name}</div>
          <div style={{ fontSize: 13, color: presence.online ? "#42B72A" : "#888", fontWeight: 600 }}>
            {presence.online ? "🟢 En ligne" : presText}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 20 }}>
            {[
              { icon: "💬", label: "Message", action: () => setOverlay("none"), color: "#1877F2" },
              { icon: "📞", label: "Appel audio", action: () => { setOverlay("none"); sig.startCall(activeConv, "audio"); }, color: "#42B72A" },
              { icon: "📹", label: "Vidéo", action: () => { setOverlay("none"); sig.startCall(activeConv, "video"); }, color: "#E91E63" },
            ].map(a => (
              <div key={a.label} onClick={a.action} style={{ cursor: "pointer", textAlign: "center" }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: a.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 6px", boxShadow: `0 2px 8px ${a.color}55` }}>{a.icon}</div>
                <div style={{ fontSize: 11, color: "#555", fontWeight: 600 }}>{a.label}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Info rows */}
        <div style={{ marginTop: 8, background: "#fff" }}>
          {[
            { icon: "😊", label: "Bonjour ! J'utilise Brute Pawa." },
            { icon: "📱", label: activeUser.name },
          ].map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", borderBottom: "1px solid #f0f2f5" }}>
              <span style={{ fontSize: 22 }}>{r.icon}</span>
              <span style={{ fontSize: 15, color: "#111" }}>{r.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     CONVERSATION VIEW — WhatsApp × Brute Pawa
  ══════════════════════════════════════════════════════════════ */
  if (activeConv && activeUser) {
    return (
      <div style={{
        position: "fixed", top: 56, bottom: 60, left: 0, right: 0,
        display: "flex", flexDirection: "column", zIndex: 5,
        overflow: "hidden",
        background: "#ECE5DD",
      }}>
        <style>{`
          .bp-chat-bg {
            background-color: #ECE5DD;
            background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%231877F2' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
          }
          .bp-msg-mine {
            background: #1877F2;
            color: #fff;
            border-radius: 18px 18px 4px 18px;
            position: relative;
          }
          .bp-msg-theirs {
            background: #fff;
            color: #111;
            border-radius: 18px 18px 18px 4px;
            position: relative;
            box-shadow: 0 1px 2px rgba(0,0,0,0.12);
          }
        `}</style>

        {/* ── HEADER ── */}
        {selectionMode ? (
          <div style={{
            background: "#0d47a1", padding: "10px 12px",
            display: "flex", alignItems: "center", gap: 14, flexShrink: 0,
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
          }}>
            <button onClick={exitSelection} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center" }}>✕</button>
            <span style={{ flex: 1, fontWeight: 700, fontSize: 18, color: "#fff" }}>{selectedMsgs.size} sélectionné{selectedMsgs.size > 1 ? "s" : ""}</span>
            <button onClick={copySelected} title="Copier" style={{ background: "none", border: "none", cursor: "pointer", color: "#fff", fontSize: 20, padding: 6 }}>⎘</button>
            <button title="Transférer" style={{ background: "none", border: "none", cursor: "pointer", color: "#fff", fontSize: 20, padding: 6 }}>↪</button>
            <button
              onClick={() => selectedMsgs.size > 0 && setShowDeleteConfirm(true)}
              title="Supprimer"
              style={{ background: "none", border: "none", cursor: selectedMsgs.size > 0 ? "pointer" : "default", color: selectedMsgs.size > 0 ? "#fff" : "rgba(255,255,255,0.35)", fontSize: 20, padding: 6 }}
            >🗑</button>
          </div>
        ) : (
          <div style={{
            background: "#1877F2", padding: "8px 10px",
            display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
            boxShadow: "0 2px 4px rgba(0,0,0,0.18)",
          }}>
            <button onClick={() => { setActiveConv(null); setOverlay("none"); }} style={{
              background: "none", border: "none", fontSize: 22, cursor: "pointer",
              color: "#fff", display: "flex", alignItems: "center", padding: "4px 2px",
            }}>←</button>

            <div style={{ position: "relative", cursor: "pointer" }} onClick={() => setOverlay("info")}>
              <div className="avatar" style={{ background: "rgba(255,255,255,0.25)", width: 40, height: 40, fontSize: 14, color: "#fff", border: "2px solid rgba(255,255,255,0.4)" }}>{activeUser.initials}</div>
              {presence.online && <div style={{ position: "absolute", bottom: 1, right: 1, width: 11, height: 11, background: "#42B72A", borderRadius: "50%", border: "2px solid #1877F2" }} />}
            </div>

            <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setOverlay("info")}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#fff", lineHeight: 1.2 }}>{activeUser.name}</div>
              <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>{presText}</div>
            </div>

            <div style={{ display: "flex", gap: 2 }}>
              <button onClick={() => sig.startCall(activeConv, "audio")} title="Appel audio" style={{
                background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%",
                width: 38, height: 38, cursor: "pointer", fontSize: 17, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>📞</button>
              <button onClick={() => sig.startCall(activeConv, "video")} title="Appel vidéo" style={{
                background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%",
                width: 38, height: 38, cursor: "pointer", fontSize: 17, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>📹</button>
              <button onClick={() => setOverlay("info")} title="Infos" style={{
                background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%",
                width: 38, height: 38, cursor: "pointer", color: "#fff", fontSize: 18, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>⋮</button>
            </div>
          </div>
        )}

        {/* ── MESSAGES AREA ── */}
        <div className="bp-chat-bg" style={{ flex: 1, overflowY: "auto", padding: "10px 10px 6px", display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{
            textAlign: "center", fontSize: 11.5, color: "#555",
            background: "rgba(255,255,255,0.85)", borderRadius: 20,
            padding: "4px 14px", margin: "2px auto 10px", display: "inline-block", alignSelf: "center",
            boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
          }}>
            Aujourd'hui
          </div>

          {currentMessages.map((msg, i) => {
            const isFirst    = i === 0 || currentMessages[i - 1]?.mine !== msg.mine;
            const isLast     = i === currentMessages.length - 1 || currentMessages[i + 1]?.mine !== msg.mine;
            const isSelected = selectedMsgs.has(msg.id);

            const longPressHandlers = {
              onMouseDown:   () => startLongPress(msg.id),
              onMouseUp:     cancelLongPress,
              onMouseLeave:  cancelLongPress,
              onTouchStart:  () => startLongPress(msg.id),
              onTouchEnd:    cancelLongPress,
              onTouchMove:   cancelLongPress,
              onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); startLongPress(msg.id); },
            };

            return (
              <div
                key={msg.id}
                onClick={() => selectionMode && toggleSelect(msg.id)}
                style={{
                  display: "flex",
                  justifyContent: msg.mine ? "flex-end" : "flex-start",
                  alignItems: "flex-end",
                  gap: 6,
                  marginTop: isFirst ? 6 : 1,
                  paddingLeft: selectionMode ? 4 : 0,
                  background: isSelected ? "rgba(24,119,242,0.12)" : "transparent",
                  borderRadius: 8,
                  cursor: selectionMode ? "pointer" : "default",
                  transition: "background 0.15s",
                  userSelect: "none",
                  paddingRight: msg.mine ? 4 : 0,
                }}
              >
                {selectionMode && (
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                    border: isSelected ? "none" : "2px solid #aaa",
                    background: isSelected ? "#1877F2" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {isSelected && <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span>}
                  </div>
                )}

                {!msg.mine && !selectionMode && (
                  <div style={{ width: 28, flexShrink: 0, alignSelf: "flex-end", paddingBottom: 2 }}>
                    {isLast && (
                      <div className="avatar xs" style={{ background: activeUser.color, width: 26, height: 26, fontSize: 10 }}>
                        {activeUser.initials}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column" }} {...(!selectionMode ? longPressHandlers : {})}>
                  {msg.attachment && (
                    <div style={{
                      background: msg.mine ? "#1564c0" : "#f1f1f1",
                      color: msg.mine ? "#fff" : "#111",
                      borderRadius: 14, padding: "8px 12px", marginBottom: 2, fontSize: 13,
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <span style={{ fontSize: 18 }}>
                        {msg.attachment.type === "image" ? "🖼️" : msg.attachment.type === "doc" ? "📄" : msg.attachment.type === "location" ? "📍" : "🎵"}
                      </span>
                      <span>{msg.attachment.label}</span>
                    </div>
                  )}
                  <div className={msg.mine ? "bp-msg-mine" : "bp-msg-theirs"} style={{
                    padding: "8px 12px 6px",
                    fontSize: 14.5, lineHeight: 1.45,
                    wordBreak: "break-word",
                  }}>
                    {msg.text}
                    <div style={{
                      fontSize: 10, marginTop: 2,
                      color: msg.mine ? "rgba(255,255,255,0.75)" : "#888",
                      textAlign: "right",
                      display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 3,
                    }}>
                      {msg.time}
                      {msg.mine && (
                        <span style={{ color: msg.status === "read" ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)", fontSize: 11 }}>
                          {msg.status === "read" ? "✓✓" : "✓"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {currentMessages.length === 0 && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 0" }}>
              <div style={{ background: "rgba(255,255,255,0.85)", borderRadius: 16, padding: "12px 20px", fontSize: 13, color: "#555", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                🔒 Les messages sont chiffrés de bout en bout
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── ATTACHMENT PICKER ── */}
        {overlay === "attach" && (
          <div style={{
            position: "absolute", bottom: 58, left: 0, right: 0,
            background: "#fff", borderTop: "1px solid #e4e6eb",
            padding: "16px 20px 18px", boxShadow: "0 -4px 20px rgba(0,0,0,0.1)",
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {[
                { icon: "🖼️", label: "Photo",    bg: "#E91E63", action: () => { sendMsg("📷 Photo envoyée", { type: "image", label: "photo.jpg" }); setOverlay("none"); } },
                { icon: "📄", label: "Document", bg: "#9C27B0", action: () => { sendMsg("📄 Document envoyé", { type: "doc", label: "document.pdf" }); setOverlay("none"); } },
                { icon: "📍", label: "Position", bg: "#F44336", action: () => { sendMsg("📍 Ma position", { type: "location", label: "Abidjan, Cocody" }); setOverlay("none"); } },
                { icon: "🎵", label: "Audio",    bg: "#FF9800", action: () => { sendMsg("🎵 Message vocal (0:08)", { type: "audio", label: "vocal.m4a" }); setOverlay("none"); } },
                { icon: "🛍️", label: "Produit",  bg: "#1877F2", action: () => { sendMsg("🛍️ Tissu Wax — 4 500 FCFA"); setOverlay("none"); } },
                { icon: "💸", label: "Paiement", bg: "#4CAF50", action: () => { sendMsg("💸 Demande : 15 000 FCFA"); setOverlay("none"); } },
                { icon: "📅", label: "RDV",      bg: "#00BCD4", action: () => { sendMsg("📅 Rendez-vous : demain 10h"); setOverlay("none"); } },
                { icon: "📊", label: "Sondage",  bg: "#607D8B", action: () => { sendMsg("📊 Sondage : quel créneau ?"); setOverlay("none"); } },
              ].map(item => (
                <div key={item.label} onClick={item.action} style={{ textAlign: "center", cursor: "pointer" }}>
                  <div style={{ width: 52, height: 52, background: item.bg, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 6px", boxShadow: `0 2px 8px ${item.bg}55` }}>{item.icon}</div>
                  <div style={{ fontSize: 11, color: "#444", fontWeight: 600 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── BOTTOM BAR ── */}
        {selectionMode ? (
          <div style={{ background: "#fff", borderTop: "1px solid #e4e6eb", display: "flex", flexShrink: 0 }}>
            {[{ icon: "↩", label: "Répondre" }, { icon: "→", label: "Transférer" }].map(action => (
              <button key={action.label} style={{
                flex: 1, background: "none", border: "none", padding: "14px 0", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                borderRight: action.label === "Répondre" ? "1px solid #e4e6eb" : "none",
              }}>
                <span style={{ fontSize: 20 }}>{action.icon}</span>
                <span style={{ fontSize: 12, color: "#555", fontWeight: 600 }}>{action.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div style={{
            background: "#f0f2f5", padding: "6px 8px",
            display: "flex", gap: 6, alignItems: "center", flexShrink: 0,
          }}>
            <button
              onClick={() => setOverlay(o => o === "attach" ? "none" : "attach")}
              style={{
                background: overlay === "attach" ? "#1877F2" : "#fff",
                border: "none", width: 40, height: 40, borderRadius: "50%",
                cursor: "pointer", fontSize: 20,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: overlay === "attach" ? "#fff" : "#555", flexShrink: 0,
                transition: "all 0.2s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
              }}>
              {overlay === "attach" ? "✕" : "＋"}
            </button>

            <div style={{ flex: 1, position: "relative" }}>
              <input
                value={newMsg}
                onChange={e => { setNewMsg(e.target.value); if (overlay === "attach") setOverlay("none"); }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
                placeholder="Message..."
                style={{
                  width: "100%", background: "#fff", border: "none",
                  borderRadius: 22, padding: "10px 14px", fontSize: 15,
                  outline: "none", boxSizing: "border-box", color: "#111",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                }}
              />
            </div>

            {newMsg.trim() ? (
              <button onClick={() => sendMsg()} style={{
                background: "#1877F2", border: "none", borderRadius: "50%",
                width: 40, height: 40, color: "#fff", cursor: "pointer",
                fontSize: 16, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 2px 8px rgba(24,119,242,0.5)",
              }}>➤</button>
            ) : (
              <button style={{
                background: "#1877F2", border: "none", borderRadius: "50%",
                width: 40, height: 40, color: "#fff", cursor: "pointer",
                fontSize: 18, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 2px 8px rgba(24,119,242,0.5)",
              }}>🎤</button>
            )}
          </div>
        )}

        {/* ── DELETE MODAL ── */}
        {showDeleteConfirm && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "0 24px" }}
            onClick={e => { if (e.target === e.currentTarget) setShowDeleteConfirm(false); }}
          >
            <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 340, padding: "24px 20px 16px", boxShadow: "0 8px 32px rgba(0,0,0,0.25)" }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#111", marginBottom: 10 }}>Supprimer le message</div>
              <div style={{ fontSize: 14, color: "#555", marginBottom: 18, lineHeight: 1.5 }}>
                Supprimer {selectedMsgs.size > 1 ? `ces ${selectedMsgs.size} messages` : "ce message"} ?
              </div>
              {(() => {
                const allMine = [...selectedMsgs].every(id => (messages[activeConv!] ?? []).find(m => m.id === id)?.mine);
                return allMine ? (
                  <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, cursor: "pointer" }}>
                    <input type="checkbox" checked={deleteForAll} onChange={e => setDeleteForAll(e.target.checked)} style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#1877F2" }} />
                    <span style={{ fontSize: 14, color: "#333" }}>Supprimer aussi pour {activeUser?.name ?? "l'autre"}</span>
                  </label>
                ) : null;
              })()}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}>
                <button onClick={() => setShowDeleteConfirm(false)} style={{ background: "none", border: "none", padding: "10px 16px", fontSize: 15, fontWeight: 700, color: "#1877F2", cursor: "pointer", borderRadius: 8 }}>Annuler</button>
                <button onClick={confirmDelete} style={{ background: "none", border: "none", padding: "10px 16px", fontSize: 15, fontWeight: 700, color: "#F44336", cursor: "pointer", borderRadius: 8 }}>Supprimer</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     INBOX — WhatsApp × Brute Pawa
  ══════════════════════════════════════════════════════════════ */
  return (
    <div style={{
      position: "fixed", top: 56, bottom: 60, left: 0, right: 0,
      display: "flex", flexDirection: "column", background: "#fff", zIndex: 1,
      overflow: "hidden",
    }}>
      <style>{`
        .bp-conv-row:active { background: #f0f2f5 !important; }
        .bp-conv-row:hover  { background: #f7f8fa !important; }
        @keyframes bp-fade-in { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* ── HEADER FIXE ── */}
      <div style={{ background: "#1877F2", flexShrink: 0 }}>
        {/* Title row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px 8px" }}>
          <div style={{ fontWeight: 900, fontSize: 22, color: "#fff", letterSpacing: -0.3 }}>Messages</div>
          <div style={{ display: "flex", gap: 4 }}>
            {[
              { icon: "🔍", title: "Rechercher" },
              { icon: "✏️", title: "Nouvelle discussion" },
              { icon: "⋮",  title: "Menu", style: { fontSize: 22, fontWeight: 700 } },
            ].map(btn => (
              <button key={btn.title} title={btn.title} style={{
                background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%",
                width: 36, height: 36, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: (btn.style as { fontSize?: number })?.fontSize ?? 17,
                fontWeight: (btn.style as { fontWeight?: number })?.fontWeight ?? 400,
              }}>{btn.icon}</button>
            ))}
          </div>
        </div>
        {/* Search bar */}
        <div style={{ position: "relative", padding: "0 12px 10px" }}>
          <span style={{ position: "absolute", left: 22, top: "50%", transform: "translateY(-65%)", fontSize: 13, color: "rgba(255,255,255,0.6)" }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher ou démarrer une discussion"
            style={{
              width: "100%", background: "rgba(255,255,255,0.18)", border: "none",
              borderRadius: 22, padding: "8px 14px 8px 34px",
              fontSize: 13.5, outline: "none", boxSizing: "border-box",
              color: "#fff",
            }}
          />
        </div>
      </div>

      {/* ── SCROLLABLE BODY ── */}
      <div style={{ flex: 1, overflowY: "auto" }}>

        {/* Statuts actifs (like WhatsApp status bar) */}
        {convList.length > 0 && (
          <div style={{ borderBottom: "1px solid #f0f2f5" }}>
            <div style={{
              display: "flex", gap: 0, overflowX: "auto",
              scrollbarWidth: "none", padding: "10px 8px 12px",
            }}>
              {/* Mon statut (ajouter) */}
              <div style={{ flexShrink: 0, textAlign: "center", width: 68, padding: "0 4px" }}>
                <div style={{ position: "relative", marginBottom: 5 }}>
                  <div className="avatar" style={{
                    width: 52, height: 52, fontSize: 18, margin: "0 auto",
                    background: "#1877F2", border: "3px solid #fff",
                    boxShadow: "0 0 0 2px #1877F2",
                  }}>
                    {(() => {
                      try { return (JSON.parse(localStorage.getItem("fb_user") ?? "{}") as { name?: string }).name?.slice(0,2).toUpperCase() ?? "Moi"; } catch { return "Moi"; }
                    })()}
                  </div>
                  <div style={{ position: "absolute", bottom: 0, right: 8, width: 18, height: 18, background: "#1877F2", borderRadius: "50%", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 900 }}>+</div>
                </div>
                <div style={{ fontSize: 10.5, color: "#555", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Mon statut</div>
              </div>

              {/* Autres statuts */}
              {convList.slice(0, 6).map(conv => (
                <div key={conv.id} onClick={() => setActiveConv(conv.id)} style={{ flexShrink: 0, textAlign: "center", width: 68, padding: "0 4px", cursor: "pointer" }}>
                  <div style={{ position: "relative", marginBottom: 5 }}>
                    <div className="avatar" style={{
                      width: 52, height: 52, fontSize: 18, margin: "0 auto",
                      background: conv.user.color,
                      border: `3px solid ${conv.unread > 0 ? "#1877F2" : "#ddd"}`,
                      boxShadow: `0 0 0 1px ${conv.unread > 0 ? "#1877F2" : "transparent"}`,
                    }}>{conv.user.initials}</div>
                    <div style={{ position: "absolute", bottom: 0, right: 8, width: 14, height: 14, background: "#42B72A", borderRadius: "50%", border: "2px solid #fff" }} />
                  </div>
                  <div style={{ fontSize: 10.5, color: "#333", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {conv.user.name.split(" ")[0]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CONVERSATION LIST ── */}
        {filteredConvs.length === 0 ? (
          <div style={{ padding: "50px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#333", marginBottom: 6 }}>
              {search ? "Aucun résultat" : "Aucune discussion"}
            </div>
            <div style={{ fontSize: 13, color: "#888" }}>
              {search ? "Essayez un autre nom" : "Appuyez sur ✏️ pour démarrer une conversation"}
            </div>
          </div>
        ) : (
          filteredConvs.map((conv, idx) => (
            <div
              key={conv.id}
              className="bp-conv-row"
              onClick={() => setActiveConv(conv.id)}
              style={{
                display: "flex", gap: 12, padding: "10px 14px",
                cursor: "pointer", background: "#fff",
                borderBottom: idx < filteredConvs.length - 1 ? "1px solid #f5f5f5" : "none",
                transition: "background 0.1s",
                animation: "bp-fade-in 0.2s ease forwards",
              }}
            >
              {/* Avatar */}
              <div style={{ position: "relative", flexShrink: 0, alignSelf: "center" }}>
                <div className="avatar" style={{ background: conv.user.color, width: 52, height: 52, fontSize: 19 }}>{conv.user.initials}</div>
                <div style={{ position: "absolute", bottom: 1, right: 1, width: 13, height: 13, background: "#42B72A", borderRadius: "50%", border: "2px solid #fff" }} />
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0, alignSelf: "center" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <span style={{
                    fontWeight: conv.unread > 0 ? 800 : 600, fontSize: 15.5, color: "#111",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "68%",
                  }}>{conv.user.name}</span>
                  <span style={{
                    fontSize: 11.5, fontWeight: conv.unread > 0 ? 700 : 400, flexShrink: 0,
                    color: conv.unread > 0 ? "#1877F2" : "#aaa",
                  }}>{conv.time}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{
                    flex: 1, fontSize: 13.5,
                    color: conv.unread > 0 ? "#222" : "#888",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    fontWeight: conv.unread > 0 ? 600 : 400,
                  }}>
                    {conv.lastMessage || "Démarrer une conversation"}
                  </div>
                  {conv.unread > 0 && (
                    <div style={{
                      background: "#1877F2", color: "#fff", borderRadius: 20,
                      minWidth: 20, height: 20, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 800, padding: "0 5px",
                    }}>
                      {conv.unread > 99 ? "99+" : conv.unread}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── FAB NOUVELLE DISCUSSION ── */}
      <button
        style={{
          position: "absolute", bottom: 16, right: 16,
          width: 54, height: 54, borderRadius: "50%",
          background: "#1877F2", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, color: "#fff",
          boxShadow: "0 4px 16px rgba(24,119,242,0.45)",
          zIndex: 10,
        }}
        title="Nouvelle discussion"
      >✏️</button>
    </div>
  );
}
