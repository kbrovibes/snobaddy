# Spec 23: Tally Mode

## What it does

Lets admins enter final W/L tallies for sessions where individual matches were never recorded — either historical sessions that predate the app, or future sessions where the whiteboard was used instead of the app.

On any completed session with zero match records, an admin sees an "Enter Final Scores" button. Tapping it opens an inline form where the admin picks players and enters their win and loss counts. Saving writes to a new `session_tally` table (completely separate from `matches`). The session then shows a read-only tally scoreboard. These tallies roll up into the leaderboard alongside match-derived stats.

## What it does NOT do

- No session creation UI — all sessions already exist in the DB
- No photo upload or AI extraction — that is Spec 24 if needed
- No tally entry for active sessions — tally mode is completed sessions only
- No per-match breakdown — only aggregate W/L per player per session
- No player profile page update — profile match history remains match-only (tally sessions appear as a gap; accepted for now)
- No mixing of tally and match data within the same session — mutually exclusive

## Data / DB changes

### New table

```sql
CREATE TABLE session_tally (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id   uuid NOT NULL REFERENCES players(id),
  wins        integer NOT NULL DEFAULT 0,
  losses      integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (session_id, player_id)
);
```

No changes to `matches`, `sessions`, or `session_players`.

### Mutual exclusivity rule (enforced in code, not by DB constraint)

- A session may have rows in `session_tally` OR rows in `matches` — never both.
- The API enforces this with a guard on each write endpoint (see API section).

## API

### `POST /api/sessions/[id]/tally`

Admin only. Creates or replaces tally rows for a session.

**Guard:** Returns 409 if `matches` table has any rows for this `session_id`.

Request body:
```json
{
  "entries": [
    { "player_id": "uuid", "wins": 3, "losses": 1 },
    { "player_id": "uuid", "wins": 2, "losses": 2 }
  ]
}
```

- Validates: session exists, session is completed, all `player_id` values are active (non-deleted) players, `wins` and `losses` are non-negative integers.
- Uses upsert on `(session_id, player_id)` — idempotent, safe to re-save after corrections.
- Returns `{ ok: true }`.

### `POST /api/matches` (existing — add guard)

**Guard:** Before inserting, check if `session_tally` has any rows for this `session_id`. Return 409 if so.

## UI

### Session detail page — entry point

On a **completed** session where `isAdmin && recentMatches.length === 0 && tallyRows.length === 0`:

- Append an "Enter Final Scores" button to the existing "Session closed" bar:
  ```
  Session closed. No new matches can be recorded.   [Reopen]  [Enter Final Scores]
  ```
- Clicking toggles an inline tally form below the bar (no navigation, no modal).

### Tally entry form (inline, client component)

```
┌── Final Scores ───────────────────────────────┐
│                                               │
│  Player            W         L                │
│  ─────────────────────────────────────────── │
│  Alice            [3]       [1]     ✕         │
│  Bob              [2]       [2]     ✕         │
│                                               │
│  [+ Add player ▾]                             │
│                                  [Save]       │
└───────────────────────────────────────────────┘
```

- "Add player" is a searchable dropdown of all active (non-deleted) players not already in the list.
- W and L are plain `<input type="number" min="0">` fields.
- ✕ removes a row.
- No minimum player count required (admin may enter partial data if some players are unknown).
- "Save" is disabled if any row has a blank W or L field.
- On save: POST to `/api/sessions/[id]/tally`, show inline success/error, then `router.refresh()`.

### Session detail page — tally scoreboard (read-only)

When `tallyRows.length > 0` (regardless of admin status):

- Replace the empty `SessionScoreboard` with a new `TallyScoreboard` component.
- Show a "Tally-only session" label where "Matches · N" normally appears.
- Table: Player | W | L | Win% — sorted by wins desc, then losses asc.
- Admin only: show a small "Edit Tallies" link that reopens the entry form pre-filled with existing rows.
- Session highlights are **not** shown for tally sessions (they require match-level data).

### Leaderboard

No UI changes. Stats roll up automatically via the `getActivePlayers()` update (see Files section).

## Files to create / modify

| File | Action |
|---|---|
| Supabase SQL editor | Run `CREATE TABLE session_tally` migration |
| `src/lib/db/tally.ts` | Create — `getSessionTally(sessionId)`, `upsertSessionTally(sessionId, entries[])` |
| `src/app/api/sessions/[id]/tally/route.ts` | Create — POST handler (admin guard, match guard, upsert) |
| `src/app/api/matches/route.ts` | Modify — add tally guard before insert |
| `src/lib/db/players.ts` → `getActivePlayers()` | Modify — add 4th parallel fetch of `session_tally`, aggregate in same JS loop |
| `src/app/(app)/session/[id]/page.tsx` | Modify — fetch tally rows for completed sessions; pass to new components; conditionally render entry button and tally scoreboard |
| `src/components/TallyEntryForm.tsx` | Create — client component: player picker + W/L inputs + save |
| `src/components/TallyScoreboard.tsx` | Create — read-only tally scoreboard table |

## Leaderboard aggregation detail

`getActivePlayers()` currently fetches all match rows and aggregates W/L in JS. Add a fourth parallel fetch:

```ts
const [
  { data: players },
  { data: matches },
  { data: deletedData },
  { data: tallies },
] = await Promise.all([
  supabase.from("players").select("id, name, email, skill_level, is_admin, user_id")
    .eq("onboarding_complete", true).is("deleted_at", null).order("name"),
  supabase.from("matches").select("team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, winning_team"),
  supabase.from("players").select("id").not("deleted_at", "is", null),
  supabase.from("session_tally").select("player_id, wins, losses"),
]);
```

After the existing match aggregation loop, add:

```ts
for (const t of tallies ?? []) {
  const s = statsMap.get(t.player_id) ?? { wins: 0, losses: 0, played: 0 };
  s.wins += t.wins;
  s.losses += t.losses;
  s.played += t.wins + t.losses;
  statsMap.set(t.player_id, s);
}
```

No season filtering — consistent with current behavior (leaderboard is all-time).

## Acceptance Criteria

- [ ] `session_tally` table exists with correct schema and unique constraint
- [ ] Admin sees "Enter Final Scores" button on a completed session with zero matches and zero tally rows
- [ ] Admin does not see tally entry button if matches exist for the session
- [ ] Non-admins never see the tally entry form
- [ ] Tally form: can add/remove players, enter W/L, save successfully
- [ ] Saving tally rows causes the session to display a tally scoreboard (W/L/Win%), not an empty state
- [ ] Admin can re-open tally entry ("Edit Tallies") and re-save; updated values reflect immediately
- [ ] `POST /api/sessions/[id]/tally` returns 409 if matches exist for the session
- [ ] `POST /api/matches` returns 409 if tally rows exist for the session
- [ ] Leaderboard W/L totals include tally session data for all players
- [ ] Player with tally-only history appears on leaderboard with correct totals
- [ ] Session highlights are not shown for tally-only sessions
- [ ] No changes to `matches` table schema or data
