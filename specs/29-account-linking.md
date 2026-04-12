# Spec 29: Account Linking — Merge Unverified Player on Sign-Up

## What it does

When a new user registers (Google SSO or email), the system checks if an existing **unverified** player (added by admin, `user_id = null`) has a matching name. If a match is found, the user sees a confirmation screen showing that player's match history and stats. They can choose to **claim** the existing account (merging it with their new auth account) or **skip** and start fresh.

This solves the problem where an admin adds "Ajay" to the player list manually, and later the real Ajay signs up — ending up with two separate records.

## What it does NOT do

- Does not merge two **verified** accounts (both with user_ids) — that's a different, harder problem
- Does not auto-merge without user confirmation — always asks
- Does not handle partial name matches or fuzzy matching (exact first-name match only for now)
- Does not run retroactively for existing duplicate accounts — admin must handle those manually or via a future tool

## Flow

```
User signs up (OAuth or email)
  → Player stub created (user_id set, onboarding_complete = false)
  → Redirect to /onboarding
  → Onboarding page checks for unverified players with matching name
  → If match found:
      Show "Is this you?" card with:
        - Player name + skill level
        - Season stats (W/L/win%, matches played)
        - Recent session dates
      [Yes, that's me] → merge accounts, continue to skill picker
      [No, start fresh] → continue to skill picker normally
  → If no match: normal onboarding (skill picker)
```

## Data / DB changes

No new tables. The merge is a series of UPDATE statements:

### Merge operation (old_player_id → new_player_id)

```sql
-- 1. Transfer all match participations
UPDATE matches SET team1_player1_id = $new WHERE team1_player1_id = $old;
UPDATE matches SET team1_player2_id = $new WHERE team1_player2_id = $old;
UPDATE matches SET team2_player1_id = $new WHERE team2_player1_id = $old;
UPDATE matches SET team2_player2_id = $new WHERE team2_player2_id = $old;

-- 2. Transfer session check-ins
UPDATE session_players SET player_id = $new WHERE player_id = $old;

-- 3. Transfer tally entries
UPDATE session_tally SET player_id = $new WHERE player_id = $old;

-- 4. Transfer finals participations
UPDATE finals_participants SET player_id = $new WHERE player_id = $old;

-- 5. Transfer proposed matches
UPDATE proposed_matches SET team1_player1_id = $new WHERE team1_player1_id = $old;
UPDATE proposed_matches SET team1_player2_id = $new WHERE team1_player2_id = $old;
UPDATE proposed_matches SET team2_player1_id = $new WHERE team2_player1_id = $old;
UPDATE proposed_matches SET team2_player2_id = $new WHERE team2_player2_id = $old;

-- 6. Transfer poems
UPDATE player_poems SET player_id = $new WHERE player_id = $old;

-- 7. Copy useful fields from old player to new player
UPDATE players SET
  skill_level = $old_skill_level,  -- preserve admin-set skill
  is_admin = $old_is_admin         -- preserve admin status if set
WHERE id = $new;

-- 8. Soft-delete old player record
UPDATE players SET deleted_at = NOW() WHERE id = $old;
```

## API

### `GET /api/players/match-unverified?name=<name>`
Returns unverified players whose name matches (case-insensitive first name match).

**Response:**
```json
{
  "candidates": [
    {
      "id": "uuid",
      "name": "Ajay Kumar",
      "skill_level": 4,
      "wins": 12,
      "losses": 8,
      "matches_played": 20,
      "last_session_date": "2026-04-07"
    }
  ]
}
```

### `POST /api/players/merge`
Merges an unverified player into the authenticated user's player record.

**Request:**
```json
{ "old_player_id": "uuid" }
```

**Validations:**
- Authenticated user must have a player record
- `old_player_id` must exist and have `user_id = null` (unverified)
- Caller's player record must be the one created during sign-up (prevents abuse)

**Response:** `{ ok: true }`

## UI

### Onboarding page — "Is this you?" step

Shown **before** the skill picker, only when candidates exist.

