import { Router } from "express";
import { db, postsTable, postLikesTable, messagesTable, usersTable, storiesTable } from "@workspace/db";
import { eq, and, or, desc, sql, gt, ilike } from "drizzle-orm";
import { CreatePostBody, GetPostParams, DeletePostParams, LikePostParams, LikePostBody, SendMessageBody, GetConversationParams, ListPostsQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { deleteObject, extractKeyFromUrl, ownerIdFromKey } from "../lib/r2";

const router = Router();

router.get("/posts", requireAuth, async (req, res): Promise<void> => {
  const params = ListPostsQueryParams.safeParse(req.query);
  const page = params.success ? (params.data.page ?? 1) : 1;
  const authorId = req.query.authorId ? Number(req.query.authorId) : null;
  const search = typeof req.query.search === "string" && req.query.search.trim() ? req.query.search.trim() : null;
  const limit = search ? 10 : 20;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (authorId) conditions.push(eq(postsTable.authorId, authorId));
  if (search) conditions.push(ilike(postsTable.content, `%${search}%`));

  const rows = await db
    .select({
      id: postsTable.id,
      authorId: postsTable.authorId,
      content: postsTable.content,
      imageUrl: postsTable.imageUrl,
      thumbnailUrl: postsTable.thumbnailUrl,
      likesCount: postsTable.likesCount,
      commentsCount: postsTable.commentsCount,
      createdAt: postsTable.createdAt,
      authorFirstName: usersTable.firstName,
      authorLastName: usersTable.lastName,
      authorAvatarUrl: usersTable.avatarUrl,
      authorCountry: usersTable.country,
    })
    .from(postsTable)
    .leftJoin(usersTable, eq(postsTable.authorId, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(postsTable.createdAt))
    .limit(limit).offset(offset);

  const myLikes = rows.length > 0
    ? await db.select({ postId: postLikesTable.postId }).from(postLikesTable)
        .where(and(
          eq(postLikesTable.userId, req.userId!),
          sql`${postLikesTable.postId} = ANY(ARRAY[${sql.join(rows.map(r => sql`${r.id}`), sql`, `)}]::int[])`,
        ))
    : [];
  const likedSet = new Set(myLikes.map(l => l.postId));

  res.json(rows.map(r => ({
    id: r.id,
    authorId: r.authorId,
    authorName: r.authorFirstName && r.authorLastName ? `${r.authorFirstName} ${r.authorLastName}` : "Utilisateur",
    authorAvatarUrl: r.authorAvatarUrl ?? null,
    authorCountry: r.authorCountry ?? "BJ",
    content: r.content,
    imageUrl: r.imageUrl,
    thumbnailUrl: r.thumbnailUrl ?? null,
    likesCount: r.likesCount,
    commentsCount: r.commentsCount,
    createdAt: r.createdAt,
    liked: likedSet.has(r.id),
  })));
});

router.post("/posts", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreatePostBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // thumbnailUrl is outside the generated schema — read directly from body
  const thumbnailUrl = typeof req.body.thumbnailUrl === "string" ? req.body.thumbnailUrl : null;

  const [post] = await db.insert(postsTable).values({
    authorId: req.userId!,
    content: parsed.data.content,
    imageUrl: parsed.data.imageUrl ?? null,
    thumbnailUrl,
  }).returning();
  res.status(201).json(post);
});

router.get("/posts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetPostParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [row] = await db.select({
    id:            postsTable.id,
    authorId:      postsTable.authorId,
    content:       postsTable.content,
    imageUrl:      postsTable.imageUrl,
    thumbnailUrl:  postsTable.thumbnailUrl,
    likesCount:    postsTable.likesCount,
    commentsCount: postsTable.commentsCount,
    createdAt:     postsTable.createdAt,
    authorFirstName: usersTable.firstName,
    authorLastName:  usersTable.lastName,
  }).from(postsTable)
    .leftJoin(usersTable, eq(postsTable.authorId, usersTable.id))
    .where(eq(postsTable.id, params.data.id));

  if (!row) { res.status(404).json({ error: "Post not found" }); return; }
  res.json({
    ...row,
    authorName: row.authorFirstName && row.authorLastName
      ? `${row.authorFirstName} ${row.authorLastName}`
      : "Utilisateur",
  });
});

