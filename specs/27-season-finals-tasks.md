# Spec 27 — Season Finals: Task Breakdown

**Tracking file for incremental implementation.**
Each task is independently deployable and leaves the app in a working state.
The entire feature is gated behind God Mode until Task 13.

---

## God Mode Strategy

All finals UI and API routes check `is_god_mode = true` on the current player.
Regular users (including admins) cannot see or access anything finals-related until the guard is removed in Task 13.
This means:
- If the feature is abandoned, delete all `finals_*` files + the DB migration. Done.
- If it's in progress, nobody outside God Mode will ever see a broken state.

---

## Guiding Constraints

- Every DB migration is **additive only** — new tables, or new nullable/defaulted columns.
  No existing columns altered, no existing tables touched beyond additive changes.
- Existing session/match/player queries must not change behaviour for `session_type = 'regular'` sessions.
- No new `is_test_session`-style side-effects on existing leaderboard or player stats.
- All finals code lives under clearly namespaced paths:
  - Pages: `src/app/(app)/finals/`
  - API routes: `src/app/api/finals/`
  - DB helpers: `src/lib/db/finals.ts`
  - Components: `src/components/finals/`

---

## Task List

### TASK 1 — DB Migration: Foundation Tables
**Status:** pending

**What:**
- New table: `finals_events` (with `UNIQUE` on `season_id`)
- New table: `finals_participants`
- New column on `sessions`: `session_type text NOT NULL DEFAULT 'regular'`
- New column on `sessions`: `finals_event_id uuid REFERENCES finals_events(id)` (nullable)
- New column on `matches`: `match_type text NOT NULL DEFAULT 'regular'`
- New column on `matches`: `finals_group text` (nullable)

**NOT included yet:** `finals_formats`, `finals_series`, `series_id` on matches — those come in later tasks.

**Breaking risk:** Zero. All new tables; existing columns get safe defaults/nulls.

**Done when:** Migration runs cleanly; `supabase db push` succeeds; existing session and match flows work exactly as before.

---

### TASK 2 — God Mode Entry Point + Finals Event Creation
**Status:** pending

**What:**
- `POST /api/finals` — create a Finals Event for the current season (God Mode only)
- `GET /api/finals/active` — fetch the current season's Finals Event if it exists (God Mode only)
- `/finals/[id]` page — skeleton with 3 tabs (Players / Groups / Sessions), tabs 2 and 3 locked/greyed
- Sessions list: add a "Season Finals" pinned section at the top (God Mode only)
  - If no event: shows "Create Finals Event" button
  - If event exists: shows status card + "Manage Finals →" link
- `DELETE /api/finals/[id]` — delete a draft event (God Mode only, draft status only)

**Breaking risk:** Zero. Sessions list change is God Mode only. No existing routes touched.

**Done when:** God Mode user can create a Finals Event, see it in the sessions list pinned section, and navigate to the Finals Event page skeleton.

---

### TASK 3 — Participant Management (Tab 1: Players)
**Status:** pending

**What:**
- `POST /api/finals/[id]/participants` — add a player to the pool (God Mode)
- `DELETE /api/finals/[id]/participants/[playerId]` — remove a player (draft only, God Mode)
- `GET /api/finals/[id]` — fetch event + participants (God Mode)
- Tab 1 UI: searchable player list, add/remove, running count
- "Auto-add from season" button — adds all players with ≥1 win/loss record this season (matches or tally)
- Show each player's skill badge + season W/L/WR%

**Breaking risk:** Zero. New API routes only.

**Done when:** Admin can build up a full Finals participant list via the UI.

---

### TASK 4 — Breakdown Generation (Tab 2: Groups)
**Status:** pending

**What:**
- `POST /api/finals/[id]/generate-breakdown` — compute Finals Score for all participants
  - Formula: `(((skill_level - 1) / 4) * 100 * 0.5) + (win_rate * 0.5)`
  - Win rate = total season wins / (wins + losses) from matches + session_tally (non-test sessions)
  - Defaults: 0 matches → win_rate = 50
  - Auto-assign groups: top 35% → A, next 35% → B, rest → C
  - Save snapshots (skill_level, season_win_rate, season_wins, season_losses, finals_score, score_breakdown jsonb, score_explanation) to `finals_participants`
  - Idempotent: re-running recomputes all non-overridden players; respects `group_override = true` rows
- `PATCH /api/finals/[id]/participants/[playerId]` — manual group override (sets group_label + group_override=true)
- `POST /api/finals/[id]/confirm-breakdown` — lock assignments; status → `breakdown_generated`
- Tab 2 UI: ranked table (Rank / Name / Skill / WR% / Score / Group dropdown / Info button)
  - Group dividers between A/B and B/C
  - Group size summary
  - Expand button shows score explanation
  - Override badge on manually moved players
  - "Re-run Breakdown" and "Confirm Groups" buttons
  - Block confirm if any group < 4 players

