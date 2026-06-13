import { Router } from "express";
import { db, groupsTable, groupMembersTable, groupPostsTable, usersTable } from "@workspace/db";
import { desc, eq, and, sql, ilike } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.get("/groups", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const search = typeof req.query.search === "string" && req.query.search.trim()
    ? req.query.search.trim()
    : null;
  const country = typeof req.query.country === "string" && req.query.country.trim()
    ? req.query.country.trim()
    : null;
  const category = typeof req.query.category === "string" && req.query.category.trim()
    ? req.query.category.trim()
    : null;

  const conditions: ReturnType<typeof eq>[] = [eq(groupsTable.privacy, "public")];
  if (search) conditions.push(sql`search_vector @@ websearch_to_tsquery('french', unaccent(${search}))` as unknown as ReturnType<typeof eq>);
  if (country) conditions.push(ilike(groupsTable.country, `%${country}%`));
  if (category) conditions.push(eq(groupsTable.category, category));

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
    .where(and(...conditions))
    .orderBy(desc(groupsTable.membersCount), desc(groupsTable.createdAt))
    .limit(search ? 10 : 50);

  if (rows.length === 0) {
    res.json([]);
    return;
  }

  const groupIds = rows.map(r => r.id);
  const memberships = await db
    .select({ groupId: groupMembersTable.groupId })
    .from(groupMembersTable)
    .where(
      and(
        eq(groupMembersTable.userId, userId),
        sql`${groupMembersTable.groupId} = ANY(${sql.raw(`ARRAY[${groupIds.join(",")}]::int[]`)})`,
      ),
    );

  const memberSet = new Set(memberships.map(m => m.groupId));

  res.json(rows.map(r => ({ ...r, isMember: memberSet.has(r.id) })));
});

router.get("/groups/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const groupId = parseInt(req.params.id, 10);
  if (isNaN(groupId)) {
    res.status(400).json({ error: "Invalid group id" });
    return;
  }

  const [group] = await db
    .select()
    .from(groupsTable)
    .where(eq(groupsTable.id, groupId))
    .limit(1);

  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  const [membership] = await db
    .select({ id: groupMembersTable.id, role: groupMembersTable.role })
    .from(groupMembersTable)
    .where(
      and(
        eq(groupMembersTable.groupId, groupId),
        eq(groupMembersTable.userId, userId),
      ),
    )
    .limit(1);

  const isMember = Boolean(membership);

  if (group.privacy === "private" && !isMember) {
    res.json({
      id: group.id,
      name: group.name,
      emoji: group.emoji,
      category: group.category,
      coverUrl: group.coverUrl,
      country: group.country,
      privacy: group.privacy,
      membersCount: group.membersCount,
      createdAt: group.createdAt,
      description: null,
      isMember: false,
      memberRole: null,
    });
    return;
  }

  res.json({ ...group, isMember, memberRole: membership?.role ?? null });
});

router.post("/groups/:id/join", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const groupId = parseInt(req.params.id, 10);
  if (isNaN(groupId)) {
    res.status(400).json({ error: "Invalid group id" });
    return;
  }

  const [group] = await db
    .select({ id: groupsTable.id, privacy: groupsTable.privacy })
    .from(groupsTable)
    .where(eq(groupsTable.id, groupId))
    .limit(1);

  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  if (group.privacy === "private") {
    res.status(403).json({ error: "Ce groupe est privé. Une invitation est requise pour le rejoindre." });
    return;
  }

  const [existing] = await db
    .select({ id: groupMembersTable.id })
    .from(groupMembersTable)
    .where(
      and(
        eq(groupMembersTable.groupId, groupId),
        eq(groupMembersTable.userId, userId),
      ),
    )
    .limit(1);

  if (existing) {
    res.json({ ok: true, alreadyMember: true });
    return;
  }

  await db.insert(groupMembersTable).values({ groupId, userId, role: "member" });
  await db
    .update(groupsTable)
    .set({ membersCount: sql`${groupsTable.membersCount} + 1` })
    .where(eq(groupsTable.id, groupId));

  res.json({ ok: true });
});

