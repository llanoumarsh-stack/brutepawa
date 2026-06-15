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
      <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "linear-gradient(180deg,#5B86E5 0%,#7A5AF8 55%,#6B21A8 100%)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <style>{`
          @keyframes tg-ring2{0%,100%{box-shadow:0 0 0 0 rgba(255,255,255,.55),0 0 0 0 rgba(255,255,255,.3)}50%{box-shadow:0 0 0 22px rgba(255,255,255,.18),0 0 0 44px rgba(255,255,255,.07)}}
          @keyframes tg-dots2{0%,80%,100%{opacity:0}40%{opacity:1}}
          .tg2-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.8);margin:0 2px;animation:tg-dots2 1.4s infinite ease-in-out both}
          .tg2-dot:nth-child(1){animation-delay:-.32s}.tg2-dot:nth-child(2){animation-delay:-.16s}
        `}</style>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"52px 20px 0", flexShrink:0 }}>
          <div style={{ width:40 }} />
          <div style={{ color:"rgba(255,255,255,.75)", fontSize:13, fontWeight:500 }}>{isVideo ? "Appel vidéo entrant" : "Appel vocal entrant"}</div>
          <div style={{ width:40 }} />
        </div>
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <div style={{ width:130, height:130, borderRadius:"50%", background:callerColor, display:"flex", alignItems:"center", justifyContent:"center", fontSize:52, color:"#fff", fontWeight:800, animation:"tg-ring2 2s ease-out infinite", marginBottom:24 }}>{mkInitials(callerName)}</div>
          <div style={{ color:"#fff", fontWeight:800, fontSize:26, marginBottom:10, textAlign:"center", padding:"0 24px" }}>{callerName}</div>
          <div style={{ display:"flex", alignItems:"center", gap:6, color:"rgba(255,255,255,.75)", fontSize:15 }}>
            Sonnerie<span className="tg2-dot" /><span className="tg2-dot" /><span className="tg2-dot" />
          </div>
          {sig.mediaError && <div style={{ marginTop:16, background:"rgba(244,67,54,.2)", color:"#FF6B6B", borderRadius:12, padding:"8px 18px", fontSize:13, textAlign:"center", maxWidth:280 }}>{sig.mediaError}</div>}
        </div>
        <div style={{ padding:"0 32px 60px", flexShrink:0, display:"flex", justifyContent:"space-around" }}>
          <div style={{ textAlign:"center", cursor:"pointer" }} onClick={() => sig.rejectCall()}>
            <div style={{ width:68, height:68, borderRadius:"50%", background:"#F44336", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 8px", boxShadow:"0 4px 20px rgba(244,67,54,.5)" }}>
              <svg viewBox="0 0 24 24" width="32" height="32" fill="#fff"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.12-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/></svg>
            </div>
            <div style={{ color:"rgba(255,255,255,.85)", fontSize:13, fontWeight:500 }}>Raccrocher</div>
          </div>
          <div style={{ textAlign:"center", cursor:"pointer" }} onClick={() => sig.acceptCall()}>
            <div style={{ width:68, height:68, borderRadius:"50%", background:"#4CAF50", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 8px", boxShadow:"0 4px 20px rgba(76,175,80,.5)" }}>
              <svg viewBox="0 0 24 24" width="32" height="32" fill="#fff"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.58.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.24 1.01L6.6 10.8z"/></svg>
            </div>
            <div style={{ color:"rgba(255,255,255,.85)", fontSize:13, fontWeight:500 }}>Accepter</div>
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
          /* ── VIDEO CALL ── */
          <>
            <video ref={remoteVideoRef} autoPlay playsInline style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", background:"#111" }} />
            <div style={{ position:"absolute", top:0, left:0, right:0, padding:"48px 16px 60px", background:"linear-gradient(180deg,rgba(0,0,0,.72) 0%,transparent 100%)", zIndex:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ flex:1 }}>
                  <div style={{ color:"#fff", fontWeight:800, fontSize:18 }}>{peer?.name ?? "Appel vidéo"}</div>
                  <div style={{ color:"rgba(255,255,255,.8)", fontSize:13, marginTop:2 }}>
                    {sig.callState === "active" ? <span style={{ color:"#A5F3A5" }}>● {fmtTime(sig.callDuration)}</span> : <span>Connexion en cours...</span>}
                  </div>
                </div>
                <button onClick={() => sig.toggleSpeaker(remoteAudioRef.current)} style={{ background:"none", border:"none", color:sig.isSpeaker?"#fff":"rgba(255,255,255,.6)", cursor:"pointer", padding:4 }}>
                  <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
                </button>
              </div>
            </div>
            <div style={{ position:"absolute", top:110, right:14, width:100, height:148, borderRadius:16, overflow:"hidden", border:"2px solid rgba(255,255,255,.55)", zIndex:15, boxShadow:"0 4px 16px rgba(0,0,0,.5)" }}>
              <video ref={localVideoRef} autoPlay playsInline muted style={{ width:"100%", height:"100%", objectFit:"cover", transform:sig.cameraFront?"scaleX(-1)":"scaleX(1)" }} />
            </div>
            <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"0 16px 52px", background:"linear-gradient(0deg,rgba(0,0,0,.75) 0%,transparent 100%)", zIndex:10 }}>
              <div style={{ display:"flex", justifyContent:"space-around", alignItems:"flex-start" }}>
                {([
                  { label:"Retourner",     icon:<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M12.05 0l-.66.03 3.81 3.81 1.33-1.33C19.8 4.07 22.14 7.24 22.5 11H24c-.51-6.16-5.66-11-11.95-11zm-.22 4C8.47 4 5.2 6.28 4.22 9.65l1.42-.42c.73-2.36 2.93-4.23 5.53-4.23 2.1 0 3.96.96 5.2 2.47L14.75 9h4V5l-1.3 1.3C16.07 4.89 14.18 4 12.08 4h-.25zM7.47 21.49C4.2 19.93 1.86 16.76 1.5 13H0c.51 6.16 5.66 11 11.95 11l.66-.03-3.81-3.81-1.33 1.33zm.89-6.52c-.19 0-.38-.03-.56-.08L6 16.68l-.41.41c.28.4.64.74 1.04 1.01.9.6 1.96.9 3.03.73.3-.04.59-.12.87-.23.56-.22 1.04-.6 1.42-1.08.19-.22.36-.47.49-.73.24-.53.34-1.12.28-1.7l-.08-.6-1.42.42c-.01.19-.04.38-.1.56-.18.56-.58 1.01-1.1 1.27a2.4 2.4 0 0 1-.66.17z"/></svg>, action:() => sig.flipCamera() },
                  { label:"Arrêter vidéo", icon:<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M21 6.5l-4-4-12 12 4 4 12-12zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2zM15 17H5V8h1.73l8 8H15v1z"/></svg>, action:() => {} },
                  { label:"Muet",          icon:<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d={sig.isMuted?"M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z":"M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28C16.28 17.23 19 14.41 19 11h-1.7z"}/></svg>, action:() => sig.toggleMute(), active:sig.isMuted },
                  { label:"Raccrocher",    icon:<svg viewBox="0 0 24 24" width="28" height="28" fill="#fff"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.12-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/></svg>, action:() => sig.endCall(), red:true },
                ] as {label:string;icon:JSX.Element;action:()=>void;active?:boolean;red?:boolean}[]).map(b => (
                  <div key={b.label} style={{ textAlign:"center", cursor:"pointer" }} onClick={b.action}>
                    <div className={`tg3-btn${b.active?" tg3-btn-on":""}`} style={b.red?{background:"#F44336",boxShadow:"0 4px 18px rgba(244,67,54,.55)"}:{}}>{b.icon}</div>
                    <div style={{ color:"rgba(255,255,255,.85)", fontSize:11, fontWeight:500, marginTop:7 }}>{b.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* ── AUDIO CALL ── */
          <>
            <div style={{ position:"absolute", inset:0, background:"linear-gradient(180deg,#5B86E5 0%,#7A5AF8 55%,#6B21A8 100%)" }} />
            <div style={{ position:"relative", zIndex:10, display:"flex", justifyContent:"space-between", alignItems:"center", padding:"48px 20px 0", flexShrink:0 }}>
              <div style={{ width:34 }} />
              <div />
              <button onClick={() => sig.toggleSpeaker(remoteAudioRef.current)} style={{ background:"none", border:"none", color:sig.isSpeaker?"#fff":"rgba(255,255,255,.6)", cursor:"pointer", padding:4 }}>
                <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d={sig.isSpeaker?"M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z":"M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"}/></svg>
              </button>
            </div>
            <div style={{ position:"relative", zIndex:10, flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
              <div style={{ width:136, height:136, borderRadius:"50%", background:peer?.color ?? "#4C6EF5", display:"flex", alignItems:"center", justifyContent:"center", fontSize:54, color:"#fff", fontWeight:800, animation:"tg-ring3 2s ease-out infinite", marginBottom:28 }}>
                {peer?.initials ?? "?"}
              </div>
              <div style={{ color:"#fff", fontWeight:800, fontSize:26, marginBottom:12, textAlign:"center", padding:"0 24px" }}>{peer?.name ?? "Appel vocal"}</div>
              <div style={{ display:"flex", alignItems:"center", gap:6, color:"rgba(255,255,255,.78)", fontSize:15 }}>
                {sig.callState === "active"
                  ? <span style={{ color:"#A5F3A5", fontWeight:700 }}>● {fmtTime(sig.callDuration)}</span>
                  : <><span>Sonnerie</span><span className="tg3-dot" /><span className="tg3-dot" /><span className="tg3-dot" /></>
                }
              </div>
            </div>
            <div style={{ position:"relative", zIndex:10, padding:"0 16px 58px", flexShrink:0 }}>
              <div style={{ display:"flex", justifyContent:"space-around", alignItems:"flex-start" }}>
                {([
                  { label:"Haut-parleur",  icon:<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>, action:() => sig.toggleSpeaker(remoteAudioRef.current), active:sig.isSpeaker },
                  { label:"Activer vidéo", icon:<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>, action:() => {} },
                  { label:"Muet",          icon:<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d={sig.isMuted?"M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z":"M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28C16.28 17.23 19 14.41 19 11h-1.7z"}/></svg>, action:() => sig.toggleMute(), active:sig.isMuted },
                  { label:"Raccrocher",    icon:<svg viewBox="0 0 24 24" width="28" height="28" fill="#fff"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.12-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/></svg>, action:() => sig.endCall(), red:true },
                ] as {label:string;icon:JSX.Element;action:()=>void;active?:boolean;red?:boolean}[]).map(b => (
                  <div key={b.label} style={{ textAlign:"center", cursor:"pointer" }} onClick={b.action}>
                    <div className={`tg3-btn${b.active?" tg3-btn-on":""}`} style={b.red?{background:"#F44336",boxShadow:"0 4px 18px rgba(244,67,54,.55)"}:{}}>{b.icon}</div>
                    <div style={{ color:"rgba(255,255,255,.85)", fontSize:11, fontWeight:500, marginTop:7 }}>{b.label}</div>
                  </div>
                ))}
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
     INFO OVERLAY — WhatsApp × BP style
  ══════════════════════════════════════════════════════════════ */
  if (activeConv && activeUser && overlay === "info") {
    return createPortal(
      <div style={{ position: "fixed", top: 0, bottom: 0, left: 0, right: 0, background: "#f0f2f5", zIndex: 10000, overflowY: "auto" }}>
        <div style={{ background: "#1877F2", padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setOverlay("none")} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", padding: 4 }}>←</button>
          <div style={{ fontWeight: 700, fontSize: 17, color: "#fff" }}>Infos du contact</div>
        </div>
        <div style={{ background: "#fff", padding: "28px 20px 24px", textAlign: "center" }}>
          <div style={{ position: "relative", display: "inline-block", marginBottom: 14 }}>
            <div className="avatar" style={{ width: 96, height: 96, fontSize: 34, background: activeUser.color }}>{activeUser.initials}</div>
            <div style={{ position: "absolute", bottom: 5, right: 5, width: 20, height: 20, background: "#42B72A", borderRadius: "50%", border: "3px solid #fff" }} />
          </div>
          <div style={{ fontWeight: 900, fontSize: 23, color: "#111", marginBottom: 4 }}>{activeUser.name}</div>
          <div style={{ fontSize: 13, color: presence.online ? "#42B72A" : "#888", fontWeight: 600 }}>{presence.online ? "🟢 En ligne" : presText}</div>
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
        <div style={{ marginTop: 8, background: "#fff" }}>
          {[{ icon: "😊", label: "Bonjour ! J'utilise Brute Pawa." }, { icon: "📱", label: activeUser.name }].map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", borderBottom: "1px solid #f0f2f5" }}>
              <span style={{ fontSize: 22 }}>{r.icon}</span>
              <span style={{ fontSize: 15, color: "#111" }}>{r.label}</span>
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
          /* NORMAL HEADER */
          <div style={{ background:"#075E54", padding:"8px 10px", display:"flex", alignItems:"center", gap:8, flexShrink:0, boxShadow:"0 2px 4px rgba(0,0,0,0.18)" }}>
            <button onClick={() => { setActiveConv(null); setOverlay("none"); setShowConvMenu(false); }}
              style={{ background:"none", border:"none", fontSize:24, cursor:"pointer", color:"#fff", display:"flex", alignItems:"center", padding:"2px 4px 2px 0", lineHeight:1 }}>‹</button>
            <div style={{ position:"relative", cursor:"pointer", flexShrink:0 }} onClick={() => setOverlay("info")}>
              <div className="avatar" style={{ background:"rgba(255,255,255,0.25)", width:40, height:40, fontSize:14, color:"#fff", border:"2px solid rgba(255,255,255,0.4)" }}>{activeUser.initials}</div>
              {presence.online && <div style={{ position:"absolute", bottom:1, right:1, width:11, height:11, background:"#25D366", borderRadius:"50%", border:"2px solid #075E54" }} />}
            </div>
            <div style={{ flex:1, minWidth:0, cursor:"pointer" }} onClick={() => setOverlay("info")}>
              <div style={{ fontWeight:700, fontSize:15, color:"#fff", lineHeight:1.2 }}>{activeUser.name}</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.85)" }}>{presText}</div>
            </div>
            <button onClick={() => sig.startCall(activeConv, "audio")}
              style={{ background:"none", border:"none", width:38, height:38, cursor:"pointer", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.58.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.24 1.01L6.6 10.8z"/></svg>
            </button>
            <div style={{ position:"relative", flexShrink:0 }}>
              <button onClick={() => { setShowConvMenu(m => !m); setShowNotifSub(false); }}
                style={{ background:"none", border:"none", width:38, height:38, cursor:"pointer", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:900 }}>⋮</button>
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
        <div style={{ flex:1, overflowY:"auto", padding:"8px 10px 4px", display:"flex", flexDirection:"column", gap:2, background: convWallpaper ?? "#ECE5DD" }}>
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
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:"40px 0" }}>
              <div style={{ background:"rgba(0,0,0,0.06)", borderRadius:16, padding:"12px 20px", fontSize:13, color:"#555" }}>
                🔒 Les messages sont chiffrés de bout en bout
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
          /* NORMAL INPUT BAR — WhatsApp style */
          <div style={{ background:"#F0F2F5", padding:"6px 8px", display:"flex", gap:4, alignItems:"center", flexShrink:0 }}>
            <button style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"#777", padding:"4px 4px", flexShrink:0, display:"flex", alignItems:"center" }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm4.24 16L12 15.45 7.77 18l1.12-4.81-3.73-3.23 4.92-.42L12 5l1.92 4.53 4.92.42-3.73 3.23L16.23 18z"/></svg>
            </button>
            <div style={{ flex:1 }}>
              <input value={newMsg}
                onChange={e => {
                  setNewMsg(e.target.value);
                  if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
                  apiSendTyping(activeConv!).catch(() => {});
                  typingDebounceRef.current = setTimeout(() => { typingDebounceRef.current = null; }, 2500);
                }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
                placeholder="Message"
                style={{ width:"100%", background:"#fff", border:"none", borderRadius:22, padding:"10px 14px", fontSize:15, outline:"none", boxSizing:"border-box", color:"#111", boxShadow:"0 1px 2px rgba(0,0,0,0.1)" }} />
            </div>
            {newMsg.trim() ? (
              <button onClick={() => sendMsg()}
                style={{ background:"#25D366", border:"none", borderRadius:"50%", width:42, height:42, color:"#fff", cursor:"pointer", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 8px rgba(37,211,102,0.4)" }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </button>
            ) : (
              <>
                <button onClick={() => { setAttachSheet(true); setAttachPage("none"); }}
                  style={{ background:"none", border:"none", cursor:"pointer", color:"#777", padding:"4px 4px", flexShrink:0, display:"flex", alignItems:"center" }}>
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>
                </button>
                <button style={{ background:"none", border:"none", cursor:"pointer", color:"#777", padding:"4px 2px", flexShrink:0, display:"flex", alignItems:"center" }}>
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 15.2l-4.4-4.4L9 9.4l3 3.1 3-3.1 1.4 1.4L12 15.2zM20 4h-3.17L15 2H9L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h4.05l.59-.65L9.88 4h4.24l1.24 1.35.59.65H20v12z"/><circle cx="12" cy="11" r="3.2"/></svg>
                </button>
                <div style={{ position:"relative", flexShrink:0 }}>
                  {isRecording ? (
                    <div style={{ display:"flex", alignItems:"center", gap:6, background:"#fff", border:"2px solid #e53935", borderRadius:24, padding:"4px 10px" }}>
                      <div style={{ width:10, height:10, borderRadius:"50%", background:"#e53935", animation:"fbl-rec-pulse 1s infinite" }} />
                      <span style={{ fontSize:13, fontWeight:700, color:"#e53935", minWidth:28 }}>
                        {`${Math.floor(recSeconds/60)}:${(recSeconds%60).toString().padStart(2,"0")}`}
                      </span>
                      <button onPointerUp={stopVoice} onPointerLeave={stopVoice}
                        style={{ background:"#e53935", border:"none", borderRadius:"50%", width:32, height:32, color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      onPointerDown={e => { e.preventDefault(); startVoice(); }}
                      style={{ background:"#25D366", border:"none", borderRadius:"50%", width:42, height:42, color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 8px rgba(37,211,102,0.4)" }}>
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z"/></svg>
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

      {/* ── HEADER ── */}
      <div style={{ background: "#fff", flexShrink: 0, borderBottom: showInboxSearch ? "none" : "1px solid #e5e5e5" }}>
        {!showInboxSearch ? (
          <div style={{ display: "flex", alignItems: "center", padding: "10px 8px 10px 4px", gap: 2 }}>
            <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="#050505"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            </button>
            <span style={{ flex: 1, fontWeight: 700, fontSize: 22, color: "#050505", letterSpacing: -0.3 }}>Messages</span>
            <button onClick={() => setSettingsPage("main")} style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg viewBox="0 0 24 24" width="26" height="26" fill="#050505"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
            </button>
            <button onClick={() => setShowInboxSearch(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg viewBox="0 0 24 24" width="26" height="26" fill="#050505"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", gap: 8, borderBottom: "1px solid #e5e5e5" }}>
            <button onClick={() => { setShowInboxSearch(false); setSearch(""); }} style={{ background: "none", border: "none", cursor: "pointer", padding: "6px 4px", display: "flex", alignItems: "center" }}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="#050505"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            </button>
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher des discussions…"
              style={{ flex: 1, background: "#f0f2f5", border: "none", borderRadius: 20, padding: "9px 14px", fontSize: 15, outline: "none", color: "#050505" }} />
            {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#888", fontSize: 18, padding: "0 4px" }}>✕</button>}
          </div>
        )}
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

        {/* Empty */}
        {!search && convList.length === 0 && chatGroups.length === 0 && (
          <div style={{ padding: "64px 32px", textAlign: "center" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>💬</div>
            <div style={{ fontWeight: 700, fontSize: 19, color: "#050505", marginBottom: 8 }}>Aucune discussion</div>
            <div style={{ fontSize: 14, color: "#888", lineHeight: 1.6 }}>Commencez une conversation avec vos amis.</div>
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

      {/* ── FAB ── */}
      <div style={{ position: "absolute", bottom: 20, right: 16, zIndex: 50 }}>
        {fabOpen && (
          <>
            <div onClick={() => setFabOpen(false)} style={{ position: "fixed", inset: 0, zIndex: -1, background: "rgba(0,0,0,0.1)" }} />
            <div style={{ position: "absolute", bottom: 68, right: 0, display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
              {[
                { label: "Nouveau canal",      color: "#00838F", icon: "📢", action: () => { setGroupWizardType("channel"); setGroupWizard("members"); setWizardSearch(""); setWizardMembers(new Set()); setFabOpen(false); } },
                { label: "Nouveau groupe",      color: "#1877F2", icon: "👥", action: () => { setGroupWizardType("group"); setGroupWizard("members"); setWizardSearch(""); setWizardMembers(new Set()); setFabOpen(false); } },
                { label: "Nouvelle discussion", color: "#42B72A", icon: "✉️", action: () => setFabOpen(false) },
              ].map((item, i) => (
                <div key={item.label} onClick={item.action} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", animation: `fbl-fab-in .2s ease ${i*.06}s both` }}>
                  <div style={{ background: "#fff", borderRadius: 22, padding: "8px 16px", boxShadow: "0 2px 12px rgba(0,0,0,.18)", fontSize: 13, fontWeight: 700, color: "#050505", whiteSpace: "nowrap" }}>{item.label}</div>
                  <div style={{ width: 46, height: 46, borderRadius: "50%", background: item.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, boxShadow: `0 3px 12px ${item.color}88` }}>{item.icon}</div>
                </div>
              ))}
            </div>
          </>
        )}
        <button onClick={() => setFabOpen(!fabOpen)}
          style={{ width: 56, height: 56, borderRadius: "50%", background: "#1877F2", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 18px rgba(24,119,242,.55)", transition: "transform .2s" }}>
          <svg viewBox="0 0 24 24" width="26" height="26" fill="#fff"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
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