**Breaking risk:** Zero. New routes + new tab content only.

**Done when:** Admin can generate the breakdown, see all players ranked with explanations, move players between groups, and confirm the assignment.

---

### TASK 5 — Finals Session Generation (Tab 3: Sessions)
**Status:** pending

**What:**
- `POST /api/finals/[id]/generate-sessions` — create 2 session rows with `session_type = 'finals'`
  - Body: `{ day1_date, day2_date }`
  - Creates sessions with status `pending`, links via `finals_event_id`
  - Updates `finals_events.finals1_session_id` and `finals2_session_id`
  - Transitions finals_event status → `sessions_created`
- Tab 3 UI: date pickers for Day 1 and Day 2, "Generate Finals Sessions" button
  - After generation: shows session cards with "View Day 1 →" / "View Day 2 →" links
- Sessions list: Finals Sessions now appear in the pinned section with status/group info
- Finals Session page (basic):
  - Header: "🏆 Finals Day 1 — Groups A & B"
  - Open / Close buttons (same lifecycle hooks as regular sessions)
  - No check-in UI (Finals Sessions block the check-in route — return 400)
  - Placeholder: "Format not selected yet" when no format exists

**Breaking risk:** Very low. Session creation is new code. Check-in block is a new guard on an existing route — only fires for `session_type = 'finals'` sessions.

**Done when:** Two Finals Sessions exist in the DB, appear in the sessions list, and can be opened/closed.

---

### TASK 6 — Format Selection UI + `finals_formats` Table
**Status:** pending

**What:**
- New DB migration: `finals_formats` table
- `POST /api/sessions/[id]/finals-format` — set format + config (God Mode)
- `GET /api/sessions/[id]/finals-format` — fetch current format
- Finals Session page: format card picker
  - Card 1: Playoffs + Finals (disabled/greyed with "Coming soon" tag until Task 10)
  - Card 2: Fixed-Partner All-Pairs (active)
  - Card descriptions adapt to actual group sizes
  - Selected card highlighted; "Configure →" button appears

**Breaking risk:** Zero. New table + new API routes + new UI section on Finals Session page only.

**Done when:** Admin can see the format picker, select Fixed-Partner, and the selection is persisted.

---

### TASK 7 — Fixed-Partner: Pair Configuration
**Status:** pending

