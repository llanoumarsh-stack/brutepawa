import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { db, chatGroupsTable, chatGroupMembersTable, chatGroupMessagesTable, usersTable } from "@workspace/db";
import { eq, and, inArray, desc } from "drizzle-orm";

const router = Router();

router.get("/chat-groups", requireAuth, async (req, res): Promise<void> => {
  const me = (req as { user?: { id: number } }).user!.id;

  const memberships = await db.select({
    groupId: chatGroupMembersTable.groupId,
    role: chatGroupMembersTable.role,
  }).from(chatGroupMembersTable).where(eq(chatGroupMembersTable.userId, me));

  if (memberships.length === 0) { res.json([]); return; }

  const groupIds = memberships.map(m => m.groupId);
  const groups = await db.select().from(chatGroupsTable)
    .where(inArray(chatGroupsTable.id, groupIds));

  const memberRows = await db.select({ groupId: chatGroupMembersTable.groupId })
    .from(chatGroupMembersTable).where(inArray(chatGroupMembersTable.groupId, groupIds));

  const lastMsgs = await Promise.all(groupIds.map(async gid => {
    const [msg] = await db.select().from(chatGroupMessagesTable)
      .where(eq(chatGroupMessagesTable.groupId, gid))
      .orderBy(desc(chatGroupMessagesTable.createdAt)).limit(1);
    return { groupId: gid, msg };
  }));

  const memberCountMap: Record<number, number> = {};
  memberRows.forEach(m => { memberCountMap[m.groupId] = (memberCountMap[m.groupId] ?? 0) + 1; });
  const lastMsgMap: Record<number, typeof lastMsgs[0]> = {};
  lastMsgs.forEach(l => { lastMsgMap[l.groupId] = l; });
  const roleMap: Record<number, string> = {};
  memberships.forEach(m => { roleMap[m.groupId] = m.role; });

  const result = groups.map(g => ({
    id: g.id,
    name: g.name,
    avatarUrl: g.avatarUrl,
    type: g.type,
    membersCount: memberCountMap[g.id] ?? 0,
    lastMessage: lastMsgMap[g.id]?.msg?.content ?? "",
    lastMessageAt: lastMsgMap[g.id]?.msg?.createdAt?.toISOString() ?? g.updatedAt.toISOString(),
    unread: 0,
    role: roleMap[g.id] ?? "member",
    updatedAt: g.updatedAt.toISOString(),
  }));

  result.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  res.json(result);
});

router.post("/chat-groups", requireAuth, async (req, res): Promise<void> => {
  const me = (req as { user?: { id: number } }).user!.id;
  const { name, type = "group", memberIds = [] } = req.body as { name: string; type?: string; memberIds?: number[] };

  if (!name || name.trim().length < 1) { res.status(400).json({ error: "Nom requis" }); return; }

  const [group] = await db.insert(chatGroupsTable).values({
    name: name.trim(),
    type: type === "channel" ? "channel" : "group",
    createdById: me,
  }).returning();

  const allMemberIds = [me, ...memberIds.filter((id: number) => id !== me)];
  await db.insert(chatGroupMembersTable).values(
    allMemberIds.map((uid: number) => ({
      groupId: group.id,
      userId: uid,
      role: uid === me ? "owner" as const : "member" as const,
    }))
  ).onConflictDoNothing();

  await db.insert(chatGroupMessagesTable).values({
    groupId: group.id,
    senderId: me,
    content: `Groupe "${group.name}" créé`,
    type: "system",
  });

  res.status(201).json({ ...group, createdAt: group.createdAt.toISOString(), updatedAt: group.updatedAt.toISOString() });
});

router.get("/chat-groups/:id", requireAuth, async (req, res): Promise<void> => {
  const me = (req as { user?: { id: number } }).user!.id;
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [group] = await db.select().from(chatGroupsTable).where(eq(chatGroupsTable.id, id));
  if (!group) { res.status(404).json({ error: "Groupe introuvable" }); return; }

  const [membership] = await db.select().from(chatGroupMembersTable)
    .where(and(eq(chatGroupMembersTable.groupId, id), eq(chatGroupMembersTable.userId, me)));
  if (!membership) { res.status(403).json({ error: "Accès refusé" }); return; }

  const members = await db.select({
    userId: chatGroupMembersTable.userId,
    role: chatGroupMembersTable.role,
    firstName: usersTable.firstName,
    lastName: usersTable.lastName,
    avatarUrl: usersTable.avatarUrl,
  }).from(chatGroupMembersTable)
    .leftJoin(usersTable, eq(chatGroupMembersTable.userId, usersTable.id))
    .where(eq(chatGroupMembersTable.groupId, id));

  res.json({
    id: group.id, name: group.name, avatarUrl: group.avatarUrl, type: group.type,
    createdById: group.createdById,
    createdAt: group.createdAt.toISOString(), updatedAt: group.updatedAt.toISOString(),
    role: membership.role,
    members,
  });
});

