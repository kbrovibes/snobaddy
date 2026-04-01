# Spec 13: UI Tweaks

Three small UI improvements across different pages.

## What it does

1. **Session view stats** — add a "Matches Played" (total match count) row to the stats section of the session detail page.
2. **Player detail: results grouped by session** — on the player detail page (`/players/[id]`), replace the flat chronological match list with matches grouped by session (most recent session first).
3. **Leaderboard: remove Skill Level column** — the `S` / Skill Level column is not useful on the leaderboard and should be removed.

## What it does NOT do

- Does not change how session stats are calculated — only adds one more number to display.
- Does not change the match history query — only changes how results are presented.
- Does not remove skill level from any other page (Players page keeps it).

## Data / DB changes

No schema changes.

### New/modified queries

**Session stats** (`src/lib/db/matches.ts` or `src/lib/db/sessions.ts`):
- Already fetches matches for a session. Expose `total_matches` count alongside existing stats, or compute it client-side from the existing data.

**Player match history grouped by session** (`src/lib/db/matches.ts` or `src/lib/db/players.ts`):
- Existing query returns flat list of matches for a player. Add session info (session `id`, `date`, `status`) to each row so the UI can group by session.
- SQL join: `matches JOIN sessions ON matches.session_id = sessions.id` filtered by player.
- Sort: sessions descending by date, matches within a session ascending by `played_at`.

## UI

### Session detail — stats section

Current stats shown (wins, losses per player tonight). Add a single aggregate row or badge:

```
Matches played tonight: 12
```

Exact placement: alongside or just above/below the existing per-player scoreboard, wherever it looks natural. Keep it simple — one number.

### Player detail page (`/players/[id]`)

Current: flat list of matches sorted by timestamp.

New layout — grouped by session:

```
──── Monday, Apr 7 ────────────────────────
  Win   Alice / Bob  vs  Carol / Dan    21–15
  Loss  Alice / Eve  vs  Frank / Grace  18–21

──── Thursday, Apr 3 ──────────────────────
  Win   Alice / Hank vs  Ivan / Jane    21–19
```

- Section header: session date (formatted nicely, e.g. "Monday, Apr 7")
- Within a session: matches in chronological order, same format as before
- Most recent session at the top
- If player has no match history: show "No matches yet."

### Leaderboard

Remove the `S` (Skill Level) column entirely from both the column header and the rows. All other columns and sort behavior unchanged.

## Files to create/modify

| File | Action |
|------|--------|
| `src/app/(app)/leaderboard/LeaderboardTable.tsx` | Modify — remove `skill_level` column definition and cell rendering |
| `src/app/(app)/session/[id]/page.tsx` (or its child component) | Modify — display total match count in the stats area |
| `src/lib/db/matches.ts` | Modify — update player match history query to join sessions and return session info |
| `src/app/(app)/players/[id]/page.tsx` | Modify — render matches grouped by session instead of flat list |

## Acceptance Criteria

- [ ] Session detail page shows a match count (e.g. "12 matches played") for the current session.
- [ ] Leaderboard has no Skill Level column.
- [ ] Player detail page groups match results by session with a date header per group.
- [ ] Player detail page shows most recent session first.
- [ ] Player with no match history sees "No matches yet."
