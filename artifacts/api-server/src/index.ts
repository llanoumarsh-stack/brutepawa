import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { liveStreamsTable } from "@workspace/db/schema";
import { eq, and, lt, or, isNotNull, isNull, sql } from "drizzle-orm";
import { deleteLiveInput } from "./lib/cloudflare-stream";
import { seedGiftCatalog } from "./routes/gifts";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

try {
  const rawDbUrl = process.env["APP_DATABASE_URL"] ?? process.env["DATABASE_URL"] ?? "";
  const dbUrl = new URL(rawDbUrl);
  dbUrl.searchParams.delete("channel_binding");
  logger.info({ host: dbUrl.hostname, db: dbUrl.pathname, pooler: dbUrl.hostname.includes("pooler") }, "DB config");
} catch {
  logger.warn("Could not parse database URL");
}

// Auto-stop live streams that have been running too long or have no viewers
async function autoStopStaleLives() {
  const now = new Date();
  const fiveMinAgo  = new Date(now.getTime() - 5  * 60 * 1000);
  const sixtyMinAgo = new Date(now.getTime() - 60 * 60 * 1000);

  try {
    // Find lives to stop — three independent conditions (any one is sufficient):
    // 1. Never had any viewer AND started > 5 min ago (no audience from the start).
    // 2. Had viewers, all left, and last heartbeat was > 5 min ago
    //    (viewer_count = 0 guards against premature stop if viewers are still present).
    // 3. Running longer than the per-row max_duration_minutes (default 60 min).
    // Note: broadcaster does NOT send heartbeats; last_viewer_at reflects viewer-only presence.
    const staleLives = await db
      .select({ id: liveStreamsTable.id, liveInputId: liveStreamsTable.liveInputId })
      .from(liveStreamsTable)
      .where(
        and(
          eq(liveStreamsTable.status, "live"),
          or(
            // Condition 1: never had a viewer and started > 5 min ago
            and(isNull(liveStreamsTable.lastViewerAt), lt(liveStreamsTable.startedAt, fiveMinAgo)),
            // Condition 2: had viewers but viewer_count reached 0 and no heartbeat in > 5 min
            and(
              eq(liveStreamsTable.viewerCount, 0),
              isNotNull(liveStreamsTable.lastViewerAt),
              lt(liveStreamsTable.lastViewerAt, fiveMinAgo),
            ),
            // Condition 3: max duration per DB field
            sql`${liveStreamsTable.startedAt} < NOW() - (${liveStreamsTable.maxDurationMinutes} * INTERVAL '1 minute')`,
          ),
        ),
      );

    for (const live of staleLives) {
      try {
        await deleteLiveInput(live.liveInputId);
      } catch (err) {
        logger.warn({ err, liveInputId: live.liveInputId }, "autoStop: CF deleteLiveInput failed (non-fatal)");
      }
      await db
        .update(liveStreamsTable)
        .set({ status: "ended", endedAt: now })
        .where(eq(liveStreamsTable.id, live.id));
      logger.info({ liveId: live.id }, "autoStop: ended stale live");
    }
  } catch (err) {
    logger.error({ err }, "autoStop: error running live cleanup");
  }
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Seed gift catalog (idempotent — only inserts if empty)
  seedGiftCatalog().catch(err => logger.warn({ err }, "seedGiftCatalog failed (non-fatal)"));

  // Start auto-stop cron: runs every 2 minutes
  setInterval(autoStopStaleLives, 2 * 60 * 1000);
  logger.info("Live auto-stop cron started (every 2 min)");
});
