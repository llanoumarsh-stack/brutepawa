import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

// GET /messaging/settings — get (or create) settings for current user
router.get("/messaging/settings", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  await db.execute(sql`
    INSERT INTO messaging_settings (user_id) VALUES (${userId})
    ON CONFLICT (user_id) DO NOTHING
  `);
  const result = await db.execute(sql`
    SELECT * FROM messaging_settings WHERE user_id = ${userId}
  `);
  const row = (result as any).rows?.[0] ?? result[0];
  res.json({
    onlineStatus: row?.online_status ?? true,
    notificationsEnabled: row?.notifications_enabled ?? true,
    readReceiptsEnabled: row?.read_receipts_enabled ?? true,
    whoCanMessage: row?.who_can_message ?? "everyone",
  });
});

// PATCH /messaging/settings — update settings
router.patch("/messaging/settings", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const { onlineStatus, notificationsEnabled, readReceiptsEnabled, whoCanMessage } = req.body;
  await db.execute(sql`
    INSERT INTO messaging_settings (user_id, online_status, notifications_enabled, read_receipts_enabled, who_can_message, updated_at)
    VALUES (
      ${userId},
      ${onlineStatus ?? true},
      ${notificationsEnabled ?? true},
      ${readReceiptsEnabled ?? true},
      ${whoCanMessage ?? "everyone"},
      now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      online_status = COALESCE(EXCLUDED.online_status, messaging_settings.online_status),
      notifications_enabled = COALESCE(EXCLUDED.notifications_enabled, messaging_settings.notifications_enabled),
      read_receipts_enabled = COALESCE(EXCLUDED.read_receipts_enabled, messaging_settings.read_receipts_enabled),
      who_can_message = COALESCE(EXCLUDED.who_can_message, messaging_settings.who_can_message),
      updated_at = now()
  `);
  res.json({ ok: true });
});

// GET /messaging/requests — get message requests (pending or spam)
router.get("/messaging/requests", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const status = req.query.status === "spam" ? "spam" : "pending";
  const result = await db.execute(sql`
    SELECT
      mr.id, mr.sender_id, mr.message_preview, mr.status, mr.created_at,
      u.first_name, u.last_name, u.avatar_url
    FROM message_requests mr
    JOIN users u ON u.id = mr.sender_id
    WHERE mr.receiver_id = ${userId} AND mr.status = ${status}
    ORDER BY mr.created_at DESC
    LIMIT 50
  `);
  const rows = (result as any).rows ?? result;
  res.json(rows.map((r: any) => ({
    id: r.id,
    senderId: r.sender_id,
    senderName: `${r.first_name} ${r.last_name}`.trim(),
    senderAvatarUrl: r.avatar_url ?? null,
    messagePreview: r.message_preview ?? "",
    status: r.status,
    createdAt: r.created_at,
  })));
});

// PATCH /messaging/requests/:id — accept / reject / spam
router.patch("/messaging/requests/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const id = Number(req.params.id);
  const { status } = req.body;
  if (!["accepted", "rejected", "spam"].includes(status)) {
    res.status(400).json({ error: "Invalid status" }); return;
  }
  await db.execute(sql`
    UPDATE message_requests SET status = ${status}
    WHERE id = ${id} AND receiver_id = ${userId}
  `);
  res.json({ ok: true });
});

export default router;