router.delete("/posts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeletePostParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  // Fetch first to get media keys for R2 cleanup
  const [post] = await db.select({
    id: postsTable.id,
    imageUrl: postsTable.imageUrl,
    thumbnailUrl: postsTable.thumbnailUrl,
  }).from(postsTable)
    .where(and(eq(postsTable.id, params.data.id), eq(postsTable.authorId, req.userId!)));

  if (!post) { res.status(404).json({ error: "Post not found" }); return; }

  await db.delete(postsTable).where(eq(postsTable.id, params.data.id));

  // Best-effort R2 cleanup — only delete keys owned by the requesting user
  const r2Keys = [
    extractKeyFromUrl(post.imageUrl),
    extractKeyFromUrl(post.thumbnailUrl),
  ].filter((k): k is string => k !== null && ownerIdFromKey(k) === req.userId!);
  await Promise.all(r2Keys.map(k => deleteObject(k).catch(() => {})));

  res.sendStatus(204);
});

router.post("/posts/:id/like", requireAuth, async (req, res): Promise<void> => {
  const params = LikePostParams.safeParse({ id: Number(req.params.id) });
  const body = LikePostBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const [existing] = await db.select().from(postLikesTable)
    .where(and(eq(postLikesTable.postId, params.data.id), eq(postLikesTable.userId, req.userId!)));

  if (body.data.action === "like" && !existing) {
    await db.insert(postLikesTable).values({ postId: params.data.id, userId: req.userId! });
    await db.update(postsTable).set({ likesCount: sql`${postsTable.likesCount} + 1` }).where(eq(postsTable.id, params.data.id));
  } else if (body.data.action === "unlike" && existing) {
    await db.delete(postLikesTable).where(and(eq(postLikesTable.postId, params.data.id), eq(postLikesTable.userId, req.userId!)));
    await db.update(postsTable).set({ likesCount: sql`${postsTable.likesCount} - 1` }).where(eq(postsTable.id, params.data.id));
  }

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, params.data.id));
  res.json(post);
});

router.get("/messages", requireAuth, async (req, res): Promise<void> => {
  const msgs = await db.select().from(messagesTable)
    .where(or(eq(messagesTable.fromUserId, req.userId!), eq(messagesTable.toUserId, req.userId!)))
    .orderBy(desc(messagesTable.createdAt));

  const convoMap = new Map<number, typeof msgs[0]>();
  for (const m of msgs) {
    const otherId = m.fromUserId === req.userId ? m.toUserId : m.fromUserId;
    if (!convoMap.has(otherId)) convoMap.set(otherId, m);
  }

  const unreadCounts = await db.select({
    fromUserId: messagesTable.fromUserId,
    count: sql<number>`count(*)::int`,
  }).from(messagesTable)
    .where(and(eq(messagesTable.toUserId, req.userId!), eq(messagesTable.isRead, false)))
    .groupBy(messagesTable.fromUserId);

  const convos = Array.from(convoMap.entries()).map(([userId, msg]) => ({
    userId,
    lastMessage: msg.content,
    unreadCount: unreadCounts.find(u => u.fromUserId === userId)?.count ?? 0,
    updatedAt: msg.createdAt,
  }));

  res.json(convos);
});

router.post("/messages", requireAuth, async (req, res): Promise<void> => {
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [msg] = await db.insert(messagesTable).values({
    fromUserId: req.userId!,
    toUserId: parsed.data.toUserId,
    content: parsed.data.content,
  }).returning();
  res.status(201).json(msg);
});

