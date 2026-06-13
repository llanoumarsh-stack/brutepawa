import { useEffect, useRef } from "react";
import { getBpToken } from "../lib/api";

/**
 * Viewer presence lifecycle hook.
 *
 * Wires the complete viewer heartbeat protocol for a live stream:
 *   - POST /join on mount          → increments viewer_count, sets last_viewer_at
 *   - POST /heartbeat every 30 s   → refreshes last_viewer_at (presence signal)
 *   - DELETE /heartbeat on leave   → decrements viewer_count
 *
 * The broadcaster does NOT use this hook; it is strictly for audience members.
 * Consumed by LiveWatchPage (follow-up task #7 will expand the viewer experience).
 *
 * @param streamId  DB id of the live stream row (null/undefined → hook is dormant)
 */
export function useViewerPresence(streamId: number | null | undefined): void {
  const joinedRef = useRef(false);

  useEffect(() => {
    if (!streamId) return;

    const token = getBpToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const join = () =>
      fetch(`/api/stream/live/${streamId}/join`, { method: "POST", headers }).catch(() => {});

    const heartbeat = () =>
      fetch(`/api/stream/live/${streamId}/heartbeat`, { method: "POST", headers }).catch(() => {});

    const leave = () => {
      if (!joinedRef.current) return;
      joinedRef.current = false;
      // keepalive: true ensures the request completes even during page unload
      fetch(`/api/stream/live/${streamId}/heartbeat`, {
        method: "DELETE",
        headers,
        keepalive: true,
      }).catch(() => {});
    };

    // Join immediately on mount, then heartbeat every 30 s
    join().then(() => { joinedRef.current = true; });
    const interval = setInterval(heartbeat, 30_000);

    // Best-effort leave on tab close / navigation away
    window.addEventListener("beforeunload", leave);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", leave);
      leave();
    };
  }, [streamId]);
}