```
┌─────────────────────────────────┐
│  We found an existing player    │
│  that might be you:             │
│                                 │
│  ┌─────────────────────────┐    │
│  │ Ajay Kumar              │    │
│  │ Skill: ●●●●○            │    │
│  │ 12W – 8L (60% WR)      │    │
│  │ 20 matches this season  │    │
│  │ Last played: Apr 7      │    │
│  └─────────────────────────┘    │
│                                 │
│  [ Yes, that's me ]  (primary)  │
│  [ No, start fresh ] (outline)  │
│                                 │
│  If multiple candidates, show   │
│  a list with radio selection    │
└─────────────────────────────────┘
```

If multiple unverified players match the name, show all as selectable cards.

## Files to create/modify

| File | Action |
|---|---|
| `src/app/api/players/match-unverified/route.ts` | Create — find unverified name matches |
| `src/app/api/players/merge/route.ts` | Create — merge old player into new |
| `src/lib/db/players.ts` | Add `findUnverifiedByName()` and `mergePlayer()` |
| `src/app/onboarding/page.tsx` | Add "Is this you?" step before skill picker |

## Tasks (1-2 min each)

### Phase 1: Backend

- [ ] **29.1** Add `findUnverifiedByName(name: string)` to `src/lib/db/players.ts` — query players where `user_id IS NULL`, `deleted_at IS NULL`, and first name matches (case-insensitive). Return id, name, skill_level.
- [ ] **29.2** Add `getPlayerSeasonSummary(playerId: string)` to `src/lib/db/players.ts` — returns wins, losses, matches_played, last_session_date for the current season.
- [ ] **29.3** Create `GET /api/players/match-unverified` route — takes `name` query param, calls `findUnverifiedByName`, enriches with season summary, returns candidates array.
- [ ] **29.4** Add `mergePlayerInto(oldPlayerId: string, newPlayerId: string)` to `src/lib/db/players.ts` — runs all UPDATE statements in a transaction (matches, session_players, session_tally, finals_participants, proposed_matches, player_poems). Copies skill_level and is_admin from old → new. Soft-deletes old player.
- [ ] **29.5** Create `POST /api/players/merge` route — validates auth, validates old player is unverified, calls `mergePlayerInto`.

### Phase 2: Onboarding UI

- [ ] **29.6** Refactor `onboarding/page.tsx` — add a `step` state: `"checking" | "claim" | "skill"`. On mount, fetch `/api/players/match-unverified?name=<user_name>`. If candidates found, show `"claim"` step. Otherwise go to `"skill"`.
- [ ] **29.7** Build the "Is this you?" card UI — shows candidate player name, skill dots, W/L stats, last played date. "Yes, that's me" and "No, start fresh" buttons.
- [ ] **29.8** Wire "Yes, that's me" button — calls `POST /api/players/merge`, then proceeds to skill picker (pre-populated with merged skill level).
- [ ] **29.9** Wire "No, start fresh" — skips to skill picker with default skill level.
- [ ] **29.10** Handle multiple candidates — render as selectable list with radio buttons, "Claim selected" button.

### Phase 3: Edge cases & safety

- [ ] **29.11** Add error handling — show inline error if merge fails, allow retry or skip.
- [ ] **29.12** Add guard in merge API — prevent merging if old_player_id has a user_id (already verified), or if new player already has match history.
- [ ] **29.13** Log the merge — insert a row into a `player_merge_log` table (or just console.log for now) with old_id, new_id, timestamp, for audit trail.

## Acceptance Criteria

- [ ] New user signs up, name matches an unverified player → "Is this you?" screen shown with stats
- [ ] Clicking "Yes" merges all match/tally/session history into new account
- [ ] After merge, leaderboard and session scoreboards show correct stats for the merged player
- [ ] Old unverified player record is soft-deleted and no longer appears in any list
- [ ] Clicking "No" continues normal onboarding with no merge
- [ ] If no name match found, onboarding proceeds normally (no extra step)
- [ ] Merge cannot be triggered for already-verified players (has user_id)
- [ ] Multiple candidates with same first name all shown as options