router.delete("/groups/:id/leave", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const groupId = parseInt(req.params.id, 10);
  if (isNaN(groupId)) {
    res.status(400).json({ error: "Invalid group id" });
    return;
  }

  const [existing] = await db
    .select({ id: groupMembersTable.id })
    .from(groupMembersTable)
    .where(
      and(
        eq(groupMembersTable.groupId, groupId),
        eq(groupMembersTable.userId, userId),
      ),
    )
    .limit(1);

  if (!existing) {
    res.json({ ok: true, wasNotMember: true });
    return;
  }

  await db
    .delete(groupMembersTable)
    .where(
      and(
        eq(groupMembersTable.groupId, groupId),
        eq(groupMembersTable.userId, userId),
      ),
    );

  await db
    .update(groupsTable)
    .set({ membersCount: sql`GREATEST(${groupsTable.membersCount} - 1, 0)` })
    .where(eq(groupsTable.id, groupId));

  res.json({ ok: true });
});

router.get("/groups/:id/posts", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const groupId = parseInt(req.params.id, 10);
  if (isNaN(groupId)) {
    res.status(400).json({ error: "Invalid group id" });
    return;
  }

  const [group] = await db
    .select({ id: groupsTable.id, privacy: groupsTable.privacy })
    .from(groupsTable)
    .where(eq(groupsTable.id, groupId))
    .limit(1);

  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  if (group.privacy === "private") {
    const [membership] = await db
      .select({ id: groupMembersTable.id })
      .from(groupMembersTable)
      .where(
        and(
          eq(groupMembersTable.groupId, groupId),
          eq(groupMembersTable.userId, userId),
        ),
      )
      .limit(1);
    if (!membership) {
      res.status(403).json({ error: "Accès réservé aux membres" });
      return;
    }
  }

  const posts = await db
    .select({
      id: groupPostsTable.id,
      content: groupPostsTable.content,
      imageUrl: groupPostsTable.imageUrl,
      createdAt: groupPostsTable.createdAt,
      authorId: usersTable.id,
      authorFirstName: usersTable.firstName,
      authorLastName: usersTable.lastName,
      authorAvatarUrl: usersTable.avatarUrl,
    })
    .from(groupPostsTable)
    .innerJoin(usersTable, eq(groupPostsTable.userId, usersTable.id))
    .where(eq(groupPostsTable.groupId, groupId))
    .orderBy(desc(groupPostsTable.createdAt))
    .limit(50);

  res.json(posts);
});

router.post("/groups/:id/posts", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const groupId = parseInt(req.params.id, 10);
  if (isNaN(groupId)) {
    res.status(400).json({ error: "Invalid group id" });
    return;
  }

  const [group] = await db
    .select({ id: groupsTable.id, privacy: groupsTable.privacy })
    .from(groupsTable)
    .where(eq(groupsTable.id, groupId))
    .limit(1);

  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  const [membership] = await db
    .select({ id: groupMembersTable.id })
    .from(groupMembersTable)
    .where(
      and(
        eq(groupMembersTable.groupId, groupId),
        eq(groupMembersTable.userId, userId),
      ),
    )
    .limit(1);

  if (!membership) {
    res.status(403).json({ error: "Vous devez être membre pour publier dans ce groupe" });
    return;
  }

  const { content, imageUrl } = req.body as { content?: string; imageUrl?: string };
  if (!content?.trim()) {
    res.status(400).json({ error: "Le contenu est requis" });
    return;
  }

  const [post] = await db
    .insert(groupPostsTable)
    .values({ groupId, userId, content: content.trim(), imageUrl: imageUrl ?? null })
    .returning();

  res.status(201).json(post);
});

export default router;
