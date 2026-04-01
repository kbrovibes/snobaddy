# Spec 12: Match Queue Improvements

## What it does

Three related improvements to how the match queue is built and maintained:

1. **Team balancing within a match** — after the 4 players for a match are selected, split them into two teams that are as close in total skill as possible.
2. **Auto-backfill on removal** — when a proposed match leaves the queue (score recorded or deleted), automatically generate a replacement to keep the queue full (subject to the dynamic cap below).
3. **Dynamic queue cap based on checked-in count** — the maximum number of queued matches scales with how many players are checked in. Never auto-generate on session open until at least 8 players are present.

## What it does NOT do

- Does not change the player-selection algorithm (anti-back-to-back, diversity, skill mixing) from spec 07.
- Does not add a manual "force generate" block — players can still click "Suggest Matches" any time to generate early.
- Does not change anything about recording real matches.

## Data / DB changes

No schema changes. All logic is in the match generation service.

## Algorithm changes

### 1. Team balancing

Once 4 players are selected (current algorithm picks these), compute the optimal 2v2 split:

- There are 3 possible splits for 4 players. Enumerate all three.
- Score each split: `abs((skillA1 + skillA2) - (skillB1 + skillB2))`
- Pick the split with the lowest score. Break ties by preferring the split where the higher-skilled player is on the team with the lower-skilled player (i.e., `min(abs(skillA1 - skillA2) + abs(skillB1 - skillB2))`).

This replaces whatever the current team-assignment logic is (if any).

### 2. Dynamic queue cap

| Checked-in players | Max queued matches |
|--------------------|-------------------|
| < 8                | 0 (no auto-gen)   |
| 8–11               | 2                 |
| 12–15              | 3                 |
| ≥ 16               | 4                 |

The cap is re-evaluated each time the queue is considered for backfill.

### 3. Auto-backfill

When a proposed match is removed from the queue (score recorded or deleted), immediately attempt to backfill:
- Compute the current dynamic cap based on checked-in count.
- If `current queue size < cap`, call the generation algorithm to fill the delta (same as clicking "Suggest Matches").
- If the algorithm cannot produce a new unique match (e.g., not enough rested players), do nothing — do not force a duplicate.

Backfill also fires when a player checks in, because the cap may have just increased.

### 4. Session open — no auto-gen until 8 players

On session start (status changes to `open`), do not auto-generate any matches regardless of how many players are present. Let the first backfill trigger when the 8th player checks in.

## API

No new routes. Changes are internal to the match generation service and the check-in / match-record handlers that call it.

Handlers that must trigger a backfill attempt after their primary action:
- `POST /api/sessions/[id]/checkin` — after inserting presence row
- `POST /api/matches` (record result) — after removing proposed match
- `DELETE /api/sessions/[id]/proposed-matches/[matchId]` — after deleting proposed match

## UI

No UI changes. The queue display and "Suggest Matches" button remain as-is.

The user will simply observe that:
- Teams in the queue are now always balanced.
- The queue refills after a match is scored or deleted (when there are enough players).
- Early in a session with few players, the queue stays shorter.

## Files to create/modify

| File | Action |
|------|--------|
| `src/lib/db/matches.ts` | Modify — add team-balancing logic to match generation; add dynamic cap calculation; export `backfillMatchQueue(sessionId)` helper |
| `src/app/api/sessions/[id]/checkin/route.ts` | Modify — call `backfillMatchQueue` after successful check-in |
| `src/app/api/matches/route.ts` | Modify — call `backfillMatchQueue` after recording a match (removing from proposed) |
| `src/app/api/sessions/[id]/proposed-matches/[matchId]/route.ts` | Modify — call `backfillMatchQueue` after deleting a proposed match |

## Acceptance Criteria

- [ ] Teams in every newly generated proposed match are as skill-balanced as possible (all 3 splits evaluated).
- [ ] Checking in the 8th player causes 2 matches to auto-appear in the queue.
- [ ] Checking in the 12th player causes the queue to expand to 3 (if not already full).
- [ ] Recording a match result causes a new proposed match to appear automatically (if cap allows).
- [ ] Deleting a proposed match causes a new one to appear automatically (if cap allows).
- [ ] With 6 players checked in, clicking "Suggest Matches" still works manually.
- [ ] With 6 players and no click, no matches auto-generate on session open.
