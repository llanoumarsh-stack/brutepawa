import { Router } from "express";
import webpush from "web-push";
import { requireAuth } from "../middlewares/requireAuth";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

function getVapidKeys() {
  const pub  = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (pub && priv) return { publicKey: pub, privateKey: priv };
  return null;
}

function initWebPush() {
  const keys = getVapidKeys();
  if (!keys) return false;
  webpush.setVapidDetails(
    "mailto:admin@brutepawa.com",
    keys.publicKey,
    keys.privateKey,
  );
  return true;
}

const webPushReady = initWebPush();

async function ensureTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL,
      endpoint    TEXT    NOT NULL UNIQUE,
      p256dh      TEXT    NOT NULL,
      auth        TEXT    NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

ensureTable().catch(() => {});

router.get("/push/vapid-public-key", (_req, res) => {
  const keys = getVapidKeys();
  if (!keys) {
    res.json({ key: null, enabled: false });
    return;
  }
  res.json({ key: keys.publicKey, enabled: true });
});

router.post("/push/subscribe", requireAuth, async (req, res): Promise<void> => {
  const { endpoint, keys } = req.body as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: "Invalid subscription payload" });
    return;
  }

  try {
    await db.execute(sql`
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
      VALUES (${req.userId!}, ${endpoint}, ${keys.p256dh}, ${keys.auth})
      ON CONFLICT (endpoint) DO UPDATE
        SET user_id = EXCLUDED.user_id,
            p256dh  = EXCLUDED.p256dh,
            auth    = EXCLUDED.auth
    `);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to save subscription" });
  }
});

router.delete("/push/unsubscribe", requireAuth, async (req, res): Promise<void> => {
  const { endpoint } = req.body as { endpoint?: string };
  try {
    await db.execute(sql`
      DELETE FROM push_subscriptions
      WHERE user_id = ${req.userId!}
      ${endpoint ? sql`AND endpoint = ${endpoint}` : sql``}
    `);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to remove subscription" });
  }
});

export async function pushToUserDevice(
  userId: number,
  payload: object,
): Promise<void> {
  if (!webPushReady) return;

  let subs: { endpoint: string; p256dh: string; auth: string }[] = [];
  try {
    const rows = await db.execute(sql`
      SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${userId}
    `);
    subs = (rows.rows ?? []) as typeof subs;
  } catch { return; }

  const body = JSON.stringify(payload);
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          await db.execute(sql`
            DELETE FROM push_subscriptions WHERE endpoint = ${sub.endpoint}
          `).catch(() => {});
        }
      }
    }),
  );
}

export default router;
