import { useState, useRef, useEffect } from "react";
import { useNavigate } from "../router";
import { apiGetConversations, apiGetMessages, apiSendMessage, apiGetUsers, type PublicUser } from "../lib/api";
import { useCallSignaling } from "../hooks/useCallSignaling";

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
  const [typing, setTyping]           = useState(false);
  const [overlay, setOverlay]         = useState<Overlay>("none");

  const bottomRef      = useRef<HTMLDivElement>(null);
  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const sig = useCallSignaling(meId);

  const activeUser   = activeConv ? (convList.find(c => c.id === activeConv)?.user ?? null) : null;
  const callPeerUser = sig.callPeerId ? (convList.find(c => c.id === sig.callPeerId)?.user
    ?? (() => {
      const u = allUsers.find(x => x.id === sig.callPeerId);
      if (!u) return null;
      const name = `${u.firstName} ${u.lastName}`;
      return { name, initials: mkInitials(name), color: CONV_COLORS[sig.callPeerId % CONV_COLORS.length] };
    })()) : null;

  const currentMessages  = activeConv ? (messages[activeConv] ?? []) : [];
  const filteredConvs    = convList.filter(c => c.user.name.toLowerCase().includes(search.toLowerCase()));

  // Sync local stream → video element
  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = sig.localStream;
  }, [sig.localStream]);

  // Sync remote stream → video or audio element
  useEffect(() => {
    if (sig.callType === "video" && remoteVideoRef.current)
      remoteVideoRef.current.srcObject = sig.remoteStream;
    else if (sig.callType === "audio" && remoteAudioRef.current)
      remoteAudioRef.current.srcObject = sig.remoteStream;
  }, [sig.remoteStream, sig.callType]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [currentMessages]);

  useEffect(() => {
    Promise.all([apiGetConversations(), apiGetUsers()])
      .then(([convs, users]) => {
        setAllUsers(users);
        const normalized: NormConv[] = convs.map(c => {
          const u    = users.find(u => u.id === c.userId);
          const name = u ? `${u.firstName} ${u.lastName}` : `Utilisateur #${c.userId}`;
          return {
            id:          c.userId,
            user:        { name, initials: mkInitials(name), color: CONV_COLORS[c.userId % CONV_COLORS.length] },
            lastMessage: c.lastMessage,
            unread:      c.unreadCount,
            time:        new Date(c.updatedAt).toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" }),
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

  const fmtTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const sendMsg = (text?: string, attachment?: Message["attachment"]) => {
    const content = text ?? newMsg.trim();
    if (!content && !attachment) return;
    if (!activeConv) return;
    const now = new Date().toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" });
    const msg: Message = { id: Date.now(), text: content, mine: true, time: now, status: "sent", attachment };
    setMessages(ms => ({ ...ms, [activeConv]: [...(ms[activeConv] ?? []), msg] }));
    if (!text) setNewMsg("");
    apiSendMessage(activeConv, content).catch(() => {});
  };

  navigate; // suppress lint warning

  /* ══════════════════════════════════════════════════════════════
     INCOMING CALL OVERLAY (top priority)
  ══════════════════════════════════════════════════════════════ */
  if (sig.callState === "incoming" && sig.incomingCall) {
    const caller     = allUsers.find(u => u.id === sig.incomingCall!.fromUserId);
    const callerName = caller
      ? `${caller.firstName} ${caller.lastName}`
      : `Utilisateur #${sig.incomingCall.fromUserId}`;
    const callerInitials = mkInitials(callerName);
    const callerColor    = CONV_COLORS[sig.incomingCall.fromUserId % CONV_COLORS.length];
    const isVideo        = sig.incomingCall.callType === "video";

    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "linear-gradient(160deg, #0d1b2a 0%, #1a3a52 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "48px 32px",
      }}>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, letterSpacing: 1, textTransform: "uppercase", marginBottom: 24 }}>
          {isVideo ? "📹 Appel vidéo entrant" : "📞 Appel audio entrant"}
        </div>
        <div style={{
          width: 110, height: 110, borderRadius: "50%", background: callerColor,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 40, color: "#fff", fontWeight: 800,
          boxShadow: `0 0 0 14px ${callerColor}44, 0 0 0 28px ${callerColor}22`,
          animation: "pulse 1.5s infinite",
          marginBottom: 20,
        }}>{callerInitials}</div>
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
     ACTIVE / CALLING OVERLAY (real WebRTC)
  ══════════════════════════════════════════════════════════════ */
  if (sig.callState === "calling" || sig.callState === "active") {
    const peer    = callPeerUser;
    const isVideo = sig.callType === "video";

    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: isVideo
          ? "linear-gradient(160deg, #0d1b2a 0%, #1a3a52 100%)"
          : "linear-gradient(160deg, #1a1a2e 0%, #16213e 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
        padding: "60px 32px 48px",
      }}>

        {/* Hidden audio element for voice calls */}
        <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: "none" }} />

        {/* Top: peer info */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 12, letterSpacing: 1, textTransform: "uppercase" }}>
            {isVideo ? "📹 Appel vidéo" : "📞 Appel audio"}
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <div style={{
              width: 100, height: 100, borderRadius: "50%",
              background: peer?.color ?? "#1877F2",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 36, color: "#fff", fontWeight: 800,
              boxShadow: sig.callState === "active"
                ? `0 0 0 12px ${peer?.color ?? "#1877F2"}44, 0 0 0 24px ${peer?.color ?? "#1877F2"}22`
                : "none",
              transition: "box-shadow 0.6s",
            }}>{peer?.initials ?? "?"}</div>
          </div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 24, marginBottom: 4 }}>
            {peer?.name ?? "Appel en cours"}
          </div>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 15 }}>
            {sig.callState === "active"
              ? <span style={{ color: "#42B72A", fontWeight: 700 }}>🟢 {fmtTime(sig.callDuration)}</span>
              : <span>⏳ Connexion...</span>
            }
          </div>
          {sig.isMuted && (
            <div style={{ marginTop: 8, background: "rgba(244,67,54,0.25)", borderRadius: 20, padding: "4px 14px", display: "inline-block", color: "#FF6B6B", fontSize: 13, fontWeight: 600 }}>
              🔇 Micro coupé
            </div>
          )}
          {sig.mediaError && (
            <div style={{ marginTop: 8, background: "rgba(244,67,54,0.2)", color: "#FF6B6B", borderRadius: 12, padding: "8px 16px", fontSize: 13 }}>
              {sig.mediaError}
            </div>
          )}
        </div>

        {/* Middle: video feeds */}
        {isVideo && (
          <div style={{ width: "100%", maxWidth: 380, position: "relative" }}>
            {/* Remote (main) */}
            <div style={{ width: "100%", aspectRatio: "4/3", borderRadius: 16, overflow: "hidden", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.15)" }}>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
              {sig.callState !== "active" && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", color: "rgba(255,255,255,0.7)", fontSize: 14, flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 32 }}>⏳</div>
                  <div>Connexion...</div>
                </div>
              )}
            </div>

            {/* Local (corner) */}
            <div style={{ position: "absolute", bottom: 10, right: 10, width: 90, height: 120, borderRadius: 10, overflow: "hidden", border: "2px solid rgba(255,255,255,0.4)", background: "rgba(0,0,0,0.6)" }}>
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
          </div>
        )}

        {/* Controls */}
        <div style={{ width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 32 }}>
            {/* Mute */}
            <div onClick={() => sig.toggleMute()} style={{ textAlign: "center", cursor: "pointer" }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: sig.isMuted ? "rgba(244,67,54,0.85)" : "rgba(255,255,255,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, margin: "0 auto 6px",
                border: `2px solid ${sig.isMuted ? "#F44336" : "rgba(255,255,255,0.2)"}`,
                transition: "all 0.2s",
              }}>
                {sig.isMuted ? "🔇" : "🎙️"}
              </div>
              <div style={{ color: sig.isMuted ? "#FF6B6B" : "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: sig.isMuted ? 700 : 400 }}>
                {sig.isMuted ? "Activé" : "Muet"}
              </div>
            </div>

            {/* Flip camera (video only) */}
            {isVideo && (
              <div onClick={() => sig.flipCamera()} style={{ textAlign: "center", cursor: "pointer" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: "rgba(255,255,255,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, margin: "0 auto 6px",
                  border: "2px solid rgba(255,255,255,0.2)",
                }}>🔁</div>
                <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>
                  {sig.cameraFront ? "Frontale" : "Arrière"}
                </div>
              </div>
            )}

            {/* Speaker placeholder */}
            <div style={{ textAlign: "center", opacity: 0.5 }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: "rgba(255,255,255,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, margin: "0 auto 6px",
                border: "2px solid rgba(255,255,255,0.2)",
              }}>🔊</div>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>HP</div>
            </div>
          </div>

          {/* Hang up */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div onClick={() => sig.endCall()} style={{
              width: 68, height: 68, borderRadius: "50%", background: "#F44336",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, cursor: "pointer",
              boxShadow: "0 4px 16px rgba(244,67,54,0.5)",
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
      <div style={{
        position: "fixed", top: 56, bottom: 60, left: 0, right: 0,
        background: "var(--fb-bg)", zIndex: 10, overflowY: "auto",
      }}>
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
              { icon: "📞", label: "Appel", action: () => { setOverlay("none"); sig.startCall(activeConv, "audio"); } },
              { icon: "📹", label: "Vidéo",  action: () => { setOverlay("none"); sig.startCall(activeConv, "video"); } },
            ].map(a => (
              <div key={a.label} onClick={a.action} style={{ cursor: "pointer", textAlign: "center" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--fb-blue)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, margin: "0 auto 6px" }}>{a.icon}</div>
                <div style={{ fontSize: 11, color: "var(--fb-text-secondary)" }}>{a.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: "var(--fb-white)", marginTop: 8, borderTop: "1px solid var(--fb-divider)", borderBottom: "1px solid var(--fb-divider)" }}>
          {[
            { icon: "📧", label: "Email",            value: `${activeUser.name.toLowerCase().replace(" ", ".")}@mail.com` },
            { icon: "📞", label: "Téléphone",         value: "+225 07 XX XX XX XX" },
            { icon: "🌍", label: "Pays",              value: "Côte d'Ivoire 🇨🇮" },
            { icon: "🏅", label: "Score de confiance",value: "Niveau Or · 88%" },
            { icon: "💼", label: "Profession",        value: "Entrepreneur" },
          ].map((row, i) => (
            <div key={i} style={{ display: "flex", gap: 14, padding: "13px 16px", borderBottom: "1px solid var(--fb-divider)", alignItems: "center" }}>
              <span style={{ fontSize: 20 }}>{row.icon}</span>
              <div>
                <div style={{ fontSize: 12, color: "var(--fb-text-secondary)" }}>{row.label}</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{row.value}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>
          {[
            { icon: "🔕", label: "Couper les notifications",          color: "var(--fb-text)" },
            { icon: "🔍", label: "Rechercher dans la conversation",    color: "var(--fb-text)" },
            { icon: "🗑️", label: "Supprimer la conversation",         color: "#F44336" },
            { icon: "🚫", label: "Bloquer ce contact",                color: "#F44336" },
          ].map((a, i) => (
            <div key={i} style={{ background: "var(--fb-white)", padding: "14px 16px", borderBottom: "1px solid var(--fb-divider)", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
              <span style={{ fontSize: 20 }}>{a.icon}</span>
              <span style={{ fontWeight: 600, fontSize: 15, color: a.color }}>{a.label}</span>
            </div>
          ))}
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
        display: "flex", flexDirection: "column", background: "var(--fb-bg)", zIndex: 5,
      }}>
        {/* Header */}
        <div style={{
          background: "var(--fb-white)", padding: "10px 12px",
          borderBottom: "1px solid var(--fb-divider)", display: "flex",
          alignItems: "center", gap: 10, flexShrink: 0,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}>
          <button onClick={() => setActiveConv(null)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--fb-blue)", padding: "4px 6px" }}>←</button>
          <div style={{ position: "relative" }}>
            <div className="avatar" style={{ background: activeUser.color, width: 42, height: 42, fontSize: 16 }}>{activeUser.initials}</div>
            <div style={{ position: "absolute", bottom: 1, right: 1, width: 12, height: 12, background: "#42B72A", borderRadius: "50%", border: "2px solid #fff" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{activeUser.name}</div>
            <div style={{ fontSize: 12, color: "#42B72A", fontWeight: 600 }}>
              {typing ? "⌨️ En train d'écrire..." : "En ligne"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              onClick={() => sig.startCall(activeConv, "audio")}
              title="Appel audio"
              style={{ background: "var(--fb-bg)", border: "none", borderRadius: "50%", width: 40, height: 40, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
              📞
            </button>
            <button
              onClick={() => sig.startCall(activeConv, "video")}
              title="Appel vidéo"
              style={{ background: "var(--fb-bg)", border: "none", borderRadius: "50%", width: 40, height: 40, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
              📹
            </button>
            <button
              onClick={() => setOverlay("info")}
              title="Infos du contact"
              style={{ background: "var(--fb-bg)", border: "none", borderRadius: "50%", width: 40, height: 40, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
              ℹ️
            </button>
          </div>
        </div>

        {/* Messages list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ textAlign: "center", fontSize: 12, color: "var(--fb-text-secondary)", background: "rgba(255,255,255,0.8)", borderRadius: 20, padding: "4px 14px", margin: "0 auto 8px" }}>
            Aujourd'hui
          </div>

          {currentMessages.map((msg, i) => {
            const showAvatar = !msg.mine && (i === 0 || currentMessages[i - 1]?.mine);
            return (
              <div key={msg.id} style={{ display: "flex", justifyContent: msg.mine ? "flex-end" : "flex-start", gap: 8, alignItems: "flex-end" }}>
                {!msg.mine && (
                  <div style={{ width: 28, flexShrink: 0 }}>
                    {showAvatar && <div className="avatar xs" style={{ background: activeUser.color }}>{activeUser.initials}</div>}
                  </div>
                )}
                <div style={{
                  maxWidth: "72%", background: msg.mine ? "var(--fb-blue)" : "var(--fb-white)",
                  color: msg.mine ? "#fff" : "var(--fb-text)",
                  borderRadius: msg.mine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  padding: "10px 14px", fontSize: 14, lineHeight: 1.4,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                }}>
                  {msg.attachment && (
                    <div style={{
                      background: msg.mine ? "rgba(255,255,255,0.15)" : "var(--fb-bg)",
                      borderRadius: 8, padding: "8px 10px", marginBottom: 6, fontSize: 13,
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <span style={{ fontSize: 18 }}>
                        {msg.attachment.type === "image" ? "🖼️" : msg.attachment.type === "doc" ? "📄" : msg.attachment.type === "location" ? "📍" : "🎵"}
                      </span>
                      <span>{msg.attachment.label}</span>
                    </div>
                  )}
                  {msg.text}
                  <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4, display: "flex", justifyContent: "flex-end", gap: 4, alignItems: "center" }}>
                    {msg.time}
                    {msg.mine && <span style={{ fontSize: 11 }}>{msg.status === "read" ? "✓✓" : "✓"}</span>}
                  </div>
                </div>
              </div>
            );
          })}

          {typing && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <div className="avatar xs" style={{ background: activeUser.color }}>{activeUser.initials}</div>
              <div style={{ background: "var(--fb-white)", borderRadius: "18px 18px 18px 4px", padding: "12px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                  {[0, 1, 2].map(j => (
                    <div key={j} style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--fb-text-secondary)", animation: `bounce 1.2s ${j * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Attachment picker */}
        {overlay === "attach" && (
          <div style={{
            position: "absolute", bottom: 58, left: 0, right: 0,
            background: "var(--fb-white)", borderTop: "1px solid var(--fb-divider)",
            padding: "16px 20px", boxShadow: "0 -4px 16px rgba(0,0,0,0.1)",
          }}>
            <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>Joindre un fichier</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {[
                { icon: "📷", label: "Photo",    action: () => { sendMsg("📷 Photo envoyée", { type: "image", label: "photo.jpg" }); setOverlay("none"); } },
                { icon: "📄", label: "Document", action: () => { sendMsg("📄 Document envoyé", { type: "doc", label: "document.pdf" }); setOverlay("none"); } },
                { icon: "📍", label: "Position", action: () => { sendMsg("📍 Ma position actuelle", { type: "location", label: "Abidjan, Cocody" }); setOverlay("none"); } },
                { icon: "🎵", label: "Audio",    action: () => { sendMsg("🎵 Message vocal (0:08)", { type: "audio", label: "vocal_0008.m4a" }); setOverlay("none"); } },
                { icon: "🛍️", label: "Produit",  action: () => { sendMsg("🛍️ Article partagé : Tissu Wax — 4 500 FCFA"); setOverlay("none"); } },
                { icon: "💳", label: "Paiement", action: () => { sendMsg("💸 Demande de paiement : 15 000 FCFA"); setOverlay("none"); } },
                { icon: "📅", label: "RDV",      action: () => { sendMsg("📅 Rendez-vous proposé : Demain à 10h00"); setOverlay("none"); } },
                { icon: "📊", label: "Sondage",  action: () => { sendMsg("📊 Sondage : Quel créneau vous convient ?"); setOverlay("none"); } },
              ].map(item => (
                <div key={item.label} onClick={item.action} style={{ textAlign: "center", cursor: "pointer" }}>
                  <div style={{ width: 52, height: 52, background: "var(--fb-bg)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, margin: "0 auto 6px" }}>{item.icon}</div>
                  <div style={{ fontSize: 11, color: "var(--fb-text-secondary)", fontWeight: 600 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input bar */}
        <div style={{
          background: "var(--fb-white)", padding: "8px 10px",
          borderTop: "1px solid var(--fb-divider)", display: "flex", gap: 8, alignItems: "center", flexShrink: 0,
        }}>
          <button
            onClick={() => setOverlay(o => o === "attach" ? "none" : "attach")}
            style={{
              background: overlay === "attach" ? "var(--fb-blue)" : "none",
              border: "none", width: 36, height: 36, borderRadius: "50%",
              cursor: "pointer", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center",
              color: overlay === "attach" ? "#fff" : "var(--fb-blue)", flexShrink: 0,
              transition: "background 0.2s",
            }}>
            {overlay === "attach" ? "✕" : "+"}
          </button>
          <button style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--fb-blue)", flexShrink: 0 }}>📷</button>
          <input
            value={newMsg}
            onChange={e => { setNewMsg(e.target.value); if (overlay === "attach") setOverlay("none"); }}
            onKeyDown={e => { if (e.key === "Enter") sendMsg(); }}
            placeholder="Message..."
            style={{ flex: 1, background: "var(--fb-bg)", border: "none", borderRadius: 22, padding: "10px 16px", fontSize: 14, outline: "none" }}
          />
          {newMsg.trim() ? (
            <button onClick={() => sendMsg()} style={{ background: "var(--fb-blue)", border: "none", borderRadius: "50%", width: 38, height: 38, color: "#fff", cursor: "pointer", fontSize: 17, flexShrink: 0 }}>➤</button>
          ) : (
            <button style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "var(--fb-blue)", flexShrink: 0 }}>👍</button>
          )}
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     CONVERSATIONS LIST
  ══════════════════════════════════════════════════════════════ */
  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ background: "var(--fb-white)", padding: "12px 16px", borderBottom: "1px solid var(--fb-divider)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 22 }}>Messages</div>
          <button style={{ background: "var(--fb-bg)", border: "none", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", fontSize: 18 }}>✏️</button>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Rechercher dans les messages..."
          style={{ width: "100%", background: "var(--fb-bg)", border: "none", borderRadius: 20, padding: "9px 16px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
        />
      </div>

      {/* Active now */}
      <div style={{ background: "var(--fb-white)", borderBottom: "1px solid var(--fb-divider)", padding: "12px 16px" }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--fb-text-secondary)", marginBottom: 10 }}>ACTIFS MAINTENANT</div>
        <div style={{ display: "flex", gap: 16, overflowX: "auto", scrollbarWidth: "none" }}>
          {convList.slice(0, 6).map(conv => (
            <div key={conv.id} onClick={() => setActiveConv(conv.id)} style={{ flexShrink: 0, textAlign: "center", cursor: "pointer" }}>
              <div style={{ position: "relative", marginBottom: 4 }}>
                <div className="avatar" style={{ background: conv.user.color, width: 48, height: 48, fontSize: 18, margin: "0 auto" }}>{conv.user.initials}</div>
                <div style={{ position: "absolute", bottom: 1, right: 1, width: 13, height: 13, background: "#42B72A", borderRadius: "50%", border: "2px solid #fff" }} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, maxWidth: 52, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {conv.user.name.split(" ")[0]}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* List */}
      <div>
        {filteredConvs.map(conv => (
          <div key={conv.id} onClick={() => setActiveConv(conv.id)} style={{
            display: "flex", gap: 12, padding: "12px 16px", cursor: "pointer",
            background: "var(--fb-white)", borderBottom: "1px solid var(--fb-divider)", alignItems: "center",
          }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div className="avatar" style={{ background: conv.user.color, width: 54, height: 54, fontSize: 20 }}>{conv.user.initials}</div>
              <div style={{ position: "absolute", bottom: 2, right: 2, width: 14, height: 14, background: "#42B72A", borderRadius: "50%", border: "2px solid #fff" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <span style={{ fontWeight: conv.unread > 0 ? 800 : 600, fontSize: 15 }}>{conv.user.name}</span>
                <span style={{ fontSize: 12, color: conv.unread > 0 ? "var(--fb-blue)" : "var(--fb-text-secondary)", fontWeight: conv.unread > 0 ? 700 : 400 }}>{conv.time}</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--fb-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: conv.unread > 0 ? 700 : 400 }}>
                {conv.lastMessage}
              </div>
            </div>
            {conv.unread > 0 && (
              <div style={{ background: "var(--fb-blue)", color: "#fff", borderRadius: "50%", minWidth: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                {conv.unread}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
