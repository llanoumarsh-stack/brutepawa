import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { db, chatGroupsTable, chatGroupMembersTable, chatGroupMessagesTable, usersTable } from "@workspace/db";
import { eq, and, inArray, desc } from "drizzle-orm";
import { pushToUserDevice } from "./push";
import { assertChatGroupAdminOrOwner } from "../lib/groupAuth";
import { sql } from "drizzle-orm";

const router = Router();

// ── Audit helpers ────────────────────────────────────────────────────────────

/** Write an audit entry using an existing transaction/db handle. Throws on failure. */
async function writeAudit(tx: typeof db, groupId: number, actorId: number, event: string, targetId?: number, detail?: string) {
  await tx.execute(sql`
    INSERT INTO chat_group_audit_log (group_id, actor_id, target_id, event, detail)
    VALUES (${groupId}, ${actorId}, ${targetId ?? null}, ${event}::chat_group_audit_event, ${detail ?? null})
  `);
}

/** Best-effort audit for non-critical events — logs errors but never breaks the caller. */
async function logAudit(groupId: number, actorId: number, event: string, targetId?: number, detail?: string) {
  try {
    await writeAudit(db, groupId, actorId, event, targetId, detail);
  } catch (err) {
    console.error("[audit-log] Failed to write audit entry", { groupId, actorId, event, targetId, err });
  }
}

router.get("/chat-groups", requireAuth, async (req, res): Promise<void> => {
  const me = req.userId!;

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
  const me = req.userId!;
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

  // Log added members
  if (memberIds.length > 0) {
    await logAudit(group.id, me, "member_added", undefined, `${memberIds.length} membre(s) ajouté(s) à la création`);
  }

  res.status(201).json({ ...group, createdAt: group.createdAt.toISOString(), updatedAt: group.updatedAt.toISOString() });
});

router.get("/chat-groups/:id", requireAuth, async (req, res): Promise<void> => {
  const me = req.userId!;
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
  const me = req.userId!;
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
  const me = req.userId!;
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
  const senderName = user ? `${user.firstName} ${user.lastName}`.trim() : `#${me}`;

  // Push à tous les membres du groupe sauf l'expéditeur
  const [group] = await db.select({ name: chatGroupsTable.name })
    .from(chatGroupsTable).where(eq(chatGroupsTable.id, id));
  const allMembers = await db.select({ userId: chatGroupMembersTable.userId })
    .from(chatGroupMembersTable).where(eq(chatGroupMembersTable.groupId, id));
  const otherMembers = allMembers.filter(m => m.userId !== me);
  const raw = content.trim();
  const preview = raw.startsWith("__audio__")    ? "🎤 Message vocal"
    : raw.startsWith("__video__")    ? "📹 Message vidéo"
    : raw.startsWith("__image__")    ? "📷 Photo"
    : raw.startsWith("__doc__")      ? "📎 Document"
    : raw.startsWith("__location__") ? "📍 Localisation"
    : raw.length > 80 ? raw.slice(0, 80) + "…" : raw;
  otherMembers.forEach(m => {
    pushToUserDevice(m.userId, {
      title: `💬 ${group?.name ?? "Groupe"} — ${senderName}`,
      body: preview,
      tag: `chat-group-${id}`,
      data: { url: `/chat-groups/${id}` },
    }).catch(() => {});
  });

  res.status(201).json({
    ...msg,
    createdAt: msg.createdAt.toISOString(),
    senderName,
  });
});

router.patch("/chat-groups/:id", requireAuth, async (req, res): Promise<void> => {
  const me = req.userId!;
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const membership = await assertChatGroupAdminOrOwner(res, id, me);
  if (!membership) return;

  const { name, avatarUrl } = req.body as { name?: string; avatarUrl?: string };
  const updates: Record<string, unknown> = {};
  if (name) updates.name = name.trim();
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;

  const [updated] = await db.update(chatGroupsTable).set(updates)
    .where(eq(chatGroupsTable.id, id)).returning();

  const parts: string[] = [];
  if (name) parts.push(`nom → "${name.trim()}"`);
  if (avatarUrl !== undefined) parts.push("avatar mis à jour");
  await logAudit(id, me, "group_updated", undefined, parts.join(", ") || "paramètres mis à jour");

  res.json(updated);
});

router.delete("/chat-groups/:id/leave", requireAuth, async (req, res): Promise<void> => {
  const me = req.userId!;
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  // Verify the caller is actually a member before deleting or logging
  const [existing] = await db.select({ id: chatGroupMembersTable.id })
    .from(chatGroupMembersTable)
    .where(and(eq(chatGroupMembersTable.groupId, id), eq(chatGroupMembersTable.userId, me)));
  if (!existing) { res.status(404).json({ error: "Vous n'êtes pas membre de ce groupe" }); return; }

  await db.delete(chatGroupMembersTable)
    .where(and(eq(chatGroupMembersTable.groupId, id), eq(chatGroupMembersTable.userId, me)));

  // Best-effort log — leave is already committed above
  await logAudit(id, me, "member_left", me);

  res.json({ ok: true });
});

router.post("/chat-groups/:id/members", requireAuth, async (req, res): Promise<void> => {
  const me = req.userId!;
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const membership = await assertChatGroupAdminOrOwner(res, id, me);
  if (!membership) return;

  const { userIds } = req.body as { userIds: number[] };
  if (!Array.isArray(userIds) || userIds.length === 0) { res.status(400).json({ error: "userIds requis" }); return; }

  await db.insert(chatGroupMembersTable).values(
    userIds.map((uid: number) => ({ groupId: id, userId: uid, role: "member" as const }))
  ).onConflictDoNothing();

  await logAudit(id, me, "member_added", undefined, `${userIds.length} membre(s) ajouté(s)`);

  res.json({ ok: true });
});

