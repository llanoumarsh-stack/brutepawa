---
name: SSE live gifts
description: Server-Sent Events endpoint for real-time gift notifications during live streams
---

Endpoint: `GET /api/stream/live/:id/events` (in `routes/stream.ts`)
- `:id` is the DB live stream integer ID (from `cfStream.session.id` on the frontend)
- Polls `giftTransactionsTable` every 2s for new rows with `contextType = 'live'` and matching `contextId`
- Initializes `lastId` to current max gift ID so only NEW gifts are pushed after connection
- Keepalive comment `: ping` every 25s to prevent proxy timeout

**Why:** Simple polling SSE avoids Redis/pub-sub complexity while staying real-time enough for live gifting.

**How to apply:** LiveWatchPage connects to this SSE using the live's DB ID (same as LiveStreamPage via `cfStream.session.id`). This is already integrated.
