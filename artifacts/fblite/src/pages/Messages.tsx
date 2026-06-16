import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "../router";
import { apiGetConversations, apiGetMessages, apiSendMessage, apiGetUsers, apiGetUserPresence, apiGetChatGroups, apiCreateChatGroup, apiGetChatGroupInfo, apiGetChatGroupMessages, apiSendChatGroupMessage, apiLeaveChatGroup, apiSendTyping, apiGetTyping, apiUploadFile, apiUploadVoice, apiDeleteConversation, type PublicUser, type ApiChatGroup, type ApiChatGroupInfo } from "../lib/api";
import { useCallSignaling, type NewMessagePayload } from "../hooks/useCallSignaling";

void ({} as ApiChatGroup);

const CONV_THEMES = {
  "bp-green": { label:"BrutePawa Vert",  bg:"#F0FDF4", mine:"#16C24A", mineText:"#fff", theirs:"#fff",     theirsText:"#111", accent:"#16C24A" },
  "ocean":    { label:"Océan Bleu",      bg:"#EFF6FF", mine:"#3B82F6", mineText:"#fff", theirs:"#fff",     theirsText:"#111", accent:"#3B82F6" },
  "orange":   { label:"Soleil Orange",   bg:"#FFF7ED", mine:"#F97316", mineText:"#fff", theirs:"#fff",     theirsText:"#111", accent:"#F97316" },
  "violet":   { label:"Violet Premium",  bg:"#FAF5FF", mine:"#8B5CF6", mineText:"#fff", theirs:"#fff",     theirsText:"#111", accent:"#8B5CF6" },
  "rose":     { label:"Rose Moderne",    bg:"#FFF1F2", mine:"#F43F5E", mineText:"#fff", theirs:"#fff",     theirsText:"#111", accent:"#F43F5E" },
  "indigo":   { label:"Indigo",          bg:"#EEF2FF", mine:"#6366F1", mineText:"#fff", theirs:"#fff",     theirsText:"#111", accent:"#6366F1" },
  "cyan":     { label:"Cyan",            bg:"#ECFEFF", mine:"#06B6D4", mineText:"#fff", theirs:"#fff",     theirsText:"#111", accent:"#06B6D4" },
  "gold":     { label:"Or",              bg:"#FEFCE8", mine:"#D97706", mineText:"#fff", theirs:"#fff",     theirsText:"#111", accent:"#D97706" },
  "dark":     { label:"Nuit Sombre",     bg:"#0F172A", mine:"#334155", mineText:"#CBD5E1", theirs:"#1E293B", theirsText:"#CBD5E1", accent:"#94A3B8" },
} as const;
type ThemeKey = keyof typeof CONV_THEMES;

const CONV_WALLPAPERS = [
  { key:"none", filename:null,      label:"Aucun"             },
  { key:"wp1",  filename:"wp1.jpg", label:"Coucher de soleil" },
  { key:"wp2",  filename:"wp2.jpg", label:"Plage tropicale"   },
  { key:"wp3",  filename:"wp3.jpg", label:"Voie lactée"       },
  { key:"wp4",  filename:"wp4.jpg", label:"Aube rose"         },
  { key:"wp5",  filename:"wp5.jpg", label:"Lac nocturne"      },
] as const;
type WallpaperKey = typeof CONV_WALLPAPERS[number]["key"];
const wpUrl = (key: WallpaperKey): string | null => {
  const wp = CONV_WALLPAPERS.find(w => w.key === key);
  if (!wp || !wp.filename) return null;
  return `${import.meta.env.BASE_URL}wallpapers/${wp.filename}`;
};

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
  attachment?: { type: "image" | "doc" | "location" | "audio"; label: string; extra?: string };
}

interface NormConv {
  id: number;
  user: { name: string; initials: string; color: string };
  lastMessage: string;
  unread: number;
  time: string;
}

interface ChatGroupConv {
  id: number;
  name: string;
  avatarUrl: string | null;
  type: "group" | "channel";
  membersCount: number;
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
  role: string;
}

interface GroupMsg {
  id: number;
  text: string;
  senderName: string;
  mine: boolean;
  time: string;
  type: "text" | "system";
}

const CONV_COLORS = ["#1877F2","#E91E8C","#7B1FA2","#F57C00","#388E3C","#00838F","#D32F2F"];
const mkInitials = (name: string) =>
  name.split(" ").filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";

function fmtConvPreview(raw: string): { text: string; isAudio: boolean } {
  if (!raw) return { text: "Démarrer une conversation", isAudio: false };
  if (raw.startsWith("__audio__:")) {
    const parts = raw.slice("__audio__:".length).split(":");
    const secs = parseInt(parts[0], 10);
    if (!isNaN(secs)) {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return { text: `Message vocal • ${m}:${s.toString().padStart(2, "0")}`, isAudio: true };
    }
    return { text: "Message vocal", isAudio: true };
  }
  return { text: raw.length > 55 ? raw.slice(0, 55) + "…" : raw, isAudio: false };
}

function voiceWaveform(seed: number, bars = 30): number[] {
  return Array.from({ length: bars }, (_, i) => {
    const v = Math.abs(Math.sin(seed * 0.061 + i * 0.73)) * 0.55
            + Math.abs(Math.sin(i * 1.27 + seed * 0.13)) * 0.45;
    return Math.max(0.18, Math.min(1, v));
  });
}

type Overlay = "none" | "info" | "attach";

