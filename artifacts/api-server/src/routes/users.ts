import { Router } from "express";
import { db, usersTable, friendRequestsTable, userBlocksTable, userReportsTable } from "@workspace/db";
import { eq, or, and, ne, ilike, sql } from "drizzle-orm";
import { UpdateMeBody, GetUserParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id, firstName: user.firstName, lastName: user.lastName,
    email: user.email, phone: user.phone, country: user.country,
    avatarUrl: user.avatarUrl, coverUrl: user.coverUrl, bio: user.bio,
    role: user.role, status: user.status, createdAt: user.createdAt,
  };
}

router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(formatUser(user));
});

router.patch("/users/me", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [user] = await db.update(usersTable)
    .set(parsed.data)
    .where(eq(usersTable.id, req.userId!))
    .returning();
  res.json(formatUser(user));
});

// Returns all users (except self) with their friendship status relative to the caller
// Supports ?q= for name search
router.get("/users", requireAuth, async (req, res): Promise<void> => {
  const me = req.userId!;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

  const baseCondition = ne(usersTable.id, me);
  const searchCondition = q
    ? or(
        ilike(sql`(${usersTable.firstName} || ' ' || ${usersTable.lastName})`, `%${q}%`),
        ilike(usersTable.firstName, `%${q}%`),
        ilike(usersTable.lastName, `%${q}%`)
      )
    : undefined;

  const whereClause = searchCondition ? and(baseCondition, searchCondition) : baseCondition;

  const [allUsers, allRequests] = await Promise.all([
    db.select({
      id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName,
      country: usersTable.country, avatarUrl: usersTable.avatarUrl, bio: usersTable.bio,
    }).from(usersTable).where(whereClause),

    db.select().from(friendRequestsTable).where(
      or(eq(friendRequestsTable.fromUserId, me), eq(friendRequestsTable.toUserId, me))
    ),
  ]);

  type RelStatus = "none" | "pending_sent" | "pending_received" | "friends";
  const result = allUsers.map(u => {
    const req = allRequests.find(r =>
      (r.fromUserId === me && r.toUserId === u.id) ||
      (r.toUserId === me && r.fromUserId === u.id)
    );
    let friendshipStatus: RelStatus = "none";
    let requestId: number | undefined;
    if (req) {
      requestId = req.id;
      if (req.status === "accepted") friendshipStatus = "friends";
      else if (req.fromUserId === me) friendshipStatus = "pending_sent";
      else friendshipStatus = "pending_received";
    }
    return { ...u, friendshipStatus, requestId };
  });

  res.json(result);
});

// Incoming pending friend requests (people who sent a request to me)
router.get("/users/me/friend-requests", requireAuth, async (req, res): Promise<void> => {
  const me = req.userId!;
  const rows = await db
    .select({
      requestId: friendRequestsTable.id,
      createdAt: friendRequestsTable.createdAt,
      fromUserId: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      country: usersTable.country,
      avatarUrl: usersTable.avatarUrl,
      bio: usersTable.bio,
    })
    .from(friendRequestsTable)
    .innerJoin(usersTable, eq(usersTable.id, friendRequestsTable.fromUserId))
    .where(and(eq(friendRequestsTable.toUserId, me), eq(friendRequestsTable.status, "pending")));

  res.json(rows.map(r => ({
    id: r.requestId,
    createdAt: r.createdAt,
    fromUser: {
      id: r.fromUserId, firstName: r.firstName, lastName: r.lastName,
      country: r.country, avatarUrl: r.avatarUrl, bio: r.bio,
    },
  })));
});

// Accepted friends list
router.get("/users/me/friends", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const rows = await db
    .select({
      id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName,
      country: usersTable.country, avatarUrl: usersTable.avatarUrl, bio: usersTable.bio,
    })
    .from(usersTable)
    .innerJoin(
      friendRequestsTable,
      or(
        and(eq(friendRequestsTable.fromUserId, userId), eq(friendRequestsTable.toUserId, usersTable.id)),
        and(eq(friendRequestsTable.toUserId, userId), eq(friendRequestsTable.fromUserId, usersTable.id))
      )
    )
    .where(eq(friendRequestsTable.status, "accepted"));
  res.json(rows);
});

