import { useEffect, useRef } from "react";
import { getBpToken } from "../lib/api";

/**
 * Viewer presence lifecycle hook.
 *
 * Wires the complete viewer heartbeat protocol for a live stream:
 *   - Calls POST /join on mount  → increments viewer_count, sets last_viewer_at
 *   - Calls POST /heartbeat every 30 s  → refreshes last_viewer_at
 *   - Calls DELETE /heartbeat on unmount → decrements viewer_count
 *
 * The broadcaster does NOT use this hook; it is strictly for audience members.
 * Used by the viewer playback page (follow-up task #7).
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
      // Use sendBeacon for reliability on page unload
      const leaveUrl = `/api/stream/live/${streamId}/heartbeat`;
      if (navigator.sendBeacon) {
        navigator.sendBeacon(leaveUrl);
      } else {
        fetch(leaveUrl, { method: "DELETE", headers, keepalive: true }).catch(() => {});
      }
    };

    // Join immediately on mount, then heartbeat every 30 s
    join().then(() => { joinedRef.current = true; });
    const interval = setInterval(heartbeat, 30_000);

    // Best-effort leave on tab close / navigation
    window.addEventListener("beforeunload", leave);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", leave);
      leave();
    };
  }, [streamId]);
}
