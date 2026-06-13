---
name: Gift/Token system
description: Virtual gift and token economy — conversion rate, tables, routes, seeding
---

Token balance lives on `walletsTable.tokenBalance` (integer, default 0).
Conversion: 1 token = 5 XOF. Min withdrawal: 1000 tokens (5000 XOF).

**Why:** Keeps token balance co-located with XOF balance in one table, simpler atomic transactions.

**How to apply:** Always update `walletsTable.tokenBalance` with SQL arithmetic (`sql\`col + ${n}\``) inside Drizzle transactions to avoid race conditions.

Default gift catalog seeded via `seedGiftCatalog()` called at API server startup (idempotent).
4 gifts: Rose 🌹 (10j), Cœur ❤️ (50j), Couronne 👑 (500j), Diamant 💎 (2000j).

Anti-self-gift check in `routes/gifts.ts`. In-memory rate limit: 10 gifts/min per user.

GiftPicker component at `artifacts/fblite/src/components/GiftPicker.tsx` — ready for LiveWatchPage (Task #7).