**What:**
- After selecting Fixed-Partner format, show partner pairing UI
- Per-group pair assignment: dropdowns, exclude already-paired players
- "Auto-suggest pairs" — pair by closest Finals Score (interleaved: #1+#2, #3+#4 etc.)
- Pair labels (Pair 1, Pair 2…)
- Validation: all players assigned, even group size
- Odd group size: clear error, block generate
- Pairs saved in `finals_formats.config` jsonb
- "Save Pairs" persists without generating matches yet

**Breaking risk:** Zero. UI + config save only.

**Done when:** Admin can assign all pairs for both groups and save the configuration.

---

### TASK 8 — Fixed-Partner: Match Generation
**Status:** pending

**What:**
- `POST /api/sessions/[id]/finals-format/generate-matches` (fixed_partner)
  - Round-robin scheduler: every pair vs every other pair exactly once
  - Distributes matches so no pair plays consecutive matches where avoidable
  - Creates match rows with `match_type = 'finals_group'`, `finals_group = 'A'/'B'`
  - `finals_format.status` → `matches_generated`
- Finals Session page: Group A / Group B tabs appear after generation
- Within each tab: match cards in rounds (2 simultaneous matches per round visual grouping)
- Match cards show pair names (e.g., "Pair 1 (Priya + Rajan) vs Pair 2 (Arjun + Mei)")
- Score entry on each card (reuses existing score recording flow)

**Breaking risk:** Low. Match creation uses existing `/api/matches` with new fields (both nullable/defaulted). The match display is new UI only on Finals Session pages.

**Done when:** All fixed-partner matches are generated and displayed. Scores can be entered.

---

### TASK 9 — Fixed-Partner: Standings, Tiebreaks & Winner
**Status:** pending

**What:**
- Live pair standings per group tab (W / L / PF / PA columns)
- Standings update as scores are recorded
- Tiebreak logic: wins first, then PF-PA differential
- 2-way tie: highlight in standings + "Record Tiebreak Match" button → prompts admin to enter a singles result
- 3-way tie: highlight in standings + "Manually select winner" dropdown → admin picks
- `finals_format.status` → `completed` when all matches recorded + any tiebreaks resolved
- Group winner displayed prominently

**Breaking risk:** Zero. Standings are read-only derived state. Tiebreak is new UI only.

**Done when:** Full Fixed-Partner Finals flow is playable end-to-end. First fully usable format.

---

### TASK 10 — Playoffs: Group-Stage Match Generation
**Status:** pending

**What:**
- New DB migration: `finals_series` table + `series_id` nullable column on `matches`
- Enable Playoffs format card (remove "Coming soon" tag)
- `POST /api/sessions/[id]/finals-format/generate-matches` (playoffs branch)
  - Group-scoped, upfront, all-at-once match generation
  - Target: ~4 group-stage matches per player
  - Partner rotation using simplified version of existing `proposeNextMatches` logic
    - Scoped to group players only
    - Avoids repeat pairings, avoids back-to-back
    - All matches generated in one pass
  - Creates match rows with `match_type = 'finals_group'`, `finals_group = 'A'/'B'`
- Group tabs: same match card display as fixed-partner

**Breaking risk:** Low. `series_id` column is nullable with no default change to match logic. Playoffs generation is a new code path only.

**Done when:** Admin can choose Playoffs format and all group-stage matches are generated.

---

### TASK 11 — Playoffs: Individual Standings & Top 4 Detection
**Status:** pending

**What:**
- Individual standings per group: W / L / Pts columns (2pts per win per player)
- Standings update live as scores recorded
- Top 4 determination once all group-stage matches have scores:
  - Sort by Pts desc
  - Tiebreak 1: head-to-head (2-way tie)
  - Tiebreak 2: total points scored (sum of team's own scores across all matches)
  - Tiebreak 3: alphabetical
- Top 4 highlighted in standings with "🏁 Advances to Finals" badge
- "Generate Finals" button appears (unlocked when all group matches complete)
- `finals_format.status` → `playoffs_complete`

**Breaking risk:** Zero. Read-only derived state + new UI elements.

**Done when:** After all group-stage matches, the top 4 are clearly identified and admin can proceed to the Finals.

---

### TASK 12 — Playoffs: Best-of-3 Series
**Status:** pending

**What:**
- `POST /api/sessions/[id]/finals-series` — auto-create series when "Generate Finals" clicked
  - Seeding: Team 1 = Seed #1 + Seed #4, Team 2 = Seed #2 + Seed #3
  - Admin can swap team assignments before confirming
  - Creates `finals_series` row per group
- Series card UI per group (below standings):
  - Shows team names
  - Game 1 / Game 2 / Game 3 score entry cards
  - Live series score (e.g., "Series: 1 – 1")
  - Completed games locked after entry
  - Game 3 entry locked if series already decided (2-0)
- Match rows for each series game: `match_type = 'finals_final'`, `series_id = <id>`
- Series winner detection: when team reaches 2 wins → `finals_series.winning_team` set, `status = completed`
- Winner displayed prominently: "🏆 Group A Winner: Priya & Kenji"
- `finals_format.status` → `completed`

**Breaking risk:** Zero. Series and series games are new DB rows with new UI only.

**Done when:** Full Playoffs Finals flow is playable end-to-end.

---

### TASK 13 — Polish, Stats & God Mode Removal
**Status:** pending

**What:**
- Verify Finals matches (`match_type != 'regular'`) are excluded from season leaderboard
  - Add guard to `getActivePlayers()` query if not already filtering
  - No toggle — permanent exclusion
- Player profile: Finals sessions labelled "🏆 Finals Day 1" in session history
- Finals Event page: completed state — archive view with winners + full standings
- Finals Session page: completed state — results summary
- Sessions list: non-God-Mode admins can see Finals Sessions (read-only results) — remove the God Mode gate from the *display* only; create/edit actions remain admin-only
- Remove God Mode requirement from all finals read routes
- QA: run through both formats end-to-end; verify all existing session/match/player flows unaffected

**Breaking risk:** Low. Removing God Mode gate is the only change to access control. Stats exclusion adds a filter that defaults to excluded (matches current behaviour for non-finals matches).

**Done when:** Feature is live for all users. Spec 27 status → ✅ Shipped.

---

## Rollback Plan

If the feature is abandoned at any point:
1. Drop the DB migration files for finals (tables + columns)
2. Delete `src/app/(app)/finals/`, `src/app/api/finals/`, `src/lib/db/finals.ts`, `src/components/finals/`
3. Remove the Finals section from the sessions list component (one block, God Mode gated)
4. Remove the check-in guard for `session_type = 'finals'` (one if-statement)
5. Remove `match_type` and `finals_group` columns from matches (nullable, safe to drop)
6. Remove `session_type` and `finals_event_id` columns from sessions (safe to drop)

No existing data is affected. No existing feature is altered.
