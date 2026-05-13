# Spec 35: UBR Tally Algorithm Redesign

## What it does

Fixes the UBR tally path so that a player who wins more games than they lose in a
tally-only session always gains rating, and a player who loses more always loses
rating. Replaces the current Elo-pool comparison formula (which has no such
guarantee and can produce wrong-direction deltas for high-rated players) with a
session-relative performance formula.

Also fixes the path-selection bug where a session with any match records silently
discards all tally data.

## What it does NOT do

- Does not change the match-based UBR path (processMatch).
- Does not change K-factor thresholds or RD logic.
- Does not change how UBR is displayed or queried.
- Does not add new DB tables or migrations.

## Root cause

**Bug 1 — Path selection (`else if`):**
In both `processSessionUbr` and `recalculateAllUbr`, the tally path is guarded by
`else if (hasTally)`. If a session has even one match record alongside tally data,
the tally is silently discarded. Sahit's 9W/2L never reaches `processTallySession`.

**Bug 2 — Formula has no direction guarantee:**
The current tally formula:
```
delta = K × 0.85 × min(ceil(n×0.75), 10) × (winRate − doublesExpected + bonus)
```
where `doublesExpected = clamp(0.5 + (Elo(rating, poolRating) − 0.5) × 0.25, 0.3, 0.7)`.
A high-rated player's doublesExpected approaches 0.70 (the clamp ceiling).
They need to win > 62.5% of games to break even, not 50%. This is unintuitive
and depends on the pool average being accurate, which it often isn't.

## New algorithm

**Invariant:** `winRate > 0.50 → delta > 0`, always.

```
relPerf  = winRate − 0.5              // range [-0.5, +0.5]
weight   = min(totalGames, 12) / 12  // more games = more signal; plateaus at 12
delta    = K × relPerf × weight × TALLY_SCALE   // TALLY_SCALE = 10
matchCount += ceil(totalGames × 0.75)            // career count for K-factor
```

Sample outputs for established player (K=24):
| Win / Loss | Win % | Delta |
|-----------|-------|-------|
| 9W / 2L   | 82%   | +70 pts |
| 7W / 3L   | 70%   | +42 pts |
| 5W / 5L   | 50%   |   0     |
| 3W / 7L   | 30%   | −42 pts |
| 2W / 9L   | 18%   | −70 pts |

## Constants to remove
```
TALLY_K_WEIGHT            // replaced by TALLY_SCALE
TALLY_MATCH_CREDIT        // no longer used in delta formula
TALLY_MAX_EFFECTIVE       // replaced by TALLY_MAX_GAMES
DOUBLES_DAMPING           // tally path no longer uses Elo pool
PERFORMANCE_BONUS_THRESHOLD
PERFORMANCE_BONUS_SCALE
```

## Constants to add
```
TALLY_SCALE    = 10   // magnitude control; ~83% of equivalent match-based delta
TALLY_MAX_GAMES = 12  // game count cap for weight normalization
```

## Files to create/modify

| File | Action |
|------|--------|
| `src/lib/db/ubr.ts` | Modify — fix path selection, update constants, rewrite `processTallySession` |
| `docs/ubr-algorithm.md` | Modify — rewrite §6 (tally path) and §12 (constants table) |
| `CHANGELOG.md` | Modify — add entry under new version |
| `releases/v0.37.0-ubr-tally-redesign.md` | Create — technical release note |

## Implementation tasks

Execute these in order. After each task, run `npm run build` to confirm no
TypeScript errors. Commit after tasks 1, 2+3, and 4 individually. Push once after
task 5.

### Task 1 — Fix path-selection bug (~2 min)

**File:** `src/lib/db/ubr.ts`

In `processSessionUbr` (around line 510), change:
```ts
// BEFORE
if (hasMatches) {
  for (const m of matches) processMatch(states, m as MatchRow);
} else if (hasTally) {
  processTallySession(states, tally);
}
```
to:
```ts
// AFTER
if (hasMatches && !session.whiteboard_mode) {
  for (const m of matches) processMatch(states, m as MatchRow);
} else if (hasTally) {
  processTallySession(states, tally);
}
```

Find the equivalent logic in `recalculateAllUbr` (around line 350–390). Look for
where `processMatch` and `processTallySession` are called in that function and apply
the same `!session.whiteboard_mode` guard to the matches branch.

Note: `session` is already fetched at the top of `processSessionUbr`. In
`recalculateAllUbr`, sessions are fetched with a `select` — confirm that
`whiteboard_mode` is included in that select. Add it if it is missing.

Commit message: `fix(ubr): prefer tally over matches for whiteboard sessions`

### Task 2 — Remove old constants (~1 min)

**File:** `src/lib/db/ubr.ts` (constants block, roughly lines 9–25)

Delete these six lines:
```ts
const TALLY_K_WEIGHT = 0.85;
const TALLY_MAX_EFFECTIVE = 10;
const TALLY_MATCH_CREDIT = 0.75;
const DOUBLES_DAMPING = 0.25;
const PERFORMANCE_BONUS_THRESHOLD = 0.05;
const PERFORMANCE_BONUS_SCALE = 0.3;
```

Add in their place:
```ts
const TALLY_SCALE = 10;      // magnitude control for session-relative delta
const TALLY_MAX_GAMES = 12;  // game count cap for weight normalization
```

`SIMPLE_MODE_MARGIN` stays (used by match path). `MARGIN_LOG_BASE` stays.

Do NOT commit yet — combine with Task 3.

### Task 3 — Rewrite processTallySession (~2 min)

