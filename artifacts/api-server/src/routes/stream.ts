import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { liveStreamsTable } from "@workspace/db/schema";
import { followsTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { createLiveInput, deleteLiveInput } from "../lib/cloudflare-stream";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

const StartBody = z.object({
  userName: z.string().min(1),
  userFlag: z.string().default(""),
});

const MIN_FOLLOWERS = 7000;

// Must be defined before any parameterised live routes to avoid prefix conflicts
router.get("/stream/live/eligibility", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const [{ cnt }] = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(followsTable)
    .where(eq(followsTable.followingId, userId));
  res.json({ canGoLive: cnt >= MIN_FOLLOWERS, followersCount: cnt });
});

router.post("/stream/live", requireAuth, async (req, res) => {
  const parsed = StartBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "userName is required" });
    return;
  }
  const { userName, userFlag } = parsed.data;
  const userId = req.userId!;

  // Gate: must have at least 7 000 followers
  const [{ cnt: followersCount }] = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(followsTable)
    .where(eq(followsTable.followingId, userId));

  if (followersCount < MIN_FOLLOWERS) {
    res.status(403).json({
      error: `Le live est accessible à partir de ${MIN_FOLLOWERS.toLocaleString("fr-FR")} abonnés. Tu en as ${followersCount.toLocaleString("fr-FR")}.`,
    });
    return;
  }

  let liveInput;
  try {
    liveInput = await createLiveInput({ userName });
  } catch (err) {
    req.log.error({ err }, "Failed to create Cloudflare live input");
    res.status(500).json({ error: "Failed to start live stream" });
    return;
  }

  let dbId: number | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, 800));
      const [row] = await db
        .insert(liveStreamsTable)
        .values({
          userId:      String(userId),
          userName,
          userFlag,
          liveInputId: liveInput.uid,
          webRtcUrl:   liveInput.webRTC.url,
          playbackUrl: liveInput.webRTCPlayback.url,
          status:      "live",
        })
        .returning();
      dbId = row.id;
      break;
    } catch (err) {
      req.log.warn({ err, attempt }, "DB insert for live stream failed (attempt %d)", attempt + 1);
    }
  }

  res.json({
    id:          dbId,
    liveInputId: liveInput.uid,
    webRtcUrl:   liveInput.webRTC.url,
    playbackUrl: liveInput.webRTCPlayback.url,
    startedAt:   new Date().toISOString(),
  });
});

router.delete("/stream/live/:liveInputId", requireAuth, async (req, res) => {
  const liveInputId = String(req.params.liveInputId);
  const userId = String(req.userId!);

  const [stream] = await db
    .select()
    .from(liveStreamsTable)
    .where(and(eq(liveStreamsTable.liveInputId, liveInputId), eq(liveStreamsTable.userId, userId)));

  if (!stream) {
    res.status(403).json({ error: "Forbidden: stream not found or not owned by you" });
    return;
  }

  try {
    await deleteLiveInput(liveInputId);
  } catch (err) {
    req.log.warn({ err }, "Failed to delete Cloudflare live input (non-fatal)");
  }
  try {
    await db
      .update(liveStreamsTable)
      .set({ status: "ended", endedAt: new Date() })
      .where(eq(liveStreamsTable.liveInputId, liveInputId));
  } catch (err) {
    req.log.warn({ err }, "Failed to update live stream status in DB (non-fatal)");
  }
  res.json({ ok: true });
});

// Fetch a single live stream by DB id (public — needed by viewer page)
router.get("/stream/live/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [stream] = await db
    .select({
      id:          liveStreamsTable.id,
      userName:    liveStreamsTable.userName,
      userFlag:    liveStreamsTable.userFlag,
      playbackUrl: liveStreamsTable.playbackUrl,
      viewerCount: liveStreamsTable.viewerCount,
      status:      liveStreamsTable.status,
    })
    .from(liveStreamsTable)
    .where(eq(liveStreamsTable.id, id));

  if (!stream) { res.status(404).json({ error: "Live not found" }); return; }
  res.json(stream);
});

// Public — listing active streams is intentionally open
router.get("/stream/lives", async (_req, res) => {
  try {
    const lives = await db
      .select()
      .from(liveStreamsTable)
      .where(eq(liveStreamsTable.status, "live"))
      .orderBy(liveStreamsTable.startedAt);
    res.json(lives);
  } catch {
    res.status(500).json({ error: "Failed to fetch live streams" });
  }
});

// Heartbeat — viewers call this every 30 s to refresh their presence timestamp.
// Only updates last_viewer_at; viewer_count is managed separately by join/leave.
router.post("/stream/live/:id/heartbeat", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [stream] = await db
    .select({ id: liveStreamsTable.id })
    .from(liveStreamsTable)
    .where(and(eq(liveStreamsTable.id, id), eq(liveStreamsTable.status, "live")));

  if (!stream) { res.status(404).json({ error: "Live not found or ended" }); return; }

  // Only refresh presence timestamp — do NOT increment viewer_count on every tick
  await db
    .update(liveStreamsTable)
    .set({ lastViewerAt: new Date() })
    .where(eq(liveStreamsTable.id, id));

  res.json({ ok: true });
});

// Called when a viewer joins: increments viewer_count by 1
router.post("/stream/live/:id/join", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [stream] = await db
    .select({ id: liveStreamsTable.id })
    .from(liveStreamsTable)
    .where(and(eq(liveStreamsTable.id, id), eq(liveStreamsTable.status, "live")));

  if (!stream) { res.status(404).json({ error: "Live not found or ended" }); return; }

  await db
    .update(liveStreamsTable)
    .set({
      viewerCount:  sql`${liveStreamsTable.viewerCount} + 1`,
      lastViewerAt: new Date(),
    })
    .where(eq(liveStreamsTable.id, id));

  res.json({ ok: true });
});

// Called when a viewer leaves: decrements viewer_count by 1 (floor 0)
router.delete("/stream/live/:id/heartbeat", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db
    .update(liveStreamsTable)
    .set({ viewerCount: sql`GREATEST(${liveStreamsTable.viewerCount} - 1, 0)` })
    .where(and(eq(liveStreamsTable.id, id), eq(liveStreamsTable.status, "live")));

  res.json({ ok: true });
});

export default router;
