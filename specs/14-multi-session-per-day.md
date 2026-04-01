# Spec 14: Multiple Sessions Per Day

## What it does

Allows admins to create more than one session on the same calendar day. Each session is independent — its own check-ins, matches, and scoreboard. Sessions on the same day are numbered (`#1`, `#2`, etc.) to distinguish them in the UI.

This feature is primarily for **testing purposes** (quickly spin up fresh sessions without waiting for a new calendar day) and for rare edge cases like running two separate play shifts in one evening.

## What it does NOT do

- Does not change the one-active-session-at-a-time constraint (only one session can be `active` at once)
- Does not allow two sessions to run simultaneously
- Does not add any UI for naming sessions manually (auto-numbering only)
- Does not change the leaderboard or season aggregation logic

## Data / DB changes

### Add `name` column to `sessions`

```sql
ALTER TABLE sessions ADD COLUMN name TEXT;
```

Nullable. Null means "no suffix" — display as plain date. When a second session is created for the same date, both get numbered retroactively.

### Naming logic (handled in application code, not DB)

When creating a new session for a date that already has sessions:
1. Count existing sessions for that date (`n`)
2. If `n = 1`, update the existing session: set `name = '#1'`
3. Set the new session's `name = '#2'` (or `#n+1`)

If the date has no prior sessions, `name` stays null.

### No schema changes to `session_players` or `matches`

Check-in/check-out is already scoped by `session_id` — each `session_players` row references a specific session. No changes needed. This is already the correct model.

## API

### `POST /api/sessions/create`

**Change:** Remove the "reactivate existing session" branch. Always create a new session.

Current behavior (to remove):
```
if session for today exists → wipe check-ins and reactivate it
```

New behavior:
```
count sessions for today → assign name if needed → insert new session with status "active"
```

Blocked if another session is currently `active` (existing guard, keep as-is).

Returns: `{ sessionId: string }`

## UI

### All Sessions list (`/`)

Show `name` next to the date when present:

```
Mon Mar 31  #2  · active      ← new session
Mon Mar 31  #1  · completed
Thu Mar 27      · completed   ← single session, no number
```

The session date and name are already rendered per-row — just append `name` as a muted badge when non-null.

### Session detail header (`/session/[id]`)

Append name to the session heading:
```
Monday, March 31  #2
```

No change needed when `name` is null.

### `CreateSessionButton` / `StartSessionButton`

No UI change needed. Button behavior (POST to `/api/sessions/create`) is unchanged.

## Files to create/modify

| File | Action |
|---|---|
| `supabase` (SQL migration) | Add `name TEXT` column to `sessions` |
| `src/lib/db/sessions.ts` | Update `getTodaySession()` to order by `(status = 'active') DESC, started_at DESC`; include `name` in all session query return types |
| `src/app/api/sessions/create/route.ts` | Remove reactivate-existing branch; add naming logic (count today's sessions, assign `#1`/`#2` etc.) |
| `src/app/(app)/page.tsx` | Show `name` badge in session list rows |
| `src/app/(app)/session/[id]/page.tsx` | Show `name` in session detail heading |

## Acceptance Criteria

- [ ] Admin can create a second session on the same day without the first being wiped
- [ ] First session gets renamed `#1` when a second is created for the same date
- [ ] New session is created with name `#2` (or `#n+1` for further sessions)
- [ ] Sessions with no name suffix display as before (no `#1` shown for single-session days)
- [ ] All Sessions list shows `#1` / `#2` badges on same-day sessions
- [ ] Session detail header shows the name when present
- [ ] Check-in and check-out remain correctly scoped to their session (no regression)
- [ ] Players page presence reflects the most recent active session, not an arbitrary one
- [ ] Creating a session is blocked if another session is already active (existing guard preserved)