**File:** `src/lib/db/ubr.ts` (function at lines 156–207)

Replace the entire function body with:
```ts
function processTallySession(
  states: Map<string, UbrState>,
  tallyRows: TallyRow[],
): void {
  const active = tallyRows.filter((t) => t.wins + t.losses > 0);
  if (active.length === 0) return;

  for (const t of active) {
    const s = states.get(t.player_id);
    if (!s) continue;

    const total = t.wins + t.losses;
    const winRate = t.wins / total;
    const relPerf = winRate - 0.5;
    const weight = Math.min(total, TALLY_MAX_GAMES) / TALLY_MAX_GAMES;

    const k = kFactor(s.matchCount, s.rd);
    const delta = k * relPerf * weight * TALLY_SCALE;

    s.rating = Math.max(RATING_FLOOR, s.rating + delta);
    s.rd = reduceRd(s.rd);
    s.matchCount += Math.ceil(total * 0.75);
  }
}
```

Run `npm run build`. Fix any TypeScript errors (there should be none — only
removed references).

Commit message: `fix(ubr): replace Elo-pool tally formula with session-relative performance`

### Task 4 — Update docs (~1 min)

**File:** `docs/ubr-algorithm.md`

Update §6 (Tally-Based Sessions / Whiteboard Mode) to document the new formula.
Replace whatever is currently there with:

```
## §6 Tally-Based Sessions (Whiteboard Mode)

Used when a session has no individual match records — only per-player win/loss totals.

**Invariant:** if a player's win rate > 50%, their rating increases. Always.

Formula:
  relPerf = winRate − 0.5              // range [-0.5, +0.5]
  weight  = min(totalGames, 12) / 12  // more games = stronger signal
  delta   = K × relPerf × weight × TALLY_SCALE

Where K is the standard K-factor (based on career match count and RD), and
TALLY_SCALE = 10.

Career match count is incremented by ceil(totalGames × 0.75) to give partial
credit toward K-factor tier progression.
```

Update §12 (Constants Table) to remove the six deleted constants and add:
- TALLY_SCALE = 10
- TALLY_MAX_GAMES = 12

Commit message: `docs(ubr): update algorithm spec for tally path v3`

### Task 5 — Version bump, CHANGELOG, release note (~2 min)

**Version:** bump to `0.37.0` (minor bump — algorithm behaviour change, not just a fix).

**`CHANGELOG.md`** — add at the top (after the header block):
```
## [0.37.0] - 2026-05-13

### Fixed
- UBR tally sessions: players who win more than they lose now always gain rating.
  The previous Elo-pool formula could produce wrong-direction deltas for
  high-rated players (needed >62% win rate to break even instead of 50%).
- UBR tally data is no longer silently discarded when a whiteboard session also
  contains stray match records.

### Changed
- Tally UBR formula replaced with session-relative performance scoring:
  `delta = K × (winRate − 0.5) × gameWeight × 10`. Simpler, no pool dependency.
```

**`releases/v0.37.0-ubr-tally-redesign.md`** — create with:
```
# Release v0.37.0 — UBR Tally Algorithm Redesign

## Summary
Two bugs in the tally-based UBR path are fixed. The formula is replaced with a
simpler session-relative model.

## Changes

### src/lib/db/ubr.ts
- Path selection: `else if (hasTally)` → `if (hasMatches && !whiteboard_mode) ...
  else if (hasTally)`. Whiteboard sessions now always go through the tally path.
- processTallySession rewritten: pool rating, Elo expected, performance bonus, and
  effectiveMatches calculations removed. Replaced with:
  `delta = K × (winRate - 0.5) × min(n, 12)/12 × 10`
- Removed constants: TALLY_K_WEIGHT, TALLY_MATCH_CREDIT, TALLY_MAX_EFFECTIVE,
  DOUBLES_DAMPING, PERFORMANCE_BONUS_THRESHOLD, PERFORMANCE_BONUS_SCALE
- Added constants: TALLY_SCALE = 10, TALLY_MAX_GAMES = 12

### docs/ubr-algorithm.md
- §6 rewritten to document new formula.
- §12 constants table updated.

## Migration
No DB schema changes. Run a full UBR recalculation from the admin panel
(God Mode → Regenerate UBR) after deploying to backfill all historical sessions.
```

**`package.json`** — bump `"version"` field from `0.36.10` to `0.37.0`.

Run `npm run build` one final time. Then:
```
git add src/lib/db/ubr.ts docs/ubr-algorithm.md CHANGELOG.md releases/v0.37.0-ubr-tally-redesign.md package.json
git commit -m "feat(ubr): v0.37.0 — session-relative tally formula + path-selection fix"
git push
```

### Task 6 — Trigger full UBR recalculation (~1 min)

After the push is live on Vercel, call the recalculate endpoint from the admin
panel: God Mode → Regenerate UBR (or POST /api/ubr/recalculate with a god_mode
session). This backfills all historical tally sessions with the new formula.

Verify by checking Sahit's UBR history chart — the latest tally session should
show a positive delta.

## Acceptance Criteria

- [ ] A player with 9W/2L in a tally session always gains rating after recalculation
- [ ] A player with 2W/9L in a tally session always loses rating after recalculation
- [ ] A player with 5W/5L gains or loses ≤ 5 points (near zero)
- [ ] `npm run build` passes with zero TypeScript errors after all changes
- [ ] Full UBR recalculation completes without errors
- [ ] Sahit's UBR history chart shows positive delta for the most recent tally session
