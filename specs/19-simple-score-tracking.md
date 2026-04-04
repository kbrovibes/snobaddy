# Spec 19: Simple Score Tracking Mode

## What it does

Adds a per-session toggle called **Simple Score Tracking** (default: on).

When on, the match-entry UI is replaced with a minimal form: pick 2 winners and 2 losers, hit Save. No match generation, no score entry. The system records the result internally as 21–15. This lets players run their own games at the court and quickly log outcomes without thinking about the app.

When off, the existing full flow (Generate Matches + score entry) is shown exactly as today.

## What it does NOT do

- Does not change how matches are stored — the same `matches` table row is written either way.
- Does not affect the scoreboard, leaderboard, or any stats calculations.
- Does not add a "simple mode" flag to individual match records — the distinction is only in the UI.
- Does not hide the match history section.
- Does not affect closed sessions (toggle is only visible/usable on active sessions).

## Data / DB changes

```sql
ALTER TABLE sessions
  ADD COLUMN simple_score_tracking boolean NOT NULL DEFAULT true;
```

No migration needed for existing rows — the default covers them.

## API

### PATCH `/api/sessions/[id]/simple-mode`

Toggles `simple_score_tracking` on the session.

- **Auth:** admin only
- **Request body:** `{ simple_score_tracking: boolean }`
- **Response:** `200 {}` on success, `403` if not admin, `404` if session not found

## UI

### Toggle button

Placed in the session header area, to the left of the status badge (Ongoing / Starting soon / Closed), only shown on active sessions and only to admins.

Appearance: a small pill button reading **"Simple"** (on) or **"Full"** (off), with a subtle icon.

```
[🏸 Ongoing]   ← status badge (right)
[⚡ Simple ▾]  ← mode toggle (left of badge, admin only)
```

Tapping it PATCHes the session and refreshes.

### When Simple Score Tracking is ON (active session)

Hide:
- ProposedMatchList (generate matches section)
- RecordMatchForm (full score entry)

Show: **SimpleMatchForm**

```
┌─────────────────────────────────────────────┐
│  Record a Win                               │
│                                             │
│  Winners                                    │
│  [Player picker ▾]  [Player picker ▾]       │
│                                             │
│  Losers                                     │
│  [Player picker ▾]  [Player picker ▾]       │
│                                             │
│  [Save]  [Clear]                            │
└─────────────────────────────────────────────┘
```

- Pickers list all currently checked-in players by first name (or disambiguated short name).
- A player can only appear once across all four slots (selecting the same person twice is prevented).
- **Save** posts to `/api/matches` with `team1 = winners`, `team2 = losers`, `team1_score = 21`, `team2_score = 15`, `winning_team = 1`. On success, clears the form and refreshes.
- **Clear** resets all four pickers to unselected.
- Both buttons are disabled until all four pickers have distinct selections.

### When Simple Score Tracking is OFF (active session)

Existing ProposedMatchList + RecordMatchForm rendered as today. No change.

## Files to create/modify

| File | Action |
|---|---|
| `src/lib/db/sessions.ts` | Modify — add `simple_score_tracking: boolean` to `Session` interface; include in `getSessionById` select |
| `src/app/api/sessions/[id]/simple-mode/route.ts` | Create — PATCH handler |
| `src/components/SimpleMatchForm.tsx` | Create — winner/loser picker form |
| `src/app/(app)/session/[id]/page.tsx` | Modify — pass `simple_score_tracking` to UI; render toggle + conditional SimpleMatchForm vs ProposedMatchList+RecordMatchForm |

## Acceptance Criteria

- [ ] New `simple_score_tracking` column exists on `sessions` table, default `true`
- [ ] `getSessionById` returns the `simple_score_tracking` field
- [ ] Toggle button is visible to admins on active sessions; not visible to non-admins or on non-active sessions
- [ ] Toggling persists: refresh the page and the mode is preserved
- [ ] In simple mode: ProposedMatchList and RecordMatchForm are hidden; SimpleMatchForm is shown
- [ ] In full mode: SimpleMatchForm is hidden; existing flow is shown unchanged
- [ ] SimpleMatchForm Save is disabled until 4 distinct players are selected
- [ ] Saved match stores `team1_score = 21`, `team2_score = 15`, `winning_team = 1`
- [ ] Saved match appears in the match history and scoreboard immediately
- [ ] Clear resets all four pickers
