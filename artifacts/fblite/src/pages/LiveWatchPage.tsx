import { useEffect, useState, useRef } from "react";
import { useNavigate } from "../router";
import { useViewerPresence } from "../hooks/useViewerPresence";
import { getBpToken } from "../lib/api";
import GiftPicker from "../components/GiftPicker";

interface LiveInfo {
  id: number;
  userId: string;
  userName: string;
  userFlag: string;
  playbackUrl: string;
  viewerCount: number;
}

interface TopDonor {
  senderId: number;
  senderName: string;
  totalTokens: number;
  giftsCount: number;
}

interface FloatingGift {
  id: number;
  emoji: string;
  x: number;
}

interface FeedEntry {
  id: number;
  type: "gift" | "chat";
  senderName: string;
  userFlag?: string;
  giftEmoji?: string;
  giftName?: string;
  content?: string;
}

interface Props {
  streamId: number;
}

export default function LiveWatchPage({ streamId }: Props) {
  const navigate = useNavigate();
  const [stream, setStream]           = useState<LiveInfo | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [topDonors, setTopDonors]     = useState<TopDonor[]>([]);
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [floatingGifts, setFloatingGifts]  = useState<FloatingGift[]>([]);
  const [feedEntries, setFeedEntries]      = useState<FeedEntry[]>([]);
  const [chatInput, setChatInput]          = useState("");
  const [sendingChat, setSendingChat]      = useState(false);
  const floatIdRef  = useRef(0);
  const feedIdRef   = useRef(0);
  const feedBottomRef = useRef<HTMLDivElement>(null);
  const sseRef      = useRef<EventSource | null>(null);

  useViewerPresence(stream?.id ?? null);

  useEffect(() => {
    const token = getBpToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch(`/api/stream/live/${streamId}`, { headers })
      .then(r => r.json())
      .then((data: LiveInfo & { status?: string }) => {
        if (data.status === "ended" || !data.playbackUrl) {
          setError("Ce live est terminé.");
        } else {
          setStream(data);
        }
      })
      .catch(() => setError("Impossible de charger le live."))
      .finally(() => setLoading(false));
  }, [streamId]);

  // Fetch viewer token balance
  useEffect(() => {
    const token = getBpToken();
    if (!token) return;
    fetch("/api/creator/wallet", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((d: { tokenBalance?: number }) => {
        if (d.tokenBalance !== undefined) setTokenBalance(d.tokenBalance);
      })
      .catch(() => {});
  }, []);

  // Fetch + refresh top donors every 15 s
  useEffect(() => {
    if (!stream) return;
    const load = () => {
      fetch(`/api/gifts/top-donors/live/${stream.id}`)
        .then(r => r.json())
        .then((d: TopDonor[]) => setTopDonors(Array.isArray(d) ? d.slice(0, 5) : []))
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [stream]);

  // SSE — subscribe to gift + chat events for the live feed
  useEffect(() => {
    if (!stream) return;

    const es = new EventSource(`/api/stream/live/${stream.id}/events`);
    sseRef.current = es;

    es.addEventListener("gift", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as {
          senderName: string;
          giftEmoji: string;
          giftName: string;
        };
        const fid = ++feedIdRef.current;
        setFeedEntries(prev => [...prev.slice(-49), {
          id: fid,
          type: "gift",
          senderName: data.senderName || "Anonyme",
          giftEmoji: data.giftEmoji  || "🎁",
          giftName:  data.giftName   || "Cadeau",
        }]);
        spawnFloat(data.giftEmoji || "🎁");
      } catch { /* ignore parse errors */ }
    });

    es.addEventListener("chat", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as {
          userName: string;
          userFlag?: string;
          content: string;
        };
        const fid = ++feedIdRef.current;
        setFeedEntries(prev => [...prev.slice(-49), {
          id: fid,
          type: "chat",
          senderName: data.userName || "Anonyme",
          userFlag: data.userFlag ?? "",
          content: data.content,
        }]);
      } catch { /* ignore parse errors */ }
    });

    return () => {
      es.close();
      sseRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream?.id]);

  // Auto-scroll feed to newest entry
  useEffect(() => {
    feedBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [feedEntries]);

  const spawnFloat = (emoji: string) => {
    const id = ++floatIdRef.current;
    const x  = 15 + Math.random() * 60;
    setFloatingGifts(prev => [...prev, { id, emoji, x }]);
    setTimeout(() => setFloatingGifts(prev => prev.filter(g => g.id !== id)), 2200);
  };

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || !stream || sendingChat) return;
    setSendingChat(true);
    try {
      const token = getBpToken();
      await fetch(`/api/stream/live/${stream.id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content: text }),
      });
      setChatInput("");
    } catch { /* ignore */ } finally {
      setSendingChat(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <p>Chargement du live…</p>
      </div>
    );
  }

  if (error || !stream) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white gap-4">
        <p>{error ?? "Live introuvable."}</p>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 rounded-full bg-white text-black text-sm font-medium"
        >
          Retour
        </button>
      </div>
    );
  }

  const broadcasterId = parseInt(stream.userId, 10);
  const token = getBpToken();

  return (
    <div className="flex flex-col h-screen bg-black text-white relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 z-10">
        <button onClick={() => navigate("/")} className="text-white text-xl">✕</button>
        <div className="flex items-center gap-2">
          <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">LIVE</span>
          <span className="text-sm font-semibold">
            {stream.userFlag} {stream.userName}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-300">
          <div className="flex items-center gap-1">
            <span>👁</span>
            <span>{stream.viewerCount}</span>
          </div>
          <div className="flex items-center gap-1 text-yellow-400 font-bold">
            <span>🪙</span>
            <span>{tokenBalance.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Video player */}
      <div className="flex-1 flex items-center justify-center bg-black relative">
        <video
          src={stream.playbackUrl}
          autoPlay
          playsInline
          controls
          className="w-full h-full object-contain"
        />

        {/* Floating gift animations */}
        {floatingGifts.map(g => (
          <div
            key={g.id}
            style={{
              position: "absolute",
              bottom: "80px",
              left: `${g.x}%`,
              fontSize: 40,
              pointerEvents: "none",
              animation: "giftFloat 2.2s ease-out forwards",
              zIndex: 50,
            }}
          >
            {g.emoji}
          </div>
        ))}

        {/* Unified activity feed overlay (gifts + chat) */}
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            width: "calc(100% - 24px)",
            maxHeight: 180,
            overflowY: "auto",
            overflowX: "hidden",
            display: "flex",
            flexDirection: "column",
            gap: 5,
            pointerEvents: "none",
            zIndex: 40,
            scrollbarWidth: "none",
          }}
        >
          {feedEntries.map(fe => (
            fe.type === "gift" ? (
              <div
                key={fe.id}
                style={{
                  display: "inline-flex",
                  alignSelf: "flex-start",
                  alignItems: "center",
                  gap: 6,
                  background: "rgba(0,0,0,0.6)",
                  backdropFilter: "blur(4px)",
                  borderRadius: 20,
                  padding: "4px 12px 4px 8px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#fff",
                  whiteSpace: "nowrap",
                  animation: "feedSlideIn 0.3s ease-out",
                }}
              >
                <span style={{ fontSize: 18 }}>{fe.giftEmoji}</span>
                <span style={{ color: "#FFD700" }}>{fe.senderName}</span>
                <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.8)" }}>a envoyé</span>
                <span style={{ color: "#E91E8C" }}>{fe.giftName}</span>
              </div>
            ) : (
              <div
                key={fe.id}
                style={{
                  display: "inline-flex",
                  alignSelf: "flex-start",
                  alignItems: "baseline",
                  gap: 5,
                  background: "rgba(0,0,0,0.55)",
                  backdropFilter: "blur(4px)",
                  borderRadius: 20,
                  padding: "5px 12px",
                  fontSize: 13,
                  color: "#fff",
                  animation: "feedSlideIn 0.3s ease-out",
                  maxWidth: "90%",
                }}
              >
                <span style={{ color: "#64B5F6", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>
                  {fe.userFlag ? `${fe.userFlag} ` : ""}{fe.senderName}
                </span>
                <span style={{ wordBreak: "break-word" }}>{fe.content}</span>
              </div>
            )
          ))}
          <div ref={feedBottomRef} />
        </div>
      </div>

      {/* Top Donors bar (shown if there are any) */}
      {topDonors.length > 0 && (
        <div
          style={{
            background: "rgba(0,0,0,0.75)",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            padding: "6px 16px",
            display: "flex",
            gap: 12,
            alignItems: "center",
            overflowX: "auto",
            zIndex: 10,
          }}
        >
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}>🏆 Top</span>
          {topDonors.map((d, i) => (
            <div key={d.senderId} style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
              <span style={{ fontSize: 12, color: i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : "#CD7F32" }}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{d.senderName || "Anonyme"}</span>
              <span style={{ fontSize: 11, color: "#FFD700" }}>🪙{d.totalTokens.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* Bottom action bar: chat input + gift button */}
      <div
        style={{
          background: "rgba(0,0,0,0.85)",
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          zIndex: 10,
        }}
      >
        {token ? (
          <>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") sendChat(); }}
              placeholder="Écrire un message…"
              maxLength={300}
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 22,
                padding: "9px 14px",
                fontSize: 14,
                color: "#fff",
                outline: "none",
              }}
            />
            <button
              onClick={sendChat}
              disabled={!chatInput.trim() || sendingChat}
              style={{
                background: chatInput.trim() ? "#1877F2" : "rgba(255,255,255,0.15)",
                border: "none",
                borderRadius: "50%",
                width: 38,
                height: 38,
                color: "#fff",
                fontSize: 17,
                cursor: chatInput.trim() ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "background 0.2s",
              }}
            >
              ➤
            </button>
          </>
        ) : (
          <div style={{ flex: 1, color: "rgba(255,255,255,0.5)", fontSize: 13, paddingLeft: 4 }}>
            Connecte-toi pour participer au chat
          </div>
        )}
        <button
          onClick={() => setShowGiftPicker(true)}
          style={{
            background: "linear-gradient(135deg, #E91E8C, #9C27B0)",
            border: "none",
            borderRadius: 24,
            padding: "9px 16px",
            color: "#fff",
            fontWeight: 800,
            fontSize: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 5,
            flexShrink: 0,
          }}
        >
          🎁
        </button>
      </div>

      {/* Gift Picker Modal */}
      {showGiftPicker && !isNaN(broadcasterId) && (
        <GiftPicker
          streamId={stream.id}
          receiverId={broadcasterId}
          receiverName={stream.userName}
          contextType="live"
          contextId={stream.id}
          tokenBalance={tokenBalance}
          onClose={() => setShowGiftPicker(false)}
          onSent={(gift, newBalance) => {
            setTokenBalance(newBalance);
            spawnFloat(gift.iconEmoji);
          }}
          onBuyTokens={() => {
            setShowGiftPicker(false);
            navigate("/wallet?tab=jetons");
          }}
        />
      )}

      <style>{`
        @keyframes giftFloat {
          0%   { transform: translateY(0) scale(1); opacity: 1; }
          80%  { transform: translateY(-160px) scale(1.3); opacity: 0.9; }
          100% { transform: translateY(-220px) scale(0.8); opacity: 0; }
        }
        @keyframes feedSlideIn {
          from { transform: translateX(-16px); opacity: 0; }
          to   { transform: translateX(0);     opacity: 1; }
        }
      `}</style>
    </div>
  );
}
