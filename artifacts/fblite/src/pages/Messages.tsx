import { useState, useRef, useEffect } from "react";
import { useNavigate } from "../router";
import { apiGetConversations, apiGetMessages, apiSendMessage, apiGetUsers, type PublicUser } from "../lib/api";

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

type Overlay = "none" | "calling" | "video" | "info" | "attach";


export default function Messages({ initialUserId }: { initialUserId?: number }) {
  const navigate = useNavigate();
  const rawUser = localStorage.getItem("fb_user");
  const user = rawUser ? JSON.parse(rawUser) : { name: "Moi" };

  const meId = (() => { try { return (JSON.parse(localStorage.getItem("fb_user") ?? "{}") as { id?: number }).id ?? 0; } catch { return 0; } })();

  const [activeConv, setActiveConv] = useState<number | null>(initialUserId ?? null);
  const [messages, setMessages] = useState<Record<number, Message[]>>({});
  const [convList, setConvList]   = useState<NormConv[]>([]);
  const [allUsers, setAllUsers]   = useState<PublicUser[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [search, setSearch] = useState("");
  const [typing, setTyping] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>("none");
  const [callDuration, setCallDuration] = useState(0);
  const [callActive, setCallActive] = useState(false);
  const [callMuted, setCallMuted] = useState(false);
  const [callSpeaker, setCallSpeaker] = useState(false);
  const [cameraFront, setCameraFront] = useState(true);
  const [cameraFlipping, setCameraFlipping] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [addedContacts, setAddedContacts] = useState<number[]>([]);
  const [callToast, setCallToast] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const activeUser = activeConv ? (convList.find(c => c.id === activeConv)?.user ?? null) : null;
  const currentMessages = activeConv ? (messages[activeConv] ?? []) : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages]);

  useEffect(() => {
    if (callActive) {
      callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      setCallDuration(0);
    }
    return () => { if (callTimerRef.current) clearInterval(callTimerRef.current); };
  }, [callActive]);

  // Release camera/mic when navigating away — prevents NotReadableError on LiveStreamPage
  useEffect(() => {
    return () => { stopStream(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    Promise.all([apiGetConversations(), apiGetUsers()])
      .then(([convs, users]) => {
        setAllUsers(users);
        const normalized: NormConv[] = convs.map(c => {
          const u = users.find(u => u.id === c.userId);
          const name = u ? `${u.firstName} ${u.lastName}` : `Utilisateur #${c.userId}`;
          return {
            id: c.userId,
            user: { name, initials: mkInitials(name), color: CONV_COLORS[c.userId % CONV_COLORS.length] },
            lastMessage: c.lastMessage,
            unread: c.unreadCount,
            time: new Date(c.updatedAt).toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" }),
          };
        });
        // If opened directly from a profile/search and conversation doesn't exist yet, inject synthetic entry
        if (initialUserId && !normalized.find(c => c.id === initialUserId)) {
          const u = users.find(u => u.id === initialUserId);
          if (u) {
            const name = `${u.firstName} ${u.lastName}`;
            normalized.unshift({
              id: initialUserId,
              user: { name, initials: mkInitials(name), color: CONV_COLORS[initialUserId % CONV_COLORS.length] },
              lastMessage: "",
              unread: 0,
              time: "",
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
          id: m.id,
          text: m.content,
          mine: m.fromUserId === meId,
          time: new Date(m.createdAt).toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" }),
          status: m.isRead ? "read" as const : "sent" as const,
        })),
      }));
    }).catch(() => {});
  }, [activeConv]);

  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const showToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setCallToast(msg);
    toastTimerRef.current = setTimeout(() => setCallToast(null), 2200);
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const startCall = async (type: "calling" | "video") => {
    setOverlay(type);
    setCallActive(false);
    setCameraFront(true);
    setAddedContacts([]);
    setShowAddContact(false);
    setMediaError(null);
    stopStream();
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: type === "video" ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current && type === "video") {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCallActive(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Permission") || msg.includes("NotAllowed")) {
        setMediaError("Accès refusé — autorisez la caméra/micro dans les paramètres du navigateur.");
      } else if (msg.includes("NotFound")) {
        setMediaError("Caméra ou micro introuvable sur cet appareil.");
      } else {
        setMediaError("Impossible d'accéder à la caméra/micro.");
      }
      setTimeout(() => setCallActive(true), 2000);
    }
  };

  const endCall = () => {
    stopStream();
    setCallActive(false);
    setCallMuted(false);
    setCallSpeaker(false);
    setCameraFront(true);
    setShowAddContact(false);
    setAddedContacts([]);
    setCallToast(null);
    setMediaError(null);
    setOverlay("none");
  };

  const toggleMute = () => {
    const next = !callMuted;
    setCallMuted(next);
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(t => { t.enabled = !next; });
    }
    showToast(next ? "🔇 Micro désactivé" : "🎙️ Micro activé");
  };

  const toggleSpeaker = async () => {
    const next = !callSpeaker;
    setCallSpeaker(next);
    if (videoRef.current && "setSinkId" in videoRef.current) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const speakers = devices.filter(d => d.kind === "audiooutput");
        const target = next
          ? speakers.find(d => d.label.toLowerCase().includes("speaker") || d.label.toLowerCase().includes("loud")) ?? speakers[speakers.length - 1]
          : speakers[0];
        if (target) {
          await (videoRef.current as HTMLVideoElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(target.deviceId);
        }
      } catch { /* setSinkId not supported on this browser */ }
    }
    showToast(next ? "🔊 Haut-parleur activé" : "🔈 Haut-parleur désactivé");
  };

  const flipCamera = async () => {
    if (!streamRef.current) {
      showToast("Caméra non disponible");
      return;
    }
    setCameraFlipping(true);
    const newFront = !cameraFront;
    streamRef.current.getVideoTracks().forEach(t => t.stop());
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFront ? "user" : "environment" },
        audio: false,
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      const audioTracks = streamRef.current.getAudioTracks();
      const combined = new MediaStream([...audioTracks, newVideoTrack]);
      streamRef.current = combined;
      if (videoRef.current) {
        videoRef.current.srcObject = combined;
        videoRef.current.play().catch(() => {});
      }
      setCameraFront(newFront);
      showToast(newFront ? "🤳 Caméra frontale" : "📷 Caméra arrière");
    } catch {
      showToast("Impossible de retourner la caméra");
    }
    setCameraFlipping(false);
  };

  const addContact = (id: number, name: string) => {
    if (addedContacts.includes(id)) return;
    setAddedContacts(prev => [...prev, id]);
    setShowAddContact(false);
    showToast(`✅ ${name} ajouté(e) à l'appel`);
  };

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

  const addableContacts = allUsers.slice(0, 8).map(u => ({
    id: u.id,
    name: `${u.firstName} ${u.lastName}`,
    initials: mkInitials(`${u.firstName} ${u.lastName}`),
    color: CONV_COLORS[u.id % CONV_COLORS.length],
  }));

  const filteredConvs = convList.filter(c =>
    c.user.name.toLowerCase().includes(search.toLowerCase())
  );

  /* ── OVERLAYS ────────────────────────────────────────────── */

  if (activeConv && activeUser && (overlay === "calling" || overlay === "video")) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: overlay === "video"
          ? "linear-gradient(160deg, #0d1b2a 0%, #1a3a52 100%)"
          : "linear-gradient(160deg, #1a1a2e 0%, #16213e 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
        padding: "60px 32px 48px",
      }}>

        {/* Toast */}
        {callToast && (
          <div style={{
            position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.75)", color: "#fff", borderRadius: 20,
            padding: "8px 20px", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap",
            zIndex: 10, backdropFilter: "blur(6px)",
          }}>{callToast}</div>
        )}

        {/* Add contact bottom sheet */}
        {showAddContact && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 20,
            background: "#1e2a3a", borderRadius: "16px 16px 0 0",
            padding: "20px 16px 32px", boxShadow: "0 -8px 32px rgba(0,0,0,0.5)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>Ajouter à l'appel</div>
              <button onClick={() => setShowAddContact(false)} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            {addableContacts.map(c => (
              <div key={c.id} onClick={() => addContact(c.id, c.name)} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 8px", cursor: "pointer",
                borderRadius: 10, background: addedContacts.includes(c.id) ? "rgba(66,183,42,0.2)" : "transparent",
              }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", background: c.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 15, flexShrink: 0 }}>{c.initials}</div>
                <div style={{ flex: 1, color: "#fff", fontWeight: 600 }}>{c.name}</div>
                <div style={{ color: addedContacts.includes(c.id) ? "#42B72A" : "rgba(255,255,255,0.4)", fontSize: 18 }}>
                  {addedContacts.includes(c.id) ? "✓" : "+"}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Top: contact info + added contacts */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 12, letterSpacing: 1, textTransform: "uppercase" }}>
            {overlay === "video" ? "📹 Appel vidéo" : "📞 Appel audio"}
          </div>

          {/* Main avatar + added contact avatars */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: -12, marginBottom: 16 }}>
            <div style={{
              width: 100, height: 100, borderRadius: "50%", background: activeUser.color,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 36, color: "#fff", fontWeight: 800,
              boxShadow: callActive
                ? `0 0 0 12px ${activeUser.color}44, 0 0 0 24px ${activeUser.color}22`
                : "none",
              transition: "box-shadow 0.6s", flexShrink: 0,
            }}>{activeUser.initials}</div>
            {addedContacts.map(id => {
              const c = addableContacts.find(x => x.id === id);
              if (!c) return null;
              return (
                <div key={id} style={{
                  width: 52, height: 52, borderRadius: "50%", background: c.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, color: "#fff", fontWeight: 800,
                  border: "3px solid #0d1b2a", marginLeft: -14, flexShrink: 0,
                }}>{c.initials}</div>
              );
            })}
          </div>

          <div style={{ color: "#fff", fontWeight: 800, fontSize: 24, marginBottom: 4 }}>
            {addedContacts.length > 0
              ? `${activeUser.name.split(" ")[0]} + ${addedContacts.length}`
              : activeUser.name}
          </div>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 15 }}>
            {callActive ? (
              <span style={{ color: "#42B72A", fontWeight: 700 }}>🟢 {fmtTime(callDuration)}</span>
            ) : (
              <span>⏳ Connexion...</span>
            )}
          </div>

          {/* Muted indicator */}
          {callMuted && (
            <div style={{ marginTop: 8, background: "rgba(244,67,54,0.25)", borderRadius: 20, padding: "4px 14px", display: "inline-block", color: "#FF6B6B", fontSize: 13, fontWeight: 600 }}>
              🔇 Micro coupé
            </div>
          )}
        </div>

        {/* Middle: real camera feed */}
        {overlay === "video" && (
          <div style={{
            width: "100%", maxWidth: 320, aspectRatio: "4/3",
            borderRadius: 16, overflow: "hidden", position: "relative",
            background: "rgba(0,0,0,0.5)",
            border: "1px solid rgba(255,255,255,0.15)",
            transform: cameraFlipping ? "scaleX(0)" : "scaleX(1)",
            transition: "transform 0.3s ease",
          }}>
            {/* Live camera video */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: "100%", height: "100%", objectFit: "cover",
                display: "block",
                transform: cameraFront ? "scaleX(-1)" : "scaleX(1)",
              }}
            />

            {/* Fallback shown when no stream yet or error */}
            {(!callActive || mediaError) && (
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexDirection: "column", gap: 8,
                background: "rgba(0,0,0,0.6)",
                color: "rgba(255,255,255,0.7)", fontSize: 13, textAlign: "center", padding: 16,
              }}>
                {mediaError
                  ? <><div style={{ fontSize: 32 }}>📵</div><div>{mediaError}</div></>
                  : <><div style={{ fontSize: 32 }}>⏳</div><div>Connexion...</div></>
                }
              </div>
            )}

            {/* Muted mic overlay */}
            {callMuted && (
              <div style={{ position: "absolute", bottom: 8, left: 8, background: "rgba(244,67,54,0.85)", borderRadius: 12, padding: "2px 8px", fontSize: 11, color: "#fff", fontWeight: 600 }}>
                🔇
              </div>
            )}
            {/* Speaker indicator */}
            {callSpeaker && (
              <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(66,183,42,0.85)", borderRadius: 12, padding: "2px 8px", fontSize: 11, color: "#fff", fontWeight: 600 }}>
                🔊 HP
              </div>
            )}
            {/* Camera label */}
            <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.5)", borderRadius: 10, padding: "2px 8px", fontSize: 10, color: "rgba(255,255,255,0.8)" }}>
              {cameraFront ? "Frontale" : "Arrière"}
            </div>
          </div>
        )}

        {/* Bottom: controls */}
        <div style={{ width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 32 }}>
            {/* Muet */}
            <div onClick={toggleMute} style={{ textAlign: "center", cursor: "pointer" }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%", position: "relative",
                background: callMuted ? "rgba(244,67,54,0.85)" : "rgba(255,255,255,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, margin: "0 auto 6px", border: `2px solid ${callMuted ? "#F44336" : "rgba(255,255,255,0.2)"}`,
                transition: "all 0.2s",
              }}>
                {callMuted ? "🔇" : "🎙️"}
                {callMuted && <div style={{ position: "absolute", bottom: -2, right: -2, width: 16, height: 16, background: "#F44336", borderRadius: "50%", border: "2px solid #1a1a2e", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>✕</div>}
              </div>
              <div style={{ color: callMuted ? "#FF6B6B" : "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: callMuted ? 700 : 400 }}>{callMuted ? "Activé" : "Muet"}</div>
            </div>

            {/* Ajouter */}
            <div onClick={() => setShowAddContact(true)} style={{ textAlign: "center", cursor: "pointer" }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: addedContacts.length > 0 ? "rgba(66,183,42,0.3)" : "rgba(255,255,255,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, margin: "0 auto 6px", border: `2px solid ${addedContacts.length > 0 ? "#42B72A" : "rgba(255,255,255,0.2)"}`,
                transition: "all 0.2s", position: "relative",
              }}>
                👥
                {addedContacts.length > 0 && (
                  <div style={{ position: "absolute", top: -4, right: -4, width: 18, height: 18, background: "#42B72A", borderRadius: "50%", border: "2px solid #1a1a2e", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700 }}>{addedContacts.length}</div>
                )}
              </div>
              <div style={{ color: addedContacts.length > 0 ? "#42B72A" : "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: addedContacts.length > 0 ? 700 : 400 }}>Ajouter</div>
            </div>

            {/* Haut-parleur */}
            <div onClick={toggleSpeaker} style={{ textAlign: "center", cursor: "pointer" }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: callSpeaker ? "rgba(24,119,242,0.85)" : "rgba(255,255,255,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, margin: "0 auto 6px", border: `2px solid ${callSpeaker ? "#1877F2" : "rgba(255,255,255,0.2)"}`,
                transition: "all 0.2s",
              }}>
                {callSpeaker ? "🔊" : "🔈"}
              </div>
              <div style={{ color: callSpeaker ? "#64B5F6" : "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: callSpeaker ? 700 : 400 }}>
                {callSpeaker ? "Activé" : "Haut-parleur"}
              </div>
            </div>

            {/* Retourner (vidéo seulement) */}
            {overlay === "video" && (
              <div onClick={flipCamera} style={{ textAlign: "center", cursor: "pointer" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: "rgba(255,255,255,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, margin: "0 auto 6px", border: "2px solid rgba(255,255,255,0.2)",
                  transition: "transform 0.3s",
                  transform: cameraFlipping ? "rotate(180deg)" : "rotate(0deg)",
                }}>
                  🔁
                </div>
                <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>Retourner</div>
              </div>
            )}
          </div>

          {/* Hang up */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div onClick={endCall} style={{
              width: 68, height: 68, borderRadius: "50%", background: "#F44336",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, cursor: "pointer", boxShadow: "0 4px 16px rgba(244,67,54,0.5)",
            }}>📵</div>
          </div>
        </div>
      </div>
    );
  }

  if (activeConv && activeUser && overlay === "info") {
    return (
      <div style={{
        position: "fixed", top: 56, bottom: 60, left: 0, right: 0,
        background: "var(--fb-bg)", zIndex: 10, overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{ background: "var(--fb-white)", padding: "12px 16px", borderBottom: "1px solid var(--fb-divider)", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setOverlay("none")} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--fb-blue)" }}>←</button>
          <div style={{ fontWeight: 700, fontSize: 17 }}>Infos du contact</div>
        </div>

        {/* Avatar + name */}
        <div style={{ background: "var(--fb-white)", padding: "28px 20px 20px", textAlign: "center", borderBottom: "1px solid var(--fb-divider)" }}>
          <div style={{ position: "relative", display: "inline-block", marginBottom: 12 }}>
            <div className="avatar" style={{ width: 88, height: 88, fontSize: 32, background: activeUser.color }}>{activeUser.initials}</div>
            <div style={{ position: "absolute", bottom: 4, right: 4, width: 18, height: 18, background: "#42B72A", borderRadius: "50%", border: "3px solid #fff" }} />
          </div>
          <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 4 }}>{activeUser.name}</div>
          <div style={{ fontSize: 14, color: "#42B72A", fontWeight: 700 }}>🟢 En ligne</div>
          <div style={{ fontSize: 13, color: "var(--fb-text-secondary)", marginTop: 4 }}>
            📍 Abidjan, Côte d'Ivoire
          </div>
          {/* Quick actions */}
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 16 }}>
            {[
              { icon: "💬", label: "Message", action: () => setOverlay("none") },
              { icon: "📞", label: "Appel", action: () => startCall("calling") },
              { icon: "📹", label: "Vidéo", action: () => startCall("video") },
              { icon: "👤", label: "Profil", action: () => {} },
            ].map(a => (
              <div key={a.label} onClick={a.action} style={{ cursor: "pointer", textAlign: "center" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--fb-blue)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, margin: "0 auto 6px" }}>{a.icon}</div>
                <div style={{ fontSize: 11, color: "var(--fb-text-secondary)" }}>{a.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Info rows */}
        <div style={{ background: "var(--fb-white)", marginTop: 8, borderTop: "1px solid var(--fb-divider)", borderBottom: "1px solid var(--fb-divider)" }}>
          {[
            { icon: "📧", label: "Email", value: `${activeUser.name.toLowerCase().replace(" ", ".")}@mail.com` },
            { icon: "📞", label: "Téléphone", value: "+225 07 XX XX XX XX" },
            { icon: "🌍", label: "Pays", value: "Côte d'Ivoire 🇨🇮" },
            { icon: "🏅", label: "Score de confiance", value: "Niveau Or · 88%" },
            { icon: "💼", label: "Profession", value: "Entrepreneur" },
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

        {/* Actions */}
        <div style={{ marginTop: 8 }}>
          {[
            { icon: "🔕", label: "Couper les notifications", color: "var(--fb-text)" },
            { icon: "🔍", label: "Rechercher dans la conversation", color: "var(--fb-text)" },
            { icon: "🗑️", label: "Supprimer la conversation", color: "#F44336" },
            { icon: "🚫", label: "Bloquer ce contact", color: "#F44336" },
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

  /* ── CONVERSATION VIEW ───────────────────────────────────── */

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
          {/* Action buttons */}
          <div style={{ display: "flex", gap: 4 }}>
            <button
              onClick={() => startCall("calling")}
              title="Appel audio"
              style={{ background: "var(--fb-bg)", border: "none", borderRadius: "50%", width: 40, height: 40, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
              📞
            </button>
            <button
              onClick={() => startCall("video")}
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

        {/* Messages */}
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
                { icon: "📷", label: "Photo", action: () => { sendMsg("📷 Photo envoyée", { type: "image", label: "photo.jpg" }); setOverlay("none"); } },
                { icon: "📄", label: "Document", action: () => { sendMsg("📄 Document envoyé", { type: "doc", label: "document.pdf" }); setOverlay("none"); } },
                { icon: "📍", label: "Position", action: () => { sendMsg("📍 Ma position actuelle", { type: "location", label: "Abidjan, Cocody" }); setOverlay("none"); } },
                { icon: "🎵", label: "Audio", action: () => { sendMsg("🎵 Message vocal (0:08)", { type: "audio", label: "vocal_0008.m4a" }); setOverlay("none"); } },
                { icon: "🛍️", label: "Produit", action: () => { sendMsg("🛍️ Article partagé : Tissu Wax — 4 500 FCFA"); setOverlay("none"); } },
                { icon: "💳", label: "Paiement", action: () => { sendMsg("💸 Demande de paiement : 15 000 FCFA"); setOverlay("none"); } },
                { icon: "📅", label: "RDV", action: () => { sendMsg("📅 Rendez-vous proposé : Demain à 10h00"); setOverlay("none"); } },
                { icon: "📊", label: "Sondage", action: () => { sendMsg("📊 Sondage : Quel créneau vous convient ?"); setOverlay("none"); } },
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

  /* ── CONVERSATIONS LIST ──────────────────────────────────── */
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
