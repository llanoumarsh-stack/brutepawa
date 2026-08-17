---
name: Drizzle migration workflow
description: How to add schema migrations so review/deploy accept them
---
Rule: never hand-write SQL files in lib/db/drizzle/. Edit the schema, then run `pnpm exec drizzle-kit generate --config ./drizzle.config.ts --name <name>` in lib/db so the journal + snapshot are created; apply with `pnpm run apply-all-migrations` (APP_DATABASE_URL set).
**Why:** a completion review rejected a hand-written migration lacking journal/snapshot entries; the post-merge runner applies every SQL file each run and now exits 1 on any non-"already exists" error, so files must be drizzle-generated and idempotency comes from the runner's rewrites (IF NOT EXISTS for tables/indexes/columns, DO $$ for enums).
**How to apply:** any lib/db schema change; dev and prod share the same Supabase DB, so one apply covers both.
