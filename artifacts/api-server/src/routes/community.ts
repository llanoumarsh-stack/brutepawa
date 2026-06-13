import { Router } from "express";
import { db, groupsTable } from "@workspace/db";
import { ilike, or, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.get("/groups", requireAuth, async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" && req.query.search.trim()
    ? req.query.search.trim()
    : null;

  const rows = await db
    .select({
      id: groupsTable.id,
      name: groupsTable.name,
      description: groupsTable.description,
      category: groupsTable.category,
      emoji: groupsTable.emoji,
      coverUrl: groupsTable.coverUrl,
      country: groupsTable.country,
      privacy: groupsTable.privacy,
      membersCount: groupsTable.membersCount,
      createdAt: groupsTable.createdAt,
    })
    .from(groupsTable)
    .where(
      search
        ? or(
            ilike(groupsTable.name, `%${search}%`),
            ilike(groupsTable.description, `%${search}%`),
            ilike(groupsTable.category, `%${search}%`),
          )
        : undefined,
    )
    .orderBy(desc(groupsTable.membersCount), desc(groupsTable.createdAt))
    .limit(search ? 10 : 50);

  res.json(rows);
});

export default router;
