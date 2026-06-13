#!/bin/bash
set -e
pnpm install --frozen-lockfile

# Push schema changes with extended timeout (drizzle-kit can be slow on first connect)
# Non-fatal: if push fails (e.g. no schema changes), log and continue
if ! timeout 90 pnpm --filter db push; then
  echo "[post-merge] DB push failed or timed out — schema may already be up to date, continuing"
fi
