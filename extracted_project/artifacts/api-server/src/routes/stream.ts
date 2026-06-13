import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { liveStreamsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { createLiveInput, deleteLiveInput } from "../lib/cloudflare-stream";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

const StartBody = z.object({
  userName: z.string().min(1),
  userFlag: z.string().default(""),
});

router.post("/stream/live", requireAuth, async (req, res) => {
  const parsed = StartBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "userName is required" });
    return;
  }
  const { userName, userFlag } = parsed.data;
  const userId = String(req.userId!);

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
          userId,
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

  // Verify the stream belongs to the authenticated user
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

// Public — listing active streams is intentionally open
router.get("/stream/lives", async (_req, res) => {
  try {
    const lives = await db
      .select()
      .from(liveStreamsTable)
      .where(eq(liveStreamsTable.status, "live"))
      .orderBy(liveStreamsTable.startedAt);

    res.json(lives);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch live streams" });
  }
});

export default router;
