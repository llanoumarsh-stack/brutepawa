---
name: Contact management system
description: Architecture and decisions for the mobile contact management feature (InfosContactScreen + 11 sub-pages + bottom sheet + API)
---

## New DB tables (lib/db/migrations/0001_contact_management.sql)
- `muted_conversations(id, user_id, other_user_id, expires_at, created_at)` — expires_at NULL = permanent mute
- `pinned_conversations(id, user_id, other_user_id, position, created_at)` — max 5 pinned per user
- `favorite_contacts(id, user_id, contact_id, created_at)`
- `deleted_conversations(id, user_id, other_user_id, deleted_at)` — soft delete per-user

All 4 tables use raw SQL via `db.execute(sql`...`)` in the API since they are NOT in the Drizzle schema.

## API route
File: `artifacts/api-server/src/routes/contacts.ts`, registered in `routes/index.ts`
Key endpoints:
- `GET /contacts/:userId` — full profile + presence + all relationship flags (mute/pin/fav/block/friend)
- `POST|DELETE /contacts/:userId/mute` — duration: "8h"|"1w"|"1m"|"always"
- `POST|DELETE /contacts/:userId/pin`
- `POST|DELETE /contacts/:userId/favorite`
- `POST /contacts/:userId/friend-request`, `PATCH` to accept/reject/cancel
- `POST|DELETE /contacts/:userId/block`
- `POST /contacts/:userId/report` — reason required
- `DELETE /contacts/:userId/conversation` — soft delete
- `GET /contacts/:userId/conversation/search?q=&type=messages`
- `GET /contacts/me/groups`, `GET /contacts/me/pinned`, `GET /contacts/me/favorites`
- `POST /contacts/:userId/add-to-group/:groupId`

**Why:** Uses raw SQL because new tables aren't in Drizzle schema. `getPresence()` returns `{ online, lastSeenAt }` (not lastSeen).

## Mobile screens (Expo Router file-based)
All under `artifacts/brute-pawa-mobile/app/contact/[userId]/`:
- `index.tsx` — InfosContactScreen (avatar, status, 3 action buttons, info rows)
- `profile.tsx` — full profile view with stats
- `search.tsx` — search messages with tabs (Messages/Médias/Liens/Fichiers)
- `mute.tsx` — duration picker radio (8h/1s/1m/Toujours)
- `pin.tsx` — Épingler/Annuler radio
- `favorites.tsx` — Ajouter/Retirer radio
- `add-friend.tsx` — send/cancel/accept friend request (handles all states)
- `add-to-group.tsx` — list user's groups, tap to add contact
- `share.tsx` — uses `Share` from react-native (NOT expo-clipboard, not installed)
- `block.tsx` — block/unblock with confirmation Alert
- `report.tsx` — reason list + optional description
- `delete.tsx` — confirmation + soft delete + redirect to messages tab

Component: `artifacts/brute-pawa-mobile/components/ContactOptionsBottomSheet.tsx`
— 11 options, items 3 (mute) and 4 (pin) have Switch toggles, item 11 (delete) is red

All screens registered in `_layout.tsx` under `contact/[userId]/*`.

## Key decisions
- Tapping mute row in bottom sheet → navigates to mute.tsx (not direct toggle) when not currently muted; direct DELETE when already muted
- Pinned conversations: max 5 enforced server-side
- expo-clipboard NOT installed — use React Native's Share API for copy/share flows
