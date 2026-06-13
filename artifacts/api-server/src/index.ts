import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { liveStreamsTable } from "@workspace/db/schema";
import { eq, and, lt, or, isNotNull, sql } from "drizzle-orm";
import { deleteLiveInput } from "./lib/cloudflare-stream";

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
    // Find lives to stop:
    // • last_viewer_at IS NOT NULL AND last_viewer_at < now-5min:
    //   A heartbeat has been received at some point, but not in the last 5 min.
    //   Both broadcaster keep-alive and real viewer heartbeats set last_viewer_at,
    //   so this correctly fires when everyone (broadcaster + viewers) has gone quiet.
    // • started_at < now - max_duration_minutes:
    //   Per-stream configurable max duration (default 60 min) stored in DB.
    const staleLives = await db
      .select({ id: liveStreamsTable.id, liveInputId: liveStreamsTable.liveInputId })
      .from(liveStreamsTable)
      .where(
        and(
          eq(liveStreamsTable.status, "live"),
          or(
            and(isNotNull(liveStreamsTable.lastViewerAt), lt(liveStreamsTable.lastViewerAt, fiveMinAgo)),
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

  // Start auto-stop cron: runs every 2 minutes
  setInterval(autoStopStaleLives, 2 * 60 * 1000);
  logger.info("Live auto-stop cron started (every 2 min)");
});
