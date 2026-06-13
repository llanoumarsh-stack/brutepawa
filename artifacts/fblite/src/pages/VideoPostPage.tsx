import { useState, useEffect, useRef } from "react";
import { useNavigate } from "../router";
import { getBpToken } from "../lib/api";
import GiftPicker from "../components/GiftPicker";

interface PostData {
  id: number;
  authorId: number;
  authorName: string;
  content: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
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

interface Props {
  postId: number;
}

function isVideoUrl(url: string | null): boolean {
  if (!url) return false;
  return /\.(mp4|mov|webm|ogg|m4v)(\?.*)?$/i.test(url);
}

export default function VideoPostPage({ postId }: Props) {
  const navigate = useNavigate();
  const [post, setPost]                     = useState<PostData | null>(null);
  const [error, setError]                   = useState<string | null>(null);
  const [loading, setLoading]               = useState(true);
  const [tokenBalance, setTokenBalance]     = useState(0);
  const [topDonors, setTopDonors]           = useState<TopDonor[]>([]);
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [floatingGifts, setFloatingGifts]  = useState<FloatingGift[]>([]);
  const floatIdRef = useRef(0);

  useEffect(() => {
    const token = getBpToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`/api/posts/${postId}`, { headers })
      .then(r => r.json())
      .then((data: PostData & { error?: string }) => {
        if (data.error) { setError(data.error); return; }
        setPost(data);
      })
      .catch(() => setError("Impossible de charger cette publication."))
      .finally(() => setLoading(false));
  }, [postId]);

  useEffect(() => {
    const token = getBpToken();
    if (!token) return;
    fetch("/api/creator/wallet", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((d: { tokenBalance?: number }) => { if (d.tokenBalance !== undefined) setTokenBalance(d.tokenBalance); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const load = () => {
      fetch(`/api/gifts/top-donors/video/${postId}`)
        .then(r => r.json())
        .then((d: TopDonor[]) => setTopDonors(Array.isArray(d) ? d.slice(0, 5) : []))
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [postId]);

  const spawnFloat = (emoji: string) => {
    const id = ++floatIdRef.current;
    const x  = 15 + Math.random() * 60;
    setFloatingGifts(prev => [...prev, { id, emoji, x }]);
    setTimeout(() => setFloatingGifts(prev => prev.filter(g => g.id !== id)), 2200);
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--fb-text-secondary)" }}>
      <p>Chargement…</p>
    </div>
  );

  if (error || !post) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 16 }}>
      <p style={{ color: "var(--fb-text-secondary)" }}>{error ?? "Publication introuvable."}</p>
      <button onClick={() => navigate("/")} style={{ padding: "8px 20px", borderRadius: 20, background: "var(--fb-blue)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700 }}>
        Retour
      </button>
    </div>
  );

  const isVideo = isVideoUrl(post.imageUrl);

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", paddingBottom: 40, position: "relative" }}>
      {/* Back button */}
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--fb-divider)" }}>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--fb-text)", padding: 4, lineHeight: 1 }}>←</button>
        <span style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>{post.authorName}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#E91E8C", fontWeight: 800, fontSize: 14 }}>
          🪙 {tokenBalance.toLocaleString()} jetons
        </div>
      </div>

      {/* Media */}
      {post.imageUrl && (
        <div style={{ position: "relative", background: "#000", overflow: "hidden" }}>
          {isVideo ? (
            <video
              src={post.imageUrl}
              controls
              playsInline
              poster={post.thumbnailUrl ?? undefined}
              style={{ width: "100%", maxHeight: "60vh", objectFit: "contain", display: "block" }}
            />
          ) : (
            <img
              src={post.imageUrl}
              alt=""
              style={{ width: "100%", maxHeight: "60vh", objectFit: "contain", display: "block" }}
            />
          )}
          {/* Floating gift animations */}
          {floatingGifts.map(g => (
            <div key={g.id} style={{
              position: "absolute", bottom: 20, left: `${g.x}%`,
              fontSize: 40, pointerEvents: "none", zIndex: 10,
              animation: "vgiftFloat 2.2s ease-out forwards",
            }}>{g.emoji}</div>
          ))}
        </div>
      )}

      {/* Post content */}
      {post.content && (
        <div style={{ padding: "14px 16px", fontSize: 15, lineHeight: 1.6, borderBottom: "1px solid var(--fb-divider)" }}>
          {post.content}
        </div>
      )}

      {/* Top Donors */}
      {topDonors.length > 0 && (
        <div style={{ margin: "12px 16px 0", background: "linear-gradient(135deg, #1a1a2e, #16213e)", borderRadius: 14, padding: "14px 16px" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#FFD700", marginBottom: 10 }}>🏆 Top donateurs</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {topDonors.map((d, i) => (
              <div key={d.senderId} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
                <span style={{ flex: 1, fontWeight: 600, fontSize: 13, color: "#fff" }}>{d.senderName || "Anonyme"}</span>
                <span style={{ fontSize: 13, color: "#FFD700", fontWeight: 700 }}>🪙 {d.totalTokens.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gift button */}
      <div style={{ padding: "16px" }}>
        <button
          onClick={() => setShowGiftPicker(true)}
          style={{
            width: "100%",
            background: "linear-gradient(135deg, #E91E8C, #9C27B0)",
            border: "none", borderRadius: 14, padding: "14px 0",
            color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer",
          }}
        >
          🎁 Envoyer un cadeau à {post.authorName.split(" ")[0]}
        </button>
      </div>

      {/* GiftPicker Modal */}
      {showGiftPicker && (
        <GiftPicker
          streamId={postId}
          receiverId={post.authorId}
          receiverName={post.authorName}
          contextType="video"
          contextId={postId}
          tokenBalance={tokenBalance}
          onClose={() => setShowGiftPicker(false)}
          onSent={(gift, newBalance) => {
            setTokenBalance(newBalance);
            spawnFloat(gift.iconEmoji);
          }}
        />
      )}

      <style>{`
        @keyframes vgiftFloat {
          0%   { transform: translateY(0) scale(1); opacity: 1; }
          80%  { transform: translateY(-120px) scale(1.3); opacity: 0.9; }
          100% { transform: translateY(-180px) scale(0.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