router.get("/chat-groups/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const me = (req as { user?: { id: number } }).user!.id;
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [membership] = await db.select().from(chatGroupMembersTable)
    .where(and(eq(chatGroupMembersTable.groupId, id), eq(chatGroupMembersTable.userId, me)));
  if (!membership) { res.status(403).json({ error: "Accès refusé" }); return; }

  const msgs = await db.select({
    id: chatGroupMessagesTable.id,
    groupId: chatGroupMessagesTable.groupId,
    senderId: chatGroupMessagesTable.senderId,
    content: chatGroupMessagesTable.content,
    type: chatGroupMessagesTable.type,
    createdAt: chatGroupMessagesTable.createdAt,
    firstName: usersTable.firstName,
    lastName: usersTable.lastName,
  }).from(chatGroupMessagesTable)
    .leftJoin(usersTable, eq(chatGroupMessagesTable.senderId, usersTable.id))
    .where(eq(chatGroupMessagesTable.groupId, id))
    .orderBy(chatGroupMessagesTable.createdAt)
    .limit(200);

  res.json(msgs.map(m => ({
    id: m.id, groupId: m.groupId, senderId: m.senderId,
    content: m.content, type: m.type,
    createdAt: m.createdAt.toISOString(),
    senderName: m.firstName && m.lastName ? `${m.firstName} ${m.lastName}` : `#${m.senderId}`,
  })));
});

router.post("/chat-groups/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const me = (req as { user?: { id: number } }).user!.id;
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { content } = req.body as { content: string };
  if (!content || content.trim().length === 0) { res.status(400).json({ error: "Contenu requis" }); return; }

  const [membership] = await db.select().from(chatGroupMembersTable)
    .where(and(eq(chatGroupMembersTable.groupId, id), eq(chatGroupMembersTable.userId, me)));
  if (!membership) { res.status(403).json({ error: "Accès refusé" }); return; }

  const [msg] = await db.insert(chatGroupMessagesTable).values({
    groupId: id, senderId: me, content: content.trim(), type: "text",
  }).returning();

  const [user] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
    .from(usersTable).where(eq(usersTable.id, me));

  res.status(201).json({
    ...msg,
    createdAt: msg.createdAt.toISOString(),
    senderName: user ? `${user.firstName} ${user.lastName}` : `#${me}`,
  });
});

router.patch("/chat-groups/:id", requireAuth, async (req, res): Promise<void> => {
  const me = (req as { user?: { id: number } }).user!.id;
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [membership] = await db.select().from(chatGroupMembersTable)
    .where(and(eq(chatGroupMembersTable.groupId, id), eq(chatGroupMembersTable.userId, me)));
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    res.status(403).json({ error: "Accès refusé" }); return;
  }

  const { name, avatarUrl } = req.body as { name?: string; avatarUrl?: string };
  const updates: Record<string, unknown> = {};
  if (name) updates.name = name.trim();
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;

  const [updated] = await db.update(chatGroupsTable).set(updates)
    .where(eq(chatGroupsTable.id, id)).returning();
  res.json(updated);
});

router.delete("/chat-groups/:id/leave", requireAuth, async (req, res): Promise<void> => {
  const me = (req as { user?: { id: number } }).user!.id;
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(chatGroupMembersTable)
    .where(and(eq(chatGroupMembersTable.groupId, id), eq(chatGroupMembersTable.userId, me)));
  res.json({ ok: true });
});

router.post("/chat-groups/:id/members", requireAuth, async (req, res): Promise<void> => {
  const me = (req as { user?: { id: number } }).user!.id;
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [membership] = await db.select().from(chatGroupMembersTable)
    .where(and(eq(chatGroupMembersTable.groupId, id), eq(chatGroupMembersTable.userId, me)));
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    res.status(403).json({ error: "Accès refusé" }); return;
  }

  const { userIds } = req.body as { userIds: number[] };
  if (!Array.isArray(userIds) || userIds.length === 0) { res.status(400).json({ error: "userIds requis" }); return; }

  await db.insert(chatGroupMembersTable).values(
    userIds.map((uid: number) => ({ groupId: id, userId: uid, role: "member" as const }))
  ).onConflictDoNothing();

  res.json({ ok: true });
});

export default router;