export default function Messages({ initialUserId, initialGroupId }: { initialUserId?: number; initialGroupId?: number }) {
  const navigate = useNavigate();
  const meId = (() => { try { return (JSON.parse(localStorage.getItem("fb_user") ?? "{}") as { id?: number }).id ?? 0; } catch { return 0; } })();

  const [activeConv, setActiveConv]   = useState<number | null>(initialUserId ?? null);
  const [messages, setMessages]       = useState<Record<number, Message[]>>({});
  const [convList, setConvList]       = useState<NormConv[]>([]);
  const [convLoading, setConvLoading] = useState(true);
  const [allUsers, setAllUsers]       = useState<PublicUser[]>([]);
  const [newMsg, setNewMsg]           = useState("");
  const [search, setSearch]           = useState("");
  const [overlay, setOverlay]         = useState<Overlay>("none");

  const [selectionMode, setSelectionMode]       = useState(false);
  const [selectedMsgs, setSelectedMsgs]         = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteForAll, setDeleteForAll]         = useState(false);
  const [presence, setPresence] = useState<{ online: boolean; lastSeenAt: string | null }>({ online: false, lastSeenAt: null });
  const [presenceTick, setPresenceTick] = useState(0);

  const [chatGroups, setChatGroups]         = useState<ChatGroupConv[]>([]);
  const [activeGroupId, setActiveGroupId]   = useState<number | null>(null);
  const [groupMsgs, setGroupMsgs]           = useState<Record<number, GroupMsg[]>>({});
  const [groupInfo, setGroupInfo]           = useState<ApiChatGroupInfo | null>(null);
  const [showGroupInfo, setShowGroupInfo]   = useState(false);
  const [groupNewMsg, setGroupNewMsg]       = useState("");

  const [groupWizard, setGroupWizard]           = useState<"none" | "members" | "name">("none");
  const [groupWizardType, setGroupWizardType]   = useState<"group" | "channel">("group");
  const [wizardMembers, setWizardMembers]       = useState<Set<number>>(new Set());
  const [wizardGroupName, setWizardGroupName]   = useState("");
  const [wizardSearch, setWizardSearch]         = useState("");
  const [wizardCreating, setWizardCreating]     = useState(false);
  const [fabOpen, setFabOpen]   = useState(false);
  const [inboxTab, setInboxTab] = useState<"all" | "unread" | "groups">("all");
  const [showInboxSearch, setShowInboxSearch] = useState(false);
  const [settingsPage, setSettingsPage] = useState<"none"|"main"|"status"|"notifs"|"invitations"|"archive"|"privacy">("none");
  const [onlineStatus, setOnlineStatus] = useState(true);
  const [notifMsgs, setNotifMsgs] = useState(true);
  const [notifReminders, setNotifReminders] = useState(true);
  const [notifPreview, setNotifPreview] = useState(false);
  const [notifOffline, setNotifOffline] = useState(false);
  const [invitTab, setInvitTab] = useState<"known"|"spam">("known");

  const [showConvMenu, setShowConvMenu]       = useState(false);
  const [showNotifSub, setShowNotifSub]       = useState(false);
  const [showDeleteConv, setShowDeleteConv]   = useState(false);
  const [showWallpaper, setShowWallpaper]     = useState(false);
  const [convWallpaper, setConvWallpaper]     = useState<string | null>(null);
  const [convThemeKey, setConvThemeKey]       = useState<ThemeKey>("bp-green");
  const [pendingThemeKey, setPendingThemeKey] = useState<ThemeKey>("bp-green");
  const [convWpKey, setConvWpKey]             = useState<WallpaperKey>("none");
  const [pendingWpKey, setPendingWpKey]       = useState<WallpaperKey>("none");

  // Persist & restore theme/wallpaper per conversation
  useEffect(() => {
    if (!activeConv) return;
    const savedTheme = localStorage.getItem(`bp_theme_${activeConv}`) as ThemeKey | null;
    const savedWp    = localStorage.getItem(`bp_wp_${activeConv}`) as WallpaperKey | null;
    setConvThemeKey(savedTheme && CONV_THEMES[savedTheme] ? savedTheme : "bp-green");
    setConvWpKey(savedWp && CONV_WALLPAPERS.find(w => w.key === savedWp) ? savedWp : "none");
  }, [activeConv]);
  const [showChatSearch, setShowChatSearch]   = useState(false);
  const [chatSearchQ, setChatSearchQ]         = useState("");
  const [chatSearchIdx, setChatSearchIdx]     = useState(0);
  const [longPressMsg, setLongPressMsg]       = useState<number | null>(null);
  const [showMicTip, setShowMicTip]           = useState(false);

  const [isRecording, setIsRecording]   = useState(false);
  const [recSeconds, setRecSeconds]     = useState(0);
  const [recDragX, setRecDragX]         = useState(0);
  const [recDragY, setRecDragY]         = useState(0);
  const [recLocked, setRecLocked]       = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<number|null>(null);
  const [audioProgress, setAudioProgress]   = useState(0);
  const [voiceSpeed, setVoiceSpeed]         = useState<1|1.5|2>(1);
  const [vpHeight, setVpHeight]         = useState<number | null>(null);
  const [vpOffset, setVpOffset]         = useState(0);
  const [peerTyping, setPeerTyping]     = useState(false);
  const [attachSheet, setAttachSheet]   = useState(false);
  const [attachPage, setAttachPage]     = useState<"none"|"poll"|"event"|"contacts"|"ai">("none");
  const [uploadingAttach, setUploadingAttach] = useState(false);
  const [aiPrompt, setAiPrompt]         = useState("");
  const [aiLoading, setAiLoading]       = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef  = useRef<HTMLInputElement>(null);
  const docInputRef     = useRef<HTMLInputElement>(null);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions]   = useState<string[]>(["", ""]);
  const [pollMultiple, setPollMultiple] = useState(true);
  const [eventName, setEventName]       = useState("");
  const [eventDesc, setEventDesc]       = useState("");
  const [eventDate, setEventDate]       = useState(new Date().toLocaleDateString("fr",{day:"numeric",month:"long",year:"numeric"}));
  const [eventTime, setEventTime]       = useState("14:00");
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const longPressTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeGroupRef    = useRef<number | null>(null);
  const groupBottomRef    = useRef<HTMLDivElement>(null);
  const bottomRef         = useRef<HTMLDivElement>(null);
  const remoteAudioRef    = useRef<HTMLAudioElement>(null);
  const voicePlayerRef    = useRef<HTMLAudioElement>(null);
  const recCancelledRef   = useRef(false);
  const recDragStartRef   = useRef<{x:number;y:number}|null>(null);
  const recIsDraggingRef  = useRef(false);
  const localVideoRef     = useRef<HTMLVideoElement>(null);
  const remoteVideoRef    = useRef<HTMLVideoElement>(null);
  const activeConvRef     = useRef<number | null>(null);
  const allUsersRef       = useRef<PublicUser[]>([]);
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const audioChunksRef    = useRef<Blob[]>([]);
  const recTimerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const recSecondsRef     = useRef(0);

  useEffect(() => { activeConvRef.current = activeConv; }, [activeConv]);
  useEffect(() => { allUsersRef.current = allUsers; }, [allUsers]);

  /* ── Deep-link: réagir aux changements de props (navigation SW) ── */
  useEffect(() => {
    if (initialUserId) {
      setActiveConv(initialUserId);
      setActiveGroupId(null);
    }
  }, [initialUserId]);

  useEffect(() => {
    if (initialGroupId) {
      setActiveGroupId(initialGroupId);
      setActiveConv(null);
    }
  }, [initialGroupId]);

  /* ── VisualViewport: shrink container when keyboard opens ── */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handler = () => {
      setVpHeight(vv.height);
      setVpOffset(vv.offsetTop);
      // auto-scroll to last message when keyboard pushes content up
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "instant" as ScrollBehavior }), 50);
    };
    handler();
    vv.addEventListener("resize", handler);
    vv.addEventListener("scroll", handler);
    return () => { vv.removeEventListener("resize", handler); vv.removeEventListener("scroll", handler); };
  }, []);

  /* ── Attachment upload helper ── */
  const sendAttachMsg = useCallback((attachment: { type: "image"|"doc"|"location"|"audio"; label: string; extra?: string }, text: string) => {
    setMessages(prev => {
      const list = [...(prev[activeConv!] ?? [])];
      list.push({ id: Date.now(), text, mine: true, time: new Date().toLocaleTimeString("fr",{hour:"2-digit",minute:"2-digit"}), status: "sent", attachment });
      return { ...prev, [activeConv!]: list };
    });
  }, [activeConv]);

  const handleFileInput = useCallback(async (file: File, kind: "image"|"doc") => {
    setAttachSheet(false); setAttachPage("none"); setUploadingAttach(true);
    try {
      const { url } = await apiUploadFile(file);
      sendAttachMsg({ type: kind, label: url, extra: file.name }, kind === "image" ? "📷 Photo" : `📄 ${file.name}`);
    } catch (e) { alert(e instanceof Error ? e.message : "Upload échoué"); }
    finally { setUploadingAttach(false); }
  }, [sendAttachMsg]);

  const handleLocation = useCallback(() => {
    setAttachSheet(false); setAttachPage("none");
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const url = `https://maps.google.com/?q=${lat},${lng}`;
        sendAttachMsg({ type: "location", label: url, extra: `${lat.toFixed(5)},${lng.toFixed(5)}` }, "📍 Ma position");
      },
      () => alert("Impossible d'accéder à la localisation. Autorisez la géolocalisation dans les paramètres du navigateur.")
    );
  }, [sendAttachMsg]);

  /* ── Peer typing indicator ── */
  useEffect(() => {
    if (!activeConv) return;
    const poll = () => apiGetTyping(activeConv).then(t => setPeerTyping(t));
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [activeConv]);

  /* ── Voice recording helpers ── */
  const startVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (recCancelledRef.current) { recCancelledRef.current = false; return; }
        const blob  = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const secs  = recSecondsRef.current;
        if (secs < 1) return;
        const convId = activeConvRef.current;
        if (!convId) return;
        const mins = Math.floor(secs / 60);
        const s    = secs % 60;
        const dur  = `${mins}:${s.toString().padStart(2, "0")}`;
        try {
          const { url } = await apiUploadVoice(blob, secs);
          const content = `__audio__:${secs}:${url}`;
          const sent = await apiSendMessage(convId, content);
          const now = new Date(sent.createdAt).toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" });
          setMessages(prev => ({
            ...prev,
            [convId]: [...(prev[convId] ?? []).filter(m => m.id !== sent.id), {
              id: sent.id, text: "", mine: true, time: now, status: "sent",
              attachment: { type: "audio" as const, label: url, extra: dur },
            }],
          }));
        } catch {
          // Fallback: show locally with blob URL (won't survive refresh)
          const url = URL.createObjectURL(blob);
          const now = new Date().toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" });
          setMessages(prev => ({
            ...prev,
            [convId]: [...(prev[convId] ?? []), {
              id: Date.now(), text: "", mine: true, time: now, status: "sent",
              attachment: { type: "audio" as const, label: url, extra: dur },
            }],
          }));
        }
      };
      mr.start(100);
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      recSecondsRef.current = 0;
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => {
        recSecondsRef.current += 1;
        setRecSeconds(recSecondsRef.current);
      }, 1000);
    } catch {
      alert("Accès au microphone refusé.");
    }
  };

  const stopVoice = () => {
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
    setRecLocked(false);
    setRecDragX(0); setRecDragY(0);
    recSecondsRef.current = 0; setRecSeconds(0);
  };

  const cancelVoice = () => {
    recCancelledRef.current = true;
    stopVoice();
  };

  const recGestureDown = (e: React.PointerEvent) => {
    recDragStartRef.current = { x: e.clientX, y: e.clientY };
    recIsDraggingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const recGestureMove = (e: React.PointerEvent) => {
    if (!recIsDraggingRef.current || !recDragStartRef.current) return;
    setRecDragX(Math.min(0, e.clientX - recDragStartRef.current.x));
    setRecDragY(Math.min(0, e.clientY - recDragStartRef.current.y));
  };
  const recGestureUp = () => {
    if (!recIsDraggingRef.current) return;
    recIsDraggingRef.current = false;
    const dx = recDragX; const dy = recDragY;
    setRecDragX(0); setRecDragY(0);
    recDragStartRef.current = null;
    if (dx < -80) { cancelVoice(); }
    else if (dy < -80) { setRecLocked(true); }
  };

  const onNewMessage = useCallback((data: NewMessagePayload) => {
    const fromId = data.fromUserId;
    const time   = new Date(data.createdAt).toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" });
    const msg: Message = { id: data.id, text: data.content, mine: false, time, status: "sent" };
    setMessages(prev => ({ ...prev, [fromId]: [...(prev[fromId] ?? []), msg] }));
    setConvList(prev => {
      const exists = prev.find(c => c.id === fromId);
      if (exists) {
        return prev.map(c => c.id === fromId
          ? { ...c, lastMessage: data.content, time, unread: activeConvRef.current === fromId ? 0 : c.unread + 1 }
          : c);
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

  useEffect(() => {
    const el = remoteAudioRef.current;
    if (!el) return;
    // Always route remote audio through the dedicated <audio> element for both
    // audio and video calls — this is the most reliable path on Android Chrome.
    if (sig.remoteStream) {
      if (el.srcObject !== sig.remoteStream) { el.srcObject = sig.remoteStream; el.play().catch(() => {}); }
    } else { el.srcObject = null; }
  }, [sig.remoteStream, sig.callType]);

  useEffect(() => {
    const el = localVideoRef.current;
    if (!el) return;
    if (sig.localStream) {
      if (el.srcObject !== sig.localStream) { el.srcObject = sig.localStream; el.play().catch(() => {}); }
    } else { el.srcObject = null; }
  }, [sig.localStream]);

  useEffect(() => {
    const el = remoteVideoRef.current;
    if (!el) return;
    if (sig.remoteStream) {
      if (el.srcObject !== sig.remoteStream) { el.srcObject = sig.remoteStream; el.play().catch(() => {}); }
    } else { el.srcObject = null; }
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
        const hiddenKey = "bp_hidden_convs";
        const hidden: number[] = JSON.parse(localStorage.getItem(hiddenKey) ?? "[]");
        const normalized: NormConv[] = convs
          .filter(c => !hidden.includes(c.userId))
          .map(c => {
            const u    = users.find(u => u.id === c.userId);
            const name = u ? `${u.firstName} ${u.lastName}` : `Utilisateur #${c.userId}`;
            return {
              id: c.userId,
              user: { name, initials: mkInitials(name), color: CONV_COLORS[c.userId % CONV_COLORS.length] },
              lastMessage: c.lastMessage, unread: c.unreadCount,
              time: new Date(c.updatedAt).toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" }),
            };
          });
        if (initialUserId && !normalized.find(c => c.id === initialUserId)) {
          const u = users.find(u => u.id === initialUserId);
          if (u) {
            const name = `${u.firstName} ${u.lastName}`;
            normalized.unshift({ id: initialUserId, user: { name, initials: mkInitials(name), color: CONV_COLORS[initialUserId % CONV_COLORS.length] }, lastMessage: "", unread: 0, time: "" });
          }
        }
        setConvList(normalized);
      }).catch(() => {}).finally(() => setConvLoading(false));
  }, []);

  const parseApiMsg = useCallback((m: { id: number; content: string; fromUserId: number; createdAt: string; isRead: boolean }) => {
    const time   = new Date(m.createdAt).toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" });
    const status = m.isRead ? "read" as const : "sent" as const;
    const base   = { id: m.id, mine: m.fromUserId === meId, time, status };
    if (m.content.startsWith("__audio__:")) {
      const rest  = m.content.slice("__audio__:".length);
      const colon = rest.indexOf(":");
      const totalSecs = parseInt(rest.slice(0, colon), 10) || 0;
      const url   = rest.slice(colon + 1);
      const mins  = Math.floor(totalSecs / 60);
      const s     = totalSecs % 60;
      const dur   = `${mins}:${s.toString().padStart(2, "0")}`;
      return { ...base, text: "", attachment: { type: "audio" as const, label: url, extra: dur } };
    }
    return { ...base, text: m.content };
  }, [meId]);

  useEffect(() => {
    if (!activeConv || messages[activeConv]) return;
    apiGetMessages(activeConv).then(msgs => {
      setMessages(prev => ({
        ...prev,
        [activeConv]: msgs.map(m => parseApiMsg(m)),
      }));
    }).catch(() => {});
  }, [activeConv]);

  useEffect(() => {
    if (!activeConv) { setPresence({ online: false, lastSeenAt: null }); return; }
    let cancelled = false;
    const fetch = () => apiGetUserPresence(activeConv).then(p => { if (!cancelled) setPresence(p); }).catch(() => {});
    fetch();
    const ticker = setInterval(() => setPresenceTick(t => t + 1), 5000);
    const poller = setInterval(fetch, 30000);
    return () => { cancelled = true; clearInterval(ticker); clearInterval(poller); };
  }, [activeConv]);

  const presText = presenceLabel(presence.online, presence.lastSeenAt);
  void presenceTick;

  useEffect(() => {
    if (!activeConv) return;
    const poll = setInterval(() => {
      apiGetMessages(activeConv).then(msgs => {
        setMessages(prev => {
          const next = msgs.map(m => parseApiMsg(m));
          if (JSON.stringify(next.map(x => x.id)) === JSON.stringify((prev[activeConv] ?? []).map(x => x.id))) return prev;
          return { ...prev, [activeConv]: next };
        });
      }).catch(() => {});
    }, 3000);
    return () => clearInterval(poll);
  }, [activeConv, parseApiMsg]);

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

  useEffect(() => {
    apiGetChatGroups().then(groups => {
      setChatGroups(groups.map(g => ({
        id: g.id, name: g.name, avatarUrl: g.avatarUrl, type: g.type,
        membersCount: g.membersCount, lastMessage: g.lastMessage,
        lastMessageAt: g.lastMessageAt, unread: g.unread, role: g.role,
      })));
    }).catch(() => {});
    const poll = setInterval(() => {
      apiGetChatGroups().then(groups => {
        setChatGroups(groups.map(g => ({
          id: g.id, name: g.name, avatarUrl: g.avatarUrl, type: g.type,
          membersCount: g.membersCount, lastMessage: g.lastMessage,
          lastMessageAt: g.lastMessageAt, unread: g.unread, role: g.role,
        })));
      }).catch(() => {});
    }, 15000);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    activeGroupRef.current = activeGroupId;
    if (!activeGroupId) return;
    const loadMsgs = () => {
      apiGetChatGroupMessages(activeGroupId).then(msgs => {
        setGroupMsgs(prev => {
          const next = msgs.map(m => ({
            id: m.id, text: m.content, senderName: m.senderName,
            mine: m.senderId === meId,
            time: new Date(m.createdAt).toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" }),
            type: m.type,
          }));
          if (JSON.stringify(next.map(x => x.id)) === JSON.stringify((prev[activeGroupId] ?? []).map(x => x.id))) return prev;
          return { ...prev, [activeGroupId]: next };
        });
      }).catch(() => {});
    };
    loadMsgs();
    apiGetChatGroupInfo(activeGroupId).then(setGroupInfo).catch(() => {});
    const poll = setInterval(loadMsgs, 3000);
    return () => clearInterval(poll);
  }, [activeGroupId, meId]);

  useEffect(() => { groupBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [groupMsgs, activeGroupId]);

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

  const sendGroupMsg = () => {
    const content = groupNewMsg.trim();
    if (!content || !activeGroupId) return;
    const now = new Date().toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" });
    const optimistic: GroupMsg = { id: Date.now(), text: content, senderName: "Moi", mine: true, time: now, type: "text" };
    setGroupMsgs(prev => ({ ...prev, [activeGroupId]: [...(prev[activeGroupId] ?? []), optimistic] }));
    setChatGroups(prev => prev.map(g => g.id === activeGroupId ? { ...g, lastMessage: content, lastMessageAt: new Date().toISOString() } : g));
    setGroupNewMsg("");
    apiSendChatGroupMessage(activeGroupId, content).catch(() => {});
  };

  const createGroup = async () => {
    const name = wizardGroupName.trim();
    if (!name || wizardCreating) return;
    setWizardCreating(true);
    try {
      const g = await apiCreateChatGroup(name, groupWizardType, [...wizardMembers]);
      const newGroup: ChatGroupConv = {
        id: g.id, name: g.name, avatarUrl: g.avatarUrl, type: g.type,
        membersCount: wizardMembers.size + 1, lastMessage: "", lastMessageAt: g.createdAt,
        unread: 0, role: "owner",
      };
      setChatGroups(prev => [newGroup, ...prev]);
      setGroupWizard("none"); setWizardGroupName(""); setWizardMembers(new Set()); setWizardSearch("");
      setActiveGroupId(g.id);
    } catch { /* silent */ } finally { setWizardCreating(false); }
  };

  const toggleVoice = (msgId: number, src: string) => {
    const el = voicePlayerRef.current;
    if (!el) return;
    if (playingAudioId === msgId) {
      el.pause();
      setPlayingAudioId(null);
    } else {
      el.pause();
      el.src = src;
      el.playbackRate = voiceSpeed;
      el.currentTime = 0;
      setAudioProgress(0);
      el.play().catch(() => {});
      setPlayingAudioId(msgId);
    }
  };

  const cycleVoiceSpeed = () => {
    const next: 1|1.5|2 = voiceSpeed === 1 ? 1.5 : voiceSpeed === 1.5 ? 2 : 1;
    setVoiceSpeed(next);
    if (voicePlayerRef.current) voicePlayerRef.current.playbackRate = next;
  };

  const startLongPress = (msgId: number) => {
    if (selectionMode) { toggleSelect(msgId); return; }
    longPressTimer.current = setTimeout(() => {
      setSelectionMode(true);
      setSelectedMsgs(new Set([msgId]));
      setLongPressMsg(msgId);
    }, 500);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };
  const toggleSelect = (msgId: number) => {
    setSelectedMsgs(prev => { const next = new Set(prev); if (next.has(msgId)) next.delete(msgId); else next.add(msgId); return next; });
  };
  const exitSelection = () => { setSelectionMode(false); setSelectedMsgs(new Set()); setShowDeleteConfirm(false); setDeleteForAll(false); };
  const copySelected = () => {
    if (!activeConv) return;
    const texts = (messages[activeConv] ?? []).filter(m => selectedMsgs.has(m.id)).map(m => m.text).join("\n");
    navigator.clipboard.writeText(texts).catch(() => {});
    exitSelection();
  };
  const confirmDelete = () => {
    if (!activeConv) return;
    setMessages(prev => ({ ...prev, [activeConv]: (prev[activeConv] ?? []).filter(m => !selectedMsgs.has(m.id)) }));
    exitSelection();
  };

  navigate;

  /* ══════════════════════════════════════════════════════════════
     GROUP CREATION WIZARD — Modern 2026
  ══════════════════════════════════════════════════════════════ */
  if (groupWizard !== "none") {
    const filteredUsers = allUsers.filter(u => u.id !== meId && (
      wizardSearch.trim() === "" ||
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(wizardSearch.toLowerCase())
    ));
    const isChannel = groupWizardType === "channel";

    return createPortal(
      <div style={{ position: "fixed", top: 0, bottom: 0, left: 0, right: 0, display: "flex", flexDirection: "column", background: "#fff", zIndex: 10000 }}>
        <style>{`@keyframes wiz-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }`}</style>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px 12px", borderBottom: "1px solid #E4E6EB", flexShrink: 0, background: "#fff" }}>
          <button
            onClick={() => { if (groupWizard === "name") setGroupWizard("members"); else { setGroupWizard("none"); setWizardMembers(new Set()); setWizardSearch(""); } }}
            style={{ background: "#F0F2F5", border: "none", borderRadius: "50%", width: 40, height: 40, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#111", flexShrink: 0 }}>
            ←
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#111" }}>
              {groupWizard === "members" ? `Nouveau ${isChannel ? "canal" : "groupe"}` : `Nommer le ${isChannel ? "canal" : "groupe"}`}
            </div>
            {groupWizard === "members" && (
              <div style={{ fontSize: 12, color: "#65676B", marginTop: 1 }}>
                {wizardMembers.size === 0 ? "Sélectionnez des membres" : `${wizardMembers.size} sélectionné${wizardMembers.size > 1 ? "s" : ""}`}
              </div>
            )}
          </div>
          {/* Step dots */}
          <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
            {[0, 1].map(i => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: (groupWizard === "members" ? 0 : 1) >= i ? "#1877F2" : "#E4E6EB", transition: "background 0.2s" }} />
            ))}
          </div>
          {groupWizard === "members" && (
            <button onClick={() => { if (wizardMembers.size > 0) setGroupWizard("name"); }}
              style={{ background: wizardMembers.size > 0 ? "#1877F2" : "#E4E6EB", border: "none", borderRadius: 22, padding: "8px 18px", color: wizardMembers.size > 0 ? "#fff" : "#aaa", fontSize: 14, fontWeight: 700, cursor: wizardMembers.size > 0 ? "pointer" : "default", transition: "all 0.2s", flexShrink: 0 }}>
              Suivant →
            </button>
          )}
        </div>

        {groupWizard === "members" ? (
          <>
            {/* Search */}
            <div style={{ padding: "10px 14px", background: "#fff", borderBottom: "1px solid #F0F2F5", flexShrink: 0 }}>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#999", pointerEvents: "none" }}>🔍</span>
                <input value={wizardSearch} onChange={e => setWizardSearch(e.target.value)}
                  placeholder="Rechercher des contacts…"
                  style={{ width: "100%", background: "#F0F2F5", border: "none", borderRadius: 24, padding: "9px 14px 9px 34px", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>

            {/* Selected chips */}
            {wizardMembers.size > 0 && (
              <div style={{ display: "flex", gap: 10, padding: "10px 14px", overflowX: "auto", scrollbarWidth: "none", borderBottom: "1px solid #F0F2F5", background: "#fff", flexShrink: 0 }}>
                {[...wizardMembers].map(uid => {
                  const u = allUsers.find(x => x.id === uid);
                  const name = u ? `${u.firstName} ${u.lastName}` : `#${uid}`;
                  return (
                    <div key={uid} onClick={() => setWizardMembers(prev => { const s = new Set(prev); s.delete(uid); return s; })}
                      style={{ flexShrink: 0, textAlign: "center", cursor: "pointer", animation: "wiz-in 0.2s ease" }}>
                      <div style={{ position: "relative", marginBottom: 3 }}>
                        <div style={{ width: 46, height: 46, borderRadius: "50%", background: CONV_COLORS[uid % CONV_COLORS.length], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15, margin: "0 auto" }}>
                          {mkInitials(name)}
                        </div>
                        <div style={{ position: "absolute", top: -3, right: -3, width: 18, height: 18, background: "#F44336", borderRadius: "50%", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 900 }}>✕</div>
                      </div>
                      <div style={{ fontSize: 10, color: "#333", maxWidth: 50, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name.split(" ")[0]}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* User list */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {filteredUsers.map((u, idx) => {
                const name = `${u.firstName} ${u.lastName}`;
                const selected = wizardMembers.has(u.id);
                return (
                  <div key={u.id}
                    onClick={() => setWizardMembers(prev => { const s = new Set(prev); if (s.has(u.id)) s.delete(u.id); else s.add(u.id); return s; })}
                    style={{ display: "flex", gap: 12, padding: "11px 16px", alignItems: "center", cursor: "pointer", background: selected ? "#F0F6FF" : "#fff", borderBottom: idx < filteredUsers.length - 1 ? "1px solid #F5F5F5" : "none", transition: "background 0.12s" }}>
                    <div style={{ width: 50, height: 50, borderRadius: "50%", background: CONV_COLORS[u.id % CONV_COLORS.length], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 17, flexShrink: 0 }}>
                      {mkInitials(name)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>{name}</div>
                    </div>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", border: selected ? "none" : "2px solid #CED0D4", background: selected ? "#1877F2" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                      {selected && <span style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>✓</span>}
                    </div>
                  </div>
                );
              })}
              {filteredUsers.length === 0 && (
                <div style={{ padding: "52px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: 44, marginBottom: 14 }}>👤</div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#333", marginBottom: 6 }}>Aucun contact trouvé</div>
                  <div style={{ fontSize: 13, color: "#888" }}>Essayez un autre terme de recherche</div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Step 2: Name + Settings */
          <div style={{ flex: 1, overflowY: "auto", padding: "32px 20px 20px" }}>

            {/* Avatar picker */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
              <div style={{ position: "relative", cursor: "pointer" }}>
                <div style={{ width: 100, height: 100, borderRadius: "50%", background: isChannel ? "linear-gradient(135deg, #00838F 0%, #00ACC1 100%)" : "linear-gradient(135deg, #1877F2 0%, #42A5F5 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 20px rgba(0,0,0,0.2)", fontSize: 42 }}>
                  {isChannel ? "📢" : "👥"}
                </div>
                <div style={{ position: "absolute", bottom: 2, right: 2, width: 32, height: 32, borderRadius: "50%", background: "#fff", border: "2px solid #E4E6EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}>📷</div>
              </div>
            </div>

            {/* Name */}
            <div style={{ marginBottom: 22 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#65676B", letterSpacing: 1, display: "block", marginBottom: 6, textTransform: "uppercase" }}>
                Nom du {isChannel ? "canal" : "groupe"}
              </label>
              <input
                value={wizardGroupName} onChange={e => setWizardGroupName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") createGroup(); }}
                placeholder={isChannel ? "Ex: Annonces officielles" : "Ex: Famille Konaté"}
                autoFocus
                style={{ width: "100%", border: "none", borderBottom: "2.5px solid #1877F2", padding: "10px 0", fontSize: 18, outline: "none", boxSizing: "border-box", color: "#111", background: "transparent", fontWeight: 700 }}
              />
            </div>

            {/* Description */}
            <div style={{ marginBottom: 28 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#65676B", letterSpacing: 1, display: "block", marginBottom: 6, textTransform: "uppercase" }}>
                Description <span style={{ color: "#aaa", fontWeight: 400, textTransform: "none" }}>(optionnel)</span>
              </label>
              <input
                placeholder={isChannel ? "Ex: Actualités et annonces…" : "Ex: Groupe privé de la famille…"}
                style={{ width: "100%", border: "none", borderBottom: "2px solid #E4E6EB", padding: "10px 0", fontSize: 15, outline: "none", boxSizing: "border-box", color: "#111", background: "transparent" }}
              />
            </div>

            {/* Public/Private toggle */}
            <div style={{ background: "#F7F8FA", borderRadius: 16, padding: "14px 16px", marginBottom: 28, display: "flex", alignItems: "center", gap: 12, border: "1px solid #E4E6EB" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#111", marginBottom: 2 }}>
                  {isChannel ? "Canal public" : "Groupe public"}
                </div>
                <div style={{ fontSize: 12, color: "#65676B", lineHeight: 1.4 }}>
                  {isChannel ? "Visible et rejoignable par tous" : "Visible et rejoignable par tous"}
                </div>
              </div>
              <div style={{ width: 48, height: 26, borderRadius: 13, background: "#E4E6EB", position: "relative", cursor: "pointer", flexShrink: 0 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.25)", transition: "left 0.2s" }} />
              </div>
            </div>

            {/* Members info */}
            <div style={{ fontSize: 13, color: "#888", marginBottom: 28, textAlign: "center" }}>
              {wizardMembers.size + 1} participant{wizardMembers.size > 0 ? "s" : ""}
            </div>

            {/* Create button */}
            <button onClick={createGroup} disabled={!wizardGroupName.trim() || wizardCreating}
              style={{ width: "100%", background: wizardGroupName.trim() ? (isChannel ? "#00838F" : "#1877F2") : "#E4E6EB", border: "none", borderRadius: 30, padding: "16px", fontSize: 16, fontWeight: 800, color: wizardGroupName.trim() ? "#fff" : "#aaa", cursor: wizardGroupName.trim() ? "pointer" : "default", transition: "all 0.2s", boxShadow: wizardGroupName.trim() ? "0 4px 16px rgba(24,119,242,0.4)" : "none" }}>
              {wizardCreating ? "⏳ Création en cours…" : `✓ Créer le ${isChannel ? "canal" : "groupe"}`}
            </button>
          </div>
        )}
      </div>
    , document.body);
  }

  /* ══════════════════════════════════════════════════════════════
     INCOMING CALL OVERLAY
  ══════════════════════════════════════════════════════════════ */
  if (sig.callState === "incoming" && sig.incomingCall) {
    const caller     = allUsers.find(u => u.id === sig.incomingCall!.fromUserId);
    const callerName = caller ? `${caller.firstName} ${caller.lastName}` : `Utilisateur #${sig.incomingCall.fromUserId}`;
    const callerColor = CONV_COLORS[sig.incomingCall.fromUserId % CONV_COLORS.length];
    const isVideo     = sig.incomingCall.callType === "video";

    return createPortal(
      <div style={{ position:"fixed", inset:0, zIndex:10000, overflow:"hidden", display:"flex", flexDirection:"column", background:"#040f07" }}>
        <style>{`
          @keyframes bp-ring-pulse{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.18);opacity:0}}
          @keyframes bp-ring-pulse2{0%,100%{transform:scale(1);opacity:.35}50%{transform:scale(1.32);opacity:0}}
          @keyframes bp-dots{0%,80%,100%{opacity:0;transform:translateY(0)}40%{opacity:1;transform:translateY(-4px)}}
          @keyframes bp-aurora{0%,100%{opacity:.7;transform:scale(1) rotate(0deg)}50%{opacity:1;transform:scale(1.08) rotate(3deg)}}
          @keyframes bp-accept-glow{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.7),0 8px 32px rgba(34,197,94,.45)}50%{box-shadow:0 0 0 14px rgba(34,197,94,.0),0 8px 32px rgba(34,197,94,.45)}}
          @keyframes bp-wave{0%,100%{height:8px}50%{height:22px}}
          .bp-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#4ade80;margin:0 3px;animation:bp-dots 1.5s infinite ease-in-out both}
          .bp-dot:nth-child(1){animation-delay:0s}.bp-dot:nth-child(2){animation-delay:.2s}.bp-dot:nth-child(3){animation-delay:.4s}
          .bp-wave-bar{width:3px;border-radius:2px;background:linear-gradient(to top,#22C55E,#86efac);animation:bp-wave 1s ease-in-out infinite}
        `}</style>

        {/* Aurora background */}
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(180deg, #071a0e 0%, #0a2e16 35%, #061208 70%, #020a04 100%)", zIndex:0 }} />
        <div style={{ position:"absolute", top:"-10%", left:"10%", width:"80%", height:"55%", borderRadius:"50%", background:"radial-gradient(ellipse, rgba(34,197,94,0.22) 0%, rgba(16,122,56,0.10) 40%, transparent 70%)", animation:"bp-aurora 6s ease-in-out infinite", zIndex:1, pointerEvents:"none" }} />
        <div style={{ position:"absolute", top:"5%", right:"-10%", width:"50%", height:"40%", borderRadius:"50%", background:"radial-gradient(ellipse, rgba(74,222,128,0.10) 0%, transparent 65%)", animation:"bp-aurora 8s ease-in-out infinite reverse", zIndex:1, pointerEvents:"none" }} />

        {/* Incoming label */}
        <div style={{ position:"relative", zIndex:10, display:"flex", justifyContent:"center", alignItems:"center", padding:"56px 20px 0" }}>
          <div style={{ background:"rgba(34,197,94,0.15)", backdropFilter:"blur(10px)", border:"1px solid rgba(34,197,94,0.3)", borderRadius:20, padding:"6px 18px", display:"flex", alignItems:"center", gap:8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#4ade80"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.58.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.24 1.01L6.6 10.8z"/></svg>
            <span style={{ color:"#4ade80", fontSize:13, fontWeight:700 }}>{isVideo ? "Appel vidéo entrant" : "Appel audio entrant"}</span>
          </div>
        </div>

        {/* Center content */}
        <div style={{ position:"relative", zIndex:10, flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          {/* Rings */}
          <div style={{ position:"relative", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:32 }}>
            <div style={{ position:"absolute", width:220, height:220, borderRadius:"50%", border:"1.5px solid rgba(34,197,94,0.2)", animation:"bp-ring-pulse2 2.4s ease-out infinite" }} />
            <div style={{ position:"absolute", width:180, height:180, borderRadius:"50%", border:"1.5px solid rgba(34,197,94,0.32)", animation:"bp-ring-pulse 2s ease-out infinite" }} />
            <div style={{ position:"absolute", width:148, height:148, borderRadius:"50%", border:"2px solid rgba(34,197,94,0.45)" }} />
            {/* Avatar */}
            <div style={{ width:124, height:124, borderRadius:"50%", background:`radial-gradient(circle at 35% 35%, ${callerColor}dd, ${callerColor}99)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:46, color:"#fff", fontWeight:900, boxShadow:`0 0 0 4px rgba(34,197,94,0.4), 0 16px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.25)`, backdropFilter:"blur(2px)", border:"3px solid rgba(255,255,255,0.15)" }}>
              {mkInitials(callerName)}
            </div>
            <div style={{ position:"absolute", bottom:8, right:8, width:22, height:22, borderRadius:"50%", background:"#22C55E", border:"3px solid #040f07", boxShadow:"0 0 10px #22C55E" }} />
          </div>

          <div style={{ fontWeight:900, fontSize:26, color:"#fff", letterSpacing:0.5, marginBottom:8, textAlign:"center", padding:"0 28px", textShadow:"0 2px 16px rgba(0,0,0,0.5)" }}>{callerName}</div>
          <div style={{ display:"flex", alignItems:"center", gap:2, marginBottom:24 }}>
            <span style={{ color:"rgba(255,255,255,.65)", fontSize:15 }}>Appel entrant</span>
            <span className="bp-dot" /><span className="bp-dot" /><span className="bp-dot" />
          </div>
        </div>

        {/* Bottom — accept / reject */}
        <div style={{ position:"relative", zIndex:10, padding:"0 40px 56px", display:"flex", justifyContent:"space-around", alignItems:"flex-start" }}>
          <div style={{ textAlign:"center", cursor:"pointer" }} onClick={() => sig.rejectCall()}>
            <div style={{ width:72, height:72, borderRadius:"50%", background:"linear-gradient(145deg,#ef4444,#b91c1c)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 10px", boxShadow:"0 6px 28px rgba(239,68,68,.55), inset 0 1px 0 rgba(255,255,255,.2)" }}>
              <svg viewBox="0 0 24 24" width="30" height="30" fill="#fff"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.12-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/></svg>
            </div>
            <div style={{ color:"rgba(255,255,255,.75)", fontSize:13, fontWeight:600 }}>Refuser</div>
          </div>
          <div style={{ textAlign:"center", cursor:"pointer" }} onClick={() => sig.acceptCall()}>
            <div style={{ width:72, height:72, borderRadius:"50%", background:"linear-gradient(145deg,#22c55e,#15803d)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 10px", animation:"bp-accept-glow 2s ease-in-out infinite", boxShadow:"0 6px 28px rgba(34,197,94,.55), inset 0 1px 0 rgba(255,255,255,.2)" }}>
              <svg viewBox="0 0 24 24" width="30" height="30" fill="#fff"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.58.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.24 1.01L6.6 10.8z"/></svg>
            </div>
            <div style={{ color:"rgba(255,255,255,.75)", fontSize:13, fontWeight:600 }}>Accepter</div>
          </div>
        </div>
      </div>
    , document.body);
  }

  /* ══════════════════════════════════════════════════════════════
     ACTIVE / CALLING CALL — FULL SCREEN
  ══════════════════════════════════════════════════════════════ */
  if (sig.callState === "calling" || sig.callState === "active") {
    const peer    = callPeerUser;
    const isVideo = sig.callType === "video";

    return createPortal(
      <div style={{ position: "fixed", inset: 0, zIndex: 10000, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <style>{`
          @keyframes tg-ring3{0%,100%{box-shadow:0 0 0 0 rgba(255,255,255,.55),0 0 0 0 rgba(255,255,255,.3)}50%{box-shadow:0 0 0 22px rgba(255,255,255,.18),0 0 0 44px rgba(255,255,255,.07)}}
          @keyframes tg-dots3{0%,80%,100%{opacity:0}40%{opacity:1}}
          .tg3-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.8);margin:0 2px;animation:tg-dots3 1.4s infinite ease-in-out both}
          .tg3-dot:nth-child(1){animation-delay:-.32s}.tg3-dot:nth-child(2){animation-delay:-.16s}
          .tg3-btn{background:rgba(255,255,255,.18);border:none;width:62px;height:62px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s}
          .tg3-btn:active{background:rgba(255,255,255,.35)!important}
          .tg3-btn-on{background:rgba(255,255,255,.9)!important}
        `}</style>
        <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: "none" }} />
        <audio ref={voicePlayerRef} style={{ display:"none" }}
          onTimeUpdate={e => { const el = e.currentTarget; if (el.duration) setAudioProgress(el.currentTime / el.duration); }}
          onEnded={() => { setPlayingAudioId(null); setAudioProgress(0); }} />

        {isVideo ? (
          /* ── VIDEO CALL — BrutePawa 2026 Premium ── */
          <>
            <style>{`
              @keyframes bpv-dots{0%,80%,100%{opacity:0;transform:translateY(0)}40%{opacity:1;transform:translateY(-4px)}}
              @keyframes bpv-end-glow{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.7),0 8px 28px rgba(239,68,68,.5)}50%{box-shadow:0 0 0 12px rgba(239,68,68,0),0 8px 28px rgba(239,68,68,.5)}}
              @keyframes bpv-secure-pulse{0%,100%{opacity:.85}50%{opacity:1}}
              @keyframes bpv-local-glow{0%,100%{box-shadow:0 0 0 2px rgba(34,197,94,0.7),0 4px 20px rgba(0,0,0,.55)}50%{box-shadow:0 0 0 3px rgba(74,222,128,1),0 4px 24px rgba(0,0,0,.6)}}
              .bpv-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#4ade80;animation:bpv-dots 1.5s ease-in-out infinite}
              .bpv-dot:nth-child(1){animation-delay:0s}.bpv-dot:nth-child(2){animation-delay:.2s}.bpv-dot:nth-child(3){animation-delay:.4s}
              .bpv-btn{display:flex;align-items:center;justify-content:center;width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;transition:transform .12s,filter .12s;background:rgba(34,197,94,0.18);backdrop-filter:blur(8px);border:1px solid rgba(34,197,94,0.3)}
              .bpv-btn:active{transform:scale(.88)!important}
              .bpv-btn-on{background:rgba(34,197,94,0.5)!important;border-color:rgba(34,197,94,0.7)!important}
            `}</style>

            {/* Remote video — full screen (audio routed via <audio> element, video only here) */}
            <video ref={remoteVideoRef} autoPlay playsInline muted style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", background:"linear-gradient(180deg,#071d0c,#020b05)" }} />

            {/* Top gradient overlay */}
            <div style={{ position:"absolute", top:0, left:0, right:0, height:"38%", background:"linear-gradient(180deg,rgba(0,0,0,0.82) 0%,rgba(0,0,0,0.35) 60%,transparent 100%)", zIndex:10, pointerEvents:"none" }} />
            {/* Bottom gradient overlay */}
            <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"42%", background:"linear-gradient(0deg,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.45) 55%,transparent 100%)", zIndex:10, pointerEvents:"none" }} />

            {/* Header */}
            <div style={{ position:"absolute", top:0, left:0, right:0, zIndex:20, padding:"50px 16px 0" }}>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
                {/* Left: chevron down + name + status */}
                <div style={{ display:"flex", alignItems:"flex-start", gap:10, flex:1 }}>
                  <button onClick={() => sig.endCall()} style={{ background:"rgba(255,255,255,0.12)", backdropFilter:"blur(10px)", border:"1px solid rgba(255,255,255,0.18)", borderRadius:"50%", width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, marginTop:2 }}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="rgba(255,255,255,.9)"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
                  </button>
                  <div>
                    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                      <span style={{ color:"#fff", fontWeight:900, fontSize:20, letterSpacing:0.2, textShadow:"0 1px 8px rgba(0,0,0,0.6)" }}>{peer?.name ?? "Appel vidéo"}</span>
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2L14.09 8.26L21 9.27L16.5 13.97L17.64 21L12 17.77L6.36 21L7.5 13.97L3 9.27L9.91 8.26L12 2Z" fill="#22C55E"/>
                        <polyline points="9,12 11,14 15,10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                      </svg>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:3 }}>
                      {sig.callState === "active"
                        ? <span style={{ color:"#4ade80", fontSize:13, fontWeight:700 }}>● {fmtTime(sig.callDuration)}</span>
                        : <>
                            <span style={{ color:"rgba(255,255,255,.75)", fontSize:13 }}>Connexion en cours</span>
                            <span className="bpv-dot" style={{ marginLeft:2 }} /><span className="bpv-dot" /><span className="bpv-dot" />
                          </>
                      }
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:4 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="rgba(74,222,128,0.8)"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
                      <span style={{ color:"rgba(255,255,255,.55)", fontSize:11, letterSpacing:0.2 }}>Chiffré de bout en bout</span>
                    </div>
                  </div>
                </div>
                {/* Speaker button */}
                <button onClick={() => sig.toggleSpeaker(remoteAudioRef.current)}
                  style={{ width:44, height:44, borderRadius:"50%", background:sig.isSpeaker ? "rgba(34,197,94,0.35)" : "rgba(255,255,255,0.12)", border:`1.5px solid ${sig.isSpeaker ? "rgba(34,197,94,0.65)" : "rgba(255,255,255,0.22)"}`, backdropFilter:"blur(12px)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 14px rgba(0,0,0,0.4)", flexShrink:0 }}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill={sig.isSpeaker ? "#4ade80" : "rgba(255,255,255,.8)"}><path d={sig.isSpeaker ? "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" : "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"}/></svg>
                </button>
              </div>
            </div>

            {/* Local camera preview — premium floating */}
            <div style={{ position:"absolute", top:130, right:14, width:106, height:158, borderRadius:20, overflow:"hidden", zIndex:20, animation:"bpv-local-glow 2.5s ease-in-out infinite", cursor:"pointer" }}>
              <video ref={localVideoRef} autoPlay playsInline muted style={{ width:"100%", height:"100%", objectFit:"cover", transform:sig.cameraFront ? "scaleX(-1)" : "scaleX(1)" }} />
              {/* Camera flip overlay button */}
              <div onClick={() => sig.flipCamera()} style={{ position:"absolute", bottom:7, right:7, width:28, height:28, borderRadius:"50%", background:"rgba(0,0,0,0.55)", backdropFilter:"blur(6px)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", border:"1px solid rgba(255,255,255,0.2)" }}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="rgba(255,255,255,0.9)"><path d="M20 5h-3.17L15 3H9L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-8 13c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
              </div>
              {/* Signal indicator */}
              <div style={{ position:"absolute", top:7, right:7, display:"flex", alignItems:"flex-end", gap:1 }}>
                {[3,5,7,9].map((h,i) => <div key={i} style={{ width:3, height:h, borderRadius:1, background:i < 3 ? "#22c55e" : "rgba(255,255,255,0.3)" }} />)}
              </div>
            </div>

            {/* Secure connection badge — center */}
            {sig.callState === "active" && (
              <div style={{ position:"absolute", bottom:175, left:"50%", transform:"translateX(-50%)", zIndex:20, animation:"bpv-secure-pulse 3s ease-in-out infinite" }}>
                <div style={{ background:"rgba(34,197,94,0.18)", backdropFilter:"blur(14px)", border:"1px solid rgba(34,197,94,0.35)", borderRadius:24, padding:"7px 18px", display:"flex", alignItems:"center", gap:7, whiteSpace:"nowrap" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="18" width="3" height="4" rx="1" fill="#4ade80"/>
                    <rect x="7" y="13" width="3" height="9" rx="1" fill="#4ade80"/>
                    <rect x="12" y="8" width="3" height="14" rx="1" fill="#4ade80"/>
                    <rect x="17" y="3" width="3" height="19" rx="1" fill="#4ade80"/>
                  </svg>
                  <span style={{ color:"rgba(255,255,255,.88)", fontSize:12, fontWeight:700, letterSpacing:0.2 }}>Connexion sécurisée</span>
                </div>
              </div>
            )}

            {/* Bottom control bar */}
            <div style={{ position:"absolute", bottom:0, left:0, right:0, zIndex:20, padding:"0 10px 46px" }}>
              <div style={{ background:"rgba(5,14,8,0.78)", backdropFilter:"blur(22px)", border:"1px solid rgba(34,197,94,0.12)", borderRadius:28, padding:"18px 10px 14px", boxShadow:"0 -4px 32px rgba(0,0,0,0.5)" }}>
                <div style={{ display:"flex", justifyContent:"space-around", alignItems:"flex-start" }}>
                  {([
                    {
                      label: sig.isVideoEnabled ? "Désactiver\nvidéo" : "Activer\nvidéo",
                      icon:<svg viewBox="0 0 24 24" width="24" height="24" fill={sig.isVideoEnabled ? "rgba(255,255,255,.9)" : "#022c0f"}>{sig.isVideoEnabled ? <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/> : <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>}</svg>,
                      action:() => sig.toggleVideo(), active:!sig.isVideoEnabled,
                    },
                    {
                      label:"Muet",
                      icon:<svg viewBox="0 0 24 24" width="24" height="24" fill={sig.isMuted ? "#022c0f" : "rgba(255,255,255,.9)"}><path d={sig.isMuted ? "M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" : "M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28C16.28 17.23 19 14.41 19 11h-1.7z"}/></svg>,
                      action:() => sig.toggleMute(), active:sig.isMuted,
                    },
                    {
                      label: sig.isScreenSharing ? "Arrêter\npartage" : "Partager\nécran",
                      icon:<svg viewBox="0 0 24 24" width="24" height="24" fill={sig.isScreenSharing ? "#022c0f" : "rgba(255,255,255,.9)"}><path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zm-7-3.53v-2.19c-2.78.48-4.34 1.71-5.5 3.72.14-1.39.73-4.47 3.93-5.81L9.5 8.47C11.27 7.28 13.8 6.86 16 9.5l1.5-1.5v4.47H13z"/></svg>,
                      action:() => sig.toggleScreenShare(), active:sig.isScreenSharing,
                    },
                    {
                      label:"Basculer\ncaméra",
                      icon:<svg viewBox="0 0 24 24" width="24" height="24" fill="rgba(255,255,255,.9)"><path d="M20 5h-3.17L15 3H9L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-8 13c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>,
                      action:() => sig.flipCamera(), active:false,
                    },
                    {
                      label:"Raccrocher",
                      icon:<svg viewBox="0 0 24 24" width="26" height="26" fill="#fff"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.12-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/></svg>,
                      action:() => sig.endCall(), red:true,
                    },
                  ] as {label:string;icon:JSX.Element;action:()=>void;active?:boolean;red?:boolean}[]).map(b => (
                    <div key={b.label} style={{ textAlign:"center", cursor:"pointer", minWidth:0 }} onClick={b.action}>
                      <div className={`bpv-btn${b.active ? " bpv-btn-on" : ""}`} style={
                        b.red
                          ? { background:"linear-gradient(145deg,#ef4444,#b91c1c)", border:"none", width:64, height:64, animation:"bpv-end-glow 2.5s ease-in-out infinite", boxShadow:"0 6px 24px rgba(239,68,68,.55), inset 0 1px 0 rgba(255,255,255,.2)" }
                          : b.active
                            ? { background:"rgba(34,197,94,0.5)", border:"1px solid rgba(34,197,94,0.7)" }
                            : {}
                      }>{b.icon}</div>
                      <div style={{ color:"rgba(255,255,255,.68)", fontSize:10, fontWeight:600, marginTop:7, whiteSpace:"pre-line", lineHeight:1.3, letterSpacing:0.1 }}>{b.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          /* ── AUDIO CALL — BrutePawa 2026 Premium ── */
          <>
            <style>{`
              @keyframes bp-ring-a{0%,100%{transform:scale(1);opacity:.55}50%{transform:scale(1.22);opacity:0}}
              @keyframes bp-ring-b{0%,100%{transform:scale(1);opacity:.35}50%{transform:scale(1.38);opacity:0}}
              @keyframes bp-aurora-a{0%,100%{opacity:.75;transform:scale(1)}50%{opacity:1;transform:scale(1.1)}}
              @keyframes bp-aurora-b{0%,100%{opacity:.4;transform:scale(1) translateX(0)}50%{opacity:.7;transform:scale(1.06) translateX(10px)}}
              @keyframes bp-dot-bounce{0%,80%,100%{opacity:0;transform:translateY(0)}40%{opacity:1;transform:translateY(-5px)}}
              @keyframes bp-wv{0%,100%{height:6px;opacity:.5}50%{height:var(--h,18px);opacity:1}}
              @keyframes bp-end-glow{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.7),0 8px 28px rgba(239,68,68,.5)}50%{box-shadow:0 0 0 10px rgba(239,68,68,0),0 8px 28px rgba(239,68,68,.5)}}
              .bpa-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#4ade80;animation:bp-dot-bounce 1.5s ease-in-out infinite}
              .bpa-dot:nth-child(1){animation-delay:0s}.bpa-dot:nth-child(2){animation-delay:.2s}.bpa-dot:nth-child(3){animation-delay:.4s}
              .bpa-ctrl-btn{display:flex;align-items:center;justify-content:center;width:66px;height:66px;border-radius:50%;border:none;cursor:pointer;transition:transform .12s,box-shadow .12s}
              .bpa-ctrl-btn:active{transform:scale(.91)!important}
            `}</style>

            {/* Deep aurora background */}
            <div style={{ position:"absolute", inset:0, background:"linear-gradient(180deg, #071d0c 0%, #0c3318 30%, #061510 65%, #020b05 100%)", zIndex:0 }} />
            <div style={{ position:"absolute", top:"-15%", left:"5%", width:"90%", height:"60%", borderRadius:"50%", background:"radial-gradient(ellipse, rgba(34,197,94,0.26) 0%, rgba(21,128,61,0.10) 40%, transparent 68%)", animation:"bp-aurora-a 7s ease-in-out infinite", zIndex:1, pointerEvents:"none" }} />
            <div style={{ position:"absolute", top:"10%", right:"-15%", width:"55%", height:"45%", borderRadius:"50%", background:"radial-gradient(ellipse, rgba(74,222,128,0.12) 0%, transparent 60%)", animation:"bp-aurora-b 9s ease-in-out infinite", zIndex:1, pointerEvents:"none" }} />
            <div style={{ position:"absolute", bottom:"20%", left:"-10%", width:"45%", height:"35%", borderRadius:"50%", background:"radial-gradient(ellipse, rgba(34,197,94,0.08) 0%, transparent 60%)", zIndex:1, pointerEvents:"none" }} />

            {/* Speaker button — top right glass */}
            <div style={{ position:"relative", zIndex:10, display:"flex", justifyContent:"flex-end", padding:"52px 20px 0", flexShrink:0 }}>
              <button onClick={() => sig.toggleSpeaker(remoteAudioRef.current)}
                style={{ width:46, height:46, borderRadius:"50%", background:sig.isSpeaker ? "rgba(34,197,94,0.35)" : "rgba(255,255,255,0.10)", border:`1.5px solid ${sig.isSpeaker ? "rgba(34,197,94,0.6)" : "rgba(255,255,255,0.2)"}`, backdropFilter:"blur(12px)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 16px rgba(0,0,0,0.35)", transition:"all .2s" }}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill={sig.isSpeaker ? "#4ade80" : "rgba(255,255,255,.75)"}><path d={sig.isSpeaker ? "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" : "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"}/></svg>
              </button>
            </div>

            {/* Center — avatar + waveform + info */}
            <div style={{ position:"relative", zIndex:10, flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>

              {/* Waveform + rings + avatar */}
              <div style={{ position:"relative", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:36 }}>
                {/* Outer rings */}
                <div style={{ position:"absolute", width:230, height:230, borderRadius:"50%", border:"1.5px solid rgba(34,197,94,0.18)", animation:"bp-ring-b 2.8s ease-out infinite" }} />
                <div style={{ position:"absolute", width:186, height:186, borderRadius:"50%", border:"1.5px solid rgba(34,197,94,0.30)", animation:"bp-ring-a 2.2s ease-out infinite" }} />
                <div style={{ position:"absolute", width:150, height:150, borderRadius:"50%", border:"2px solid rgba(34,197,94,0.42)" }} />

                {/* Waveform bars — left */}
                <div style={{ position:"absolute", left:-52, display:"flex", alignItems:"center", gap:3, height:60 }}>
                  {[14,20,10,24,16,8,18,12].map((h,i) => (
                    <div key={i} className="bpa-wave-bar" style={{ width:3, borderRadius:2, background:"linear-gradient(to top,rgba(34,197,94,0.9),rgba(134,239,172,0.5))", animation:`bp-wv ${0.7 + i*0.11}s ease-in-out infinite`, animationDelay:`${i*0.09}s`, ["--h" as string]:`${h}px`, height:6 }} />
                  ))}
                </div>
                {/* Waveform bars — right */}
                <div style={{ position:"absolute", right:-52, display:"flex", alignItems:"center", gap:3, height:60 }}>
                  {[12,18,8,22,14,20,10,16].map((h,i) => (
                    <div key={i} style={{ width:3, borderRadius:2, background:"linear-gradient(to top,rgba(34,197,94,0.9),rgba(134,239,172,0.5))", animation:`bp-wv ${0.65 + i*0.10}s ease-in-out infinite`, animationDelay:`${i*0.07+0.15}s`, height:6 }} />
                  ))}
                </div>

                {/* Glassmorphism avatar */}
                <div style={{
                  width:134, height:134, borderRadius:"50%",
                  background:`radial-gradient(circle at 33% 30%, rgba(255,255,255,0.22), rgba(255,255,255,0.04) 60%), radial-gradient(circle at 70% 75%, ${peer?.color ?? "#166534"}cc, ${peer?.color ?? "#166534"}88)`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:50, color:"#fff", fontWeight:900,
                  border:"2.5px solid rgba(255,255,255,0.18)",
                  boxShadow:`0 0 0 5px rgba(34,197,94,0.35), 0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.3)`,
                  backdropFilter:"blur(4px)",
                  textShadow:"0 2px 12px rgba(0,0,0,0.4)",
                }}>
                  {peer?.initials ?? "?"}
                </div>
                {/* Online dot */}
                <div style={{ position:"absolute", bottom:10, right:10, width:22, height:22, borderRadius:"50%", background:"radial-gradient(circle, #4ade80, #22c55e)", border:"3px solid #071d0c", boxShadow:"0 0 14px rgba(74,222,128,0.8)" }} />
              </div>

              {/* Name + verified */}
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <span style={{ fontWeight:900, fontSize:26, color:"#fff", letterSpacing:0.3, textShadow:"0 2px 16px rgba(0,0,0,0.5)" }}>{peer?.name ?? "Appel vocal"}</span>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L14.09 8.26L21 9.27L16.5 13.97L17.64 21L12 17.77L6.36 21L7.5 13.97L3 9.27L9.91 8.26L12 2Z" fill="#22C55E"/>
                  <polyline points="9,12 11,14 15,10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
              </div>

              {/* Status */}
              <div style={{ display:"flex", alignItems:"center", gap:4, marginBottom:20 }}>
                {sig.callState === "active"
                  ? <span style={{ color:"#4ade80", fontWeight:700, fontSize:16, letterSpacing:0.3 }}>● {fmtTime(sig.callDuration)}</span>
                  : <>
                      <span style={{ color:"rgba(255,255,255,.65)", fontSize:15 }}>Sonnerie</span>
                      <span className="bpa-dot" style={{ marginLeft:4 }} /><span className="bpa-dot" /><span className="bpa-dot" />
                    </>
                }
              </div>

              {/* Branding capsule */}
              <div style={{ background:"rgba(34,197,94,0.12)", backdropFilter:"blur(12px)", border:"1px solid rgba(34,197,94,0.28)", borderRadius:24, padding:"7px 18px", display:"flex", alignItems:"center", gap:8 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="18" width="3" height="4" rx="1" fill="#4ade80"/>
                  <rect x="7" y="14" width="3" height="8" rx="1" fill="#4ade80"/>
                  <rect x="12" y="9" width="3" height="13" rx="1" fill="#4ade80"/>
                  <rect x="17" y="4" width="3" height="18" rx="1" fill="#4ade80"/>
                </svg>
                <span style={{ color:"rgba(255,255,255,.85)", fontSize:13, fontWeight:600, letterSpacing:0.2 }}>Appel audio Brutepawa</span>
              </div>
            </div>

            {/* Bottom control bar */}
            <div style={{ position:"relative", zIndex:10, padding:"0 12px 52px", flexShrink:0 }}>
              <div style={{ background:"rgba(10,28,16,0.75)", backdropFilter:"blur(20px)", border:"1px solid rgba(34,197,94,0.15)", borderRadius:28, padding:"18px 16px 16px", boxShadow:"0 -4px 32px rgba(0,0,0,0.4)" }}>
                <div style={{ display:"flex", justifyContent:"space-around", alignItems:"flex-start" }}>
                  {([
                    {
                      label:"Haut-parleur",
                      icon:<svg viewBox="0 0 24 24" width="26" height="26" fill={sig.isSpeaker?"#022c0f":"rgba(255,255,255,.9)"}><path d={sig.isSpeaker?"M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z":"M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"}/></svg>,
                      action:() => sig.toggleSpeaker(remoteAudioRef.current),
                      active:sig.isSpeaker,
                    },
                    {
                      label:"Activer vidéo",
                      icon:<svg viewBox="0 0 24 24" width="26" height="26" fill="rgba(255,255,255,.9)"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>,
                      action:() => {},
                      active:false,
                    },
                    {
                      label:"Muet",
                      icon:<svg viewBox="0 0 24 24" width="26" height="26" fill={sig.isMuted?"#022c0f":"rgba(255,255,255,.9)"}><path d={sig.isMuted?"M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z":"M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28C16.28 17.23 19 14.41 19 11h-1.7z"}/></svg>,
                      action:() => sig.toggleMute(),
                      active:sig.isMuted,
                    },
                    {
                      label:"Raccrocher",
                      icon:<svg viewBox="0 0 24 24" width="28" height="28" fill="#fff"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.12-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/></svg>,
                      action:() => sig.endCall(),
                      red:true,
                    },
                  ] as {label:string;icon:JSX.Element;action:()=>void;active?:boolean;red?:boolean}[]).map(b => (
                    <div key={b.label} style={{ textAlign:"center", cursor:"pointer" }} onClick={b.action}>
                      <div className="bpa-ctrl-btn" style={
                        b.red
                          ? { background:"linear-gradient(145deg,#ef4444,#b91c1c)", boxShadow:"0 6px 24px rgba(239,68,68,.55), inset 0 1px 0 rgba(255,255,255,.2)", animation:"bp-end-glow 2.5s ease-in-out infinite" }
                          : b.active
                            ? { background:"linear-gradient(145deg,#22c55e,#16a34a)", boxShadow:"0 6px 20px rgba(34,197,94,.45), inset 0 1px 0 rgba(255,255,255,.25)" }
                            : { background:"rgba(255,255,255,0.10)", boxShadow:"0 4px 16px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.1)", border:"1px solid rgba(255,255,255,.12)" }
                      }>{b.icon}</div>
                      <div style={{ color:"rgba(255,255,255,.7)", fontSize:11, fontWeight:600, marginTop:8, letterSpacing:0.1 }}>{b.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    , document.body);
  }

  /* ══════════════════════════════════════════════════════════════
     GROUP INFO VIEW — Premium redesign
  ══════════════════════════════════════════════════════════════ */
  if (activeGroupId !== null && showGroupInfo) {
    const grp = chatGroups.find(g => g.id === activeGroupId);
    const gInfo = groupInfo;
    const isChannelG = grp?.type === "channel";

    return createPortal(
      <div style={{ position: "fixed", top: 0, bottom: 0, left: 0, right: 0, background: "#F0F2F5", zIndex: 10000, overflowY: "auto" }}>

        {/* Header */}
        <div style={{ background: "#fff", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid #E4E6EB", position: "sticky", top: 0, zIndex: 5 }}>
          <button onClick={() => setShowGroupInfo(false)}
            style={{ background: "#F0F2F5", border: "none", borderRadius: "50%", width: 40, height: 40, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#111" }}>←</button>
          <div style={{ fontWeight: 800, fontSize: 18, color: "#111" }}>Infos du {isChannelG ? "canal" : "groupe"}</div>
        </div>

        {/* Profile card */}
        <div style={{ background: "#fff", marginBottom: 8 }}>
          {/* Color banner */}
          <div style={{ height: 80, background: isChannelG ? "linear-gradient(135deg, #00838F 0%, #00ACC1 100%)" : "linear-gradient(135deg, #1877F2 0%, #42A5F5 100%)" }} />

          {/* Avatar overlapping banner */}
          <div style={{ textAlign: "center", marginTop: -48, position: "relative", zIndex: 1, paddingBottom: 20 }}>
            <div style={{ width: 94, height: 94, borderRadius: "50%", background: isChannelG ? "linear-gradient(135deg, #00838F, #00ACC1)" : "linear-gradient(135deg, #1877F2, #42A5F5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, margin: "0 auto", border: "4px solid #fff", boxShadow: "0 4px 16px rgba(0,0,0,0.18)" }}>
              {isChannelG ? "📢" : "👥"}
            </div>
            <div style={{ fontWeight: 900, fontSize: 22, color: "#111", marginTop: 12, marginBottom: 3 }}>{grp?.name ?? "Groupe"}</div>
            <div style={{ fontSize: 13, color: "#65676B" }}>
              {gInfo?.members.length ?? grp?.membersCount ?? 0} membre{(gInfo?.members.length ?? 1) !== 1 ? "s" : ""}
              {" · "}{isChannelG ? "Canal" : "Groupe"}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 20, padding: "0 20px" }}>
              {[
                { icon: "💬", label: "Message",   color: "#1877F2", bg: "#E8F0FE", action: () => setShowGroupInfo(false) },
                { icon: "🔕", label: "Silencieux", color: "#607D8B", bg: "#ECEFF1", action: () => {} },
                { icon: "🎥", label: "Vidéo",      color: "#9C27B0", bg: "#F3E5F5", action: () => {} },
                { icon: "🚪", label: "Quitter",    color: "#F44336", bg: "#FFEBEE", action: async () => { await apiLeaveChatGroup(activeGroupId); setChatGroups(p => p.filter(g => g.id !== activeGroupId)); setActiveGroupId(null); setShowGroupInfo(false); } },
              ].map(a => (
                <div key={a.label} onClick={a.action} style={{ cursor: "pointer", textAlign: "center", flex: 1, maxWidth: 70 }}>
                  <div style={{ width: 52, height: 52, borderRadius: "50%", background: a.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 6px" }}>{a.icon}</div>
                  <div style={{ fontSize: 11, color: a.color, fontWeight: 700 }}>{a.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Add members */}
        <div style={{ background: "#fff", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", cursor: "pointer", borderBottom: "1px solid #F5F5F5" }}>
            <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#E8F0FE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#1877F2", fontWeight: 900, flexShrink: 0 }}>+</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#1877F2" }}>Ajouter des membres</div>
              <div style={{ fontSize: 12, color: "#888" }}>Inviter des contacts dans le {isChannelG ? "canal" : "groupe"}</div>
            </div>
          </div>
        </div>

        {/* Members list */}
        <div style={{ background: "#fff" }}>
          <div style={{ padding: "10px 20px 6px", fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: 0.8, textTransform: "uppercase" }}>
            Membres · {gInfo?.members.length ?? grp?.membersCount ?? 0}
          </div>
          {(gInfo?.members ?? []).map((m, i) => {
            const name = m.firstName && m.lastName ? `${m.firstName} ${m.lastName}` : `Utilisateur #${m.userId}`;
            const roleLabel = m.role === "owner" ? "Propriétaire" : m.role === "admin" ? "Admin" : null;
            const roleColor = m.role === "owner" ? "#F57C00" : "#1877F2";
            return (
              <div key={m.userId} style={{ display: "flex", gap: 12, padding: "11px 20px", alignItems: "center", borderBottom: i < (gInfo?.members.length ?? 0) - 1 ? "1px solid #F5F5F5" : "none" }}>
                <div style={{ width: 46, height: 46, borderRadius: "50%", background: CONV_COLORS[m.userId % CONV_COLORS.length], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>{mkInitials(name)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: "#111" }}>{name}</div>
                  {m.userId === meId && <div style={{ fontSize: 12, color: "#888" }}>Vous</div>}
                </div>
                {roleLabel && <div style={{ fontSize: 11, color: roleColor, fontWeight: 700, background: roleColor + "18", borderRadius: 12, padding: "3px 10px", flexShrink: 0 }}>{roleLabel}</div>}
              </div>
            );
          })}
        </div>
      </div>
    , document.body);
  }

  /* ══════════════════════════════════════════════════════════════
     INFO OVERLAY — BrutePawa 2026 premium
  ══════════════════════════════════════════════════════════════ */
  if (activeConv && activeUser && overlay === "info") {
    const infoActions = [
      {
        label: "Message",
        action: () => setOverlay("none"),
        icon: (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" fill="#22C55E"/>
            <circle cx="8" cy="11" r="1.2" fill="#fff"/>
            <circle cx="12" cy="11" r="1.2" fill="#fff"/>
            <circle cx="16" cy="11" r="1.2" fill="#fff"/>
          </svg>
        ),
      },
      {
        label: "Appel audio",
        action: () => { setOverlay("none"); sig.startCall(activeConv, "audio"); },
        icon: (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="#22C55E">
            <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01z"/>
          </svg>
        ),
      },
      {
        label: "Vidéo",
        action: () => { setOverlay("none"); sig.startCall(activeConv, "video"); },
        icon: (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="#22C55E">
            <path d="M15 10l4.55-2.27A1 1 0 0121 8.62v6.76a1 1 0 01-1.45.9L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          </svg>
        ),
      },
    ];
    const infoRows = [
      {
        label: "Bonjour ! J'utilise Brute Pawa.",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#22C55E">
            <circle cx="12" cy="12" r="10"/>
            <path d="M8 13s1.5 2 4 2 4-2 4-2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
            <circle cx="9" cy="10" r="1.2" fill="#fff"/>
            <circle cx="15" cy="10" r="1.2" fill="#fff"/>
          </svg>
        ),
      },
      {
        label: activeUser.name,
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#22C55E">
            <rect x="5" y="2" width="14" height="20" rx="3"/>
            <rect x="9" y="4" width="6" height="1.5" rx="0.75" fill="#fff"/>
            <circle cx="12" cy="18" r="1" fill="#fff"/>
          </svg>
        ),
      },
    ];
    return createPortal(
      <div style={{ position: "fixed", top: 0, bottom: 0, left: 0, right: 0, zIndex: 10000, overflowY: "auto", background: "linear-gradient(160deg, #f0fdf4 0%, #ffffff 50%, #f0fdf4 100%)" }}>
        {/* subtle decorative blobs */}
        <div style={{ position: "fixed", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(34,197,94,0.10) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "fixed", bottom: 80, left: -40, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(34,197,94,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />

        {/* ── HEADER ── */}
        <div style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottom: "1px solid rgba(34,197,94,0.12)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setOverlay("none")} style={{ width: 38, height: 38, borderRadius: "50%", background: "#F0FDF4", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div style={{ flex: 1, fontWeight: 800, fontSize: 17, color: "#0D1B2A" }}>Infos du contact</div>
          <button style={{ width: 38, height: 38, borderRadius: "50%", background: "#F0FDF4", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#22C55E">
              <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
            </svg>
          </button>
        </div>

        {/* ── PROFILE CARD ── */}
        <div style={{ margin: "20px 16px 0", background: "#fff", borderRadius: 24, padding: "28px 20px 24px", textAlign: "center", boxShadow: "0 4px 24px rgba(34,197,94,0.10), 0 1px 4px rgba(0,0,0,0.06)", border: "1px solid rgba(34,197,94,0.08)" }}>
          {/* avatar */}
          <div style={{ position: "relative", display: "inline-block", marginBottom: 18 }}>
            <div style={{ width: 104, height: 104, borderRadius: "50%", background: activeUser.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, fontWeight: 900, color: "#fff", border: "3.5px solid #22C55E", boxShadow: "0 0 0 4px rgba(34,197,94,0.15), 0 6px 20px rgba(0,0,0,0.12)" }}>
              {activeUser.initials}
            </div>
            {/* presence dot */}
            <div style={{ position: "absolute", bottom: 6, right: 6, width: 20, height: 20, borderRadius: "50%", background: presence.online ? "#22C55E" : "#9CA3AF", border: "3px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }} />
          </div>

          {/* name + verified badge */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginBottom: 6 }}>
            <span style={{ fontWeight: 900, fontSize: 22, color: "#0D1B2A", letterSpacing: -0.3 }}>{activeUser.name}</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L14.09 8.26L21 9.27L16.5 13.97L17.64 21L12 17.77L6.36 21L7.5 13.97L3 9.27L9.91 8.26L12 2Z" fill="#22C55E"/>
              <polyline points="9,12 11,14 15,10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>

          {/* presence text */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 24 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: presence.online ? "#22C55E" : "#9CA3AF", flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: presence.online ? "#22C55E" : "#9CA3AF", fontWeight: 600 }}>{presence.online ? "En ligne" : presText}</span>
          </div>

          {/* action buttons */}
          <div style={{ display: "flex", gap: 10 }}>
            {infoActions.map(a => (
              <div key={a.label} onClick={a.action} style={{ flex: 1, background: "#F0FDF4", borderRadius: 16, padding: "14px 8px 12px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, border: "1px solid rgba(34,197,94,0.15)", boxShadow: "0 2px 8px rgba(34,197,94,0.08)", transition: "transform 0.15s" }}
                onPointerDown={e => (e.currentTarget.style.transform = "scale(0.96)")}
                onPointerUp={e => (e.currentTarget.style.transform = "scale(1)")}
                onPointerLeave={e => (e.currentTarget.style.transform = "scale(1)")}
              >
                <div style={{ width: 48, height: 48, borderRadius: 14, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(34,197,94,0.15)" }}>
                  {a.icon}
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#374151", textAlign: "center" }}>{a.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── INFO ROWS ── */}
        <div style={{ margin: "14px 16px 32px", background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", border: "1px solid rgba(34,197,94,0.07)" }}>
          {infoRows.map((row, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderBottom: i < infoRows.length - 1 ? "1px solid #F0FDF4" : "none" }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {row.icon}
              </div>
              <span style={{ flex: 1, fontSize: 14.5, color: "#0D1B2A", fontWeight: 500 }}>{row.label}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          ))}
        </div>
      </div>
    , document.body);
  }

  /* ══════════════════════════════════════════════════════════════
     GROUP CHAT VIEW
  ══════════════════════════════════════════════════════════════ */
  if (activeGroupId !== null) {
    const grp = chatGroups.find(g => g.id === activeGroupId);
    const gmsgs = groupMsgs[activeGroupId] ?? [];
    return createPortal(
      <div style={{ position: "fixed", top: 0, bottom: 0, left: 0, right: 0, display: "flex", flexDirection: "column", zIndex: 10000, overflow: "hidden", background: "#ECE5DD" }}>
        <style>{`
          .bp-chat-bg { background-color:#ECE5DD; background-image:url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%231877F2' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E"); }
          .bp-msg-mine { background:#1877F2; color:#fff; border-radius:18px 18px 4px 18px; }
          .bp-msg-theirs { background:#fff; color:#111; border-radius:18px 18px 18px 4px; box-shadow:0 1px 2px rgba(0,0,0,0.12); }
        `}</style>
        <div style={{ background: "#1877F2", padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, boxShadow: "0 2px 4px rgba(0,0,0,0.18)" }}>
          <button onClick={() => { setActiveGroupId(null); setShowGroupInfo(false); }} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#fff", padding: "4px 2px" }}>←</button>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: grp?.type === "channel" ? "#00838F" : "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, cursor: "pointer", border: "2px solid rgba(255,255,255,0.4)", flexShrink: 0 }} onClick={() => setShowGroupInfo(true)}>
            {grp?.type === "channel" ? "📢" : "👥"}
          </div>
          <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setShowGroupInfo(true)}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#fff", lineHeight: 1.2 }}>{grp?.name ?? "Groupe"}</div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.85)" }}>{grp?.membersCount ?? 0} membre{(grp?.membersCount ?? 0) !== 1 ? "s" : ""}</div>
          </div>
          <button onClick={() => setShowGroupInfo(true)} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 38, height: 38, cursor: "pointer", color: "#fff", fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>⋮</button>
        </div>
        <div className="bp-chat-bg" style={{ flex: 1, overflowY: "auto", padding: "10px 10px 6px", display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ textAlign: "center", fontSize: 11.5, color: "#555", background: "rgba(255,255,255,0.85)", borderRadius: 20, padding: "4px 14px", margin: "2px auto 10px", display: "inline-block", alignSelf: "center", boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }}>Aujourd'hui</div>
          {gmsgs.map((msg, i) => {
            const isFirst = i === 0 || gmsgs[i - 1]?.mine !== msg.mine;
            if (msg.type === "system") {
              return <div key={msg.id} style={{ textAlign: "center", fontSize: 11.5, color: "#555", background: "rgba(255,255,255,0.85)", borderRadius: 20, padding: "4px 14px", margin: "6px auto", display: "inline-block", alignSelf: "center", boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }}>{msg.text}</div>;
            }
            return (
              <div key={msg.id} style={{ display: "flex", justifyContent: msg.mine ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 6, marginTop: isFirst ? 6 : 1 }}>
                {!msg.mine && (
                  <div style={{ width: 28, flexShrink: 0, alignSelf: "flex-end", paddingBottom: 2 }}>
                    {isFirst && <div className="avatar xs" style={{ width: 26, height: 26, fontSize: 10, background: CONV_COLORS[Math.abs(msg.text.length + i) % CONV_COLORS.length] }}>{mkInitials(msg.senderName)}</div>}
                  </div>
                )}
                <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column" }}>
                  {!msg.mine && isFirst && <div style={{ fontSize: 11, color: "#1877F2", fontWeight: 700, marginBottom: 2, paddingLeft: 2 }}>{msg.senderName}</div>}
                  <div className={msg.mine ? "bp-msg-mine" : "bp-msg-theirs"} style={{ padding: "8px 12px 6px", fontSize: 14.5, lineHeight: 1.45, wordBreak: "break-word" }}>
                    {msg.text}
                    <div style={{ fontSize: 10, marginTop: 2, color: msg.mine ? "rgba(255,255,255,0.75)" : "#888", textAlign: "right" }}>{msg.time}{msg.mine && <span style={{ marginLeft: 3 }}>✓</span>}</div>
                  </div>
                </div>
              </div>
            );
          })}
          {gmsgs.length === 0 && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 0" }}>
              <div style={{ background: "rgba(255,255,255,0.85)", borderRadius: 16, padding: "12px 20px", fontSize: 13, color: "#555", textAlign: "center" }}>🔒 Les messages sont chiffrés de bout en bout</div>
            </div>
          )}
          <div ref={groupBottomRef} />
        </div>
        <div style={{ background: "#f0f2f5", padding: "6px 8px", display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <input value={groupNewMsg} onChange={e => setGroupNewMsg(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendGroupMsg(); } }}
              placeholder="Message..." style={{ width: "100%", background: "#fff", border: "none", borderRadius: 22, padding: "10px 14px", fontSize: 15, outline: "none", boxSizing: "border-box", color: "#111", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }} />
          </div>
          {groupNewMsg.trim() ? (
            <button onClick={sendGroupMsg} style={{ background: "#1877F2", border: "none", borderRadius: "50%", width: 40, height: 40, color: "#fff", cursor: "pointer", fontSize: 16, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(24,119,242,0.5)" }}>➤</button>
          ) : (
            <button style={{ background: "#1877F2", border: "none", borderRadius: "50%", width: 40, height: 40, color: "#fff", cursor: "pointer", fontSize: 18, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(24,119,242,0.5)" }}>🎤</button>
          )}
        </div>
      </div>
    , document.body);
  }

  /* ══════════════════════════════════════════════════════════════
     CONVERSATION VIEW — Facebook Lite Messenger exact clone
  ══════════════════════════════════════════════════════════════ */
  if (activeConv && activeUser) {
    const searchMatches = chatSearchQ.trim()
      ? currentMessages.filter(m => m.text.toLowerCase().includes(chatSearchQ.toLowerCase()))
      : [];
    const highlightId = searchMatches[chatSearchIdx]?.id ?? null;

    return createPortal(
      <div style={{ position:"fixed", top: vpOffset ? `${vpOffset}px` : 0, left:0, right:0, height: vpHeight ? `${vpHeight}px` : "100dvh", display:"flex", flexDirection:"column", zIndex:10000, overflow:"hidden" }}>
        <style>{`
          .fbl-msg-mine   { background:#DCF8C6; color:#111; border-radius:8px 8px 2px 8px; box-shadow:0 1px 1px rgba(0,0,0,0.12); }
          .fbl-msg-theirs { background:#fff; color:#111; border-radius:8px 8px 8px 2px; box-shadow:0 1px 1px rgba(0,0,0,0.10); }
          .fbl-menu-btn { display:flex; align-items:center; gap:14px; padding:13px 20px; background:none; border:none; width:100%; font-size:15px; color:#111; cursor:pointer; text-align:left; font-family:inherit; }
          .fbl-menu-btn:active { background:#F0F2F5; }
          .fbl-react-btn:active { transform:scale(1.35); }
          @keyframes fbl-sheet-up { from{transform:translateY(100%)} to{transform:translateY(0)} }
          @keyframes fbl-fade-in  { from{opacity:0} to{opacity:1} }
          @keyframes fbl-rec-pulse { 0%,100%{opacity:1} 50%{opacity:0.2} }
          @keyframes fbl-pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
          @keyframes wa-typing-dot { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }
          .wa-typing-dot { width:7px; height:7px; border-radius:50%; background:#999; display:inline-block; animation:wa-typing-dot 1.2s infinite; }
          .wa-typing-dot:nth-child(2) { animation-delay:0.2s; }
          .wa-typing-dot:nth-child(3) { animation-delay:0.4s; }
          .wa-attach-icon { display:flex; flex-direction:column; align-items:center; gap:7px; cursor:pointer; background:none; border:none; padding:0; }
          .wa-attach-icon span { font-size:12px; color:#555; text-align:center; line-height:1.2; max-width:64px; }
          .wa-attach-circle { width:52px; height:52px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:22px; }
        `}</style>

        {/* ── HEADER ── */}
        {selectionMode ? (
          /* ── PREMIUM SELECTION HEADER ── */
          <div style={{ background:"linear-gradient(135deg,#16C24A,#0ea541)", padding:"0 10px", height:58, display:"flex", alignItems:"center", gap:8, flexShrink:0, boxShadow:"0 2px 16px rgba(22,194,74,0.35)" }}>
            {/* Back arrow */}
            <button onClick={() => { setSelectionMode(false); setSelectedMsgs(new Set()); setLongPressMsg(null); }}
              style={{ background:"none", border:"none", cursor:"pointer", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", padding:8, borderRadius:"50%", flexShrink:0 }}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            </button>
            {/* Count capsule */}
            <div style={{ background:"rgba(255,255,255,0.22)", borderRadius:20, padding:"4px 14px", display:"flex", alignItems:"center", gap:7, backdropFilter:"blur(8px)", flex:1 }}>
              <span style={{ color:"#fff", fontWeight:900, fontSize:19, lineHeight:1 }}>{selectedMsgs.size}</span>
              <span style={{ color:"rgba(255,255,255,0.92)", fontSize:13, fontWeight:500 }}>{selectedMsgs.size <= 1 ? "sélectionné" : "sélectionnés"}</span>
            </div>
            {/* Edit icon */}
            <button style={{ background:"rgba(255,255,255,0.18)", border:"none", width:38, height:38, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, backdropFilter:"blur(8px)" }}>
              <svg viewBox="0 0 24 24" width="19" height="19" fill="#fff"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            </button>
            {/* Delete icon */}
            <button onClick={() => { confirmDelete(); setLongPressMsg(null); }}
              style={{ background:"rgba(255,255,255,0.18)", border:"none", width:38, height:38, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, backdropFilter:"blur(8px)" }}>
              <svg viewBox="0 0 24 24" width="19" height="19" fill="#fff"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </button>
            {/* More icon */}
            <button style={{ background:"rgba(255,255,255,0.18)", border:"none", width:38, height:38, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, backdropFilter:"blur(8px)" }}>
              <svg viewBox="0 0 24 24" width="19" height="19" fill="#fff"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
            </button>
          </div>
        ) : showChatSearch ? (
          /* SEARCH HEADER */
          <div style={{ background:"#075E54", padding:"8px 10px", display:"flex", alignItems:"center", gap:8, flexShrink:0, boxShadow:"0 2px 4px rgba(0,0,0,0.18)" }}>
            <button onClick={() => { setShowChatSearch(false); setChatSearchQ(""); setChatSearchIdx(0); }}
              style={{ background:"none", border:"none", fontSize:24, cursor:"pointer", color:"#fff", padding:"2px 4px 2px 0", display:"flex", alignItems:"center", lineHeight:1 }}>‹</button>
            <div style={{ fontWeight:700, fontSize:15, color:"#fff", flex:1 }}>Rechercher</div>
            {searchMatches.length > 0 && (
              <div style={{ fontSize:13, color:"rgba(255,255,255,0.85)", flexShrink:0 }}>
                {chatSearchIdx + 1} sur {searchMatches.length}
              </div>
            )}
            <button style={{ background:"rgba(255,255,255,0.2)", border:"none", borderRadius:14, padding:"4px 10px", color:"#fff", fontSize:12, cursor:"pointer", fontWeight:600, flexShrink:0 }}>
              Afficher en liste
            </button>
            <div style={{ display:"flex" }}>
              <button onClick={() => setChatSearchIdx(i => Math.max(0, i - 1))}
                style={{ background:"none", border:"none", color:"#fff", fontSize:16, cursor:"pointer", padding:"4px 6px", opacity: searchMatches.length === 0 ? 0.4 : 1 }}>▲</button>
              <button onClick={() => setChatSearchIdx(i => Math.min(searchMatches.length - 1, i + 1))}
                style={{ background:"none", border:"none", color:"#fff", fontSize:16, cursor:"pointer", padding:"4px 6px", opacity: searchMatches.length === 0 ? 0.4 : 1 }}>▼</button>
            </div>
          </div>
        ) : (
          /* NORMAL HEADER — Premium white design */
          <div style={{ background:"#fff", padding:"10px 12px", display:"flex", alignItems:"center", gap:10, flexShrink:0, borderBottom:"1px solid #F1F5F9", boxShadow:"0 1px 8px rgba(0,0,0,0.06)" }}>
            <button onClick={() => { setActiveConv(null); setOverlay("none"); setShowConvMenu(false); }}
              style={{ background:"none", border:"none", cursor:"pointer", color:"#16C24A", display:"flex", alignItems:"center", padding:"4px 6px 4px 0", flexShrink:0 }}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#16C24A" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            </button>
            <div style={{ position:"relative", cursor:"pointer", flexShrink:0 }} onClick={() => setOverlay("info")}>
              <div style={{ width:44, height:44, borderRadius:"50%", background:"linear-gradient(135deg,#16C24A,#0ea541)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:800, color:"#fff", boxShadow:"0 2px 8px rgba(22,194,74,0.35)" }}>{activeUser.initials}</div>
              {presence.online && <div style={{ position:"absolute", bottom:1, right:1, width:12, height:12, background:"#16C24A", borderRadius:"50%", border:"2.5px solid #fff" }} />}
            </div>
            <div style={{ flex:1, minWidth:0, cursor:"pointer" }} onClick={() => setOverlay("info")}>
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <span style={{ fontWeight:800, fontSize:16, color:"#0F172A", lineHeight:1.2 }}>{activeUser.name}</span>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="#16C24A"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
              </div>
              <div style={{ fontSize:12, color: presence.online ? "#16C24A" : "#94A3B8", fontWeight: presence.online ? 600 : 400 }}>{presText}</div>
            </div>
            <button onClick={() => sig.startCall(activeConv, "audio")}
              style={{ background:"#F0FDF4", border:"none", width:38, height:38, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#16C24A" strokeWidth="2.2" strokeLinecap="round"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.58.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.24 1.01L6.6 10.8z"/></svg>
            </button>
            <button onClick={() => sig.startCall(activeConv, "video")}
              style={{ background:"#F0FDF4", border:"none", width:38, height:38, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#16C24A" strokeWidth="2.2" strokeLinecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
            </button>
            <div style={{ position:"relative", flexShrink:0 }}>
              <button onClick={() => { setShowConvMenu(m => !m); setShowNotifSub(false); }}
                style={{ background:"none", border:"none", width:34, height:34, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#64748B" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="5" r="1.2" fill="#64748B"/><circle cx="12" cy="12" r="1.2" fill="#64748B"/><circle cx="12" cy="19" r="1.2" fill="#64748B"/></svg>
              </button>
            </div>
          </div>
        )}

        {/* SEARCH INPUT BAR */}
        {showChatSearch && (
          <div style={{ background:"#fff", padding:"6px 12px", borderBottom:"1px solid #E4E6EB", flexShrink:0 }}>
            <input value={chatSearchQ} onChange={e => { setChatSearchQ(e.target.value); setChatSearchIdx(0); }}
              placeholder="Rechercher dans la conversation…"
              autoFocus
              style={{ width:"100%", background:"#F0F2F5", border:"none", borderRadius:20, padding:"8px 14px", fontSize:14, outline:"none", boxSizing:"border-box" }} />
          </div>
        )}

        {/* ── MESSAGES AREA ── */}
        <div style={{ flex:1, overflowY:"auto", padding:"8px 10px 4px", display:"flex", flexDirection:"column", gap:2,
          ...(convWpKey !== "none" && wpUrl(convWpKey) ? {
            backgroundImage:`url(${wpUrl(convWpKey)})`, backgroundSize:"cover", backgroundPosition:"center", backgroundAttachment:"local"
          } : { background: convWallpaper ?? CONV_THEMES[convThemeKey].bg }) }}>

          {currentMessages.length === 0 ? (
            <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, padding:"60px 32px", textAlign:"center" }}>
              <div style={{ width:58, height:58, borderRadius:"50%", background:"rgba(0,0,0,0.08)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div style={{ fontSize:14, fontWeight:600, color:"rgba(0,0,0,0.45)", lineHeight:1.5 }}>
                Démarrer une conversation
              </div>
            </div>
          ) : (
            <div style={{ textAlign:"center", fontSize:11.5, color:"#888", background:"rgba(0,0,0,0.05)", borderRadius:20, padding:"3px 14px", margin:"4px auto 10px", display:"inline-block", alignSelf:"center" }}>Aujourd'hui</div>
          )}

          {currentMessages.map((msg, i) => {
            const isLast     = i === currentMessages.length - 1 || currentMessages[i + 1]?.mine !== msg.mine;
            const isHL       = showChatSearch && chatSearchQ.trim() && msg.text.toLowerCase().includes(chatSearchQ.toLowerCase());
            const isAct      = msg.id === highlightId;
            const isSelected = selectionMode && selectedMsgs.has(msg.id);
            const isAudio    = msg.attachment?.type === "audio";
            const isVoicePlaying = isAudio && playingAudioId === msg.id;
            const wfBars     = isAudio ? voiceWaveform(msg.id) : [];
            const playedBars = isAudio ? Math.floor(wfBars.length * audioProgress) : 0;
            return (
              <div key={msg.id}
                style={{ display:"flex", justifyContent: msg.mine ? "flex-end" : "flex-start", alignItems:"flex-end", gap:6, marginTop:2,
                  background: isSelected ? "rgba(22,194,74,0.10)" : isAct ? "rgba(24,119,242,0.15)" : isHL ? "rgba(255,235,59,0.25)" : "transparent",
                  borderRadius:10, transition:"all 0.2s", paddingLeft: selectionMode ? 38 : 0, paddingRight: selectionMode ? 6 : 0, position:"relative",
                  cursor: selectionMode ? "pointer" : "default" }}
                onClick={() => { if (selectionMode) toggleSelect(msg.id); }}
                onPointerDown={() => { if (!selectionMode) startLongPress(msg.id); }}
                onPointerUp={cancelLongPress} onPointerLeave={cancelLongPress}
                onContextMenu={e => { e.preventDefault(); cancelLongPress(); setSelectionMode(true); setSelectedMsgs(new Set([msg.id])); setLongPressMsg(msg.id); }}>
                {/* Premium selection circle */}
                {selectionMode && (
                  <div style={{ position:"absolute", left:7, top:"50%", transform:"translateY(-50%)", width:26, height:26, borderRadius:"50%",
                    background: isSelected ? "#16C24A" : "#fff",
                    border: `2.5px solid ${isSelected ? "#16C24A" : "#CBD5E1"}`,
                    boxShadow: isSelected ? "0 0 0 4px rgba(22,194,74,0.2), 0 2px 8px rgba(22,194,74,0.3)" : "0 1px 4px rgba(0,0,0,0.1)",
                    display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.18s", flexShrink:0, zIndex:2 }}>
                    {isSelected && <svg viewBox="0 0 24 24" width="14" height="14" fill="#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>}
                  </div>
                )}
                {/* Green glow outline on selected bubble */}
                {isSelected && (
                  <div style={{ position:"absolute", inset:1, borderRadius:10, border:"2px solid rgba(22,194,74,0.55)", boxShadow:"0 0 14px rgba(22,194,74,0.22)", pointerEvents:"none", zIndex:1 }} />
                )}
                {!msg.mine && (
                  <div style={{ width:28, flexShrink:0, alignSelf:"flex-end", paddingBottom:2 }}>
                    {isLast && <div className="avatar xs" style={{ background:activeUser.color, width:26, height:26, fontSize:10 }}>{activeUser.initials}</div>}
                  </div>
                )}
                <div style={{ maxWidth:"72%" }}>
                  {msg.attachment && (
                    msg.attachment.type === "audio" ? (
                      /* ── PREMIUM VOICE MESSAGE BUBBLE ── */
                      <div style={{
                        background: msg.mine ? "#16C24A" : "#fff",
                        borderRadius: msg.mine ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
                        padding:"12px 13px 10px",
                        minWidth:210, maxWidth:270,
                        boxShadow: msg.mine
                          ? "0 4px 18px rgba(22,194,74,0.38)"
                          : "0 2px 14px rgba(0,0,0,0.10)",
                        marginBottom:2,
                      }}>
                        {/* Row: play btn + waveform + speed+avatar(mine) */}
                        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                          {/* Play / Pause */}
                          <button
                            onClick={() => toggleVoice(msg.id, msg.attachment!.label)}
                            style={{
                              width:42, height:42, borderRadius:"50%", flexShrink:0, border:"none", cursor:"pointer",
                              background: msg.mine ? "rgba(255,255,255,0.28)" : "#16C24A",
                              display:"flex", alignItems:"center", justifyContent:"center",
                              boxShadow: msg.mine ? "none" : "0 3px 12px rgba(22,194,74,0.42)",
                              transition:"transform 0.12s",
                            }}>
                            {isVoicePlaying
                              ? <svg viewBox="0 0 24 24" width="17" height="17" fill="#fff"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                              : <svg viewBox="0 0 24 24" width="17" height="17" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
                            }
                          </button>

                          {/* Waveform bars */}
                          <div style={{ flex:1, display:"flex", alignItems:"center", gap:2, height:38 }}>
                            {wfBars.map((h, bi) => (
                              <div key={bi} style={{
                                flex:1, borderRadius:2,
                                height:`${Math.round(h * 100)}%`,
                                background: msg.mine
                                  ? (bi < playedBars ? "rgba(255,255,255,0.97)" : "rgba(255,255,255,0.38)")
                                  : (bi < playedBars ? "#16C24A" : "#CBD5E1"),
                                transition:"background 0.08s",
                              }}/>
                            ))}
                          </div>

                          {/* Speed badge + mini avatar (sent only) */}
                          {msg.mine && (
                            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5, flexShrink:0 }}>
                              <button onClick={cycleVoiceSpeed}
                                style={{ background:"rgba(255,255,255,0.22)", border:"none", borderRadius:7, padding:"2px 6px", cursor:"pointer", color:"#fff", fontSize:11, fontWeight:800 }}>
                                {voiceSpeed}x
                              </button>
                              <div style={{ width:26, height:26, borderRadius:"50%", background:"rgba(255,255,255,0.32)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:800, color:"#fff" }}>
                                {activeConvRef.current ? "ME" : "ME"}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Footer: duration | timestamp + ticks */}
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:7 }}>
                          <span style={{ fontSize:11, fontWeight:700, color: msg.mine ? "rgba(255,255,255,0.75)" : "#94A3B8", fontVariantNumeric:"tabular-nums" }}>
                            {isVoicePlaying
                              ? (() => {
                                  const el = voicePlayerRef.current;
                                  if (!el || !el.duration) return msg.attachment!.extra || "0:00";
                                  const s = Math.floor(el.currentTime);
                                  return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,"0")}`;
                                })()
                              : (msg.attachment!.extra || "0:00")
                            }
                          </span>
                          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                            <span style={{ fontSize:11, color: msg.mine ? "rgba(255,255,255,0.7)" : "#94A3B8" }}>{msg.time}</span>
                            {msg.mine && (
                              <svg viewBox="0 0 20 12" width="18" height="10"
                                fill={msg.status==="read" ? "#A5F3C0" : "rgba(255,255,255,0.6)"}>
                                <path d="M1 6l4 4 8-8" stroke={msg.status==="read" ? "#A5F3C0" : "rgba(255,255,255,0.6)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                                <path d="M7 6l4 4 8-8" stroke={msg.status==="read" ? "#A5F3C0" : "rgba(255,255,255,0.6)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: msg.mine ? "#1564c0" : "#f1f1f1", color: msg.mine ? "#fff" : "#111", borderRadius:14, padding:"8px 12px", marginBottom:2, fontSize:13, display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:18 }}>{msg.attachment.type==="image"?"🖼️":msg.attachment.type==="doc"?"📄":msg.attachment.type==="location"?"📍":"🎵"}</span>
                        <span>{msg.attachment.label}</span>
                      </div>
                    )
                  )}
                  {msg.attachment?.type === "image" && (
                    <div style={{ borderRadius:"8px 8px 0 0", overflow:"hidden", maxWidth:240, marginBottom:2 }}>
                      <img src={msg.attachment.label} alt={msg.attachment.extra || "photo"} style={{ width:"100%", display:"block", maxHeight:320, objectFit:"cover" }} />
                    </div>
                  )}
                  {msg.attachment?.type === "location" && (
                    <a href={msg.attachment.label} target="_blank" rel="noreferrer"
                      style={{ display:"flex", alignItems:"center", gap:8, background: msg.mine?"#c5f0a4":"#f1f1f1", borderRadius:10, padding:"10px 12px", marginBottom:2, textDecoration:"none", color:"#111", maxWidth:220 }}>
                      <span style={{ fontSize:26 }}>📍</span>
                      <div>
                        <div style={{ fontWeight:700, fontSize:13 }}>Position partagée</div>
                        <div style={{ fontSize:11, color:"#555" }}>{msg.attachment.extra ?? "Ouvrir la carte"}</div>
                      </div>
                    </a>
                  )}
                  {msg.attachment?.type === "doc" && (
                    <a href={msg.attachment.label} target="_blank" rel="noreferrer"
                      style={{ display:"flex", alignItems:"center", gap:8, background: msg.mine?"#c5f0a4":"#f1f1f1", borderRadius:10, padding:"10px 12px", marginBottom:2, textDecoration:"none", color:"#111", maxWidth:240 }}>
                      <span style={{ fontSize:26 }}>📄</span>
                      <div style={{ fontWeight:600, fontSize:13, wordBreak:"break-all" }}>{msg.attachment.extra ?? "Document"}</div>
                    </a>
                  )}
                  {!isAudio && (
                  <div className={msg.mine ? "fbl-msg-mine" : "fbl-msg-theirs"}
                    style={{ padding:"8px 12px 5px", fontSize:14.5, lineHeight:1.45, wordBreak:"break-word",
                      background: msg.mine ? CONV_THEMES[convThemeKey].mine : CONV_THEMES[convThemeKey].theirs,
                      color: msg.mine ? CONV_THEMES[convThemeKey].mineText : CONV_THEMES[convThemeKey].theirsText }}>
                    {msg.text}
                    <div style={{ fontSize:10, marginTop:2, textAlign:"right", display:"flex", justifyContent:"flex-end", alignItems:"center", gap:3,
                      color: msg.mine ? "rgba(255,255,255,0.72)" : "#888" }}>
                      {msg.time}
                      {msg.mine && <span style={{ fontSize:11, color: msg.status === "read" ? "#4FC3F7" : "rgba(255,255,255,0.72)" }}>{msg.status === "read" ? "✓✓" : "✓"}</span>}
                    </div>
                  </div>
                  )}
                </div>
              </div>
            );
          })}
          {false && currentMessages.length === 0 && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"8px 16px 24px", gap:0 }}>

              {/* ── Illustration ── */}
              <div style={{ width:"100%", maxWidth:340 }}>
                <svg viewBox="0 0 340 240" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:"100%", height:"auto" }}>
                  {/* Green background circle */}
                  <circle cx="170" cy="130" r="105" fill="#DCFCE7" opacity="0.7"/>
                  <circle cx="170" cy="130" r="75" fill="#DCFCE7" opacity="0.4"/>

                  {/* ── Man (left) — green hoodie ── */}
                  {/* Hoodie body */}
                  <rect x="55" y="120" width="52" height="72" rx="12" fill="#16C24A"/>
                  {/* Hood */}
                  <path d="M55 132 Q55 120 81 118 Q107 120 107 132" fill="#0ea541"/>
                  {/* BP logo on hoodie */}
                  <circle cx="81" cy="148" r="10" fill="#0ea541"/>
                  <text x="81" y="152" textAnchor="middle" fontSize="8" fontWeight="900" fill="#fff" fontFamily="Georgia, serif">bp</text>
                  {/* Legs */}
                  <rect x="62" y="188" width="14" height="40" rx="7" fill="#1E293B"/>
                  <rect x="83" y="188" width="14" height="40" rx="7" fill="#1E293B"/>
                  {/* Shoes */}
                  <ellipse cx="69" cy="229" rx="11" ry="5" fill="#0F172A"/>
                  <ellipse cx="90" cy="229" rx="11" ry="5" fill="#0F172A"/>
                  {/* Head */}
                  <circle cx="81" cy="106" r="20" fill="#4A2C0A"/>
                  {/* Hair short */}
                  <ellipse cx="81" cy="88" rx="20" ry="8" fill="#1A0A00"/>
                  {/* Eyes */}
                  <circle cx="75" cy="105" r="2.8" fill="#fff"/>
                  <circle cx="87" cy="105" r="2.8" fill="#fff"/>
                  <circle cx="76" cy="105" r="1.4" fill="#1A0A00"/>
                  <circle cx="88" cy="105" r="1.4" fill="#1A0A00"/>
                  {/* Smile */}
                  <path d="M77 112 Q81 116 85 112" stroke="#1A0A00" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                  {/* Phone */}
                  <rect x="105" y="140" width="20" height="32" rx="4" fill="#0F172A"/>
                  <rect x="107" y="143" width="16" height="24" rx="2" fill="#A7F3D0"/>
                  {/* Arm */}
                  <path d="M107 140 Q106 128 104 140" stroke="#4A2C0A" strokeWidth="8" strokeLinecap="round" fill="none"/>

                  {/* ── Woman (right) — green BrutePawa t-shirt ── */}
                  {/* T-shirt body */}
                  <rect x="207" y="118" width="52" height="70" rx="12" fill="#16C24A"/>
                  {/* BP logo on t-shirt */}
                  <circle cx="233" cy="148" r="10" fill="#0ea541"/>
                  <text x="233" y="152" textAnchor="middle" fontSize="8" fontWeight="900" fill="#fff" fontFamily="Georgia, serif">bp</text>
                  {/* Skirt/pants */}
                  <rect x="211" y="182" width="18" height="42" rx="8" fill="#1E293B"/>
                  <rect x="234" y="182" width="18" height="42" rx="8" fill="#1E293B"/>
                  <ellipse cx="220" cy="225" rx="11" ry="5" fill="#0F172A"/>
                  <ellipse cx="243" cy="225" rx="11" ry="5" fill="#0F172A"/>
                  {/* Head */}
                  <circle cx="233" cy="104" r="20" fill="#3D1F07"/>
                  {/* Bun hair */}
                  <ellipse cx="233" cy="87" rx="14" ry="9" fill="#1A0A00"/>
                  <circle cx="233" cy="80" r="8" fill="#1A0A00"/>
                  {/* Earring */}
                  <circle cx="253" cy="106" r="3" fill="#FCD34D"/>
                  {/* Eyes */}
                  <circle cx="227" cy="103" r="2.8" fill="#fff"/>
                  <circle cx="239" cy="103" r="2.8" fill="#fff"/>
                  <circle cx="228" cy="103" r="1.4" fill="#1A0A00"/>
                  <circle cx="240" cy="103" r="1.4" fill="#1A0A00"/>
                  {/* Smile */}
                  <path d="M229 110 Q233 114 237 110" stroke="#1A0A00" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                  {/* Phone */}
                  <rect x="192" y="140" width="20" height="32" rx="4" fill="#0F172A"/>
                  <rect x="194" y="143" width="16" height="24" rx="2" fill="#BBF7D0"/>
                  {/* Arm */}
                  <path d="M207 155 Q202 148 204 140" stroke="#3D1F07" strokeWidth="8" strokeLinecap="round" fill="none"/>

                  {/* ── Floating chat bubbles ── */}
                  {/* Top left */}
                  <rect x="14" y="60" width="70" height="36" rx="14" fill="#16C24A"/>
                  <path d="M25 95 L16 106 L38 95" fill="#16C24A"/>
                  <rect x="22" y="71" width="22" height="5" rx="2.5" fill="#fff" opacity="0.9"/>
                  <rect x="22" y="80" width="52" height="5" rx="2.5" fill="#fff" opacity="0.7"/>
                  {/* Top right */}
                  <rect x="256" y="50" width="70" height="36" rx="14" fill="#fff" style={{filter:"drop-shadow(0 2px 8px rgba(0,0,0,0.10))"}}/>
                  <path d="M315 85 L326 96 L304 85" fill="#fff"/>
                  <circle cx="274" cy="68" r="4" fill="#CBD5E1"/>
                  <circle cx="286" cy="68" r="4" fill="#CBD5E1"/>
                  <circle cx="298" cy="68" r="4" fill="#CBD5E1"/>
                  {/* Lock icon center */}
                  <rect x="149" y="82" width="42" height="42" rx="21" fill="#fff" style={{filter:"drop-shadow(0 4px 12px rgba(22,194,74,0.25))"}}/>
                  <rect x="160" y="94" width="20" height="16" rx="3" fill="#16C24A"/>
                  <path d="M163 94 Q163 88 170 88 Q177 88 177 94" stroke="#16C24A" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                  <circle cx="170" cy="101" r="2.5" fill="#fff"/>
                  {/* Small heart top right */}
                  <path d="M302 120 C302 117 298 116 297 119 C296 116 292 117 292 120 C292 124 297 128 297 128 C297 128 302 124 302 120z" fill="#F87171"/>
                  {/* Small green dot decorations */}
                  <circle cx="145" cy="55" r="5" fill="#16C24A" opacity="0.5"/>
                  <circle cx="200" cy="45" r="3.5" fill="#16C24A" opacity="0.4"/>
                  <circle cx="30" cy="140" r="4" fill="#16C24A" opacity="0.35"/>
                </svg>
              </div>

              {/* Title */}
              <div style={{ fontWeight:800, fontSize:20, color:"#0F172A", textAlign:"center", lineHeight:1.3, margin:"4px 0 12px" }}>
                Commencez une conversation<br/>
                avec <span style={{ color:"#16C24A" }}>{activeUser.name}</span>
              </div>

              {/* Security card */}
              <div style={{ display:"flex", alignItems:"center", gap:10, background:"#fff", border:"1px solid #E2E8F0", borderRadius:16, padding:"12px 16px", margin:"0 4px 16px", width:"100%", boxSizing:"border-box", boxShadow:"0 1px 6px rgba(0,0,0,0.06)" }}>
                <div style={{ width:36, height:36, borderRadius:"50%", background:"#DCFCE7", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#16C24A" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <div style={{ fontSize:13, color:"#475569", lineHeight:1.5 }}>
                  Vos messages sont protégés par un <span style={{ fontWeight:700, color:"#16C24A" }}>chiffrement de bout en bout.</span>
                </div>
              </div>

              {/* Suggestions header */}
              <div style={{ width:"100%", fontSize:14, fontWeight:700, color:"#0F172A", marginBottom:10, textAlign:"left" }}>
                Suggestions pour démarrer
              </div>

              {/* Suggestion chips */}
              <div style={{ display:"flex", gap:8, width:"100%", overflowX:"auto", scrollbarWidth:"none", paddingBottom:4 }}>
                {([
                  { icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#16C24A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 11v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3zM20.293 8.293A1 1 0 0 0 19.586 8H17V6a4 4 0 0 0-4-4 1 1 0 0 0-1 1v.667a4 4 0 0 1-1.902 3.43l-1.547.773A1 1 0 0 0 8 8.866V19a2 2 0 0 0 2 2h6.234a2 2 0 0 0 1.994-1.832l.582-7A2 2 0 0 0 20.293 8.293z"/></svg>, label:"Dire bonjour", msg:"Bonjour ! 👋" },
                  { icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#16C24A" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><circle cx="9" cy="9" r="1" fill="#16C24A"/><circle cx="15" cy="9" r="1" fill="#16C24A"/></svg>, label:"Un emoji", msg:"😄" },
                  { icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#16C24A" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>, label:"Une photo", msg:"Je voulais partager cette photo avec toi 📷" },
                  { icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#16C24A" strokeWidth="2" strokeLinecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>, label:"Une musique", msg:"Tu connais cette chanson ? 🎵" },
                  { icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#16C24A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>, label:"Un cadeau", msg:"J'ai quelque chose pour toi 🎁" },
                ] as {icon:React.ReactNode; label:string; msg:string}[]).map((s, i) => (
                  <button key={i}
                    onClick={() => {
                      if (!activeConv) return;
                      const id = Date.now();
                      setMessages(prev => ({ ...prev, [activeConv]: [...(prev[activeConv] ?? []), { id, text: s.msg, mine: true, time: new Date().toLocaleTimeString("fr", { hour:"2-digit", minute:"2-digit" }), status: "sent" }] }));
                      import("../lib/api").then(m => m.apiSendMessage(activeConv, s.msg).catch(() => {}));
                    }}
                    style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8, background:"#fff", border:"1px solid #E2E8F0", borderRadius:16, padding:"12px 14px", cursor:"pointer", flexShrink:0, minWidth:72, boxShadow:"0 1px 4px rgba(0,0,0,0.06)", transition:"all 0.15s" }}>
                    {s.icon}
                    <span style={{ fontSize:11, color:"#475569", fontWeight:600, textAlign:"center", lineHeight:1.2 }}>{s.label}</span>
                  </button>
                ))}
              </div>

              {/* Security guarantee card */}
              <div style={{ display:"flex", alignItems:"center", gap:12, background:"#fff", border:"1px solid #E2E8F0", borderRadius:16, padding:"14px 16px", marginTop:14, width:"100%", boxSizing:"border-box", cursor:"pointer", boxShadow:"0 1px 6px rgba(0,0,0,0.06)" }}>
                <div style={{ width:42, height:42, borderRadius:12, background:"#DCFCE7", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#16C24A" strokeWidth="2.2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:14, color:"#0F172A", marginBottom:2 }}>Sécurité garantie</div>
                  <div style={{ fontSize:12, color:"#64748B", lineHeight:1.5 }}>Personne en dehors de cette discussion ne peut lire vos messages, pas même BrutePawa.</div>
                </div>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              </div>

            </div>
          )}
          {peerTyping && (
            <div style={{ display:"flex", alignItems:"center", gap:8, alignSelf:"flex-start", background:"#fff", borderRadius:"8px 8px 8px 2px", padding:"8px 14px", boxShadow:"0 1px 1px rgba(0,0,0,0.10)", marginBottom:4, maxWidth:100 }}>
              <span className="wa-typing-dot" />
              <span className="wa-typing-dot" />
              <span className="wa-typing-dot" />
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── INPUT BAR ── */}
        {selectionMode ? (
          /* ── PREMIUM GLASSMORPHISM SELECTION PANEL ── */
          <div style={{ background:"rgba(248,250,252,0.94)", backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)", borderRadius:"24px 24px 0 0", boxShadow:"0 -8px 40px rgba(0,0,0,0.13), 0 -1px 0 rgba(255,255,255,0.8)", flexShrink:0, paddingBottom:"env(safe-area-inset-bottom, 12px)" }}>
            {/* Drag handle */}
            <div style={{ width:40, height:4, borderRadius:2, background:"#CBD5E1", margin:"10px auto 14px" }} />

            {/* Reaction bubbles row */}
            <div style={{ display:"flex", gap:6, padding:"0 12px 14px", overflowX:"auto", scrollbarWidth:"none", WebkitOverflowScrolling:"touch" } as React.CSSProperties}>
              {["😊","❤️","👍","👎","🔥","😍","👏","😂","😮","😢"].map(em => (
                <button key={em}
                  onClick={() => { setSelectionMode(false); setSelectedMsgs(new Set()); setLongPressMsg(null); }}
                  style={{ background:"#fff", border:"1.5px solid #F1F5F9", borderRadius:"50%", width:50, height:50, flexShrink:0, fontSize:26, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.08)", transition:"transform 0.12s, box-shadow 0.12s" }}
                  onMouseEnter={e => { e.currentTarget.style.transform="scale(1.28)"; e.currentTarget.style.boxShadow="0 4px 16px rgba(22,194,74,0.25)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform="scale(1)"; e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.08)"; }}>
                  {em}
                </button>
              ))}
            </div>

            {/* Separator */}
            <div style={{ height:1, background:"linear-gradient(90deg,transparent,#E2E8F0 20%,#E2E8F0 80%,transparent)", margin:"0 16px 14px" }} />

            {/* Actions grid 3×2 */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:6, padding:"0 10px 16px" }}>
              {/* Répondre */}
              <button onClick={() => { setSelectionMode(false); setSelectedMsgs(new Set()); setLongPressMsg(null); }}
                style={{ background:"#fff", border:"1.5px solid #F1F5F9", borderRadius:18, padding:"12px 4px 8px", display:"flex", flexDirection:"column", alignItems:"center", gap:5, cursor:"pointer", boxShadow:"0 1px 6px rgba(0,0,0,0.06)" }}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="#16C24A"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>
                <span style={{ fontSize:9.5, fontWeight:700, color:"#334155", lineHeight:1.1, textAlign:"center" }}>Répondre</span>
              </button>
              {/* Transférer */}
              <button onClick={() => { setSelectionMode(false); setSelectedMsgs(new Set()); setLongPressMsg(null); }}
                style={{ background:"#fff", border:"1.5px solid #F1F5F9", borderRadius:18, padding:"12px 4px 8px", display:"flex", flexDirection:"column", alignItems:"center", gap:5, cursor:"pointer", boxShadow:"0 1px 6px rgba(0,0,0,0.06)" }}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="#16C24A"><path d="M14 15l7-7-7-7v4.1c-5 0-8.5-1.6-11-5.1 1 5 4 10 11 11V15z"/></svg>
                <span style={{ fontSize:9.5, fontWeight:700, color:"#334155", lineHeight:1.1, textAlign:"center" }}>Transférer</span>
              </button>
              {/* Copier */}
              <button onClick={() => { copySelected(); }}
                style={{ background:"#fff", border:"1.5px solid #F1F5F9", borderRadius:18, padding:"12px 4px 8px", display:"flex", flexDirection:"column", alignItems:"center", gap:5, cursor:"pointer", boxShadow:"0 1px 6px rgba(0,0,0,0.06)" }}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="#16C24A"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                <span style={{ fontSize:9.5, fontWeight:700, color:"#334155", lineHeight:1.1, textAlign:"center" }}>Copier</span>
              </button>
              {/* Épingler */}
              <button onClick={() => { setSelectionMode(false); setSelectedMsgs(new Set()); setLongPressMsg(null); }}
                style={{ background:"#fff", border:"1.5px solid #F1F5F9", borderRadius:18, padding:"12px 4px 8px", display:"flex", flexDirection:"column", alignItems:"center", gap:5, cursor:"pointer", boxShadow:"0 1px 6px rgba(0,0,0,0.06)" }}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="#16C24A"><path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/></svg>
                <span style={{ fontSize:9.5, fontWeight:700, color:"#334155", lineHeight:1.1, textAlign:"center" }}>Épingler</span>
              </button>
              {/* Enregistrer */}
              <button onClick={() => { setSelectionMode(false); setSelectedMsgs(new Set()); setLongPressMsg(null); }}
                style={{ background:"#fff", border:"1.5px solid #F1F5F9", borderRadius:18, padding:"12px 4px 8px", display:"flex", flexDirection:"column", alignItems:"center", gap:5, cursor:"pointer", boxShadow:"0 1px 6px rgba(0,0,0,0.06)" }}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="#16C24A"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                <span style={{ fontSize:9.5, fontWeight:700, color:"#334155", lineHeight:1.1, textAlign:"center" }}>Enregistrer</span>
              </button>
              {/* Supprimer */}
              <button onClick={() => { confirmDelete(); setLongPressMsg(null); }}
                style={{ background:"#FFF5F5", border:"1.5px solid #FEE2E2", borderRadius:18, padding:"12px 4px 8px", display:"flex", flexDirection:"column", alignItems:"center", gap:5, cursor:"pointer", boxShadow:"0 1px 6px rgba(239,68,68,0.08)" }}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="#EF4444"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                <span style={{ fontSize:9.5, fontWeight:700, color:"#EF4444", lineHeight:1.1, textAlign:"center" }}>Supprimer</span>
              </button>
            </div>
          </div>
        ) : (
          /* NORMAL INPUT BAR — Premium white design */
          <div style={{ background:"#fff", borderTop:"1px solid #F1F5F9", flexShrink:0 }}>

            {/* ── Premium recording bar — WhatsApp 2026 style ── */}
            {isRecording && (
              <div style={{ position:"relative", margin:"6px 10px 2px" }}>

                {/* Floating lock icon — shows when dragging up */}
                {recDragY < -35 && !recLocked && (
                  <div style={{
                    position:"absolute", top:-52, left:"50%", transform:"translateX(-50%)",
                    width:44, height:44, borderRadius:"50%",
                    background: recDragY < -75 ? "#1877F2" : "#fff",
                    boxShadow:"0 6px 24px rgba(0,0,0,0.18)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    animation:"fbl-fade-in 0.18s ease",
                    transition:"background 0.2s",
                  }}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill={recDragY < -75 ? "#fff" : "#1877F2"}>
                      <rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4" strokeWidth="2" stroke={recDragY < -75 ? "#fff" : "#1877F2"} fill="none" strokeLinecap="round"/>
                    </svg>
                  </div>
                )}

                {/* Lock badge when locked */}
                {recLocked && (
                  <div style={{ display:"flex", alignItems:"center", gap:6, paddingBottom:6, paddingLeft:4 }}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="#1877F2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4" strokeWidth="2" stroke="#1877F2" fill="none" strokeLinecap="round"/></svg>
                    <span style={{ fontSize:12, fontWeight:700, color:"#1877F2" }}>Verrouillé — appuyez sur Envoyer</span>
                  </div>
                )}

                {/* Main capsule */}
                <div
                  onPointerDown={!recLocked ? recGestureDown : undefined}
                  onPointerMove={!recLocked ? recGestureMove : undefined}
                  onPointerUp={!recLocked ? recGestureUp : undefined}
                  style={{
                    display:"flex", alignItems:"center", gap:10,
                    background:"rgba(255,255,255,0.97)",
                    backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)",
                    borderRadius:28,
                    padding:"9px 10px 9px 12px",
                    boxShadow:"0 8px 32px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.07)",
                    border:"1px solid rgba(226,232,240,0.8)",
                    transform:`translateX(${recDragX * 0.38}px)`,
                    transition: recIsDraggingRef.current ? "none" : "transform 0.28s cubic-bezier(0.34,1.56,0.64,1)",
                    cursor: recLocked ? "default" : "grab",
                    userSelect:"none", touchAction:"none",
                  }}>

                  {/* Trash button */}
                  <button onClick={cancelVoice}
                    style={{
                      width:40, height:40, borderRadius:"50%", border:"none", flexShrink:0,
                      background:"#fff", cursor:"pointer",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      boxShadow:"0 2px 10px rgba(0,0,0,0.10)",
                    }}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                  </button>

                  {/* Center: dot + timer + waveform + ANNULER */}
                  <div style={{ flex:1, display:"flex", alignItems:"center", gap:8, overflow:"hidden" }}>
                    {/* Red pulsing dot */}
                    <div style={{ width:9, height:9, borderRadius:"50%", background:"#EF4444", flexShrink:0, animation:"fbl-rec-pulse 1s ease-in-out infinite" }} />

                    {/* Timer */}
                    <span style={{ fontSize:15, fontWeight:800, color:"#EF4444", fontVariantNumeric:"tabular-nums", flexShrink:0, minWidth:42 }}>
                      {`${Math.floor(recSeconds/60).toString().padStart(2,"0")}:${(recSeconds%60).toString().padStart(2,"0")}`}
                    </span>

                    {/* Waveform OR swipe-cancel hint */}
                    {recDragX < -55 ? (
                      <span style={{ flex:1, fontSize:12, fontWeight:700, color: recDragX < -80 ? "#EF4444" : "#94A3B8", textAlign:"center" }}>
                        {recDragX < -80 ? "Relâchez pour annuler" : "← Glisser pour annuler"}
                      </span>
                    ) : (
                      <div style={{ flex:1, display:"flex", alignItems:"center", gap:1.5, height:34 }}>
                        {[0.38,0.62,0.90,0.55,0.80,0.45,0.72,0.95,0.60,0.40,0.85,0.50,0.75,0.35,0.68,0.92,0.48,0.70,0.38,0.80].map((h,i) => (
                          <div key={i} style={{
                            flex:1, borderRadius:2, background:"#16C24A",
                            height:`${Math.round(h*100)}%`,
                            animation:`wa-typing-dot ${0.55+i*0.07}s ease-in-out ${i*0.045}s infinite alternate`,
                            opacity:0.7+h*0.3,
                          }} />
                        ))}
                      </div>
                    )}

                    {/* ANNULER text */}
                    <span style={{ fontSize:12, fontWeight:700, color:"#94A3B8", flexShrink:0, letterSpacing:"0.03em" }}>ANNULER</span>
                  </div>

                  {/* Send button */}
                  <button onClick={stopVoice}
                    style={{
                      width:48, height:48, borderRadius:"50%", border:"none", flexShrink:0,
                      background:"linear-gradient(135deg,#16C24A 0%,#0ea541 100%)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      cursor:"pointer",
                      boxShadow:"0 4px 20px rgba(22,194,74,0.5)",
                    }}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2" fill="#fff" stroke="none"/>
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* ── Main input row ── */}
            <div style={{ padding:"8px 12px", display:"flex", gap:8, alignItems:"center" }}>
              {/* Emoji button */}
              <button style={{ background:"none", border:"none", cursor:"pointer", padding:0, flexShrink:0, display:"flex", alignItems:"center" }}>
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><circle cx="9" cy="9" r="1" fill="#94A3B8"/><circle cx="15" cy="9" r="1" fill="#94A3B8"/></svg>
              </button>
              {/* Text input */}
              <div style={{ flex:1 }}>
                <input value={newMsg}
                  onChange={e => {
                    setNewMsg(e.target.value);
                    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
                    apiSendTyping(activeConv!).catch(() => {});
                    typingDebounceRef.current = setTimeout(() => { typingDebounceRef.current = null; }, 2500);
                  }}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
                  placeholder="Écrire un message..."
                  disabled={isRecording}
                  style={{ width:"100%", background: isRecording ? "#F8FAFC" : "#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:24, padding:"10px 16px", fontSize:15, outline:"none", boxSizing:"border-box", color: isRecording ? "#94A3B8" : "#0F172A", opacity: isRecording ? 0.5 : 1 }} />
              </div>
              {newMsg.trim() && !isRecording ? (
                <button onClick={() => sendMsg()}
                  style={{ background:"#16C24A", border:"none", borderRadius:"50%", width:44, height:44, color:"#fff", cursor:"pointer", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 3px 12px rgba(22,194,74,0.45)" }}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              ) : (
                <>
                  {!isRecording && (
                    <>
                      <button onClick={() => { setAttachSheet(true); setAttachPage("none"); }}
                        style={{ background:"none", border:"none", cursor:"pointer", padding:0, flexShrink:0, display:"flex", alignItems:"center" }}>
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                      </button>
                      <button style={{ background:"none", border:"none", cursor:"pointer", padding:0, flexShrink:0, display:"flex", alignItems:"center" }}>
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      </button>
                    </>
                  )}
                  {/* Mic button — hidden during recording */}
                  {!isRecording && (
                  <button
                    onPointerDown={e => { e.preventDefault(); startVoice(); }}
                    style={{ background:"#16C24A", border:"none", borderRadius:"50%", width:44, height:44, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", boxShadow:"0 3px 12px rgba(22,194,74,0.45)" }}>
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                  </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── ⋮ DROPDOWN MENU ── */}
        {showConvMenu && (
          <>
            <div style={{ position:"fixed", inset:0, zIndex:98 }} onClick={() => { setShowConvMenu(false); setShowNotifSub(false); }} />
            <div style={{ position:"fixed", top:56, right:8, background:"#fff", borderRadius:12, boxShadow:"0 4px 24px rgba(0,0,0,0.22)", zIndex:10001, minWidth:234, overflow:"hidden", animation:"fbl-fade-in 0.15s ease" }}
              onClick={e => e.stopPropagation()}>
              <button className="fbl-menu-btn" onClick={() => setShowNotifSub(n => !n)}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="#555"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
                <span style={{ flex:1 }}>Notifications</span>
                <span style={{ color:"#bbb", fontSize:16, transition:"transform 0.2s", transform: showNotifSub ? "rotate(90deg)" : "none" }}>›</span>
              </button>
              {showNotifSub && (
                <div style={{ background:"#F8F9FA", borderTop:"1px solid #EAEAEA", borderBottom:"1px solid #EAEAEA" }}>
                  <button className="fbl-menu-btn" style={{ paddingLeft:36, fontSize:14, color:"#555" }} onClick={() => setShowNotifSub(false)}>
                    <span style={{ fontSize:14 }}>‹</span> <span>Retour</span>
                  </button>
                  <button className="fbl-menu-btn" style={{ paddingLeft:36, fontSize:14 }}>🔕 Couper le son</button>
                  <button className="fbl-menu-btn" style={{ paddingLeft:36, fontSize:14 }}>⏱ Désactiver pour…</button>
                  <button className="fbl-menu-btn" style={{ paddingLeft:36, fontSize:14 }}>⚙️ Personnaliser</button>
                  <button className="fbl-menu-btn" style={{ paddingLeft:36, fontSize:14, color:"#E02020" }} onClick={() => setShowConvMenu(false)}>🚫 Désactiver</button>
                </div>
              )}
              <button className="fbl-menu-btn" onClick={() => { sig.startCall(activeConv, "video"); setShowConvMenu(false); }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="#555"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
                Appel vidéo
              </button>
              <button className="fbl-menu-btn" onClick={() => { setShowChatSearch(true); setShowConvMenu(false); }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="#555"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                Rechercher
              </button>
              <button className="fbl-menu-btn" onClick={() => { setPendingThemeKey(convThemeKey); setPendingWpKey(convWpKey); setShowWallpaper(true); setShowConvMenu(false); }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="#555"><path d="M21 3H3C2 3 1 4 1 5v14c0 1.1.9 2 2 2h18c1 0 2-1 2-2V5c0-1-1-2-2-2zM5 17l3.5-4.5 2.5 3.01L14.5 11l4.5 6H5z"/></svg>
                Fond d'écran
              </button>
              <div style={{ height:1, background:"#F0F2F5" }} />
              <button className="fbl-menu-btn" onClick={async () => {
                const id = activeConv!;
                setMessages(prev => ({ ...prev, [id]: [] }));
                setConvList(prev => prev.map(c => c.id === id ? { ...c, lastMessage: "", unread: 0 } : c));
                setShowConvMenu(false);
                await apiDeleteConversation(id).catch(() => {});
              }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="#555"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                Effacer l'historique
              </button>
              <button className="fbl-menu-btn" style={{ color:"#E02020" }} onClick={() => { setShowDeleteConv(true); setShowConvMenu(false); }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="#E02020"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 2.75c1.24 0 2.25 1.01 2.25 2.25S13.24 11.25 12 11.25 9.75 10.24 9.75 9 10.76 6.75 12 6.75zM17 17H7v-.75c0-1.67 3.33-2.5 5-2.5s5 .83 5 2.5V17z"/></svg>
                Supprimer l'échange
              </button>
            </div>
          </>
        )}

        {/* long-press modal removed — handled inline by selection header + bottom bar */}

        {/* ── WALLPAPER / THEME SELECTOR PREMIUM ── */}
        {showWallpaper && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:10001, display:"flex", flexDirection:"column", justifyContent:"flex-end", animation:"fbl-fade-in 0.18s ease" }}
            onClick={() => setShowWallpaper(false)}>
            <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", maxHeight:"82dvh", overflowY:"auto", animation:"fbl-sheet-up 0.25s ease" }}
              onClick={e => e.stopPropagation()}>

              {/* Drag handle */}
              <div style={{ display:"flex", justifyContent:"center", padding:"10px 0 0" }}>
                <div style={{ width:36, height:4, borderRadius:2, background:"#E2E8F0" }} />
              </div>

              {/* Title */}
              <div style={{ padding:"14px 20px 6px", fontWeight:800, fontSize:17, color:"#0F172A", textAlign:"center" }}>
                Personnaliser la conversation
              </div>

              {/* ── Live preview strip ── */}
              <div style={{ margin:"8px 16px 0", borderRadius:16, overflow:"hidden", border:"1px solid #E2E8F0",
                ...(pendingWpKey !== "none" && wpUrl(pendingWpKey) ? { backgroundImage:`url(${wpUrl(pendingWpKey)})`, backgroundSize:"cover", backgroundPosition:"center" } : { background: CONV_THEMES[pendingThemeKey].bg }) }}>
                <div style={{ padding:"10px 14px", display:"flex", flexDirection:"column", gap:6 }}>
                  {/* Received */}
                  <div style={{ display:"flex", justifyContent:"flex-start" }}>
                    <div style={{ background:CONV_THEMES[pendingThemeKey].theirs, color:CONV_THEMES[pendingThemeKey].theirsText, borderRadius:"8px 8px 8px 2px", padding:"7px 11px", fontSize:12.5, maxWidth:"62%", boxShadow:"0 1px 2px rgba(0,0,0,0.10)" }}>
                      Salut ! Comment tu vas ? 😊
                    </div>
                  </div>
                  {/* Sent */}
                  <div style={{ display:"flex", justifyContent:"flex-end" }}>
                    <div style={{ background:CONV_THEMES[pendingThemeKey].mine, color:CONV_THEMES[pendingThemeKey].mineText, borderRadius:"8px 8px 2px 8px", padding:"7px 11px", fontSize:12.5, maxWidth:"62%", boxShadow:"0 1px 2px rgba(0,0,0,0.12)" }}>
                      Très bien merci ! Et toi ? 🙌
                    </div>
                  </div>
                  {/* Received */}
                  <div style={{ display:"flex", justifyContent:"flex-start" }}>
                    <div style={{ background:CONV_THEMES[pendingThemeKey].theirs, color:CONV_THEMES[pendingThemeKey].theirsText, borderRadius:"8px 8px 8px 2px", padding:"7px 11px", fontSize:12.5, maxWidth:"55%", boxShadow:"0 1px 2px rgba(0,0,0,0.10)" }}>
                      Super ! 🎉
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Couleurs de discussion ── */}
              <div style={{ padding:"18px 16px 4px" }}>
                <div style={{ fontWeight:700, fontSize:14, color:"#0F172A", marginBottom:12 }}>Couleurs de discussion</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:8 }}>
                  {(Object.entries(CONV_THEMES) as [ThemeKey, typeof CONV_THEMES[ThemeKey]][]).map(([key, t]) => {
                    const sel = pendingThemeKey === key;
                    return (
                      <div key={key} onClick={() => setPendingThemeKey(key)}
                        style={{ cursor:"pointer", borderRadius:14, border: sel ? `2.5px solid #16C24A` : "2px solid #E2E8F0", overflow:"hidden", position:"relative", transition:"border-color 0.15s", boxShadow: sel ? "0 0 0 3px rgba(22,194,74,0.18)" : "none" }}>
                        {/* Mini preview */}
                        <div style={{ background:t.bg, padding:"6px 6px 4px", display:"flex", flexDirection:"column", gap:3 }}>
                          {/* Their bubble */}
                          <div style={{ background:t.theirs, borderRadius:"5px 5px 5px 1px", height:8, width:"68%", boxShadow:"0 1px 1px rgba(0,0,0,0.08)" }} />
                          {/* Mine bubble */}
                          <div style={{ background:t.mine, borderRadius:"5px 5px 1px 5px", height:8, width:"55%", alignSelf:"flex-end", boxShadow:"0 1px 2px rgba(0,0,0,0.14)" }} />
                          {/* Their bubble 2 */}
                          <div style={{ background:t.theirs, borderRadius:"5px 5px 5px 1px", height:6, width:"50%", boxShadow:"0 1px 1px rgba(0,0,0,0.08)", marginBottom:2 }} />
                        </div>
                        {/* Label */}
                        <div style={{ background:"#fff", padding:"3px 4px 5px", textAlign:"center" }}>
                          <span style={{ fontSize:9.5, fontWeight: sel ? 700 : 500, color: sel ? "#16C24A" : "#475569", lineHeight:1.1, display:"block" }}>{t.label}</span>
                        </div>
                        {/* Selected badge */}
                        {sel && (
                          <div style={{ position:"absolute", top:4, right:4, width:16, height:16, borderRadius:"50%", background:"#16C24A", display:"flex", alignItems:"center", justifyContent:"center" }}>
                            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Fond d'écran ── */}
              <div style={{ padding:"16px 16px 4px" }}>
                <div style={{ fontWeight:700, fontSize:14, color:"#0F172A", marginBottom:12 }}>Fond d'écran</div>
                <div style={{ display:"flex", gap:8, overflowX:"auto", scrollbarWidth:"none", paddingBottom:4 }}>
                  {CONV_WALLPAPERS.map(w => {
                    const sel = pendingWpKey === w.key;
                    const url = wpUrl(w.key as WallpaperKey);
                    return (
                      <div key={w.key} onClick={() => setPendingWpKey(w.key as WallpaperKey)}
                        style={{ flexShrink:0, width:72, cursor:"pointer", borderRadius:14, overflow:"hidden", border: sel ? "2.5px solid #16C24A" : "2px solid #E2E8F0", position:"relative", boxShadow: sel ? "0 0 0 3px rgba(22,194,74,0.18)" : "0 2px 8px rgba(0,0,0,0.10)", transition:"all 0.15s" }}>
                        {url ? (
                          <img src={url} alt={w.label} style={{ width:"100%", height:72, objectFit:"cover", display:"block" }} />
                        ) : (
                          <div style={{ width:"100%", height:72, background:"#F0FDF4", display:"flex", alignItems:"center", justifyContent:"center" }}>
                            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#16C24A" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                          </div>
                        )}
                        <div style={{ background:"#fff", padding:"3px 2px 5px", textAlign:"center", fontSize:9.5, fontWeight: sel ? 700 : 500, color: sel ? "#16C24A" : "#475569", lineHeight:1.2 }}>{w.label}</div>
                        {sel && (
                          <div style={{ position:"absolute", top:4, right:4, width:18, height:18, borderRadius:"50%", background:"#16C24A", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 1px 4px rgba(0,0,0,0.3)" }}>
                            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Appliquer button ── */}
              <div style={{ padding:"16px 16px 32px" }}>
                <button onClick={() => {
                  setConvThemeKey(pendingThemeKey);
                  setConvWpKey(pendingWpKey);
                  setConvWallpaper(null);
                  setShowWallpaper(false);
                  if (activeConv) {
                    localStorage.setItem(`bp_theme_${activeConv}`, pendingThemeKey);
                    localStorage.setItem(`bp_wp_${activeConv}`, pendingWpKey);
                  }
                }}
                  style={{ width:"100%", background:"linear-gradient(135deg,#16C24A,#0ea541)", border:"none", borderRadius:99, padding:"15px", fontSize:16, fontWeight:800, color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, boxShadow:"0 4px 18px rgba(22,194,74,0.45)", letterSpacing:0.2 }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                  </svg>
                  Appliquer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── SUPPRIMER L'ÉCHANGE DIALOG ── */}
        {showDeleteConv && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:10001, padding:"0 20px", animation:"fbl-fade-in 0.18s ease" }}
            onClick={e => { if (e.target === e.currentTarget) setShowDeleteConv(false); }}>
            <div style={{ background:"#fff", borderRadius:28, width:"100%", maxWidth:360, boxShadow:"0 24px 64px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.10)", overflow:"hidden", animation:"fbl-sheet-up 0.22s ease" }}
              onClick={e => e.stopPropagation()}>

              {/* Top icon area */}
              <div style={{ padding:"32px 24px 20px", textAlign:"center" }}>
                {/* Trash icon in layered circles */}
                <div style={{ position:"relative", display:"inline-flex", alignItems:"center", justifyContent:"center", marginBottom:20 }}>
                  <div style={{ width:88, height:88, borderRadius:"50%", background:"rgba(239,68,68,0.10)" }} />
                  <div style={{ position:"absolute", width:66, height:66, borderRadius:"50%", background:"rgba(239,68,68,0.16)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6"/>
                      <path d="M14 11v6"/>
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  </div>
                </div>

                {/* Title */}
                <div style={{ fontWeight:800, fontSize:20, color:"#0F172A", marginBottom:8, letterSpacing:-0.3 }}>
                  Supprimer la discussion
                </div>

                {/* Subtitle */}
                <div style={{ fontSize:14, color:"#64748B", lineHeight:1.6, marginBottom:0 }}>
                  Cette action supprimera définitivement votre conversation avec <strong style={{ color:"#0F172A" }}>{activeUser?.name ?? "cet utilisateur"}</strong>.
                </div>
              </div>

              {/* Divider */}
              <div style={{ height:1, background:"#F1F5F9", margin:"0 0" }} />

              {/* User card */}
              <div style={{ padding:"16px 24px", display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:46, height:46, borderRadius:"50%", background: activeUser?.color ?? "#16C24A", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <span style={{ color:"#fff", fontWeight:800, fontSize:17 }}>{activeUser?.initials ?? "?"}</span>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <span style={{ fontWeight:700, fontSize:15, color:"#0F172A" }}>{activeUser?.name ?? "Utilisateur"}</span>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" fill="#16C24A"/>
                      <polyline points="8,12 11,15 16,9" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    </svg>
                  </div>
                  <div style={{ fontSize:13, color:"#94A3B8", marginTop:1 }}>Hors ligne</div>
                </div>
              </div>

              {/* Divider */}
              <div style={{ height:1, background:"#F1F5F9" }} />

              {/* Checkbox option */}
              <label style={{ display:"flex", alignItems:"center", gap:14, padding:"16px 24px", cursor:"pointer" }}>
                {/* Custom checkbox */}
                <div onClick={() => setDeleteForAll(v => !v)}
                  style={{ width:22, height:22, borderRadius:6, border: deleteForAll ? "none" : "2px solid #CBD5E1", background: deleteForAll ? "#16C24A" : "#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.15s" }}>
                  {deleteForAll && (
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </div>
                <span style={{ fontSize:14, color:"#334155", fontWeight:500 }}>
                  Supprimer également pour <strong style={{ color:"#0F172A" }}>{activeUser?.name ?? "cet utilisateur"}</strong>
                </span>
              </label>

              {/* Divider */}
              <div style={{ height:1, background:"#F1F5F9" }} />

              {/* Action buttons */}
              <div style={{ display:"flex", gap:10, padding:"16px 20px 20px" }}>
                <button onClick={() => setShowDeleteConv(false)}
                  style={{ flex:1, background:"#fff", border:"1.5px solid #E2E8F0", borderRadius:50, padding:"13px", fontSize:15, fontWeight:700, color:"#16C24A", cursor:"pointer" }}>
                  Annuler
                </button>
                <button onClick={async () => {
                  const id = activeConv!;
                  if (deleteForAll) {
                    await apiDeleteConversation(id).catch(() => {});
                  } else {
                    const hiddenKey = "bp_hidden_convs";
                    const hidden: number[] = JSON.parse(localStorage.getItem(hiddenKey) ?? "[]");
                    if (!hidden.includes(id)) localStorage.setItem(hiddenKey, JSON.stringify([...hidden, id]));
                  }
                  setMessages(prev => { const n = { ...prev }; delete n[id]; return n; });
                  setConvList(prev => prev.filter(c => c.id !== id));
                  setActiveConv(null);
                  setShowDeleteConv(false);
                  setDeleteForAll(false);
                }}
                  style={{ flex:1.4, background:"linear-gradient(135deg,#EF4444,#DC2626)", border:"none", borderRadius:50, padding:"13px 18px", fontSize:15, fontWeight:700, color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:7, boxShadow:"0 4px 14px rgba(239,68,68,0.4)" }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── ATTACHMENT SHEET ── */}
        {attachSheet && createPortal(
          <div style={{ position:"fixed", inset:0, zIndex:10002, display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
            <div style={{ background:"rgba(0,0,0,0.45)", position:"absolute", inset:0 }} onClick={() => { setAttachSheet(false); setAttachPage("none"); }} />
            <div style={{ background:"#fff", borderRadius:"18px 18px 0 0", position:"relative", zIndex:1, animation:"fbl-sheet-up 0.22s ease", maxHeight:"90dvh", overflowY:"auto" }}>

              {/* Hidden file inputs */}
              <input ref={galleryInputRef} type="file" accept="image/*" style={{ display:"none" }}
                onChange={e => { const f=e.target.files?.[0]; if(f) handleFileInput(f,"image"); e.target.value=""; }} />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }}
                onChange={e => { const f=e.target.files?.[0]; if(f) handleFileInput(f,"image"); e.target.value=""; }} />
              <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.csv,.zip" style={{ display:"none" }}
                onChange={e => { const f=e.target.files?.[0]; if(f) handleFileInput(f,"doc"); e.target.value=""; }} />

              {/* MAIN ICONS GRID */}
              {attachPage === "none" && (
                <>
                  <div style={{ width:36, height:4, background:"#DDD", borderRadius:2, margin:"10px auto 0" }} />
                  <div style={{ padding:"18px 18px 6px", display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"18px 8px" }}>
                    <button className="wa-attach-icon" onClick={() => galleryInputRef.current?.click()}>
                      <div className="wa-attach-circle" style={{ background:"#5B8DEF" }}>🖼️</div><span>Galerie</span>
                    </button>
                    <button className="wa-attach-icon" onClick={() => cameraInputRef.current?.click()}>
                      <div className="wa-attach-circle" style={{ background:"#FF5BA7" }}>📷</div><span>Caméra</span>
                    </button>
                    <button className="wa-attach-icon" onClick={handleLocation}>
                      <div className="wa-attach-circle" style={{ background:"#25D366" }}>📍</div><span>Localisation</span>
                    </button>
                    <button className="wa-attach-icon" onClick={() => setAttachPage("contacts")}>
                      <div className="wa-attach-circle" style={{ background:"#1877F2" }}>👤</div><span>Contact</span>
                    </button>
                    <button className="wa-attach-icon" onClick={() => docInputRef.current?.click()}>
                      <div className="wa-attach-circle" style={{ background:"#7B5EA7" }}>📄</div><span>Document</span>
                    </button>
                    <button className="wa-attach-icon" onClick={() => setAttachPage("poll")}>
                      <div className="wa-attach-circle" style={{ background:"#F5A623" }}>📊</div><span>Sondage</span>
                    </button>
                    <button className="wa-attach-icon" onClick={() => setAttachPage("event")}>
                      <div className="wa-attach-circle" style={{ background:"#FF5BA7" }}>📅</div><span>Événement</span>
                    </button>
                    <button className="wa-attach-icon" onClick={() => setAttachPage("ai")}>
                      <div className="wa-attach-circle" style={{ background:"#00BCD4" }}>🤖</div><span>Images d'IA</span>
                    </button>
                  </div>
                  <div style={{ height:20 }} />
                </>
              )}

              {/* SONDAGE */}
              {attachPage === "poll" && (
                <div style={{ padding:"16px 18px 24px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:18 }}>
                    <button onClick={() => setAttachPage("none")} style={{ background:"none", border:"none", cursor:"pointer", fontSize:22, color:"#555", padding:0 }}>‹</button>
                    <div style={{ fontWeight:800, fontSize:17 }}>Créer un sondage</div>
                  </div>
                  <input value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="Question…"
                    style={{ width:"100%", border:"none", borderBottom:"2px solid #25D366", padding:"8px 0", fontSize:16, outline:"none", marginBottom:16, boxSizing:"border-box" }} />
                  <div style={{ fontSize:11, color:"#999", fontWeight:600, marginBottom:10, textTransform:"uppercase" as const }}>Options</div>
                  {pollOptions.map((opt, idx) => (
                    <div key={idx} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                      <input value={opt} onChange={e => { const o=[...pollOptions]; o[idx]=e.target.value; setPollOptions(o); }} placeholder={`Option ${idx+1}`}
                        style={{ flex:1, border:"none", borderBottom:"1.5px solid #E4E6EB", padding:"8px 0", fontSize:15, outline:"none" }} />
                      {pollOptions.length > 2 && (
                        <button onClick={() => setPollOptions(o => o.filter((_,i) => i !== idx))} style={{ background:"none", border:"none", cursor:"pointer", color:"#E02020", fontSize:20, padding:0 }}>✕</button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setPollOptions(o => [...o, ""])} style={{ background:"none", border:"none", color:"#25D366", fontSize:15, fontWeight:700, cursor:"pointer", padding:"4px 0", marginBottom:16 }}>+ Ajouter une option</button>
                  <label style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24, cursor:"pointer" }}>
                    <input type="checkbox" checked={pollMultiple} onChange={e => setPollMultiple(e.target.checked)} style={{ width:18, height:18, accentColor:"#25D366" }} />
                    <span style={{ fontSize:14 }}>Autoriser plusieurs réponses</span>
                  </label>
                  <button
                    onClick={() => {
                      if (!pollQuestion.trim() || pollOptions.filter(o=>o.trim()).length < 2) return;
                      const text = `📊 ${pollQuestion}\n${pollOptions.filter(o=>o.trim()).map((o,i)=>`${i+1}. ${o}`).join("\n")}${pollMultiple?" (plusieurs réponses)":""}`;
                      setMessages(prev => {
                        const list = [...(prev[activeConv!] ?? [])];
                        list.push({ id:Date.now(), text, mine:true, time:new Date().toLocaleTimeString("fr",{hour:"2-digit",minute:"2-digit"}), status:"sent" });
                        return { ...prev, [activeConv!]: list };
                      });
                      setPollQuestion(""); setPollOptions(["",""]); setPollMultiple(true);
                      setAttachSheet(false); setAttachPage("none");
                    }}
                    disabled={!pollQuestion.trim() || pollOptions.filter(o=>o.trim()).length < 2}
                    style={{ width:"100%", background: pollQuestion.trim() && pollOptions.filter(o=>o.trim()).length>=2 ? "#25D366":"#E4E6EB", border:"none", borderRadius:30, padding:"15px", fontSize:16, fontWeight:800, color: pollQuestion.trim() && pollOptions.filter(o=>o.trim()).length>=2 ? "#fff":"#999", cursor:"pointer", transition:"all 0.2s" }}>
                    Envoyer le sondage
                  </button>
                </div>
              )}

              {/* ÉVÉNEMENT */}
              {attachPage === "event" && (
                <div style={{ padding:"16px 18px 24px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:18 }}>
                    <button onClick={() => setAttachPage("none")} style={{ background:"none", border:"none", cursor:"pointer", fontSize:22, color:"#555", padding:0 }}>‹</button>
                    <div style={{ fontWeight:800, fontSize:17 }}>Créer un événement</div>
                  </div>
                  <input value={eventName} onChange={e => setEventName(e.target.value)} placeholder="Nom de l'événement"
                    style={{ width:"100%", border:"none", borderBottom:"2px solid #25D366", padding:"8px 0", fontSize:18, fontWeight:700, outline:"none", marginBottom:16, boxSizing:"border-box" }} />
                  <textarea value={eventDesc} onChange={e => setEventDesc(e.target.value)} placeholder="Description (optionnel)"
                    style={{ width:"100%", border:"none", borderBottom:"1.5px solid #E4E6EB", padding:"8px 0", fontSize:14, outline:"none", resize:"none" as const, height:56, marginBottom:16, boxSizing:"border-box", fontFamily:"inherit" }} />
                  <div style={{ display:"flex", gap:12, marginBottom:20 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, color:"#999", fontWeight:600, marginBottom:4 }}>DATE</div>
                      <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)}
                        style={{ width:"100%", border:"none", borderBottom:"1.5px solid #E4E6EB", padding:"6px 0", fontSize:15, outline:"none", boxSizing:"border-box" }} />
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, color:"#999", fontWeight:600, marginBottom:4 }}>HEURE</div>
                      <input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)}
                        style={{ width:"100%", border:"none", borderBottom:"1.5px solid #E4E6EB", padding:"6px 0", fontSize:15, outline:"none", boxSizing:"border-box" }} />
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (!eventName.trim()) return;
                      const text = `📅 ${eventName}${eventDesc.trim()?`\n${eventDesc}`:""}\n🗓 ${eventDate} à ${eventTime}`;
                      setMessages(prev => {
                        const list = [...(prev[activeConv!] ?? [])];
                        list.push({ id:Date.now(), text, mine:true, time:new Date().toLocaleTimeString("fr",{hour:"2-digit",minute:"2-digit"}), status:"sent" });
                        return { ...prev, [activeConv!]: list };
                      });
                      setEventName(""); setEventDesc("");
                      setAttachSheet(false); setAttachPage("none");
                    }}
                    disabled={!eventName.trim()}
                    style={{ width:"100%", background: eventName.trim()?"#25D366":"#E4E6EB", border:"none", borderRadius:30, padding:"15px", fontSize:16, fontWeight:800, color: eventName.trim()?"#fff":"#999", cursor:"pointer", transition:"all 0.2s" }}>
                    Envoyer l'événement
                  </button>
                </div>
              )}

              {/* CONTACTS */}
              {attachPage === "contacts" && (
                <div style={{ padding:"16px 0 24px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8, padding:"0 18px" }}>
                    <button onClick={() => setAttachPage("none")} style={{ background:"none", border:"none", cursor:"pointer", fontSize:22, color:"#555", padding:0 }}>‹</button>
                    <div style={{ fontWeight:800, fontSize:17 }}>Partager un contact</div>
                  </div>
                  {allUsers.filter(u => u.id !== (JSON.parse(localStorage.getItem("fb_user")||"{}") as {id?:number}).id).slice(0,20).map(u => (
                    <button key={u.id} onClick={() => {
                      const fullName = `${u.firstName} ${u.lastName}`;
                      const text = `👤 Contact : ${fullName}`;
                      setMessages(prev => {
                        const list = [...(prev[activeConv!] ?? [])];
                        list.push({ id:Date.now(), text, mine:true, time:new Date().toLocaleTimeString("fr",{hour:"2-digit",minute:"2-digit"}), status:"sent" });
                        return { ...prev, [activeConv!]: list };
                      });
                      setAttachSheet(false); setAttachPage("none");
                    }} style={{ display:"flex", alignItems:"center", gap:12, width:"100%", background:"none", border:"none", padding:"12px 18px", cursor:"pointer", textAlign:"left" as const }}>
                      <div className="avatar" style={{ width:46, height:46, fontSize:16, flexShrink:0 }}>{`${u.firstName[0]}${u.lastName[0]}`.toUpperCase()}</div>
                      <div style={{ fontWeight:600, fontSize:15, color:"#111" }}>{u.firstName} {u.lastName}</div>
                    </button>
                  ))}
                </div>
              )}

              {/* IMAGES D'IA */}
              {attachPage === "ai" && (
                <div style={{ padding:"16px 18px 28px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:18 }}>
                    <button onClick={() => setAttachPage("none")} style={{ background:"none", border:"none", cursor:"pointer", fontSize:22, color:"#555", padding:0 }}>‹</button>
                    <div style={{ fontWeight:800, fontSize:17 }}>Générer une image IA</div>
                  </div>
                  <div style={{ background:"linear-gradient(135deg,#00BCD4,#7B5EA7)", borderRadius:14, padding:"16px", marginBottom:18, textAlign:"center" }}>
                    <div style={{ fontSize:36, marginBottom:8 }}>🤖✨</div>
                    <div style={{ color:"#fff", fontSize:13, lineHeight:1.5, fontWeight:500 }}>Décris l'image que tu veux générer et elle sera envoyée dans la conversation.</div>
                  </div>
                  <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                    placeholder="Ex : un lion majestueux au coucher du soleil sur la savane africaine…"
                    rows={4}
                    style={{ width:"100%", border:"1.5px solid #E4E6EB", borderRadius:12, padding:"12px 14px", fontSize:15, outline:"none", resize:"none" as const, boxSizing:"border-box" as const, fontFamily:"inherit", marginBottom:16 }} />
                  <button
                    disabled={!aiPrompt.trim() || aiLoading}
                    onClick={async () => {
                      if (!aiPrompt.trim() || aiLoading) return;
                      setAiLoading(true);
                      try {
                        const r = await fetch("/api/ai/image", {
                          method:"POST",
                          headers:{"Content-Type":"application/json","Authorization":`Bearer ${localStorage.getItem("bp_token")||""}`},
                          body:JSON.stringify({ prompt: aiPrompt.trim() })
                        });
                        if (!r.ok) throw new Error("Génération impossible");
                        const d = await r.json() as { url?: string };
                        if (d.url) {
                          sendAttachMsg({ type:"image", label:d.url, extra:aiPrompt.trim() }, "🤖 Image générée par IA");
                          setAiPrompt(""); setAttachSheet(false); setAttachPage("none");
                        }
                      } catch {
                        const text = `🤖 Image IA : "${aiPrompt.trim()}"`;
                        sendAttachMsg({ type:"image", label:`https://placehold.co/400x300/00BCD4/fff?text=${encodeURIComponent(aiPrompt.trim().slice(0,40))}`, extra:aiPrompt.trim() }, text);
                        setAiPrompt(""); setAttachSheet(false); setAttachPage("none");
                      }
                      setAiLoading(false);
                    }}
                    style={{ width:"100%", background: aiPrompt.trim()&&!aiLoading?"linear-gradient(135deg,#00BCD4,#7B5EA7)":"#E4E6EB", border:"none", borderRadius:30, padding:"15px", fontSize:16, fontWeight:800, color: aiPrompt.trim()&&!aiLoading?"#fff":"#999", cursor:"pointer", transition:"all 0.2s", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                    {aiLoading ? <><span style={{ animation:"fbl-rec-pulse 1s infinite", display:"inline-block" }}>⏳</span> Génération…</> : "✨ Générer et envoyer"}
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

        {/* Upload overlay */}
        {uploadingAttach && (
          <div style={{ position:"fixed", inset:0, zIndex:10003, background:"rgba(0,0,0,0.55)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14 }}>
            <div style={{ width:52, height:52, border:"4px solid rgba(255,255,255,0.3)", borderTop:"4px solid #25D366", borderRadius:"50%", animation:"fbl-sheet-up 0.8s linear infinite" }} />
            <div style={{ color:"#fff", fontWeight:700, fontSize:15 }}>Envoi en cours…</div>
          </div>
        )}
      </div>
    , document.body);
  }

  /* ══════════════════════════════════════════════════════════════
     INBOX — Premium 2026
  ══════════════════════════════════════════════════════════════ */
  const totalUnread = convList.reduce((s, c) => s + c.unread, 0) + chatGroups.reduce((s, g) => s + g.unread, 0);

  const visibleConvs = filteredConvs.filter(c =>
    inboxTab === "groups" ? false :
    inboxTab === "unread" ? c.unread > 0 : true
  );
  const visibleGroups = chatGroups.filter(g =>
    (inboxTab === "all" || inboxTab === "groups") &&
    (inboxTab === "unread" ? g.unread > 0 : true) &&
    (!search || g.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <>
    <style>{`
      .fbl-row{transition:background .1s}.fbl-row:active{background:#f2f3f5!important}
      @keyframes fbl-fab-in{from{opacity:0;transform:scale(.7) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
      .fbl-toggle{width:51px;height:31px;border-radius:16px;border:none;cursor:pointer;position:relative;transition:background .2s;flex-shrink:0}
      .fbl-toggle::after{content:'';position:absolute;top:3px;width:25px;height:25px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.3);transition:left .2s}
      .fbl-toggle-on{background:#1877F2}.fbl-toggle-on::after{left:23px}
      .fbl-toggle-off{background:#ccc}.fbl-toggle-off::after{left:3px}
      .fbl-settings-row{display:flex;align-items:center;padding:14px 16px;gap:14px;border-bottom:1px solid #f0f0f0;cursor:pointer;background:#fff}
      .fbl-settings-row:active{background:#f5f5f5}
    `}</style>

    <div style={{ position: "fixed", top: 0, bottom: 0, left: 0, right: 0, display: "flex", flexDirection: "column", background: "#fff", zIndex: 1, overflow: "hidden" }}>

      {/* ── PREMIUM HEADER ── */}
      <div style={{ background: "#fff", flexShrink: 0, paddingTop: "env(safe-area-inset-top, 0px)" }}>
        {/* Row 1 — Logo + title + actions */}
        <div style={{ display: "flex", alignItems: "center", padding: "12px 16px 8px", gap: 10 }}>
          {/* BP Logo */}
          <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "#16C24A", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>
            </div>
            <span style={{ color: "#16C24A", fontWeight: 900, fontSize: 17, fontFamily: "Georgia, serif", fontStyle: "italic", letterSpacing: -0.5 }}>brutepawa</span>
          </button>
          <span style={{ fontWeight: 800, fontSize: 20, color: "#0F172A", letterSpacing: -0.4, flex: 1 }}>Messages</span>
          {totalUnread > 0 && (
            <div style={{ background: "#16C24A", color: "#fff", borderRadius: 99, minWidth: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, padding: "0 6px" }}>
              {totalUnread > 99 ? "99+" : totalUnread}
            </div>
          )}
          <button onClick={() => setShowInboxSearch(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#0F172A" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
          </button>
          <button onClick={() => setSettingsPage("main")} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#0F172A" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#16C24A,#0ea541)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", flexShrink: 0, boxShadow: "0 2px 8px rgba(22,194,74,0.3)", cursor: "pointer" }}
            onClick={() => navigate("/")}>
            {(() => { try { const n = (JSON.parse(localStorage.getItem("fb_user") ?? "{}") as { name?: string }).name ?? ""; return n.split(" ").map((w:string) => w[0]).join("").slice(0,2).toUpperCase() || "BP"; } catch { return "BP"; } })()}
          </div>
        </div>
        {/* Row 2 — Search bar */}
        {!showInboxSearch ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 16px 12px" }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, background: "#F1F5F9", borderRadius: 14, padding: "10px 14px" }}>
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#94A3B8" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher des personnes, groupes, canaux..." style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 14, color: "#0F172A" }} />
              {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 0, lineHeight: 1 }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>}
            </div>
            <button style={{ width: 44, height: 44, borderRadius: 14, background: "#F1F5F9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#475569" strokeWidth="2.2" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="12" y1="18" x2="20" y2="18"/></svg>
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", padding: "0 12px 12px", gap: 8 }}>
            <button onClick={() => { setShowInboxSearch(false); setSearch(""); }} style={{ background: "none", border: "none", cursor: "pointer", padding: "6px 4px", display: "flex", alignItems: "center" }}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#0F172A" strokeWidth="2.2" strokeLinecap="round"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            </button>
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher des personnes, groupes, canaux…" style={{ flex: 1, background: "#F1F5F9", border: "none", borderRadius: 14, padding: "10px 14px", fontSize: 14, outline: "none", color: "#0F172A" }} />
            {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", padding: "0 2px" }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>}
          </div>
        )}
        <div style={{ height: 1, background: "#F1F5F9" }} />
      </div>

      {/* ── BODY ── */}
      <div style={{ flex: 1, overflowY: "auto", background: "#fff" }}>

        {/* Story / contacts bar */}
        {!search && convList.length > 0 && (
          <div style={{ background: "#fff", borderBottom: "1px solid #e5e5e5" }}>
            <div style={{ display: "flex", overflowX: "auto", scrollbarWidth: "none", padding: "10px 8px 12px", gap: 0 }}>
              {/* "Votre note" */}
              <div style={{ flexShrink: 0, textAlign: "center", width: 72, padding: "0 4px" }}>
                <div style={{ position: "relative", marginBottom: 5 }}>
                  <div className="avatar" style={{ width: 56, height: 56, fontSize: 19, margin: "0 auto", background: "#E4E6EB", color: "#65676B", border: "3px solid #fff" }}>
                    {(() => { try { return (JSON.parse(localStorage.getItem("fb_user") ?? "{}") as { name?: string }).name?.slice(0,2).toUpperCase() ?? "??"; } catch { return "??"; } })()}
                  </div>
                  <div style={{ position: "absolute", bottom: 0, right: 6, width: 20, height: 20, background: "#1877F2", borderRadius: "50%", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 900, lineHeight: 1 }}>+</div>
                </div>
                <div style={{ fontSize: 11, color: "#444", fontWeight: 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Votre note</div>
              </div>
              {convList.slice(0, 8).map(conv => (
                <div key={conv.id} onClick={() => setActiveConv(conv.id)} style={{ flexShrink: 0, textAlign: "center", width: 72, padding: "0 4px", cursor: "pointer" }}>
                  <div style={{ position: "relative", marginBottom: 5 }}>
                    <div className="avatar" style={{ width: 56, height: 56, fontSize: 19, margin: "0 auto", background: conv.user.color, border: "3px solid #fff" }}>{conv.user.initials}</div>
                    <div style={{ position: "absolute", bottom: 0, right: 6, width: 14, height: 14, background: "#42B72A", borderRadius: "50%", border: "2.5px solid #fff" }} />
                  </div>
                  <div style={{ fontSize: 11, color: "#444", fontWeight: 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {conv.user.name.split(" ")[0]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All conversations + groups merged */}
        {[
          ...visibleConvs.map(c => ({ type: "conv" as const, id: c.id, key: `c${c.id}`, name: c.user.name, preview: c.lastMessage || "Démarrer une conversation", time: c.time, unread: c.unread, color: c.user.color, initials: c.user.initials, online: true, grp: null })),
          ...visibleGroups.map(g => {
            const isChan = g.type === "channel";
            const ts = g.lastMessageAt ? new Date(g.lastMessageAt).toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" }) : "";
            return { type: "group" as const, id: g.id, key: `g${g.id}`, name: g.name, preview: g.lastMessage || `${g.membersCount} membre${g.membersCount !== 1 ? "s" : ""}`, time: ts, unread: g.unread, color: isChan ? "#00838F" : "#1877F2", initials: isChan ? "📢" : "👥", online: false, grp: g };
          }),
        ].map(item => (
          <div key={item.key} className="fbl-row"
            onClick={() => item.type === "conv" ? setActiveConv(item.id) : setActiveGroupId(item.id)}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", background: "#fff" }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div className="avatar" style={{ width: 56, height: 56, fontSize: item.type === "group" ? 24 : 20, background: item.color }}>{item.initials}</div>
              {item.online && <div style={{ position: "absolute", bottom: 1, right: 1, width: 14, height: 14, background: "#42B72A", borderRadius: "50%", border: "2.5px solid #fff" }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                <span style={{ fontWeight: item.unread > 0 ? 700 : 400, fontSize: 15, color: "#050505", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "72%" }}>{item.name}</span>
                <span style={{ fontSize: 12, color: item.unread > 0 ? "#050505" : "#888", fontWeight: item.unread > 0 ? 600 : 400, flexShrink: 0 }}>{item.time}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ flex: 1, fontSize: 13, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: item.unread > 0 ? 600 : 400 }}>{item.preview}</span>
                {item.unread > 0 && <div style={{ width: 10, height: 10, background: "#1877F2", borderRadius: "50%", flexShrink: 0 }} />}
              </div>
            </div>
          </div>
        ))}

        {/* ── Loading skeleton ── */}
        {convLoading && convList.length === 0 && (
          <div style={{ padding:"0 16px" }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 0", borderBottom:"1px solid #F1F5F9" }}>
                <div style={{ width:52, height:52, borderRadius:"50%", background:"#E2E8F0", flexShrink:0, animation:"fbl-pulse 1.4s ease-in-out infinite" }} />
                <div style={{ flex:1 }}>
                  <div style={{ height:14, width:"55%", background:"#E2E8F0", borderRadius:7, marginBottom:8, animation:"fbl-pulse 1.4s ease-in-out infinite" }} />
                  <div style={{ height:12, width:"80%", background:"#F1F5F9", borderRadius:6, animation:"fbl-pulse 1.4s ease-in-out infinite" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Premium Empty State ── */}
        {false && !convLoading && !search && convList.length === 0 && chatGroups.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0 24px" }}>

            {/* Illustration SVG */}
            <div style={{ width: "100%", maxWidth: 380, padding: "0 12px" }}>
              <svg viewBox="0 0 380 280" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "auto" }}>
                {/* Background circle */}
                <circle cx="190" cy="150" r="120" fill="#DCFCE7" opacity="0.6"/>
                <circle cx="190" cy="150" r="90" fill="#DCFCE7" opacity="0.4"/>

                {/* ── Person 1 — left, standing, hoodie ── */}
                {/* Body */}
                <rect x="60" y="130" width="44" height="60" rx="10" fill="#16C24A"/>
                {/* Head */}
                <circle cx="82" cy="118" r="18" fill="#8B5E3C"/>
                {/* Hair */}
                <ellipse cx="82" cy="103" rx="18" ry="8" fill="#2D1A0E"/>
                {/* Eyes */}
                <circle cx="76" cy="117" r="2.5" fill="#fff"/>
                <circle cx="88" cy="117" r="2.5" fill="#fff"/>
                <circle cx="77" cy="117" r="1.2" fill="#1A0A00"/>
                <circle cx="89" cy="117" r="1.2" fill="#1A0A00"/>
                {/* Legs */}
                <rect x="64" y="185" width="14" height="42" rx="7" fill="#1E293B"/>
                <rect x="82" y="185" width="14" height="42" rx="7" fill="#1E293B"/>
                {/* Shoes */}
                <ellipse cx="71" cy="228" rx="10" ry="5" fill="#0F172A"/>
                <ellipse cx="89" cy="228" rx="10" ry="5" fill="#0F172A"/>
                {/* Phone in hand */}
                <rect x="95" y="148" width="18" height="28" rx="4" fill="#0F172A"/>
                <rect x="97" y="151" width="14" height="20" rx="2" fill="#38BDF8"/>
                {/* Arm */}
                <path d="M104 148 Q100 138 95 148" stroke="#8B5E3C" strokeWidth="6" strokeLinecap="round" fill="none"/>
                {/* Bag strap */}
                <path d="M60 135 Q48 155 55 175" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" fill="none"/>

                {/* ── Person 2 — center, sitting on big chat bubble ── */}
                {/* Big green chat bubble as seat */}
                <rect x="140" y="190" width="100" height="60" rx="20" fill="#16C24A"/>
                <path d="M165 248 L155 265 L180 248" fill="#16C24A"/>
                {/* 3 dots inside bubble */}
                <circle cx="173" cy="220" r="5" fill="#fff"/>
                <circle cx="190" cy="220" r="5" fill="#fff"/>
                <circle cx="207" cy="220" r="5" fill="#fff"/>
                {/* Body sitting */}
                <rect x="163" y="155" width="44" height="40" rx="10" fill="#fff"/>
                {/* Legs dangling */}
                <rect x="167" y="190" width="13" height="30" rx="6" fill="#1E293B"/>
                <rect x="183" y="190" width="13" height="30" rx="6" fill="#1E293B"/>
                <ellipse cx="174" cy="221" rx="9" ry="5" fill="white"/>
                <ellipse cx="190" cy="221" rx="9" ry="5" fill="white"/>
                {/* Head */}
                <circle cx="185" cy="140" r="20" fill="#5C3A1E"/>
                {/* Bun hair */}
                <ellipse cx="185" cy="122" rx="12" ry="9" fill="#2D1A0E"/>
                <circle cx="185" cy="117" r="7" fill="#2D1A0E"/>
                {/* Eyes */}
                <circle cx="179" cy="139" r="2.5" fill="#fff"/>
                <circle cx="191" cy="139" r="2.5" fill="#fff"/>
                <circle cx="180" cy="139" r="1.2" fill="#1A0A00"/>
                <circle cx="192" cy="139" r="1.2" fill="#1A0A00"/>
                {/* Phone */}
                <rect x="195" y="158" width="18" height="28" rx="4" fill="#0F172A"/>
                <rect x="197" y="161" width="14" height="20" rx="2" fill="#A78BFA"/>
                {/* Arm to phone */}
                <path d="M207 158 Q206 150 200 158" stroke="#5C3A1E" strokeWidth="6" strokeLinecap="round" fill="none"/>

                {/* ── Person 3 — right, sitting cross-legged ── */}
                {/* Body */}
                <rect x="262" y="155" width="44" height="48" rx="10" fill="#16C24A" opacity="0.9"/>
                {/* Crossed legs */}
                <path d="M262 198 Q255 215 268 222 Q280 230 280 215" stroke="#1E293B" strokeWidth="12" strokeLinecap="round" fill="none"/>
                <path d="M306 198 Q313 215 300 222 Q288 230 288 215" stroke="#1E293B" strokeWidth="12" strokeLinecap="round" fill="none"/>
                {/* Head */}
                <circle cx="284" cy="142" r="18" fill="#3D2009"/>
                {/* Short hair */}
                <ellipse cx="284" cy="126" rx="18" ry="7" fill="#1A0A00"/>
                {/* Eyes */}
                <circle cx="278" cy="141" r="2.5" fill="#fff"/>
                <circle cx="290" cy="141" r="2.5" fill="#fff"/>
                <circle cx="279" cy="141" r="1.2" fill="#1A0A00"/>
                <circle cx="291" cy="141" r="1.2" fill="#1A0A00"/>
                {/* Phone in lap */}
                <rect x="272" y="175" width="24" height="16" rx="4" fill="#0F172A"/>
                <rect x="274" y="177" width="20" height="12" rx="2" fill="#FDE68A"/>
                {/* Arm down */}
                <path d="M275 168 Q272 174 277 175" stroke="#3D2009" strokeWidth="6" strokeLinecap="round" fill="none"/>

                {/* ── Floating chat bubbles ── */}
                {/* Top left white bubble */}
                <rect x="18" y="80" width="72" height="36" rx="14" fill="#fff" style={{filter:"drop-shadow(0 2px 8px rgba(0,0,0,0.12))"}}/>
                <path d="M30 115 L22 126 L42 115" fill="#fff"/>
                <circle cx="36" cy="98" r="4" fill="#CBD5E1"/>
                <circle cx="50" cy="98" r="4" fill="#CBD5E1"/>
                <circle cx="64" cy="98" r="4" fill="#CBD5E1"/>
                {/* Top right green bubble */}
                <rect x="288" y="60" width="72" height="36" rx="14" fill="#16C24A"/>
                <path d="M348 95 L360 106 L340 95" fill="#16C24A"/>
                <rect x="296" y="73" width="20" height="5" rx="2.5" fill="#fff" opacity="0.8"/>
                <rect x="296" y="82" width="50" height="5" rx="2.5" fill="#fff" opacity="0.6"/>
                {/* Small bubble top center */}
                <rect x="145" y="40" width="54" height="30" rx="12" fill="#16C24A" opacity="0.8"/>
                <path d="M155 69 L148 78 L165 69" fill="#16C24A" opacity="0.8"/>
                <circle cx="159" cy="55" r="3.5" fill="#fff"/>
                <circle cx="172" cy="55" r="3.5" fill="#fff"/>
                <circle cx="185" cy="55" r="3.5" fill="#fff"/>
                {/* Person icon top right area */}
                <rect x="308" y="110" width="32" height="32" rx="16" fill="#fff" opacity="0.9" style={{filter:"drop-shadow(0 1px 4px rgba(0,0,0,0.1))"}}/>
                <circle cx="324" cy="120" r="5" fill="#94A3B8"/>
                <path d="M316 134c0-4.4 3.6-8 8-8s8 3.6 8 8" fill="#94A3B8"/>
                {/* Video icon left */}
                <rect x="22" y="155" width="32" height="32" rx="16" fill="#fff" opacity="0.9" style={{filter:"drop-shadow(0 1px 4px rgba(0,0,0,0.1))"}}/>
                <rect x="29" y="163" width="14" height="10" rx="2" fill="#94A3B8"/>
                <path d="M43 165 l6 3 -6 3 z" fill="#94A3B8"/>
              </svg>
            </div>

            {/* Text + button — centered */}
            <div style={{ padding: "0 24px 24px", width: "100%", boxSizing: "border-box", textAlign: "center" }}>
              <div style={{ fontWeight: 800, fontSize: 22, color: "#0F172A", marginBottom: 10, lineHeight: 1.2 }}>Aucune discussion</div>
              <div style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6, marginBottom: 24 }}>Commencez une conversation avec vos amis ou rejoignez des groupes et canaux.</div>
              <button
                onClick={() => setFabOpen(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#16C24A", color: "#fff", border: "none", borderRadius: 99, padding: "14px 28px", fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: "0 4px 18px rgba(22,194,74,0.45)" }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Nouvelle discussion
              </button>
            </div>

          </div>
        )}
        {search && visibleConvs.length === 0 && visibleGroups.length === 0 && (
          <div style={{ padding: "56px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>🔍</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#333", marginBottom: 6 }}>Aucun résultat</div>
            <div style={{ fontSize: 13, color: "#888" }}>Aucune discussion pour «{search}»</div>
          </div>
        )}
      </div>

      {/* ── FAB — always visible ── */}
      <div style={{ position: "absolute", bottom: 80, right: 16, zIndex: 50 }}>
        {fabOpen && (
          <>
            <div onClick={() => setFabOpen(false)} style={{ position: "fixed", inset: 0, zIndex: -1, background: "rgba(0,0,0,0.18)" }} />
            <div style={{ position: "absolute", bottom: 68, right: 0, display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
              {([
                { label: "Nouvelle discussion", iconBg: "#16C24A", svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, action: () => setFabOpen(false) },
                { label: "Nouveau groupe", iconBg: "#3B82F6", svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, action: () => { setGroupWizardType("group"); setGroupWizard("members"); setWizardSearch(""); setWizardMembers(new Set()); setFabOpen(false); } },
                { label: "Créer un canal", iconBg: "#8B5CF6", svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>, action: () => { setGroupWizardType("channel"); setGroupWizard("members"); setWizardSearch(""); setWizardMembers(new Set()); setFabOpen(false); } },
                { label: "Diffuser une annonce", iconBg: "#F59E0B", svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 0h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 7.91a16 16 0 0 0 6.1 6.1l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>, action: () => setFabOpen(false) },
                { label: "Inviter des amis", iconBg: "#7C3AED", svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>, action: () => setFabOpen(false) },
                { label: "Fermer", iconBg: "#16C24A", svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>, action: () => setFabOpen(false) },
              ] as {label:string;iconBg:string;svg:React.ReactNode;action:()=>void}[]).map((item, i) => (
                <div key={i} onClick={item.action} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", animation: `fbl-fab-in .18s ease ${i*.055}s both` }}>
                  <div style={{ background: "#fff", borderRadius: 99, padding: "9px 18px", boxShadow: "0 2px 14px rgba(0,0,0,.14)", fontSize: 14, fontWeight: 600, color: "#0F172A", whiteSpace: "nowrap" }}>{item.label}</div>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: item.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 4px 16px ${item.iconBg}55` }}>{item.svg}</div>
                </div>
              ))}
            </div>
          </>
        )}
        <button onClick={() => setFabOpen(!fabOpen)} style={{ width: 58, height: 58, borderRadius: "50%", background: "#16C24A", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(22,194,74,.55)", transition: "transform .2s", transform: fabOpen ? "rotate(45deg)" : "rotate(0deg)" }}>
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        </button>
      </div>
    </div>

    {/* ── SETTINGS OVERLAY (portaled) ── */}
    {settingsPage !== "none" && createPortal(
      <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "#fff", display: "flex", flexDirection: "column" }}>
        {/* Settings: main list */}
        {settingsPage === "main" && <>
          <div style={{ display: "flex", alignItems: "center", padding: "10px 8px", borderBottom: "1px solid #e5e5e5", gap: 4 }}>
            <button onClick={() => setSettingsPage("none")} style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 10px" }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="#050505"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            </button>
            <span style={{ flex: 1, fontWeight: 600, fontSize: 18, color: "#050505" }}>Paramètres de messagerie</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {[
              { icon: <svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="10" fill="none" stroke="#050505" strokeWidth="2"/><circle cx="12" cy="8" r="3" fill="#050505"/><path d="M6 20c0-3.31 2.69-6 6-6s6 2.69 6 6" fill="#050505"/></svg>, label: "Statut En ligne", right: onlineStatus ? "Oui" : "Non", page: "status" },
              { icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="#050505"><path d="M18 8a6 6 0 0 0-12 0c0 4-2 5-2 5h16s-2-1-2-5"/><path d="M13.73 21a2 2 0 0 1-3.46 0" fill="none" stroke="#050505" strokeWidth="2"/></svg>, label: "Notifications de messages", right: null, page: "notifs" },
              { icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="#050505"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>, label: "Invitations", right: null, page: "invitations" },
              { icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="#050505"><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27z"/></svg>, label: "Archive", right: null, page: "archive" },
              { icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="#050505"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>, label: "Confidentialité et sécurité", right: null, page: "privacy" },
            ].map(item => (
              <div key={item.label} className="fbl-settings-row" onClick={() => setSettingsPage(item.page as typeof settingsPage)}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#f0f2f5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{item.icon}</div>
                <span style={{ flex: 1, fontSize: 15, color: "#050505" }}>{item.label}</span>
                {item.right ? <span style={{ fontSize: 14, color: "#888" }}>{item.right}</span> : <svg viewBox="0 0 24 24" width="18" height="18" fill="#888"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>}
              </div>
            ))}
          </div>
        </>}

        {/* Settings: Statut En ligne */}
        {settingsPage === "status" && <>
          <div style={{ display: "flex", alignItems: "center", padding: "10px 8px", borderBottom: "1px solid #e5e5e5", gap: 4 }}>
            <button onClick={() => setSettingsPage("main")} style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 10px" }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="#050505"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            </button>
            <span style={{ flex: 1, fontWeight: 600, fontSize: 18, color: "#050505" }}>Statut En ligne</span>
          </div>
          <div style={{ padding: "16px 0" }}>
            <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #f0f0f0" }}>
              <span style={{ flex: 1, fontSize: 15, color: "#050505" }}>Indiquer si vous êtes en ligne</span>
              <button onClick={() => setOnlineStatus(p => !p)} className={`fbl-toggle ${onlineStatus ? "fbl-toggle-on" : "fbl-toggle-off"}`} />
            </div>
            <div style={{ padding: "16px 16px 0", fontSize: 13, color: "#65676B", lineHeight: 1.6 }}>
              Lorsque ce paramètre est activé, votre statut En ligne est visible par les personnes avec qui vous êtes en contact sur Facebook et Messenger, et par celles auxquelles vous avez envoyé une invitation. Vous ne pouvez voir le statut En ligne des autres que si le vôtre est activé.
              <br/><br/>
              Pour ne plus afficher votre statut En ligne, désactivez-le partout où vous utilisez Facebook et Messenger. <span style={{ color: "#1877F2", fontWeight: 600 }}>En savoir plus</span>
            </div>
          </div>
        </>}

        {/* Settings: Notifications */}
        {settingsPage === "notifs" && <>
          <div style={{ display: "flex", alignItems: "center", padding: "10px 8px", borderBottom: "1px solid #e5e5e5", gap: 4 }}>
            <button onClick={() => setSettingsPage("main")} style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 10px" }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="#050505"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            </button>
            <span style={{ flex: 1, fontWeight: 600, fontSize: 18, color: "#050505" }}>Notifications de messages</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            <div style={{ padding: "16px 16px 8px", fontWeight: 700, fontSize: 16, color: "#050505" }}>Messages</div>
            <div style={{ padding: "0 16px 12px", fontSize: 13, color: "#65676B" }}>Recevez des notifications push en temps réel lorsque vous recevez de nouveaux messages.</div>
            <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid #f0f0f0", borderTop: "1px solid #f0f0f0" }}>
              <span style={{ flex: 1, fontSize: 15, color: "#050505" }}>Messages des discussions</span>
              <button onClick={() => setNotifMsgs(p => !p)} className={`fbl-toggle ${notifMsgs ? "fbl-toggle-on" : "fbl-toggle-off"}`} />
            </div>
            <div style={{ padding: "16px 16px 8px", fontWeight: 700, fontSize: 16, color: "#050505" }}>Rappels de messages</div>
            <div style={{ padding: "0 16px 12px", fontSize: 13, color: "#65676B" }}>Recevez des rappels occasionnels concernant des messages non lus dans des discussions récentes.</div>
            <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid #f0f0f0", borderTop: "1px solid #f0f0f0" }}>
              <span style={{ flex: 1, fontSize: 15, color: "#050505" }}>Rappels de messages</span>
              <button onClick={() => setNotifReminders(p => !p)} className={`fbl-toggle ${notifReminders ? "fbl-toggle-on" : "fbl-toggle-off"}`} />
            </div>
            <div style={{ padding: "16px 16px 8px", fontWeight: 700, fontSize: 16, color: "#050505" }}>Aperçu des messages</div>
            <div style={{ padding: "0 16px 12px", fontSize: 13, color: "#65676B" }}>Afficher les messages sur les notifications.</div>
            <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid #f0f0f0", borderTop: "1px solid #f0f0f0" }}>
              <span style={{ flex: 1, fontSize: 15, color: "#050505" }}>Aperçu des messages</span>
              <button onClick={() => setNotifPreview(p => !p)} className={`fbl-toggle ${notifPreview ? "fbl-toggle-on" : "fbl-toggle-off"}`} />
            </div>
            <div style={{ padding: "16px 16px 8px", fontWeight: 700, fontSize: 16, color: "#050505" }}>Notifications en mode déconnecté</div>
            <div style={{ padding: "0 16px 12px", fontSize: 13, color: "#65676B" }}>Continuez de recevoir les rappels de messages lorsqu'un autre compte est connecté.</div>
            <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid #f0f0f0", borderTop: "1px solid #f0f0f0" }}>
              <span style={{ flex: 1, fontSize: 15, color: "#050505" }}>Notifications en mode déconnecté</span>
              <button onClick={() => setNotifOffline(p => !p)} className={`fbl-toggle ${notifOffline ? "fbl-toggle-on" : "fbl-toggle-off"}`} />
            </div>
          </div>
        </>}

        {/* Settings: Invitations */}
        {settingsPage === "invitations" && <>
          <div style={{ display: "flex", alignItems: "center", padding: "10px 8px", borderBottom: "1px solid #e5e5e5", gap: 4 }}>
            <button onClick={() => setSettingsPage("main")} style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 10px" }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="#050505"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            </button>
            <span style={{ flex: 1, fontWeight: 600, fontSize: 18, color: "#050505" }}>Invitations par message</span>
          </div>
          <div style={{ display: "flex", borderBottom: "1px solid #e5e5e5", padding: "0 16px" }}>
            {(["known","spam"] as const).map(t => (
              <button key={t} onClick={() => setInvitTab(t)}
                style={{ flex: 1, background: "none", border: "none", cursor: "pointer", padding: "14px 4px", fontSize: 14, fontWeight: invitTab === t ? 700 : 400, color: invitTab === t ? "#1877F2" : "#65676B", borderBottom: `2px solid ${invitTab === t ? "#1877F2" : "transparent"}` }}>
                {t === "known" ? "Vous connaissez peut-être" : "Spam"}
              </button>
            ))}
          </div>
          <div style={{ padding: "12px 16px", fontSize: 13, color: "#65676B", lineHeight: 1.5 }}>
            Ouvrez une invitation pour en savoir plus sur la personne qui vous envoie le message. Elle n'en saura rien tant que vous ne l'aurez pas acceptée. <span style={{ color: "#1877F2", fontWeight: 600 }}>Décidez qui peut vous envoyer un message</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {convList.slice(0, 5).map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: "1px solid #f0f0f0" }}>
                <div className="avatar" style={{ width: 46, height: 46, fontSize: 17, background: c.user.color, flexShrink: 0 }}>{c.user.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: "#050505" }}>{c.user.name}</div>
                  <div style={{ fontSize: 13, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.lastMessage || "Aucun message"}</div>
                </div>
              </div>
            ))}
            {convList.length === 0 && <div style={{ padding: "40px", textAlign: "center", color: "#888", fontSize: 14 }}>Aucune invitation</div>}
          </div>
        </>}

        {/* Settings: Archive */}
        {settingsPage === "archive" && <>
          <div style={{ display: "flex", alignItems: "center", padding: "10px 8px", borderBottom: "1px solid #e5e5e5", gap: 4 }}>
            <button onClick={() => setSettingsPage("main")} style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 10px" }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="#050505"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            </button>
            <span style={{ flex: 1, fontWeight: 600, fontSize: 18, color: "#050505" }}>Archiver</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {convList.slice(0, 5).map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: "1px solid #f0f0f0" }}>
                <div className="avatar" style={{ width: 50, height: 50, fontSize: 18, background: c.user.color, flexShrink: 0 }}>{c.user.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 15, color: "#050505" }}>{c.user.name}</div>
                  <div style={{ fontSize: 13, color: "#888" }}>Les messages et les appels sont sécurisés...</div>
                </div>
              </div>
            ))}
            {convList.length === 0 && <div style={{ padding: "40px", textAlign: "center", color: "#888", fontSize: 14 }}>Aucune discussion archivée</div>}
          </div>
        </>}

        {/* Settings: Confidentialité */}
        {settingsPage === "privacy" && <>
          <div style={{ display: "flex", alignItems: "center", padding: "10px 8px", borderBottom: "1px solid #e5e5e5", gap: 4 }}>
            <button onClick={() => setSettingsPage("main")} style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 10px" }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="#050505"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            </button>
            <span style={{ flex: 1, fontWeight: 600, fontSize: 18, color: "#050505" }}>Confidentialité et sécurité</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {[
              { section: "Qui peut vous contacter", items: [
                { label: "Diffusion des messages", sub: "Choisissez qui peut vous envoyer un message" },
                { label: "Comptes bloqués", sub: "Empêchez quelqu'un de vous contacter" },
                { label: "Contacts masqués", sub: "Masquez des personnes dans vos suggestions de contacts" },
              ]},
              { section: "Ce que voient les personnes", items: [
                { label: "Confirmations de lecture", sub: "Indiquez aux personnes que vous avez lu leurs messages" },
              ]},
              { section: "Discussions chiffrées de bout en bout", items: [
                { label: "Alertes de sécurité", sub: "Consultez et gérez les alertes pour les connexions et les modifications de clé" },
                { label: "Stockage des messages", sub: "Gérez l'accès à votre historique des discussions et son stockage" },
                { label: "Aperçus", sub: "Affichez les aperçus du contenu partagé depuis les applications Meta" },
                { label: "Vérifier les clés dans la discussion", sub: "Appuyez longuement pour voir les clés" },
              ]},
            ].map(group => (
              <div key={group.section}>
                <div style={{ padding: "12px 16px 6px", fontWeight: 700, fontSize: 14, color: "#050505" }}>{group.section}</div>
                {group.items.map(item => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #f0f0f0", gap: 12, cursor: "pointer" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, color: "#050505", marginBottom: 2 }}>{item.label}</div>
                      <div style={{ fontSize: 13, color: "#888" }}>{item.sub}</div>
                    </div>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="#bbb"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>}
      </div>
    , document.body)}
    </>
  );
}
