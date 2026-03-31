# Spec 09: Fix Online Indicator

## What it does
Makes the green "online" dot in the Who's Here list actually work. Current implementation
is broken for two reasons (see below). This spec replaces it with a client-side approach
that correctly shows who has the app open right now.

## What it does NOT do
- No real-time push updates — players who open/close the app mid-session don't appear
  or disappear live. A one-time check on page load is good enough.
- No persistent presence history.

## Root cause of current breakage

### Bug 1 — DB migration never enforced
`last_seen_at TIMESTAMPTZ` column was added in code but never guaranteed to exist.
Supabase silently returns no rows when filtering on a non-existent column, so
`getOnlinePlayerIds` always returns an empty set.

### Bug 2 — SSR race condition
`OnlinePing` fires `POST /api/ping` client-side *after* the server has already rendered
the page and computed online status. The dot is computed at SSR time; the ping that would
make it appear runs afterwards. The user would need to reload a second time — which never
happens in practice.

## Fix

### DB
Ensure the column exists (run once in Supabase SQL editor if not already done):
```sql
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
```

### Architecture change
Move online-status resolution fully to the client:

1. Keep `POST /api/ping` — fires on mount, updates `last_seen_at = now()`.
2. Add `GET /api/online?session=<id>` — returns array of player IDs from the
   Who's Here list whose `last_seen_at > now() - 5 minutes`.
3. Remove `getOnlinePlayerIds` call from the SSR path in `session/[id]/page.tsx`
   and remove the `onlinePlayerIds` prop from `WhoIsHere`.
4. Inside `WhoIsHere` (already a client component), on mount:
   a. Fire the ping.
   b. After 800 ms (let the ping land), call `GET /api/online?session=<id>`.
   c. Store result in local state and render dots.

This way the dots are never computed at SSR time — they appear a moment after the
page loads, which is fine.

## API

### `POST /api/ping` (already exists — no change needed)
Updates `players.last_seen_at` for the authenticated user.

### `GET /api/online?session=<id>` (new)
- Auth: required (existing session cookie)
- Returns: `{ onlinePlayerIds: string[] }`
- Logic: joins `session_players` (checked-in, not checked-out) with `players` where
  `last_seen_at > now() - 5 minutes` and `session_id = <id>`

## UI
`WhoIsHere` gains local state `onlinePlayerIds: Set<string>` (starts empty, so no dot
flicker on load). After the ping + delay, dots appear for players who are online.
Remove the `onlinePlayerIds` prop — it's now self-contained.

## Files to create/modify
| File | Action |
|---|---|
| `src/app/api/online/route.ts` | Create — GET handler |
| `src/app/api/ping/route.ts` | No change needed |
| `src/components/WhoIsHere.tsx` | Modify — add internal fetch + state, remove prop |
| `src/components/OnlinePing.tsx` | Delete — ping is now handled inside WhoIsHere |
| `src/app/(app)/session/[id]/page.tsx` | Modify — remove getOnlinePlayerIds call and prop |
| `src/lib/db/players.ts` | Modify — remove getOnlinePlayerIds (logic moves to API route) |

## Acceptance Criteria
- [ ] Opening the session page causes a dot to appear next to your own name within ~1 second
- [ ] Opening a second browser as a different user causes their dot to appear on the first browser's next page load
- [ ] Players who have not opened the page in the last 5 minutes show no dot
- [ ] Manually-added players (no user_id / no last_seen_at) show no dot
- [ ] No dot flicker on initial load
