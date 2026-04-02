# Spec 18: Match Generation Audit Log

## What it does

Persists a structured decision log every time a match is proposed, capturing a snapshot of why those 4 players were selected and how they were team-balanced. Admins and God Mode users can view this log per match via a detail button on proposed match cards.

## What it does NOT do

- Does not slow down match generation (zero extra DB roundtrips — log is bundled into the existing proposed_matches INSERT)
- Does not store all candidate combinations (only the winner + top runners-up)
- Does not recompute decisions on demand (snapshot is taken at generation time)
- Does not expose this UI to regular players

---

## Design rationale

The generation algorithm already has all scoring data in memory immediately before inserting into `proposed_matches`. Serializing that state into a JSONB column on the same INSERT costs nothing extra. The only architecture question is **persistence after the proposed match is consumed or deleted**.

`proposed_matches` rows are short-lived (deleted when played or removed). A separate `match_generation_logs` table that persists independently solves this:
- Logs for played matches survive → reviewable post-session
- Logs for deleted/rejected proposals also survive → useful for diagnosing why a match was skipped

---

## Data / DB changes

### New table: `match_generation_logs`

```sql
create table match_generation_logs (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references sessions(id) on delete cascade,
  proposed_match_id uuid references proposed_matches(id) on delete set null,
  match_id          uuid references matches(id) on delete set null,
  generated_at      timestamptz not null default now(),
  outcome           text not null default 'pending', -- 'pending' | 'played' | 'deleted'
  log               jsonb not null
);

create index on match_generation_logs(session_id);
create index on match_generation_logs(proposed_match_id);
```

### `log` JSONB shape

```jsonb
{
  "players_considered": [
    {
      "id": "uuid",
      "name": "Alice",
      "skill": 3,
      "wait_min": 42,
      "last_played_at": "2026-04-01T19:45:00Z",
      "excluded": false,
      "exclusion_reason": null
    },
    {
      "id": "uuid",
      "name": "Bob",
      "skill": 4,
      "wait_min": 0,
      "last_played_at": "2026-04-01T20:10:00Z",
      "excluded": true,
      "exclusion_reason": "wave_locked"
    }
  ],
  "selected": {
    "players": ["Alice", "Carol", "Dave", "Eve"],
    "score": 8450,
    "team1": ["Alice", "Dave"],
    "team2": ["Carol", "Eve"],
    "skill_totals": [6, 6],
    "skill_diff": 0,
    "score_breakdown": {
      "wait_time_bonus": 3200,
      "back_to_back_penalty": 0,
      "diversity_bonus": 1200,
      "skill_balance_bonus": 500,
      "exact_duplicate_penalty": 0
    }
  },
  "runners_up": [
    {
      "players": ["Alice", "Frank", "Dave", "Eve"],
      "score": 8100,
      "score_delta": -350,
      "reason_not_selected": "lower wait-time bonus"
    },
    {
      "players": ["Alice", "Carol", "Grace", "Eve"],
      "score": 7900,
      "score_delta": -550,
      "reason_not_selected": "higher skill imbalance"
    }
  ],
  "wave": 1,
  "cap_at_generation": 4,
  "checked_in_count": 14
}
```

---

## API

### `GET /api/sessions/[id]/match-logs`
Returns all generation logs for the session.
- Auth: admin or god mode only
- Response: `{ logs: MatchGenerationLog[] }`

### `GET /api/match-logs/[logId]`
Returns a single log with full detail.
- Auth: admin or god mode only

---

## Backend changes

### `src/lib/db/proposed.ts` — `proposeNextMatches`

At the point where a match is selected and before the INSERT:
1. Build the `log` JSON object from in-memory data already available: `waitMinutes`, `justPlayed`, `workingHistory`, `players`, score breakdown from `findBestMatch`
2. Capture top 2–3 runners-up by running `findBestMatch` on the remaining candidates (limited, not exhaustive)
3. Insert into `match_generation_logs` **in the same batch** as `proposed_matches` — or as a fire-and-forget async write if latency is a concern

**Important**: `findBestMatch` should be refactored to return score breakdown alongside the selected match, not just the match itself.

### When proposed match is played (`POST /api/matches`)
Update the corresponding `match_generation_logs` row:
- Set `match_id = <new match id>`
- Set `outcome = 'played'`

### When proposed match is deleted (`DELETE /api/proposed-matches/[id]`)
Update the corresponding `match_generation_logs` row:
- Set `outcome = 'deleted'`

---

## UI

### Proposed match card (admin/god mode only)
Add a small `ℹ️` icon button in the top-left of each proposed match card.
Tapping opens a bottom sheet or inline expansion showing:

```
─── Why this match? ──────────────────────

  Selected from 14 checked-in players
  Wave 1 of 2 · Score: 8,450

  Players
  ┌─────────────┬───────┬──────────┐
  │ Name        │ Skill │ Wait     │
  ├─────────────┼───────┼──────────┤
  │ Alice       │  ●●●  │  42 min  │
  │ Carol       │  ●●   │  38 min  │
  │ Dave        │  ●●●  │  15 min  │
  │ Eve         │  ●●   │  29 min  │
  └─────────────┴───────┴──────────┘

  Score breakdown
  Wait time bonus      +3,200
  Diversity bonus      +1,200
  Skill balance        +  500
  Back-to-back         +    0
  ─────────────────────────────
  Total                 8,450

  Runner-up
  Alice / Frank vs Dave / Eve · 8,100
  (−350 pts: lower wait-time bonus)
```

### Session admin view (future)
Post-session, admins can browse all generation logs to review algorithm quality.

---

## Files to create/modify

| File | Action |
|------|--------|
| `src/lib/db/proposed.ts` | Modify — refactor `findBestMatch` to return score breakdown; build and insert log alongside proposed match |
| `src/lib/db/match-logs.ts` | Create — query functions for logs |
| `src/app/api/sessions/[id]/match-logs/route.ts` | Create — GET endpoint |
| `src/app/api/match-logs/[logId]/route.ts` | Create — GET single log |
| `src/app/api/matches/route.ts` | Modify — update log outcome to 'played' on match record |
| `src/app/api/proposed-matches/[id]/route.ts` | Modify — update log outcome to 'deleted' on proposal delete |
| `src/components/ProposedMatchList.tsx` | Modify — add ℹ️ button (admin only), inline expansion or sheet |

## Acceptance Criteria

- [ ] `match_generation_logs` table created with correct schema
- [ ] Every `proposeNextMatches` call inserts a log row per match generated
- [ ] Log includes player snapshot, score breakdown, and 2 runners-up
- [ ] Log `outcome` updates to `'played'` when match is recorded
- [ ] Log `outcome` updates to `'deleted'` when proposal is deleted
- [ ] ℹ️ button visible on proposed match cards for admins only
- [ ] Tapping shows human-readable breakdown of the decision
- [ ] Generation latency is not measurably impacted (fire-and-forget write if needed)
- [ ] Logs for deleted proposals are preserved (not cascade-deleted with the proposed match)