// Send a friend request
router.post("/users/:id/friend-request", requireAuth, async (req, res): Promise<void> => {
  const me = req.userId!;
  const targetId = Number(req.params.id);
  if (isNaN(targetId) || targetId === me) { res.status(400).json({ error: "Invalid target" }); return; }

  // Check if already exists in either direction
  const [existing] = await db.select().from(friendRequestsTable).where(
    or(
      and(eq(friendRequestsTable.fromUserId, me), eq(friendRequestsTable.toUserId, targetId)),
      and(eq(friendRequestsTable.fromUserId, targetId), eq(friendRequestsTable.toUserId, me))
    )
  );
  if (existing) { res.status(409).json({ error: "Request already exists", requestId: existing.id, status: existing.status }); return; }

  const [row] = await db.insert(friendRequestsTable)
    .values({ fromUserId: me, toUserId: targetId, status: "pending" })
    .returning();
  res.status(201).json({ id: row.id, status: row.status });
});

// Accept a friend request (receiver only)
router.post("/friends/:id/accept", requireAuth, async (req, res): Promise<void> => {
  const me = req.userId!;
  const requestId = Number(req.params.id);
  if (isNaN(requestId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [row] = await db.select().from(friendRequestsTable).where(eq(friendRequestsTable.id, requestId));
  if (!row) { res.status(404).json({ error: "Request not found" }); return; }
  if (row.toUserId !== me) { res.status(403).json({ error: "Forbidden" }); return; }
  if (row.status !== "pending") { res.status(409).json({ error: "Already processed" }); return; }

  await db.update(friendRequestsTable).set({ status: "accepted" }).where(eq(friendRequestsTable.id, requestId));
  res.json({ ok: true });
});

// Reject or cancel a friend request
router.delete("/friends/:id", requireAuth, async (req, res): Promise<void> => {
  const me = req.userId!;
  const requestId = Number(req.params.id);
  if (isNaN(requestId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [row] = await db.select().from(friendRequestsTable).where(eq(friendRequestsTable.id, requestId));
  if (!row) { res.status(404).json({ error: "Request not found" }); return; }
  if (row.fromUserId !== me && row.toUserId !== me) { res.status(403).json({ error: "Forbidden" }); return; }

  await db.delete(friendRequestsTable).where(eq(friendRequestsTable.id, requestId));
  res.json({ ok: true });
});

router.get("/users/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(formatUser(user));
});

// Block a user
router.post("/users/:id/block", requireAuth, async (req, res): Promise<void> => {
  const me = req.userId!;
  const targetId = Number(req.params.id);
  if (isNaN(targetId) || targetId === me) { res.status(400).json({ error: "Invalid target" }); return; }

  await db.insert(userBlocksTable)
    .values({ blockerId: me, blockedId: targetId })
    .onConflictDoNothing();
  res.status(201).json({ ok: true });
});

// Unblock a user
router.delete("/users/:id/block", requireAuth, async (req, res): Promise<void> => {
  const me = req.userId!;
  const targetId = Number(req.params.id);
  if (isNaN(targetId)) { res.status(400).json({ error: "Invalid target" }); return; }

  await db.delete(userBlocksTable)
    .where(and(eq(userBlocksTable.blockerId, me), eq(userBlocksTable.blockedId, targetId)));
  res.json({ ok: true });
});

// Check if caller has blocked a user
router.get("/users/:id/block", requireAuth, async (req, res): Promise<void> => {
  const me = req.userId!;
  const targetId = Number(req.params.id);
  if (isNaN(targetId)) { res.status(400).json({ error: "Invalid target" }); return; }

  const [row] = await db.select().from(userBlocksTable)
    .where(and(eq(userBlocksTable.blockerId, me), eq(userBlocksTable.blockedId, targetId)));
  res.json({ blocked: !!row });
});

// Report a user
router.post("/users/:id/report", requireAuth, async (req, res): Promise<void> => {
  const me = req.userId!;
  const targetId = Number(req.params.id);
  if (isNaN(targetId) || targetId === me) { res.status(400).json({ error: "Invalid target" }); return; }

  const reason = typeof req.body.reason === "string" && req.body.reason.trim()
    ? req.body.reason.trim()
    : "Aucune raison précisée";

  await db.insert(userReportsTable).values({ reporterId: me, reportedId: targetId, reason });
  res.status(201).json({ ok: true });
});

export default router;
