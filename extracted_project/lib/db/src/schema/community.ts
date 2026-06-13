import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const groupsTable = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"),
  emoji: text("emoji").notNull().default("🏘️"),
  coverUrl: text("cover_url"),
  country: text("country"),
  privacy: text("privacy").notNull().default("public"),
  createdById: integer("created_by_id").notNull(),
  membersCount: integer("members_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const groupMembersTable = pgTable("group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull(),
  userId: integer("user_id").notNull(),
  role: text("role").notNull().default("member"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pagesTable = pgTable("pages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"),
  emoji: text("emoji").notNull().default("📢"),
  avatarUrl: text("avatar_url"),
  coverUrl: text("cover_url"),
  country: text("country"),
  verified: boolean("verified").notNull().default(false),
  createdById: integer("created_by_id").notNull(),
  followersCount: integer("followers_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const pageFollowersTable = pgTable("page_followers", {
  id: serial("id").primaryKey(),
  pageId: integer("page_id").notNull(),
  userId: integer("user_id").notNull(),
  followedAt: timestamp("followed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGroupSchema = createInsertSchema(groupsTable).omit({ id: true, createdAt: true, updatedAt: true, membersCount: true });
export const insertPageSchema = createInsertSchema(pagesTable).omit({ id: true, createdAt: true, updatedAt: true, followersCount: true });
export type Group = typeof groupsTable.$inferSelect;
export type GroupMember = typeof groupMembersTable.$inferSelect;
export type Page = typeof pagesTable.$inferSelect;
export type PageFollower = typeof pageFollowersTable.$inferSelect;
export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type InsertPage = z.infer<typeof insertPageSchema>;
