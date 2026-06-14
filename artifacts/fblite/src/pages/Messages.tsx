import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "../router";
import { apiGetConversations, apiGetMessages, apiSendMessage, apiGetUsers, type PublicUser } from "../lib/api";
import { useCallSignaling, type NewMessagePayload } from "../hooks/useCallSignaling";

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
     INFO OVERLAY
  ══════════════════════════════════════════════════════════════ */
  if (activeConv && activeUser && overlay === "info") {
    return (
      <div style={{ position: "fixed", top: 56, bottom: 60, left: 0, right: 0, background: "var(--fb-bg)", zIndex: 10, overflowY: "auto" }}>
        <div style={{ background: "var(--fb-white)", padding: "12px 16px", borderBottom: "1px solid var(--fb-divider)", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setOverlay("none")} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--fb-blue)" }}>←</button>
          <div style={{ fontWeight: 700, fontSize: 17 }}>Infos du contact</div>
        </div>
        <div style={{ background: "var(--fb-white)", padding: "28px 20px 20px", textAlign: "center", borderBottom: "1px solid var(--fb-divider)" }}>
          <div style={{ position: "relative", display: "inline-block", marginBottom: 12 }}>
            <div className="avatar" style={{ width: 88, height: 88, fontSize: 32, background: activeUser.color }}>{activeUser.initials}</div>
            <div style={{ position: "absolute", bottom: 4, right: 4, width: 18, height: 18, background: "#42B72A", borderRadius: "50%", border: "3px solid #fff" }} />
          </div>
          <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 4 }}>{activeUser.name}</div>
          <div style={{ fontSize: 14, color: "#42B72A", fontWeight: 700 }}>🟢 En ligne</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 16 }}>
            {[
              { icon: "💬", label: "Message", action: () => setOverlay("none") },
              { icon: "📞", label: "Appel",   action: () => { setOverlay("none"); sig.startCall(activeConv, "audio"); } },
              { icon: "📹", label: "Vidéo",   action: () => { setOverlay("none"); sig.startCall(activeConv, "video"); } },
            ].map(a => (
              <div key={a.label} onClick={a.action} style={{ cursor: "pointer", textAlign: "center" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--fb-blue)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, margin: "0 auto 6px" }}>{a.icon}</div>
                <div style={{ fontSize: 11, color: "var(--fb-text-secondary)" }}>{a.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     CONVERSATION VIEW
  ══════════════════════════════════════════════════════════════ */
  if (activeConv && activeUser) {
    return (
      <div style={{
        position: "fixed", top: 56, bottom: 60, left: 0, right: 0,
        display: "flex", flexDirection: "column", background: "#f0f2f5", zIndex: 5,
      }}>
        {/* Header — normal ou mode sélection */}
        {selectionMode ? (
          <div style={{
            background: "#075e54", padding: "8px 12px",
            display: "flex", alignItems: "center", gap: 14, flexShrink: 0,
            boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
          }}>
            <button onClick={exitSelection} style={{
              background: "none", border: "none", fontSize: 22, cursor: "pointer",
              color: "#fff", padding: 4, display: "flex", alignItems: "center",
            }}>✕</button>
            <span style={{ flex: 1, fontWeight: 700, fontSize: 18, color: "#fff" }}>
              {selectedMsgs.size}
            </span>
            <button onClick={copySelected} title="Copier" style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#fff", fontSize: 20, padding: 6, display: "flex", alignItems: "center",
            }}>⎘</button>
            <button title="Transférer" style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#fff", fontSize: 20, padding: 6, display: "flex", alignItems: "center",
            }}>↪</button>
            <button
              onClick={() => selectedMsgs.size > 0 && setShowDeleteConfirm(true)}
              title="Supprimer"
              style={{
                background: "none", border: "none", cursor: selectedMsgs.size > 0 ? "pointer" : "default",
                color: selectedMsgs.size > 0 ? "#fff" : "rgba(255,255,255,0.4)",
                fontSize: 20, padding: 6, display: "flex", alignItems: "center",
              }}>🗑</button>
          </div>
        ) : (
          <div style={{
            background: "#fff", padding: "8px 12px",
            borderBottom: "1px solid #e4e6eb",
            display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}>
            <button onClick={() => { setActiveConv(null); setOverlay("none"); }} style={{
              background: "none", border: "none", fontSize: 20, cursor: "pointer",
              color: "#1877F2", padding: "6px 8px", borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>←</button>

            <div style={{ position: "relative", cursor: "pointer" }} onClick={() => setOverlay("info")}>
              <div className="avatar" style={{ background: activeUser.color, width: 40, height: 40, fontSize: 15 }}>{activeUser.initials}</div>
              <div style={{ position: "absolute", bottom: 1, right: 1, width: 12, height: 12, background: "#42B72A", borderRadius: "50%", border: "2px solid #fff" }} />
            </div>

            <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setOverlay("info")}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#050505", lineHeight: 1.2 }}>{activeUser.name}</div>
              <div style={{ fontSize: 12, color: "#42B72A", fontWeight: 600 }}>En ligne</div>
            </div>

            <div style={{ display: "flex", gap: 2 }}>
              <button onClick={() => sig.startCall(activeConv, "audio")} title="Appel audio" style={{
                background: "#f0f2f5", border: "none", borderRadius: "50%",
                width: 38, height: 38, cursor: "pointer", fontSize: 17,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>📞</button>
              <button onClick={() => sig.startCall(activeConv, "video")} title="Appel vidéo" style={{
                background: "#f0f2f5", border: "none", borderRadius: "50%",
                width: 38, height: 38, cursor: "pointer", fontSize: 17,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>📹</button>
              <button onClick={() => setOverlay("info")} title="Infos" style={{
                background: "#f0f2f5", border: "none", borderRadius: "50%",
                width: 38, height: 38, cursor: "pointer", fontSize: 17,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>ℹ️</button>
            </div>
          </div>
        )}

        {/* Messages list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{
            textAlign: "center", fontSize: 12, color: "#65676b",
            background: "rgba(255,255,255,0.9)", borderRadius: 20,
            padding: "4px 14px", margin: "4px auto 10px", display: "inline-block", alignSelf: "center",
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

            const handleRowClick = () => {
              if (selectionMode) toggleSelect(msg.id);
            };

            return (
              <div
                key={msg.id}
                onClick={handleRowClick}
                style={{
                  display: "flex",
                  justifyContent: msg.mine ? "flex-end" : "flex-start",
                  alignItems: "center",
                  gap: 6,
                  marginTop: isFirst ? 8 : 1,
                  paddingLeft: selectionMode ? 4 : 0,
                  background: isSelected ? "rgba(0,90,255,0.08)" : "transparent",
                  borderRadius: 8,
                  cursor: selectionMode ? "pointer" : "default",
                  transition: "background 0.15s",
                  userSelect: "none",
                }}
              >
                {/* Selection circle */}
                {selectionMode && (
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                    border: isSelected ? "none" : "2px solid #bbb",
                    background: isSelected ? "#25D366" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s",
                  }}>
                    {isSelected && <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>✓</span>}
                  </div>
                )}

                {/* Avatar placeholder for other's messages */}
                {!msg.mine && !selectionMode && (
                  <div style={{ width: 28, flexShrink: 0, paddingBottom: 2, alignSelf: "flex-end" }}>
                    {isLast && (
                      <div className="avatar xs" style={{ background: activeUser.color, width: 26, height: 26, fontSize: 10 }}>
                        {activeUser.initials}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ maxWidth: "75%" }} {...(!selectionMode ? longPressHandlers : {})}>
                  {msg.attachment && (
                    <div style={{
                      background: msg.mine ? "#1877F2" : "#e4e6eb",
                      color: msg.mine ? "#fff" : "#050505",
                      borderRadius: 18, padding: "8px 12px", marginBottom: 2, fontSize: 13,
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <span style={{ fontSize: 18 }}>
                        {msg.attachment.type === "image" ? "🖼️" : msg.attachment.type === "doc" ? "📄" : msg.attachment.type === "location" ? "📍" : "🎵"}
                      </span>
                      <span>{msg.attachment.label}</span>
                    </div>
                  )}
                  <div style={{
                    background: msg.mine ? "#1877F2" : "#e4e6eb",
                    color: msg.mine ? "#fff" : "#050505",
                    borderRadius: msg.mine
                      ? (isFirst ? "18px 18px 4px 18px" : isLast ? "18px 4px 18px 18px" : "18px 4px 4px 18px")
                      : (isFirst ? "18px 18px 18px 4px" : isLast ? "4px 18px 18px 18px" : "4px 18px 18px 4px"),
                    padding: "9px 13px", fontSize: 14.5, lineHeight: 1.4,
                    wordBreak: "break-word",
                  }}>
                    {msg.text}
                  </div>
                  {isLast && (
                    <div style={{
                      fontSize: 10.5, color: "#65676b", marginTop: 3,
                      textAlign: msg.mine ? "right" : "left",
                      paddingRight: msg.mine ? 2 : 0,
                    }}>
                      {msg.time}{msg.mine && <span style={{ marginLeft: 4 }}>{msg.status === "read" ? "✓✓" : "✓"}</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Attachment picker */}
        {overlay === "attach" && (
          <div style={{
            position: "absolute", bottom: 58, left: 0, right: 0,
            background: "#fff", borderTop: "1px solid #e4e6eb",
            padding: "16px 20px", boxShadow: "0 -4px 16px rgba(0,0,0,0.08)",
          }}>
            <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>Joindre un fichier</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {[
                { icon: "📷", label: "Photo",    action: () => { sendMsg("📷 Photo envoyée", { type: "image", label: "photo.jpg" }); setOverlay("none"); } },
                { icon: "📄", label: "Document", action: () => { sendMsg("📄 Document envoyé", { type: "doc", label: "document.pdf" }); setOverlay("none"); } },
                { icon: "📍", label: "Position", action: () => { sendMsg("📍 Ma position", { type: "location", label: "Abidjan, Cocody" }); setOverlay("none"); } },
                { icon: "🎵", label: "Audio",    action: () => { sendMsg("🎵 Message vocal (0:08)", { type: "audio", label: "vocal.m4a" }); setOverlay("none"); } },
                { icon: "🛍️", label: "Produit",  action: () => { sendMsg("🛍️ Tissu Wax — 4 500 FCFA"); setOverlay("none"); } },
                { icon: "💳", label: "Paiement", action: () => { sendMsg("💸 Demande : 15 000 FCFA"); setOverlay("none"); } },
                { icon: "📅", label: "RDV",      action: () => { sendMsg("📅 Rendez-vous : demain 10h"); setOverlay("none"); } },
                { icon: "📊", label: "Sondage",  action: () => { sendMsg("📊 Sondage : quel créneau ?"); setOverlay("none"); } },
              ].map(item => (
                <div key={item.label} onClick={item.action} style={{ textAlign: "center", cursor: "pointer" }}>
                  <div style={{ width: 52, height: 52, background: "#f0f2f5", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, margin: "0 auto 5px" }}>{item.icon}</div>
                  <div style={{ fontSize: 11, color: "#65676b", fontWeight: 600 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom bar — selection actions OR normal input */}
        {selectionMode ? (
          <div style={{
            background: "#fff", borderTop: "1px solid #e4e6eb",
            display: "flex", flexShrink: 0,
          }}>
            {[
              { icon: "↩", label: "Répondre" },
              { icon: "→", label: "Transférer" },
            ].map(action => (
              <button key={action.label} style={{
                flex: 1, background: "none", border: "none",
                padding: "14px 0", cursor: "pointer",
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
            background: "#fff", padding: "8px 10px",
            borderTop: "1px solid #e4e6eb",
            display: "flex", gap: 6, alignItems: "center", flexShrink: 0,
          }}>
            <button
              onClick={() => setOverlay(o => o === "attach" ? "none" : "attach")}
              style={{
                background: overlay === "attach" ? "#1877F2" : "#f0f2f5",
                border: "none", width: 36, height: 36, borderRadius: "50%",
                cursor: "pointer", fontSize: 18,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: overlay === "attach" ? "#fff" : "#1877F2", flexShrink: 0,
                transition: "all 0.2s",
              }}>
              {overlay === "attach" ? "✕" : "+"}
            </button>
            <button style={{
              background: "none", border: "none", fontSize: 22, cursor: "pointer",
              color: "#1877F2", flexShrink: 0, padding: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 36, height: 36,
            }}>📷</button>
            <div style={{ flex: 1, position: "relative" }}>
              <input
                value={newMsg}
                onChange={e => { setNewMsg(e.target.value); if (overlay === "attach") setOverlay("none"); }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
                placeholder="Message..."
                style={{
                  width: "100%", background: "#f0f2f5", border: "none",
                  borderRadius: 22, padding: "10px 16px", fontSize: 14.5,
                  outline: "none", boxSizing: "border-box", color: "#050505",
                }}
              />
            </div>
            {newMsg.trim() ? (
              <button onClick={() => sendMsg()} style={{
                background: "#1877F2", border: "none", borderRadius: "50%",
                width: 36, height: 36, color: "#fff", cursor: "pointer",
                fontSize: 16, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>➤</button>
            ) : (
              <button style={{
                background: "none", border: "none", fontSize: 24, cursor: "pointer",
                color: "#1877F2", flexShrink: 0, padding: 0,
              }}>👍</button>
            )}
          </div>
        )}

        {/* Delete confirmation modal */}
        {showDeleteConfirm && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 50, padding: "0 24px",
          }}
            onClick={e => { if (e.target === e.currentTarget) setShowDeleteConfirm(false); }}
          >
            <div style={{
              background: "#fff", borderRadius: 16,
              width: "100%", maxWidth: 360,
              padding: "24px 20px 16px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
            }}>
              <div style={{ fontWeight: 800, fontSize: 17, color: "#050505", marginBottom: 8 }}>
                Supprimer le message
              </div>
              <div style={{ fontSize: 14, color: "#444", marginBottom: 18, lineHeight: 1.5 }}>
                Voulez-vous vraiment supprimer {selectedMsgs.size > 1 ? `ces ${selectedMsgs.size} messages` : "ce message"} ?
              </div>

              {/* "Delete for everyone" checkbox (only if all selected messages are mine) */}
              {(() => {
                const allMine = [...selectedMsgs].every(id =>
                  (messages[activeConv!] ?? []).find(m => m.id === id)?.mine
                );
                return allMine ? (
                  <label style={{
                    display: "flex", alignItems: "center", gap: 10,
                    marginBottom: 20, cursor: "pointer",
                  }}>
                    <input
                      type="checkbox"
                      checked={deleteForAll}
                      onChange={e => setDeleteForAll(e.target.checked)}
                      style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#1877F2" }}
                    />
                    <span style={{ fontSize: 14, color: "#333" }}>
                      Supprimer aussi pour {activeUser?.name ?? "l'autre"}
                    </span>
                  </label>
                ) : null;
              })()}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{
                    background: "none", border: "none", padding: "10px 18px",
                    fontSize: 15, fontWeight: 700, color: "#1877F2", cursor: "pointer",
                    borderRadius: 8,
                  }}>
                  Annuler
                </button>
                <button
                  onClick={confirmDelete}
                  style={{
                    background: "none", border: "none", padding: "10px 18px",
                    fontSize: 15, fontWeight: 700, color: "#F44336", cursor: "pointer",
                    borderRadius: 8,
                  }}>
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     INBOX — Facebook Messenger style
  ══════════════════════════════════════════════════════════════ */
  return (
    <div style={{ maxWidth: 600, margin: "0 auto", background: "#fff", minHeight: "100%" }}>

      {/* Header */}
      <div style={{ padding: "14px 16px 10px", borderBottom: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 24, color: "#050505" }}>Messages</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={{
              background: "#f0f2f5", border: "none", borderRadius: "50%",
              width: 36, height: 36, cursor: "pointer", fontSize: 17,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>✏️</button>
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#65676b", fontSize: 14 }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher dans les messages"
            style={{
              width: "100%", background: "#f0f2f5", border: "none",
              borderRadius: 22, padding: "9px 16px 9px 38px",
              fontSize: 14.5, outline: "none", boxSizing: "border-box", color: "#050505",
            }}
          />
        </div>
      </div>

      {/* Actifs maintenant */}
      {convList.length > 0 && (
        <div style={{ padding: "8px 16px 12px", borderBottom: "1px solid #f0f2f5" }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#050505", marginBottom: 10 }}>Actifs maintenant</div>
          <div style={{ display: "flex", gap: 14, overflowX: "auto", scrollbarWidth: "none" }}>
            {convList.slice(0, 8).map(conv => (
              <div key={conv.id} onClick={() => setActiveConv(conv.id)} style={{ flexShrink: 0, textAlign: "center", cursor: "pointer" }}>
                <div style={{ position: "relative", marginBottom: 4 }}>
                  <div className="avatar" style={{
                    background: conv.user.color, width: 52, height: 52,
                    fontSize: 18, margin: "0 auto",
                  }}>{conv.user.initials}</div>
                  <div style={{ position: "absolute", bottom: 2, right: 2, width: 14, height: 14, background: "#42B72A", borderRadius: "50%", border: "2px solid #fff" }} />
                </div>
                <div style={{ fontSize: 11, color: "#050505", fontWeight: 600, maxWidth: 54, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {conv.user.name.split(" ")[0]}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversation list */}
      <div>
        {filteredConvs.length === 0 && (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "#65676b", fontSize: 14 }}>
            {search ? "Aucun résultat" : "Aucune conversation pour l'instant"}
          </div>
        )}
        {filteredConvs.map(conv => (
          <div
            key={conv.id}
            onClick={() => setActiveConv(conv.id)}
            style={{
              display: "flex", gap: 12, padding: "8px 16px", cursor: "pointer",
              background: "#fff",
              transition: "background 0.1s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "#f0f2f5")}
            onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
          >
            <div style={{ position: "relative", flexShrink: 0, alignSelf: "center" }}>
              <div className="avatar" style={{ background: conv.user.color, width: 56, height: 56, fontSize: 20 }}>{conv.user.initials}</div>
              <div style={{ position: "absolute", bottom: 2, right: 2, width: 14, height: 14, background: "#42B72A", borderRadius: "50%", border: "2px solid #fff" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0, alignSelf: "center" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                <span style={{
                  fontWeight: conv.unread > 0 ? 800 : 600, fontSize: 15.5, color: "#050505",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "65%",
                }}>{conv.user.name}</span>
                <span style={{
                  fontSize: 12, fontWeight: conv.unread > 0 ? 700 : 400,
                  color: conv.unread > 0 ? "#1877F2" : "#65676b", flexShrink: 0,
                }}>{conv.time}</span>
              </div>
              <div style={{
                fontSize: 13.5, color: conv.unread > 0 ? "#050505" : "#65676b",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                fontWeight: conv.unread > 0 ? 700 : 400,
              }}>
                {conv.lastMessage || "Démarrer une conversation"}
              </div>
            </div>
            {conv.unread > 0 && (
              <div style={{
                background: "#1877F2", color: "#fff", borderRadius: "50%",
                minWidth: 22, height: 22,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 800, flexShrink: 0, alignSelf: "center",
              }}>
                {conv.unread > 9 ? "9+" : conv.unread}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
