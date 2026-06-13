import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  giftCatalogTable, giftTransactionsTable, walletsTable,
} from "@workspace/db/schema";
import { eq, and, desc, sql, gt } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

// ── Seed default catalog (idempotent) ────────────────────────────────────────
const DEFAULT_GIFTS = [
  { name: "Rose",     iconEmoji: "🌹", tokenCost: 10,   animationType: "float"  },
  { name: "Cœur",    iconEmoji: "❤️",  tokenCost: 50,   animationType: "pulse"  },
  { name: "Couronne", iconEmoji: "👑", tokenCost: 500,  animationType: "spin"   },
  { name: "Diamant",  iconEmoji: "💎", tokenCost: 2000, animationType: "burst"  },
];

export async function seedGiftCatalog() {
  const existing = await db.select({ cnt: sql<number>`count(*)::int` }).from(giftCatalogTable);
  if (existing[0].cnt > 0) return;
  await db.insert(giftCatalogTable).values(DEFAULT_GIFTS);
}

// ── In-memory rate limiter (max 10 gifts / min per user) ────────────────────
const giftRateLimitMap = new Map<number, number[]>();
const GIFT_RATE_LIMIT  = 10;
const GIFT_RATE_WINDOW = 60_000;

function checkGiftRateLimit(userId: number): boolean {
  const now   = Date.now();
  const times = (giftRateLimitMap.get(userId) ?? []).filter(t => now - t < GIFT_RATE_WINDOW);
  if (times.length >= GIFT_RATE_LIMIT) return false;
  giftRateLimitMap.set(userId, [...times, now]);
  return true;
}

// GET /api/gifts/catalog
router.get("/gifts/catalog", async (_req, res) => {
  const gifts = await db.select().from(giftCatalogTable).orderBy(giftCatalogTable.tokenCost);
  res.json(gifts);
});

// POST /api/gifts/send  (auth required, anti-self, rate-limited, atomic)
const SendBody = z.object({
  giftId:      z.number().int().positive(),
  receiverId:  z.number().int().positive(),
  contextType: z.enum(["video", "live"]),
  contextId:   z.number().int().positive(),
  senderName:  z.string().default(""),
});

router.post("/gifts/send", requireAuth, async (req, res) => {
  const parsed = SendBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Corps invalide" }); return; }
  const { giftId, receiverId, contextType, contextId, senderName } = parsed.data;
  const senderId = req.userId!;

  // Anti-self-gift
  if (senderId === receiverId) {
    res.status(400).json({ error: "Tu ne peux pas t'envoyer un cadeau à toi-même." });
    return;
  }

  // Rate limit
  if (!checkGiftRateLimit(senderId)) {
    res.status(429).json({ error: "Trop de cadeaux envoyés. Réessaie dans une minute." });
    return;
  }

  const [gift] = await db.select().from(giftCatalogTable).where(eq(giftCatalogTable.id, giftId));
  if (!gift) { res.status(404).json({ error: "Cadeau introuvable" }); return; }

  try {
    const record = await db.transaction(async (trx) => {
      // Ensure sender wallet exists
      let [sw] = await trx.select().from(walletsTable).where(eq(walletsTable.userId, senderId));
      if (!sw) [sw] = await trx.insert(walletsTable).values({ userId: senderId }).returning();

      if ((sw.tokenBalance ?? 0) < gift.tokenCost) throw new Error("INSUFFICIENT_TOKENS");

      // Debit sender
      await trx.update(walletsTable)
        .set({ tokenBalance: sql`${walletsTable.tokenBalance} - ${gift.tokenCost}` })
        .where(eq(walletsTable.userId, senderId));

      // Ensure receiver wallet exists and credit
      let [rw] = await trx.select().from(walletsTable).where(eq(walletsTable.userId, receiverId));
      if (!rw) [rw] = await trx.insert(walletsTable).values({ userId: receiverId }).returning();

      await trx.update(walletsTable)
        .set({ tokenBalance: sql`${walletsTable.tokenBalance} + ${gift.tokenCost}` })
        .where(eq(walletsTable.userId, receiverId));

      // Record gift transaction
      const [rec] = await trx.insert(giftTransactionsTable).values({
        senderId,
        senderName,
        receiverId,
        giftId:      gift.id,
        giftName:    gift.name,
        giftEmoji:   gift.iconEmoji,
        tokenAmount: gift.tokenCost,
        contextType,
        contextId,
      }).returning();
      return rec;
    });

    res.status(201).json(record);
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_TOKENS") {
      res.status(400).json({ error: "Solde de jetons insuffisant." });
      return;
    }
    req.log.error({ err }, "Gift send failed");
    res.status(500).json({ error: "Erreur lors de l'envoi du cadeau" });
  }
});

// GET /api/gifts/top-donors/:contextType/:contextId
router.get("/gifts/top-donors/:contextType/:contextId", async (req, res) => {
  const { contextType, contextId } = req.params;
  if (contextType !== "video" && contextType !== "live") {
    res.status(400).json({ error: "contextType must be video or live" }); return;
  }
  const ctxId = parseInt(contextId, 10);
  if (isNaN(ctxId)) { res.status(400).json({ error: "Invalid contextId" }); return; }

  const donors = await db
    .select({
      senderId:    giftTransactionsTable.senderId,
      senderName:  giftTransactionsTable.senderName,
      totalTokens: sql<number>`sum(${giftTransactionsTable.tokenAmount})::int`,
      giftsCount:  sql<number>`count(*)::int`,
    })
    .from(giftTransactionsTable)
    .where(and(
      eq(giftTransactionsTable.contextType, contextType as "video" | "live"),
      eq(giftTransactionsTable.contextId, ctxId),
    ))
    .groupBy(giftTransactionsTable.senderId, giftTransactionsTable.senderName)
    .orderBy(desc(sql`sum(${giftTransactionsTable.tokenAmount})`))
    .limit(10);

  res.json(donors);
});

// GET /api/gifts/received  — creator history (auth required)
router.get("/gifts/received", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const limit  = Math.min(parseInt(String(req.query.limit ?? "20"), 10) || 20, 100);
  const since  = req.query.since ? parseInt(String(req.query.since), 10) : 0;

  const gifts = await db
    .select()
    .from(giftTransactionsTable)
    .where(and(
      eq(giftTransactionsTable.receiverId, userId),
      since ? gt(giftTransactionsTable.id, since) : undefined,
    ))
    .orderBy(desc(giftTransactionsTable.createdAt))
    .limit(limit);

  res.json(gifts);
});

export default router;
