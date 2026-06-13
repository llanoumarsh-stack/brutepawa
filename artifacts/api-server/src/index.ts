import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { liveStreamsTable } from "@workspace/db/schema";
import { eq, and, lt, or, sql } from "drizzle-orm";
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
    // • No viewer present for > 5 min — uses COALESCE(last_viewer_at, started_at)
    //   so that lives that never received a heartbeat are also caught after 5 min.
    // • Running longer than max_duration_minutes (default 60 min).
    const staleLives = await db
      .select({ id: liveStreamsTable.id, liveInputId: liveStreamsTable.liveInputId })
      .from(liveStreamsTable)
      .where(
        and(
          eq(liveStreamsTable.status, "live"),
          or(
            lt(
              sql`COALESCE(${liveStreamsTable.lastViewerAt}, ${liveStreamsTable.startedAt})`,
              fiveMinAgo,
            ),
            lt(liveStreamsTable.startedAt, sixtyMinAgo),
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
