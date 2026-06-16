import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "../router";
import { apiGetConversations, apiGetMessages, apiSendMessage, apiGetUsers, apiGetUserPresence, apiGetChatGroups, apiCreateChatGroup, apiGetChatGroupInfo, apiGetChatGroupMessages, apiSendChatGroupMessage, apiLeaveChatGroup, apiSendTyping, apiGetTyping, apiUploadFile, type PublicUser, type ApiChatGroup, type ApiChatGroupInfo } from "../lib/api";
import { useCallSignaling, type NewMessagePayload } from "../hooks/useCallSignaling";

void ({} as ApiChatGroup);

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

type Overlay = "none" | "info" | "attach";

export default function Messages({ initialUserId, initialGroupId }: { initialUserId?: number; initialGroupId?: number }) {
  const navigate = useNavigate();
  const meId = (() => { try { return (JSON.parse(localStorage.getItem("fb_user") ?? "{}") as { id?: number }).id ?? 0; } catch { return 0; } })();

  const [activeConv, setActiveConv]   = useState<number | null>(initialUserId ?? null);
  const [messages, setMessages]       = useState<Record<number, Message[]>>({});
  const [convList, setConvList]       = useState<NormConv[]>([]);
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
  const [settingsPage, setSettingsPage] = useState<"none"|"status"|"notifs"|"invitations"|"archive"|"privacy">("none");
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
  const [showChatSearch, setShowChatSearch]   = useState(false);
  const [chatSearchQ, setChatSearchQ]         = useState("");
  const [chatSearchIdx, setChatSearchIdx]     = useState(0);
  const [longPressMsg, setLongPressMsg]       = useState<number | null>(null);
  const [showMicTip, setShowMicTip]           = useState(false);

  const [isRecording, setIsRecording]   = useState(false);
  const [recSeconds, setRecSeconds]     = useState(0);
  const [vpHeight, setVpHeight]         = useState<number | null>(null);
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
  const localVideoRef     = useRef<HTMLVideoElement>(null);
  const remoteVideoRef    = useRef<HTMLVideoElement>(null);
  const activeConvRef     = useRef<number | null>(null);
  const allUsersRef       = useRef<PublicUser[]>([]);
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const audioChunksRef    = useRef<Blob[]>([]);
  const recTimerRef       = useRef<ReturnType<typeof setInterval> | null>(null);

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
      // auto-scroll to last message when keyboard pushes content up
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "instant" as ScrollBehavior }), 50);
    };
    handler();
    vv.addEventListener("resize", handler);
    return () => vv.removeEventListener("resize", handler);
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
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url  = URL.createObjectURL(blob);
        const secs = recSeconds;
        stream.getTracks().forEach(t => t.stop());
        if (secs < 1) return;
        const now  = new Date().toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" });
        const mins = Math.floor(secs / 60);
        const s    = secs % 60;
        const dur  = `${mins}:${s.toString().padStart(2, "0")}`;
        setMessages(prev => ({
          ...prev,
          [activeConv!]: [...(prev[activeConv!] ?? []), {
            id: Date.now(), text: "", mine: true, time: now, status: "sent",
            attachment: { type: "audio", label: url, extra: dur } as { type: "audio"; label: string; extra?: string },
          }],
        }));
      };
      mr.start(100);
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch {
      alert("Accès au microphone refusé.");
    }
  };

  const stopVoice = () => {
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
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
    if (sig.remoteStream && sig.callType === "audio") {
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
        const normalized: NormConv[] = convs.map(c => {
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
      }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeConv || messages[activeConv]) return;
    apiGetMessages(activeConv).then(msgs => {
      setMessages(prev => ({
        ...prev,
        [activeConv]: msgs.map(m => ({
          id: m.id, text: m.content, mine: m.fromUserId === meId,
          time: new Date(m.createdAt).toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" }),
          status: m.isRead ? "read" as const : "sent" as const,
        })),
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
          const next = msgs.map(m => ({
            id: m.id, text: m.content, mine: m.fromUserId === meId,
            time: new Date(m.createdAt).toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" }),
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

  const startLongPress = (msgId: number) => {
    longPressTimer.current = setTimeout(() => { setLongPressMsg(msgId); }, 500);
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

            {/* Remote video — full screen */}
            <video ref={remoteVideoRef} autoPlay playsInline style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", background:"linear-gradient(180deg,#071d0c,#020b05)" }} />

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
                      label:"Basculer\ncaméra",
                      icon:<svg viewBox="0 0 24 24" width="24" height="24" fill="rgba(255,255,255,.9)"><path d="M20 5h-3.17L15 3H9L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-8 13c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>,
                      action:() => sig.flipCamera(), active:false,
                    },
                    {
                      label:"Désactiver\nvidéo",
                      icon:<svg viewBox="0 0 24 24" width="24" height="24" fill="rgba(255,255,255,.9)"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>,
                      action:() => {}, active:false,
                    },
                    {
                      label:"Muet",
                      icon:<svg viewBox="0 0 24 24" width="24" height="24" fill={sig.isMuted ? "#022c0f" : "rgba(255,255,255,.9)"}><path d={sig.isMuted ? "M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" : "M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28C16.28 17.23 19 14.41 19 11h-1.7z"}/></svg>,
                      action:() => sig.toggleMute(), active:sig.isMuted,
                    },
                    {
                      label:"Partager\nécran",
                      icon:<svg viewBox="0 0 24 24" width="24" height="24" fill="rgba(255,255,255,.9)"><path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zm-7-3.53v-2.19c-2.78.48-4.34 1.71-5.5 3.72.14-1.39.73-4.47 3.93-5.81L9.5 8.47C11.27 7.28 13.8 6.86 16 9.5l1.5-1.5v4.47H13z"/></svg>,
                      action:() => {}, active:false,
                    },
                    {
                      label:"Effets",
                      icon:<svg viewBox="0 0 24 24" width="24" height="24" fill="rgba(255,255,255,.9)"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7zm1-11h-2v3H8v2h3v3h2v-3h3v-2h-3z"/><circle cx="12" cy="12" r="1.5" fill="rgba(255,255,255,.9)"/><path d="M12 2l1.09 3.26L16 4l-2.18 2.55L15.5 10l-3.5-2-3.5 2 1.68-3.45L8 4l2.91 1.26z" fill="rgba(255,255,255,.6)"/></svg>,
                      action:() => {}, active:false,
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
      <div style={{ position:"fixed", top:0, left:0, right:0, height: vpHeight ? `${vpHeight}px` : "100dvh", display:"flex", flexDirection:"column", zIndex:10000, overflow:"hidden" }}>
        <style>{`
          .fbl-msg-mine   { background:#DCF8C6; color:#111; border-radius:8px 8px 2px 8px; box-shadow:0 1px 1px rgba(0,0,0,0.12); }
          .fbl-msg-theirs { background:#fff; color:#111; border-radius:8px 8px 8px 2px; box-shadow:0 1px 1px rgba(0,0,0,0.10); }
          .fbl-menu-btn { display:flex; align-items:center; gap:14px; padding:13px 20px; background:none; border:none; width:100%; font-size:15px; color:#111; cursor:pointer; text-align:left; font-family:inherit; }
          .fbl-menu-btn:active { background:#F0F2F5; }
          .fbl-react-btn:active { transform:scale(1.35); }
          @keyframes fbl-sheet-up { from{transform:translateY(100%)} to{transform:translateY(0)} }
          @keyframes fbl-fade-in  { from{opacity:0} to{opacity:1} }
          @keyframes fbl-rec-pulse { 0%,100%{opacity:1} 50%{opacity:0.2} }
          @keyframes wa-typing-dot { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }
          .wa-typing-dot { width:7px; height:7px; border-radius:50%; background:#999; display:inline-block; animation:wa-typing-dot 1.2s infinite; }
          .wa-typing-dot:nth-child(2) { animation-delay:0.2s; }
          .wa-typing-dot:nth-child(3) { animation-delay:0.4s; }
          .wa-attach-icon { display:flex; flex-direction:column; align-items:center; gap:7px; cursor:pointer; background:none; border:none; padding:0; }
          .wa-attach-icon span { font-size:12px; color:#555; text-align:center; line-height:1.2; max-width:64px; }
          .wa-attach-circle { width:52px; height:52px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:22px; }
        `}</style>

        {/* ── HEADER ── */}
        {longPressMsg !== null ? (
          /* SELECTION BAR */
          <div style={{ background:"#075E54", padding:"10px 16px", display:"flex", alignItems:"center", gap:18, flexShrink:0, boxShadow:"0 1px 3px rgba(0,0,0,0.18)" }}>
            <button onClick={() => setLongPressMsg(null)}
              style={{ background:"none", border:"none", cursor:"pointer", color:"#fff", display:"flex", alignItems:"center", padding:4 }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
            <span style={{ flex:1, fontWeight:700, fontSize:17, color:"#fff" }}>1</span>
            <button style={{ background:"none", border:"none", cursor:"pointer", color:"#fff", display:"flex", alignItems:"center", padding:6 }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M21 8.5L16.5 4 7 13.5l-3 9 9-3L21 8.5zM5.92 17.08l1.55-4.64L11 16.08 5.92 17.08zM15 6l3 3-8.25 8.25-3-3L15 6z"/></svg>
            </button>
            <button onClick={() => { setMessages(prev => ({ ...prev, [activeConv!]: (prev[activeConv!] ?? []).filter(x => x.id !== longPressMsg) })); setLongPressMsg(null); }}
              style={{ background:"none", border:"none", cursor:"pointer", color:"#fff", display:"flex", alignItems:"center", padding:6 }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
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
        <div style={{ flex:1, overflowY:"auto", padding:"8px 10px 4px", display:"flex", flexDirection:"column", gap:2, background: convWallpaper ?? "#F8FAFC" }}>
          <div style={{ textAlign:"center", fontSize:11.5, color:"#888", background:"rgba(0,0,0,0.05)", borderRadius:20, padding:"3px 14px", margin:"4px auto 10px", display:"inline-block", alignSelf:"center" }}>Aujourd'hui</div>
          {currentMessages.map((msg, i) => {
            const isLast     = i === currentMessages.length - 1 || currentMessages[i + 1]?.mine !== msg.mine;
            const isHL       = showChatSearch && chatSearchQ.trim() && msg.text.toLowerCase().includes(chatSearchQ.toLowerCase());
            const isAct      = msg.id === highlightId;
            const isSelected = longPressMsg !== null && msg.id === longPressMsg;
            return (
              <div key={msg.id}
                style={{ display:"flex", justifyContent: msg.mine ? "flex-end" : "flex-start", alignItems:"flex-end", gap:6, marginTop:2,
                  background: isSelected ? "rgba(0,120,212,0.13)" : isAct ? "rgba(24,119,242,0.15)" : isHL ? "rgba(255,235,59,0.25)" : "transparent",
                  borderRadius:8, transition:"background 0.2s", paddingLeft: longPressMsg !== null ? 36 : 0, position:"relative" }}
                onMouseDown={() => startLongPress(msg.id)} onMouseUp={cancelLongPress} onMouseLeave={cancelLongPress}
                onTouchStart={() => startLongPress(msg.id)} onTouchEnd={cancelLongPress} onTouchMove={cancelLongPress}
                onContextMenu={e => { e.preventDefault(); cancelLongPress(); setLongPressMsg(msg.id); }}>
                {/* Telegram-style selection circle indicator */}
                {longPressMsg !== null && (
                  <div style={{ position:"absolute", left:6, top:"50%", transform:"translateY(-50%)", width:22, height:22, borderRadius:"50%",
                    background: isSelected ? "#1877F2" : "transparent", border: `2px solid ${isSelected ? "#1877F2" : "#B0B3B8"}`,
                    display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s", flexShrink:0 }}>
                    {isSelected && <svg viewBox="0 0 24 24" width="12" height="12" fill="#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>}
                  </div>
                )}
                {!msg.mine && (
                  <div style={{ width:28, flexShrink:0, alignSelf:"flex-end", paddingBottom:2 }}>
                    {isLast && <div className="avatar xs" style={{ background:activeUser.color, width:26, height:26, fontSize:10 }}>{activeUser.initials}</div>}
                  </div>
                )}
                <div style={{ maxWidth:"72%" }}>
                  {msg.attachment && (
                    msg.attachment.type === "audio" ? (
                      <div style={{ background: msg.mine ? "#0073e6" : "#E4E6EB", borderRadius:18, padding:"8px 12px", marginBottom:2, display:"flex", alignItems:"center", gap:8, minWidth:180 }}>
                        <span style={{ fontSize:20 }}>🎙️</span>
                        <div style={{ flex:1, display:"flex", flexDirection:"column", gap:4 }}>
                          <audio controls src={msg.attachment.label} style={{ width:"100%", height:28, outline:"none" }} />
                          {msg.attachment.extra && <span style={{ fontSize:10, color: msg.mine ? "rgba(255,255,255,0.7)" : "#888" }}>{msg.attachment.extra}</span>}
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
                  <div className={msg.mine ? "fbl-msg-mine" : "fbl-msg-theirs"} style={{ padding:"8px 12px 5px", fontSize:14.5, lineHeight:1.45, wordBreak:"break-word" }}>
                    {msg.text}
                    <div style={{ fontSize:10, marginTop:2, color:"#888", textAlign:"right", display:"flex", justifyContent:"flex-end", alignItems:"center", gap:3 }}>
                      {msg.time}
                      {msg.mine && <span style={{ fontSize:11, color: msg.status === "read" ? "#4FC3F7" : "#888" }}>{msg.status === "read" ? "✓✓" : "✓"}</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {currentMessages.length === 0 && (
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
        {longPressMsg !== null ? (
          /* TELEGRAM SELECTION BOTTOM: reactions + action pills */
          <div style={{ background:"#F0F2F5", flexShrink:0, borderTop:"1px solid #E4E6EB" }}>
            {/* Emoji reaction strip */}
            <div style={{ display:"flex", alignItems:"center", background:"#fff", margin:"8px 12px 0", borderRadius:30, padding:"6px 4px", boxShadow:"0 1px 6px rgba(0,0,0,0.12)", gap:0 }}>
              {["😊","❤️","👍","👎","🔥","😍","👏"].map(em => (
                <button key={em} onClick={() => setLongPressMsg(null)}
                  style={{ background:"none", border:"none", fontSize:26, cursor:"pointer", flex:1, padding:"4px 2px", lineHeight:1, transition:"transform 0.1s" }}
                  onMouseEnter={e => (e.currentTarget.style.transform="scale(1.35)")}
                  onMouseLeave={e => (e.currentTarget.style.transform="scale(1)")}>
                  {em}
                </button>
              ))}
              <button style={{ background:"none", border:"none", cursor:"pointer", color:"#888", fontSize:18, padding:"4px 8px", flexShrink:0, display:"flex", alignItems:"center" }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
              </button>
            </div>
            {/* Action pill buttons */}
            <div style={{ display:"flex", gap:10, padding:"10px 12px 14px" }}>
              <button onClick={() => setLongPressMsg(null)}
                style={{ flex:1, background:"#fff", border:"1.5px solid #E4E6EB", borderRadius:24, padding:"11px 8px", fontSize:15, fontWeight:700, cursor:"pointer", color:"#111", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>
                Répondre
              </button>
              <button onClick={() => setLongPressMsg(null)}
                style={{ flex:1, background:"#fff", border:"1.5px solid #E4E6EB", borderRadius:24, padding:"11px 8px", fontSize:15, fontWeight:700, cursor:"pointer", color:"#111", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                Transférer
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M14 15l7-7-7-7v4.1c-5 0-8.5-1.6-11-5.1 1 5 4 10 11 11V15z"/></svg>
              </button>
            </div>
          </div>
        ) : (
          /* NORMAL INPUT BAR — Premium white design */
          <div style={{ background:"#fff", padding:"8px 12px", display:"flex", gap:8, alignItems:"center", flexShrink:0, borderTop:"1px solid #F1F5F9" }}>
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
                style={{ width:"100%", background:"#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:24, padding:"10px 16px", fontSize:15, outline:"none", boxSizing:"border-box", color:"#0F172A" }} />
            </div>
            {newMsg.trim() ? (
              <button onClick={() => sendMsg()}
                style={{ background:"#16C24A", border:"none", borderRadius:"50%", width:44, height:44, color:"#fff", cursor:"pointer", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 3px 12px rgba(22,194,74,0.45)" }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            ) : (
              <>
                <button onClick={() => { setAttachSheet(true); setAttachPage("none"); }}
                  style={{ background:"none", border:"none", cursor:"pointer", padding:0, flexShrink:0, display:"flex", alignItems:"center" }}>
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                </button>
                <button style={{ background:"none", border:"none", cursor:"pointer", padding:0, flexShrink:0, display:"flex", alignItems:"center" }}>
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                </button>
                <div style={{ position:"relative", flexShrink:0 }}>
                  {isRecording ? (
                    <div style={{ display:"flex", alignItems:"center", gap:6, background:"#FEF2F2", border:"2px solid #EF4444", borderRadius:24, padding:"4px 10px" }}>
                      <div style={{ width:9, height:9, borderRadius:"50%", background:"#EF4444", animation:"fbl-rec-pulse 1s infinite" }} />
                      <span style={{ fontSize:13, fontWeight:700, color:"#EF4444", minWidth:28 }}>
                        {`${Math.floor(recSeconds/60)}:${(recSeconds%60).toString().padStart(2,"0")}`}
                      </span>
                      <button onPointerUp={stopVoice} onPointerLeave={stopVoice}
                        style={{ background:"#EF4444", border:"none", borderRadius:"50%", width:30, height:30, color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      onPointerDown={e => { e.preventDefault(); startVoice(); }}
                      style={{ background:"#16C24A", border:"none", borderRadius:"50%", width:44, height:44, color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 3px 12px rgba(22,194,74,0.45)" }}>
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                    </button>
                  )}
                </div>
              </>
            )}
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
              <button className="fbl-menu-btn" onClick={() => { setShowWallpaper(true); setShowConvMenu(false); }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="#555"><path d="M21 3H3C2 3 1 4 1 5v14c0 1.1.9 2 2 2h18c1 0 2-1 2-2V5c0-1-1-2-2-2zM5 17l3.5-4.5 2.5 3.01L14.5 11l4.5 6H5z"/></svg>
                Fond d'écran
              </button>
              <div style={{ height:1, background:"#F0F2F5" }} />
              <button className="fbl-menu-btn" onClick={() => { setMessages(prev => ({ ...prev, [activeConv!]: [] })); setShowConvMenu(false); }}>
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

        {/* ── WALLPAPER / FOND D'ÉCRAN SELECTOR ── */}
        {showWallpaper && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:10001, display:"flex", flexDirection:"column", justifyContent:"flex-end", animation:"fbl-fade-in 0.15s ease" }}
            onClick={() => setShowWallpaper(false)}>
            <div style={{ background:"#fff", borderRadius:"20px 20px 0 0", padding:"20px 16px 32px", animation:"fbl-sheet-up 0.25s ease" }} onClick={e => e.stopPropagation()}>
              <div style={{ fontWeight:700, fontSize:16, color:"#111", marginBottom:18, textAlign:"center" }}>Sélectionnez un thème</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:14 }}>
                {([
                  { color:null,      label:"Défaut" },
                  { color:"#FFF3E0", label:"Chaud"  },
                  { color:"#E8F5E9", label:"Vert"   },
                  { color:"#E3F2FD", label:"Bleu"   },
                  { color:"#FCE4EC", label:"Rose"   },
                  { color:"#F3E5F5", label:"Violet" },
                  { color:"#E8EAF6", label:"Indigo" },
                  { color:"#E0F7FA", label:"Cyan"   },
                  { color:"#FFFDE7", label:"Jaune"  },
                  { color:"#EFEBE9", label:"Brun"   },
                ] as { color:string|null; label:string }[]).map(t => {
                  const active = convWallpaper === t.color;
                  return (
                    <div key={t.label} style={{ textAlign:"center", cursor:"pointer" }}
                      onClick={() => { setConvWallpaper(t.color); setShowWallpaper(false); }}>
                      <div style={{ width:52, height:52, borderRadius:"50%", background: t.color ?? "#fff", border: active ? "3px solid #1877F2" : "2px solid #E4E6EB", margin:"0 auto 4px", boxShadow: active ? "0 0 0 2px rgba(24,119,242,0.3)" : "none" }} />
                      <div style={{ fontSize:11, color: active ? "#1877F2" : "#555", fontWeight: active ? 700 : 400 }}>{t.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── SUPPRIMER L'ÉCHANGE DIALOG ── */}
        {showDeleteConv && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:10001, padding:"0 24px", animation:"fbl-fade-in 0.15s ease" }}
            onClick={e => { if (e.target === e.currentTarget) setShowDeleteConv(false); }}>
            <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:340, padding:"24px 20px 16px", boxShadow:"0 8px 32px rgba(0,0,0,0.28)" }}>
              <div style={{ fontWeight:800, fontSize:16, color:"#111", marginBottom:10 }}>Supprimer l'échange</div>
              <div style={{ fontSize:14, color:"#555", marginBottom:18, lineHeight:1.55 }}>
                Voulez-vous vraiment supprimer l'échange avec <strong>{activeUser.name}</strong> ?
              </div>
              <label style={{ display:"flex", alignItems:"center", gap:10, marginBottom:22, cursor:"pointer" }}>
                <input type="checkbox" checked={deleteForAll} onChange={e => setDeleteForAll(e.target.checked)}
                  style={{ width:18, height:18, accentColor:"#1877F2", cursor:"pointer" }} />
                <span style={{ fontSize:14, color:"#333" }}>Supprimer aussi pour {activeUser.name}</span>
              </label>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <button onClick={() => { setMessages(prev => ({ ...prev, [activeConv!]: [] })); setActiveConv(null); setShowDeleteConv(false); setDeleteForAll(false); }}
                  style={{ background:"#E02020", border:"none", borderRadius:8, padding:"13px", fontSize:15, fontWeight:700, color:"#fff", cursor:"pointer" }}>
                  Supprimer l'échange
                </button>
                <button onClick={() => setShowDeleteConv(false)}
                  style={{ background:"none", border:"none", padding:"10px", fontSize:15, fontWeight:600, color:"#1877F2", cursor:"pointer" }}>
                  Annuler
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
                      const text = `👤 Contact : ${u.name}`;
                      setMessages(prev => {
                        const list = [...(prev[activeConv!] ?? [])];
                        list.push({ id:Date.now(), text, mine:true, time:new Date().toLocaleTimeString("fr",{hour:"2-digit",minute:"2-digit"}), status:"sent" });
                        return { ...prev, [activeConv!]: list };
                      });
                      setAttachSheet(false); setAttachPage("none");
                    }} style={{ display:"flex", alignItems:"center", gap:12, width:"100%", background:"none", border:"none", padding:"12px 18px", cursor:"pointer", textAlign:"left" as const }}>
                      <div className="avatar" style={{ width:46, height:46, fontSize:16, flexShrink:0 }}>{u.name.slice(0,2).toUpperCase()}</div>
                      <div style={{ fontWeight:600, fontSize:15, color:"#111" }}>{u.name}</div>
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
          <button onClick={() => navigate("/")} style={{ width: 34, height: 34, borderRadius: "50%", background: "#16C24A", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
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

        {/* ── Premium Empty State ── */}
        {!search && convList.length === 0 && chatGroups.length === 0 && (
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

            {/* Text + actions row */}
            <div style={{ display: "flex", alignItems: "flex-start", padding: "0 20px", width: "100%", gap: 16, marginTop: 4 }}>
              {/* Left: text + button */}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 22, color: "#0F172A", marginBottom: 8, lineHeight: 1.2 }}>Aucune discussion</div>
                <div style={{ fontSize: 13.5, color: "#64748B", lineHeight: 1.6, marginBottom: 20 }}>Commencez une conversation avec vos amis ou rejoignez des groupes et canaux.</div>
                <button
                  onClick={() => setFabOpen(true)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#16C24A", color: "#fff", border: "none", borderRadius: 99, padding: "13px 22px", fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: "0 4px 16px rgba(22,194,74,0.4)" }}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  Nouvelle discussion
                </button>
              </div>

              {/* Right: expanded FAB actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end", flexShrink: 0 }}>
                {([
                  { label: "Nouvelle discussion", iconBg: "#16C24A", svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, action: () => setFabOpen(false) },
                  { label: "Nouveau groupe", iconBg: "#3B82F6", svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, action: () => { setGroupWizardType("group"); setGroupWizard("members"); setWizardSearch(""); setWizardMembers(new Set()); } },
                  { label: "Créer un canal", iconBg: "#8B5CF6", svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>, action: () => { setGroupWizardType("channel"); setGroupWizard("members"); setWizardSearch(""); setWizardMembers(new Set()); } },
                  { label: "Diffuser une annonce", iconBg: "#F59E0B", svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 0h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 7.91a16 16 0 0 0 6.1 6.1l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>, action: () => {} },
                  { label: "Inviter des amis", iconBg: "#8B5CF6", svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>, action: () => {} },
                ] as {label:string;iconBg:string;svg:React.ReactNode;action:()=>void}[]).map((item, i) => (
                  <div key={i} onClick={item.action} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", animation: `fbl-fab-in .2s ease ${i*.05}s both` }}>
                    <div style={{ background: "#fff", borderRadius: 99, padding: "8px 14px", boxShadow: "0 2px 12px rgba(0,0,0,0.12)", fontSize: 13.5, fontWeight: 600, color: "#0F172A", whiteSpace: "nowrap" }}>{item.label}</div>
                    <div style={{ width: 46, height: 46, borderRadius: "50%", background: item.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 4px 14px ${item.iconBg}66` }}>{item.svg}</div>
                  </div>
                ))}
              </div>
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

      {/* ── FAB — visible only when conversations exist ── */}
      {(convList.length > 0 || chatGroups.length > 0) && (
        <div style={{ position: "absolute", bottom: 80, right: 16, zIndex: 50 }}>
          {fabOpen && (
            <>
              <div onClick={() => setFabOpen(false)} style={{ position: "fixed", inset: 0, zIndex: -1, background: "rgba(0,0,0,0.1)" }} />
              <div style={{ position: "absolute", bottom: 68, right: 0, display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
                {([
                  { label: "Nouvelle discussion", iconBg: "#16C24A", svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, action: () => setFabOpen(false) },
                  { label: "Nouveau groupe", iconBg: "#3B82F6", svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, action: () => { setGroupWizardType("group"); setGroupWizard("members"); setWizardSearch(""); setWizardMembers(new Set()); setFabOpen(false); } },
                  { label: "Créer un canal", iconBg: "#8B5CF6", svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>, action: () => { setGroupWizardType("channel"); setGroupWizard("members"); setWizardSearch(""); setWizardMembers(new Set()); setFabOpen(false); } },
                  { label: "Diffuser une annonce", iconBg: "#F59E0B", svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 0h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 7.91a16 16 0 0 0 6.1 6.1l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>, action: () => setFabOpen(false) },
                  { label: "Inviter des amis", iconBg: "#8B5CF6", svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>, action: () => setFabOpen(false) },
                ] as {label:string;iconBg:string;svg:React.ReactNode;action:()=>void}[]).map((item, i) => (
                  <div key={i} onClick={item.action} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", animation: `fbl-fab-in .2s ease ${i*.06}s both` }}>
                    <div style={{ background: "#fff", borderRadius: 99, padding: "8px 16px", boxShadow: "0 2px 12px rgba(0,0,0,.14)", fontSize: 13.5, fontWeight: 600, color: "#0F172A", whiteSpace: "nowrap" }}>{item.label}</div>
                    <div style={{ width: 46, height: 46, borderRadius: "50%", background: item.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 4px 14px ${item.iconBg}55` }}>{item.svg}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          <button onClick={() => setFabOpen(!fabOpen)} style={{ width: 56, height: 56, borderRadius: "50%", background: fabOpen ? "#16C24A" : "#16C24A", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 18px rgba(22,194,74,.5)", transition: "transform .2s" }}>
            {fabOpen
              ? <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              : <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            }
          </button>
        </div>
      )}
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