router.get("/messages/:userId", requireAuth, async (req, res): Promise<void> => {
  const params = GetConversationParams.safeParse({ userId: Number(req.params.userId) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const msgs = await db.select().from(messagesTable)
    .where(or(
      and(eq(messagesTable.fromUserId, req.userId!), eq(messagesTable.toUserId, params.data.userId)),
      and(eq(messagesTable.fromUserId, params.data.userId), eq(messagesTable.toUserId, req.userId!)),
    ))
    .orderBy(messagesTable.createdAt);

  await db.update(messagesTable).set({ isRead: true })
    .where(and(eq(messagesTable.fromUserId, params.data.userId), eq(messagesTable.toUserId, req.userId!)));

  res.json(msgs);
});

// ─── Stories ────────────────────────────────────────────────────────────────

router.get("/stories", requireAuth, async (req, res): Promise<void> => {
  const now = new Date();
  const rows = await db
    .select({
      id: storiesTable.id,
      authorId: storiesTable.authorId,
      mediaUrl: storiesTable.mediaUrl,
      thumbnailUrl: storiesTable.thumbnailUrl,
      content: storiesTable.content,
      bgColor: storiesTable.bgColor,
      emoji: storiesTable.emoji,
      expiresAt: storiesTable.expiresAt,
      viewsCount: storiesTable.viewsCount,
      createdAt: storiesTable.createdAt,
      authorFirstName: usersTable.firstName,
      authorLastName: usersTable.lastName,
      authorAvatarUrl: usersTable.avatarUrl,
      authorCountry: usersTable.country,
    })
    .from(storiesTable)
    .leftJoin(usersTable, eq(storiesTable.authorId, usersTable.id))
    .where(gt(storiesTable.expiresAt, now))
    .orderBy(desc(storiesTable.createdAt));

  const authorMap = new Map<number, {
    authorId: number;
    authorName: string;
    authorAvatarUrl: string | null;
    authorCountry: string;
    stories: typeof rows;
  }>();

  for (const r of rows) {
    if (!authorMap.has(r.authorId)) {
      authorMap.set(r.authorId, {
        authorId: r.authorId,
        authorName: r.authorFirstName && r.authorLastName
          ? `${r.authorFirstName} ${r.authorLastName}` : "Utilisateur",
        authorAvatarUrl: r.authorAvatarUrl ?? null,
        authorCountry: r.authorCountry ?? "BJ",
        stories: [],
      });
    }
    authorMap.get(r.authorId)!.stories.push(r);
  }

  res.json(Array.from(authorMap.values()).map(a => ({
    authorId: a.authorId,
    authorName: a.authorName,
    authorAvatarUrl: a.authorAvatarUrl,
    authorCountry: a.authorCountry,
    storiesCount: a.stories.length,
    stories: a.stories.map(s => ({
      id: s.id,
      mediaUrl: s.mediaUrl,
      thumbnailUrl: s.thumbnailUrl ?? null,
      content: s.content,
      bgColor: s.bgColor,
      emoji: s.emoji,
      expiresAt: s.expiresAt,
      viewsCount: s.viewsCount,
      createdAt: s.createdAt,
    })),
    latestStoryAt: a.stories[0]?.createdAt ?? null,
  })));
});

router.post("/stories", requireAuth, async (req, res): Promise<void> => {
  const { mediaUrl, thumbnailUrl, content, bgColor, emoji } = req.body as {
    mediaUrl?: string; thumbnailUrl?: string; content?: string; bgColor?: string; emoji?: string;
  };

  if (!mediaUrl && !content) {
    res.status(400).json({ error: "mediaUrl or content required" }); return;
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [story] = await db.insert(storiesTable).values({
    authorId: req.userId!,
    mediaUrl: mediaUrl ?? null,
    thumbnailUrl: thumbnailUrl ?? null,
    content: content ?? null,
    bgColor: bgColor ?? "#1877F2",
    emoji: emoji ?? null,
    expiresAt,
  }).returning();

  res.status(201).json(story);
});

router.post("/stories/:id/view", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.update(storiesTable)
    .set({ viewsCount: sql`${storiesTable.viewsCount} + 1` })
    .where(eq(storiesTable.id, id));
  res.sendStatus(204);
});

router.delete("/stories/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [story] = await db.select({
    id: storiesTable.id,
    mediaUrl: storiesTable.mediaUrl,
    thumbnailUrl: storiesTable.thumbnailUrl,
  }).from(storiesTable)
    .where(and(eq(storiesTable.id, id), eq(storiesTable.authorId, req.userId!)));

  if (!story) { res.status(404).json({ error: "Story not found" }); return; }

  await db.delete(storiesTable).where(eq(storiesTable.id, id));

  const r2Keys = [
    extractKeyFromUrl(story.mediaUrl),
    extractKeyFromUrl(story.thumbnailUrl),
  ].filter((k): k is string => k !== null && ownerIdFromKey(k) === req.userId!);
  await Promise.all(r2Keys.map(k => deleteObject(k).catch(() => {})));

  res.sendStatus(204);
});

export default router;
