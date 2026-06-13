import { Router } from "express";
import { db, usersTable, transactionsTable, productsTable, jobsTable, coursesTable } from "@workspace/db";
import { eq, ilike, desc, sql } from "drizzle-orm";
import { ListAdminUsersQueryParams, UpdateUserStatusParams, UpdateUserStatusBody } from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/requireAuth";

const router = Router();

router.get("/admin/stats", requireAdmin, async (req, res): Promise<void> => {
  const [totalUsers] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);
  const [totalTransactions] = await db.select({ count: sql<number>`count(*)::int` }).from(transactionsTable);
  const [totalProducts] = await db.select({ count: sql<number>`count(*)::int` }).from(productsTable);
  const [totalJobs] = await db.select({ count: sql<number>`count(*)::int` }).from(jobsTable);
  const [totalCourses] = await db.select({ count: sql<number>`count(*)::int` }).from(coursesTable);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [newUsersToday] = await db.select({ count: sql<number>`count(*)::int` })
    .from(usersTable).where(sql`created_at >= ${today}`);
  const [activeUsers] = await db.select({ count: sql<number>`count(*)::int` })
    .from(usersTable).where(eq(usersTable.status, "active"));

  const [revenue] = await db.select({ total: sql<number>`coalesce(sum(amount::numeric), 0)::float` })
    .from(transactionsTable).where(eq(transactionsTable.status, "completed"));

  res.json({
    totalUsers: totalUsers.count,
    totalTransactions: totalTransactions.count,
    totalProducts: totalProducts.count,
    totalJobs: totalJobs.count,
    totalCourses: totalCourses.count,
    totalRevenue: revenue.total ?? 0,
    newUsersToday: newUsersToday.count,
    activeUsers: activeUsers.count,
  });
});

router.get("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const params = ListAdminUsersQueryParams.safeParse(req.query);
  const page = params.success ? (params.data.page ?? 1) : 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  let users;
  if (params.success && params.data.search) {
    users = await db.select().from(usersTable)
      .where(ilike(usersTable.email, `%${params.data.search}%`))
      .orderBy(desc(usersTable.createdAt)).limit(limit).offset(offset);
  } else {
    users = await db.select().from(usersTable)
      .orderBy(desc(usersTable.createdAt)).limit(limit).offset(offset);
  }

  res.json(users.map(u => ({
    id: u.id, firstName: u.firstName, lastName: u.lastName,
    email: u.email, phone: u.phone, country: u.country,
    avatarUrl: u.avatarUrl, bio: u.bio,
    role: u.role, status: u.status, createdAt: u.createdAt,
  })));
});

router.patch("/admin/users/:id/status", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateUserStatusParams.safeParse({ id: Number(req.params.id) });
  const body = UpdateUserStatusBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const [user] = await db.update(usersTable)
    .set({ status: body.data.status })
    .where(eq(usersTable.id, params.data.id))
    .returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  res.json({
    id: user.id, firstName: user.firstName, lastName: user.lastName,
    email: user.email, phone: user.phone, country: user.country,
    avatarUrl: user.avatarUrl, bio: user.bio,
    role: user.role, status: user.status, createdAt: user.createdAt,
  });
});

export default router;
