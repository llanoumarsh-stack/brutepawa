---
name: MoneyFusion simulation
description: How token purchases are simulated without a real MoneyFusion integration
---

Flow: `POST /api/tokens/purchase` creates a `pending` record and returns payment instructions (operator, phone, reference, message).
`POST /api/tokens/webhook` confirms or fails the purchase and credits tokens.

Webhook security: HMAC-SHA256 via `MONEYFUSION_SECRET` env var, signature in `X-MF-Signature` header (`sha256=<hex>`).
If `MONEYFUSION_SECRET` is unset, webhook is open — dev/test mode.

**Why:** MoneyFusion integration is simulated; future real integration just needs to call the same webhook.
**How to apply:** To test a token credit: POST `{ purchaseId, status: "confirmed" }` to `/api/tokens/webhook` without the signature header (dev mode only).
