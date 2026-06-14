# AfriConnect

Super-app pour l'Afrique de l'Ouest : wallet (MTN/Moov/Orange Money), tontines, marketplace, emplois/freelance, formation, et réseau social professionnel.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxy at /api)
- `pnpm --filter @workspace/africonnect run dev` — run the React frontend (port 24265, proxy at /)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run typecheck:libs` — rebuild lib declarations (run after changing lib/db or lib/api-spec)
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `APP_DATABASE_URL` — Postgres connection string (Supabase pooler), `SESSION_SECRET` — JWT signing key

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18 + Vite, wouter, TanStack Query, Tailwind CSS, shadcn/ui
- API: Express 5, Zod validation, JWT auth (jsonwebtoken + bcryptjs)
- DB: PostgreSQL (Supabase) + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml`)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source-of-truth for all API contracts
- `lib/db/src/schema/` — Drizzle ORM schemas (users, wallet, tontines, marketplace, jobs, education, social)
- `lib/api-client-react/src/generated/` — generated TanStack Query hooks (from Orval)
- `lib/api-zod/src/generated/` — generated Zod schemas (from Orval)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/auth.ts` — JWT sign/verify
- `artifacts/api-server/src/middlewares/requireAuth.ts` — auth middleware
- `artifacts/africonnect/src/pages/` — React page components
- `artifacts/africonnect/src/contexts/auth.tsx` — auth context + localStorage token

## Architecture decisions

- Contract-first: OpenAPI spec → Orval codegen → typed hooks + Zod schemas
- JWT stored in localStorage as `africonnect_token`; server signs with SESSION_SECRET
- All monetary values stored as numeric strings in DB, converted to Number in API responses
- Passwords hashed with bcryptjs (cost 10)
- Routes all mounted under `/api` via the shared proxy

## Product

AfriConnect is a 6-module super-app:
1. **Wallet** — solde FCFA, dépôts (MTN/Orange/Moov Money), transferts peer-to-peer
2. **Tontines** — groupes d'épargne rotatifs numériques avec contributions en ligne
3. **Marketplace** — achat/vente de produits physiques et formations en Afrique de l'Ouest
4. **Jobs** — offres CDI/CDD/freelance avec candidature intégrée
5. **Education** — catalogue de cours gratuits et payants, inscriptions en ligne
6. **Social** — fil d'actualités professionnel, messagerie directe, réseau pro

## Demo accounts

- **Admin**: kofi@africonnect.com / password123
- **User**: aminata@africonnect.com / password123
- **User**: yao@africonnect.com / password123
- **User**: fatou@africonnect.com / password123

## User preferences

- **Toujours pusher vers GitHub** après chaque modification : `git push "https://x-access-token:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/llanoumarsh-stack/brutepawa.git" main`

## Gotchas

- After changing `lib/db` or `lib/api-spec`, always run `pnpm run typecheck:libs` before leaf package checks
- bcryptjs is installed in `@workspace/api-server` — run seed scripts from that directory
- Monetary amounts: DB stores as `numeric`/string, API returns as `Number`
- `lib/db` exports: run `pnpm run typecheck:libs` if new tables don't show up in imports

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
