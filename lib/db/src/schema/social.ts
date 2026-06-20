import { pgTable, text, serial, timestamp, integer, boolean, pgEnum, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id").notNull(),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  thumbnailUrl: text("thumbnail_url"),
  musicTrackName: text("music_track_name"),
  musicArtist: text("music_artist"),
  musicUrl: text("music_url"),
  musicArtworkUrl: text("music_artwork_url"),
  musicDuration: text("music_duration"),
  likesCount: integer("likes_count").notNull().default(0),
  commentsCount: integer("comments_count").notNull().default(0),
  isPinned: boolean("is_pinned").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  commentsDisabled: boolean("comments_disabled").notNull().default(false),
  audience: text("audience").notNull().default("public"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const postLikesTable = pgTable("post_likes", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  fromUserId: integer("from_user_id").notNull(),
  toUserId: integer("to_user_id").notNull(),
  content: text("content").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  isDelivered: boolean("is_delivered").notNull().default(false),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const liveStreamStatusEnum = pgEnum("live_stream_status", ["live", "ended"]);

export const liveMessagesTable = pgTable("live_messages", {
  id: serial("id").primaryKey(),
  streamId: integer("stream_id").notNull(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  userFlag: text("user_flag").notNull().default(""),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("live_messages_stream_idx").on(t.streamId)]);

export const liveStreamsTable = pgTable("live_streams", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  userFlag: text("user_flag").notNull().default(""),
  liveInputId: text("live_input_id").notNull().unique(),
  webRtcUrl: text("webrtc_url").notNull(),
  playbackUrl: text("playback_url").notNull(),
  status: liveStreamStatusEnum("status").notNull().default("live"),
  viewerCount: integer("viewer_count").notNull().default(0),
  lastViewerAt: timestamp("last_viewer_at", { withTimezone: true }),
  maxDurationMinutes: integer("max_duration_minutes").notNull().default(60),
  recordingEnabled: boolean("recording_enabled").notNull().default(false),
  replayUrl: text("replay_url"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
}, (t) => [index("live_streams_status_idx").on(t.status)]);

export const commentsTable = pgTable("comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  authorId: integer("author_id").notNull(),
  parentId: integer("parent_id"),
  content: text("content").notNull().default(""),
  audioUrl: text("audio_url"),
  audioDuration: integer("audio_duration"),
  likesCount: integer("likes_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const commentLikesTable = pgTable("comment_likes", {
  id: serial("id").primaryKey(),
  commentId: integer("comment_id").notNull(),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("comment_likes_pair_idx").on(t.commentId, t.userId)]);

export const followsTable = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: integer("follower_id").notNull(),
  followingId: integer("following_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("follows_pair_idx").on(t.followerId, t.followingId)]);

export const friendRequestsTable = pgTable("friend_requests", {
  id: serial("id").primaryKey(),
  fromUserId: integer("from_user_id").notNull(),
  toUserId: integer("to_user_id").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [uniqueIndex("friend_req_pair_idx").on(t.fromUserId, t.toUserId)]);

export const storiesTable = pgTable("stories", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id").notNull(),
  mediaUrl: text("media_url"),
  thumbnailUrl: text("thumbnail_url"),
  content: text("content"),
  bgColor: text("bg_color").notNull().default("#1877F2"),
  emoji: text("emoji"),
  musicTrackName: text("music_track_name"),
  musicArtist: text("music_artist"),
  musicUrl: text("music_url"),
  musicArtworkUrl: text("music_artwork_url"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  viewsCount: integer("views_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userBlocksTable = pgTable("user_blocks", {
  id: serial("id").primaryKey(),
  blockerId: integer("blocker_id").notNull(),
  blockedId: integer("blocked_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("user_blocks_pair_idx").on(t.blockerId, t.blockedId)]);

export const userReportsTable = pgTable("user_reports", {
  id: serial("id").primaryKey(),
  reporterId: integer("reporter_id").notNull(),
  reportedId: integer("reported_id").notNull(),
  reason: text("reason").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("user_reports_status_idx").on(t.status)]);

export const userHiddenProfilesTable = pgTable("user_hidden_profiles", {
  id: serial("id").primaryKey(),
  hiderId: integer("hider_id").notNull(),
  hiddenId: integer("hidden_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("user_hidden_profiles_pair_idx").on(t.hiderId, t.hiddenId)]);

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(),
  actorId: integer("actor_id"),
  actorName: text("actor_name"),
  actorAvatarUrl: text("actor_avatar_url"),
  action: text("action").notNull(),
  detail: text("detail"),
  thumbnailUrl: text("thumbnail_url"),
  messageCount: integer("message_count"),
  link: text("link"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  organizerId: integer("organizer_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }),
  coverUrl: text("cover_url"),
  isOnline: boolean("is_online").notNull().default(false),
  type: text("type").notNull().default("public"),
  goingCount: integer("going_count").notNull().default(0),
  interestedCount: integer("interested_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const eventRsvpsTable = pgTable("event_rsvps", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  userId: integer("user_id").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("event_rsvps_pair_idx").on(t.eventId, t.userId)]);

export const hiddenPostsTable = pgTable("hidden_posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  postId: integer("post_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("hidden_posts_pair_idx").on(t.userId, t.postId)]);

export const savedPostsTable = pgTable("saved_posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  postId: integer("post_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("saved_posts_pair_idx").on(t.userId, t.postId)]);

export const postReportsTable = pgTable("post_reports", {
  id: serial("id").primaryKey(),
  reporterId: integer("reporter_id").notNull(),
  postId: integer("post_id").notNull(),
  reason: text("reason").notNull().default("spam"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("post_reports_status_idx").on(t.status)]);

export const chatGroupTypeEnum = pgEnum("chat_group_type", ["group", "channel"]);
export const chatGroupMemberRoleEnum = pgEnum("chat_group_member_role", ["owner", "admin", "member"]);
export const chatGroupMsgTypeEnum = pgEnum("chat_group_msg_type", ["text", "system"]);

export const chatGroupsTable = pgTable("chat_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  type: chatGroupTypeEnum("type").notNull().default("group"),
  createdById: integer("created_by_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const chatGroupMembersTable = pgTable("chat_group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull(),
  userId: integer("user_id").notNull(),
  role: chatGroupMemberRoleEnum("role").notNull().default("member"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("chat_group_members_unique").on(t.groupId, t.userId)]);

export const chatGroupMessagesTable = pgTable("chat_group_messages", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull(),
  senderId: integer("sender_id").notNull(),
  content: text("content").notNull(),
  type: chatGroupMsgTypeEnum("type").notNull().default("text"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("chat_group_messages_group_idx").on(t.groupId)]);

export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true, createdAt: true, updatedAt: true, likesCount: true, commentsCount: true });
export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true });
export const insertCommentSchema = createInsertSchema(commentsTable).omit({ id: true, createdAt: true, updatedAt: true, likesCount: true });
export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export const insertStorySchema = createInsertSchema(storiesTable).omit({ id: true, createdAt: true, viewsCount: true });
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof postsTable.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;
export type LiveStream = typeof liveStreamsTable.$inferSelect;
export type LiveMessage = typeof liveMessagesTable.$inferSelect;
export type Comment = typeof commentsTable.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Follow = typeof followsTable.$inferSelect;
export type FriendRequest = typeof friendRequestsTable.$inferSelect;
export type Story = typeof storiesTable.$inferSelect;
export type InsertStory = z.infer<typeof insertStorySchema>;
export type Notification = typeof notificationsTable.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type UserBlock = typeof userBlocksTable.$inferSelect;
export type UserReport = typeof userReportsTable.$inferSelect;