// ── KICK / BAN a member ──────────────────────────────────────────────────────
router.delete("/chat-groups/:id/members/:userId", requireAuth, async (req, res): Promise<void> => {
  const me = req.userId!;
  const id = parseInt(req.params.id);
  const targetId = parseInt(req.params.userId);
  if (isNaN(id) || isNaN(targetId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [membership] = await db.select().from(chatGroupMembersTable)
    .where(and(eq(chatGroupMembersTable.groupId, id), eq(chatGroupMembersTable.userId, me)));
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    res.status(403).json({ error: "Accès refusé" }); return;
  }

  // Cannot kick an owner
  const [targetMembership] = await db.select().from(chatGroupMembersTable)
    .where(and(eq(chatGroupMembersTable.groupId, id), eq(chatGroupMembersTable.userId, targetId)));
  if (!targetMembership) { res.status(404).json({ error: "Membre introuvable" }); return; }
  if (targetMembership.role === "owner") { res.status(403).json({ error: "Impossible d'exclure le propriétaire" }); return; }

  // Atomic: kick + audit in a single transaction
  await db.transaction(async (tx) => {
    await tx.delete(chatGroupMembersTable)
      .where(and(eq(chatGroupMembersTable.groupId, id), eq(chatGroupMembersTable.userId, targetId)));
    await writeAudit(tx, id, me, "member_kicked", targetId);
  });

  res.json({ ok: true });
});

// ── CHANGE a member's role ───────────────────────────────────────────────────
router.patch("/chat-groups/:id/members/:userId/role", requireAuth, async (req, res): Promise<void> => {
  const me = req.userId!;
  const id = parseInt(req.params.id);
  const targetId = parseInt(req.params.userId);
  if (isNaN(id) || isNaN(targetId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [membership] = await db.select().from(chatGroupMembersTable)
    .where(and(eq(chatGroupMembersTable.groupId, id), eq(chatGroupMembersTable.userId, me)));
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    res.status(403).json({ error: "Accès refusé" }); return;
  }

  const { role } = req.body as { role: string };
  if (!["admin", "member"].includes(role)) { res.status(400).json({ error: "Rôle invalide (admin|member)" }); return; }

  // Only owner can promote to admin
  if (role === "admin" && membership.role !== "owner") {
    res.status(403).json({ error: "Seul le propriétaire peut promouvoir un admin" }); return;
  }

  const [targetMembership] = await db.select().from(chatGroupMembersTable)
    .where(and(eq(chatGroupMembersTable.groupId, id), eq(chatGroupMembersTable.userId, targetId)));
  if (!targetMembership) { res.status(404).json({ error: "Membre introuvable" }); return; }
  if (targetMembership.role === "owner") { res.status(403).json({ error: "Impossible de modifier le rôle du propriétaire" }); return; }

  const roleLabel = role === "admin" ? "Administrateur" : "Membre";

  // Atomic: role update + audit in a single transaction
  await db.transaction(async (tx) => {
    await tx.update(chatGroupMembersTable)
      .set({ role: role as "admin" | "member" })
      .where(and(eq(chatGroupMembersTable.groupId, id), eq(chatGroupMembersTable.userId, targetId)));
    await writeAudit(tx, id, me, "role_changed", targetId, `→ ${roleLabel}`);
  });

  res.json({ ok: true });
});

// ── AUDIT LOG ────────────────────────────────────────────────────────────────
router.get("/chat-groups/:id/audit-log", requireAuth, async (req, res): Promise<void> => {
  const me = req.userId!;
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [membership] = await db.select().from(chatGroupMembersTable)
    .where(and(eq(chatGroupMembersTable.groupId, id), eq(chatGroupMembersTable.userId, me)));
  if (!membership) { res.status(403).json({ error: "Accès refusé" }); return; }
  if (membership.role !== "owner" && membership.role !== "admin") {
    res.status(403).json({ error: "Réservé aux administrateurs" }); return;
  }

  const limit = Math.min(parseInt(String(req.query.limit ?? "100")), 200);
  const eventFilter = req.query.event as string | undefined;

  let query = sql`
    SELECT
      l.id, l.group_id, l.actor_id, l.target_id, l.event, l.detail, l.created_at,
      a.first_name AS actor_first, a.last_name AS actor_last, a.avatar_url AS actor_avatar,
      t.first_name AS target_first, t.last_name AS target_last, t.avatar_url AS target_avatar
    FROM chat_group_audit_log l
    LEFT JOIN users a ON a.id = l.actor_id
    LEFT JOIN users t ON t.id = l.target_id
    WHERE l.group_id = ${id}
    ${eventFilter ? sql`AND l.event = ${eventFilter}::chat_group_audit_event` : sql``}
    ORDER BY l.created_at DESC
    LIMIT ${limit}
  `;

  const rows = await db.execute(query) as unknown as { rows: Record<string, unknown>[] };
  const entries = (rows.rows ?? []).map((r: Record<string, unknown>) => ({
    id: r.id,
    groupId: r.group_id,
    actorId: r.actor_id,
    targetId: r.target_id ?? null,
    event: r.event,
    detail: r.detail ?? null,
    createdAt: r.created_at,
    actorName: r.actor_first && r.actor_last ? `${r.actor_first} ${r.actor_last}` : `#${r.actor_id}`,
    actorAvatar: r.actor_avatar ?? null,
    targetName: r.target_first && r.target_last ? `${r.target_first} ${r.target_last}` : (r.target_id ? `#${r.target_id}` : null),
    targetAvatar: r.target_avatar ?? null,
  }));

  res.json(entries);
});

export default router;
