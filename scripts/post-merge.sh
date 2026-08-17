#!/bin/bash
set -e

# 1. Install dependencies
pnpm install --frozen-lockfile

# 2. Generate migration SQL from current schema (non-interactive, idempotent)
pnpm --filter @workspace/db exec drizzle-kit generate --config ./drizzle.config.ts

# 3. Apply all migration files non-interactively via raw pg client
pnpm --filter @workspace/db run apply-all-migrations
