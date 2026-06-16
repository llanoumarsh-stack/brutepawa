---
name: Supabase-only DB rule
description: Always use the Supabase DB (APP_DATABASE_URL). Never use Replit managed PostgreSQL tools. Production migrations require explicit file path.
---

**Rule:** Use only `APP_DATABASE_URL` (Supabase pooler). Never call `executeSql()`, `checkDatabase()`, or `createDatabase()` from the Replit database skill — those connect to Replit's managed PostgreSQL, not to this project's Supabase.

**Why:** The project runs on an external Supabase PostgreSQL. The Replit managed DB is a different database entirely and would silently operate on the wrong data store.

**How to apply:**
- For dev migrations: `APP_DATABASE_URL="$APP_DATABASE_URL" node lib/db/apply-migration.mjs lib/db/drizzle/<migration>.sql`
- For production migrations: same command but pass the explicit production Supabase URL from `viewEnvVars({ environment: "production" })` — the shared `APP_DATABASE_URL` env var is the production Supabase connection string.
- The `apply-migration.mjs` default file is `0000_broken_dazzler.sql` — always pass the target migration file explicitly.
- Always verify column existence after migration before assuming success.
