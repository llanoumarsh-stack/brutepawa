import { useEffect, useState } from "react";
import { useNavigate } from "../router";
import { useViewerPresence } from "../hooks/useViewerPresence";
import { getBpToken } from "../lib/api";

interface LiveInfo {
  id: number;
  userName: string;
  userFlag: string;
  playbackUrl: string;
  viewerCount: number;
}

interface Props {
  streamId: number;
}

export default function LiveWatchPage({ streamId }: Props) {
  const navigate = useNavigate();
  const [stream, setStream] = useState<LiveInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Wire viewer presence: join on mount, heartbeat every 30 s, leave on unmount
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

  return (
    <div className="flex flex-col h-screen bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <button onClick={() => navigate("/")} className="text-white text-xl">✕</button>
        <div className="flex items-center gap-2">
          <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">LIVE</span>
          <span className="text-sm font-semibold">
            {stream.userFlag} {stream.userName}
          </span>
        </div>
        <div className="flex items-center gap-1 text-sm text-gray-300">
          <span>👁</span>
          <span>{stream.viewerCount}</span>
        </div>
      </div>

      {/* Video player */}
      <div className="flex-1 flex items-center justify-center bg-black">
        <video
          src={stream.playbackUrl}
          autoPlay
          playsInline
          controls
          className="w-full h-full object-contain"
        />
      </div>
    </div>
  );
}
