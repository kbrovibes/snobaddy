# Spec 22: Test Sessions

## What it does

Marks sessions as "test" sessions so they can be excluded from the season leaderboard and session history by default. Any session created on a non-Monday/Thursday is auto-flagged as a test session. Admins can toggle the flag on any session. Admins also get a per-device toggle on the leaderboard and session list pages to include test sessions in those views.

## What it does NOT do

- Does not hide test sessions from non-admins during active play — anyone can check in and play in a test session normally
- Does not change match recording, check-in, or any other session mechanics
- Does not affect the per-session scoreboard (only the leaderboard and session list history)
- Does not add any per-player profile filtering for test sessions

## Data / DB changes

### Migration

```sql
ALTER TABLE sessions
  ADD COLUMN is_test_session boolean NOT NULL DEFAULT false;
```

No backfill needed — existing sessions (all Mon/Thu) default to `false`.

## Auto-detection on session creation

In `POST /api/sessions/create`, after resolving `today` in Pacific time, detect the day of week:

```ts
const dow = new Date().toLocaleDateString("en-US", {
  timeZone: "America/Los_Angeles",
  weekday: "long",
});
const isTestSession = dow !== "Monday" && dow !== "Thursday";
```

Pass `is_test_session: isTestSession` in the `.insert()` call. Also apply to the `.update()` path that reactivates an existing session for today (so re-running on a Sat still marks it correctly).

## API

### PATCH /api/sessions/[id]/test-session
- **Auth**: admin only
- **Body**: `{ is_test_session: boolean }`
- **Response**: `200 {}` on success, `403` if not admin, `404` if session not found

## UI

### 1. Session detail page — admin toggle

An iOS-style toggle appears in the session header (right side, near the date), visible only to admins. Label: **"Test Session"**. Tapping it calls `PATCH /api/sessions/[id]/test-session` and triggers `router.refresh()`.

When `is_test_session` is `true`, a small **TEST** badge appears below the session date (visible to admin only).

```
┌─────────────────────────────────────┐
│  Mon, Apr 7         [TEST] ◉ toggle │
│  Spring 2026                        │
└─────────────────────────────────────┘
```

### 2. Session list page (`/`) — admin filter toggle

A small iOS toggle row appears at the top of the session list, visible only to admins:

```
  Show Test Sessions  [ ○ ]   ← off by default
```

- Preference stored in `localStorage` key `snobaddy:show-test-sessions` (boolean, default `false`)
- When OFF: test sessions are filtered out of the list
- When ON: test sessions shown with a **TEST** badge next to their date chip
- Non-admins never see this toggle and never see test sessions in the list

### 3. Leaderboard page (`/leaderboard`) — admin filter toggle

Same iOS toggle pattern, stored in `localStorage` key `snobaddy:leaderboard-show-test` (boolean, default `false`):

```
  Include Test Sessions  [ ○ ]   ← off by default
```

- When OFF: leaderboard stats computed from non-test sessions only (current behavior)
- When ON: stats recomputed to include test session matches
- Non-admins never see this toggle; their leaderboard always excludes test sessions
- The award cards (Badminton Nut, etc.) and total match count also update when toggled ON

## Data layer changes

### `src/lib/db/sessions.ts`

- Add `is_test_session: boolean` to `Session` and `SessionRow` interfaces
- Update all `.select()` calls that read sessions to include `is_test_session`
- `getAllSessions()`: include `is_test_session` in returned rows (no filtering — caller decides)
- `getSessionById()`: include `is_test_session` in returned `Session`

### `src/lib/db/players.ts`

Add an `options` parameter to `getActivePlayers`:

```ts
export async function getActivePlayers(
  options?: { includeTestSessions?: boolean }
): Promise<PlayerStats[]>
```

When `includeTestSessions` is `false` (default), the matches query joins to `sessions` and filters `is_test_session = false`. When `true`, fetches all matches (current behavior).

The matches query changes from:
```ts
supabase.from("matches").select("..., sessions(date)")
```
to:
```ts
supabase.from("matches").select("..., sessions!inner(date, is_test_session)")
// + .eq("sessions.is_test_session", false)  when excludeTestSessions
```

### `src/lib/db/matches.ts`

`getSeasonMatchCount()` — add same `includeTestSessions` option to exclude test-session matches from the total count shown on the leaderboard.

## Files to create/modify

| File | Action |
|---|---|
| `supabase/migrations/add_is_test_session.sql` | Create — migration SQL |
| `src/app/api/sessions/create/route.ts` | Modify — day-of-week detection, pass `is_test_session` |
| `src/app/api/sessions/[id]/test-session/route.ts` | Create — PATCH endpoint |
| `src/lib/db/sessions.ts` | Modify — add field to types + all select queries |
| `src/lib/db/players.ts` | Modify — `getActivePlayers` accepts `includeTestSessions` option |
| `src/lib/db/matches.ts` | Modify — `getSeasonMatchCount` accepts `includeTestSessions` option |
| `src/components/TestSessionToggle.tsx` | Create — admin iOS toggle for session detail page (calls PATCH, router.refresh) |
| `src/app/(app)/page.tsx` | Modify — pass `is_test_session` via `getAllSessions`; pass `isAdmin` to list client component |
| `src/app/(app)/SessionListClient.tsx` | Create (or modify existing) — client component with localStorage filter toggle |
| `src/app/(app)/leaderboard/page.tsx` | Modify — fetch both datasets; pass `isAdmin` to table component |
| `src/app/(app)/leaderboard/LeaderboardTable.tsx` | Modify — accept both stat sets; render localStorage toggle for admins |

## Acceptance Criteria

- [ ] Sessions created on Mon or Thu have `is_test_session = false`; sessions created on any other day have `is_test_session = true`
- [ ] Admin can toggle `is_test_session` on/off from the session detail page; change persists in DB
- [ ] Non-admins see no TEST badge, no toggles, and no test sessions in the session list
- [ ] Session list hides test sessions by default for admins; "Show Test Sessions" toggle reveals them with a TEST badge
- [ ] Leaderboard excludes test-session matches by default; "Include Test Sessions" toggle recomputes stats to include them
- [ ] Each admin's toggle preference is independent (localStorage, not DB); toggling on one device/browser does not affect others
- [ ] Non-admins' leaderboard is always computed without test sessions
- [ ] Award cards and total match count on leaderboard also update when the test session toggle is ON
