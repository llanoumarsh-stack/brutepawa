# BrutePawa

Réseau social moderne avec marketplace, messagerie, live streaming et système de cadeaux/tokens.

## Run & Operate

- `artifacts/fblite: web` workflow — main React frontend (port 3000, served at `/`)
- `artifacts/fblite: api-server` workflow — Express API server (port 8080, proxy at `/api`)
- `artifacts/creator-pro: web` workflow — Creator Pro frontend (port 19530, served at `/creator-pro/`)
- `artifacts/brute-pawa-mobile: expo` workflow — Expo mobile app (port 22245, served at `/mobile/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run typecheck:libs` — rebuild lib declarations (run after changing lib/db or lib/api-spec)
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes to Supabase (dev only)

## Stack

- pnpm workspaces, Node.js 20, TypeScript 5.9
- **Main frontend (fblite)**: React 19 + Vite, wouter, TanStack Query, Tailwind CSS
- **Mobile (brute-pawa-mobile)**: Expo / React Native
- **Creator Pro**: React 19 + Vite
- **API**: Express 5, Zod validation, JWT auth (jsonwebtoken + bcryptjs)
- **DB**: PostgreSQL (Supabase) + Drizzle ORM
- **Storage**: Cloudflare R2 (object storage)
- **Video**: Cloudflare Stream (live streaming)
- **Push notifications**: Web Push (VAPID)

## Where things live

- `lib/db/src/schema/` — Drizzle ORM schemas
- `lib/api-zod/` — Zod schemas
- `lib/api-client-react/` — React Query hooks
- `lib/api-spec/` — OpenAPI spec
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/` — Auth, R2, Cloudflare Stream helpers
- `artifacts/fblite/src/pages/` — Main app React pages
- `artifacts/fblite/src/components/` — Shared UI components
- `artifacts/brute-pawa-mobile/app/` — Expo screens and navigation

## Required Environment Variables

All already set in Replit Secrets / env:

- `APP_DATABASE_URL` — Supabase Postgres connection string (pooler)
- `SESSION_SECRET` — JWT signing secret
- `CF_ACCOUNT_ID`, `CF_STREAM_TOKEN` — Cloudflare Stream for live video
- `CF_TURN_API_TOKEN`, `CF_TURN_KEY_ID` — Cloudflare TURN for WebRTC
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`, `R2_ACCOUNT_ID` — Cloudflare R2 storage
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — Web push notifications

## Architecture decisions

- JWT auth stored in cookies/localStorage; server signs with SESSION_SECRET
- Token system: `tokenBalance` on `walletsTable`, 1 token = 5 XOF, min withdrawal = 1000 tokens
- Live streaming: SSE at `GET /api/stream/live/:id/events` polls DB every 2s
- MoneyFusion webhook uses HMAC via `MONEYFUSION_SECRET` env (open in dev if unset)
- Always use `APP_DATABASE_URL` (Supabase); never use Replit's managed `executeSql`
- For production migrations: `APP_DATABASE_URL="..." node lib/db/apply-migration.mjs lib/db/drizzle/<file>.sql`

## User Preferences

- **DB exclusive**: Use only Supabase (`APP_DATABASE_URL`). Never use Replit managed DB (`executeSql` / `checkDatabase`)
- **Push to GitHub** after each work session: `git push "https://x-access-token:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/llanoumarsh-stack/brutepawa.git" main`
- Use `-o push.default=current -o push.autoSetupRemote=true -o receive.denyCurrentBranch=ignore` flags if secret scanning blocks push

## Gotchas

- After changing `lib/db` or `lib/api-spec`, always run `pnpm run typecheck:libs` before leaf package checks
- `pnpm install` needs `tar` override (`^7.5.22`) in `pnpm-workspace.yaml` — Replit firewall blocks `tar@7.5.16`
- Messages.tsx exceeds Babel's 500KB deopt threshold — expected, not an error
- AWS SDK v3 warns about Node.js <22 — harmless, app works on Node 20
