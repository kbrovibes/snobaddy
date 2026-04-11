# Spec 27 — Season Finals

**Owner:** @kbrovibes
**Status:** 📝 Draft
**Version:** 0.2.0
**Feature:** Season Finals — a structured tournament system for end-of-season competitive play.

---

## 1. Overview

Season Finals is a special end-of-season event distinct from regular session nights. Rather than free-form check-ins and algorithm-generated casual matches, Finals is a pre-planned competitive tournament where:

- Players are curated and placed into groups **before** the day of play based on season performance
- Two Finals days are run: **Finals Day 1** (top performers) and **Finals Day 2** (remaining players)
- Each Finals day has a chosen **format** (Playoffs or Fixed-Partner) that drives match generation
- Matches are recorded the same way as regular sessions, but standings are tracked differently

This spec covers everything from planning (player selection + group assignment) through format selection through match generation and results. It is intentionally large. Implementation will happen in phases.

---

## 2. Terminology

| Term | Definition |
|------|-----------|
| **Finals Event** | The overarching umbrella for a season's finals. Contains the player pool, group assignments, and links to the two Finals Sessions. |
| **Finals Participant** | A player who has been added to the Finals Event player pool by an admin. |
| **Group** | A tier of players within a Finals Event. Group A = highest tier, Group B = mid tier, Group C = lower tier (Finals Day 2). |
| **Finals Day 1** | The session containing Group A + Group B players. |
| **Finals Day 2** | The session containing Group C players (and optionally some Group B players later). |
| **Finals Score** | A composite numeric score (0–100) computed for each participant to drive group assignment. Explicitly defined in §5. |
| **Format** | The match structure chosen for a Finals Session: `playoffs` or `fixed_partner`. |
| **Playoffs Format** | Players in each group play a series of matches; top 4 individual scorers advance to a Best-of-3 Final. |
| **Fixed-Partner Format** | Admin pre-assigns partner pairs; all pairs play every other pair once; highest total points wins. |
| **Playoff Phase** | The group-stage matches in Playoffs Format. |
| **Finals Phase** | The Best-of-3 climax match between the top 2 pairs from the Playoff Phase. |
| **Series** | A Best-of-3 grouping: two teams play up to 3 individual games; first to win 2 games wins the Series. |

---

## 3. Scope

### In scope (this spec)
- Admin creates a Finals Event linked to the current season
- Admin adds players to the Finals Event pool (not check-in, a separate pre-planned list)
- System computes a Finals Score for each participant and proposes group assignments (A/B/C)
- Admin can manually override group assignments
- Admin generates 2 Finals Sessions (with configurable dates) from the Finals Event
- Finals Sessions appear distinctly in the sessions list (labeled, not regular nights)
- Finals Session can be "Opened" (like a regular session start) and "Closed"
- Format selection: admin picks one of 2 formats per Finals Session via card UI
- Playoffs format: system generates all group-stage matches; top 4 advance to Best-of-3 Final
- Fixed-Partner format: admin sets partner pairs; system generates full round-robin; most points wins
- Score entry uses the same match recording flow as regular sessions
- Live standings within each group update as scores are entered
- Match tabs: one tab per group (Group A / Group B) within the Finals Session

### Out of scope (deferred to later specs)
- "Plays both Finals" support (a player attending both Day 1 and Day 2)
- Semifinal match before the Best-of-3 (currently: top 4 directly seed into one 2v2 final)
- Elimination bracket visualisation (bracket tree drawing)
- Player self-registration / signup for finals (admin-curated only for now)
- Spectator/public view of Finals matches

---

## 4. The Finals Flow (End-to-End)

```
1. PLANNING PHASE (admin, done before finals day)
   ├── Admin creates Finals Event for the current season
   ├── Admin adds players to the Finals pool (one by one or bulk from season participants)
   ├── Admin triggers "Generate Finals Breakdown"
   │   └── System computes Finals Score → assigns Group A / B / C
   │   └── Admin sees each player's score with full breakdown (why they landed here)
   │   └── Admin can drag/re-assign players between groups
   ├── Admin confirms breakdown
   └── Admin sets dates → "Generate Finals Sessions"
       └── Two sessions created: Finals Day 1 (Groups A+B), Finals Day 2 (Group C)

2. SESSION PHASE (on the day of play)
   ├── Admin opens the Finals Session (like "Start Session" for regular nights)
   ├── Admin selects format (card UI):
   │   ├── Option 1: Playoffs + Finals (with variant descriptions based on player count)
   │   └── Option 2: Fixed-Partner All-Pairs
   ├── Admin configures format:
   │   ├── [Playoffs] → no extra config; system auto-generates all group-stage matches
   │   └── [Fixed-Partner] → admin sets partner pairings → preview → confirm
   └── Admin clicks "Generate Matches"
       └── All matches for the session appear in tabs (Group A / Group B)

3. PLAY PHASE (live, match by match)
   ├── Matches are displayed condensed (like proposed matches view)
   ├── Score entry form on each match card (same as current score entry)
   ├── Live standings update per group as scores come in
   └── [Playoffs only] Once all group-stage matches done → top 4 highlighted → Best-of-3 Final unlocked

4. FINALS PHASE (playoffs format only)
   ├── Best-of-3 series match cards appear
   ├── Each game in the series recorded individually
   └── Series winner declared when team reaches 2 wins

5. COMPLETION
   ├── Admin closes Finals Session
   ├── Finals results shown (winners per group, final standings)
   └── Results archived on Finals Event page — NOT rolled into season leaderboard
```

---

## 5. The Finals Score Heuristic (Explicit)

Every player in the Finals pool gets a **Finals Score** from 0 to 100. This score determines group placement and is shown to the admin with a full breakdown so decisions are transparent and explainable.

### Formula

```
Finals Score = (Skill Score × 0.50)
             + (Win Rate    × 0.50)
```

**Why only two components:** Using only skill level and win/loss record keeps the score compatible with all data sources — including players whose sessions were recorded in tally mode (aggregate W/L only, no match-by-match detail). It also makes the score easy to explain at the venue: "you're in Group A because your skill is 4 and you won 62% of your matches this season."

### Component Definitions

| Component | Calculation | Weight | Notes |
|-----------|-------------|--------|-------|
| **Skill Score** | `((skill_level − 1) / 4) × 100` | 50% | Maps skill 1→0, skill 5→100. Badminton skill level is the primary signal of ceiling. |
| **Win Rate** | `(season_wins / (season_wins + season_losses)) × 100` | 50% | Season-wide wins + losses from both `matches` and `session_tally` (non-test sessions). Players with 0 matches default to 50 (neutral). |

### Example Breakdown

> **Priya** — Skill 4, Season Win Rate 62% (from 18 matches + 2 tally sessions)
>
> - Skill Score:  ((4−1)/4) × 100 = 75.0  → 75.0 × 0.50 = **37.50**
> - Win Rate:     62.0              → 62.0 × 0.50 = **31.00**
> - **Finals Score: 68.50**
>
> Explanation shown to admin: *"Advanced player (Skill 4) with a strong season win rate of 62%. Placed in Group A."*

### Group Assignment (default thresholds)

After scoring all participants, players are ranked by Finals Score and split into groups. Default split assumes roughly equal group sizes, biased toward the total participant count:

| Group | Who | Typical Size | Finals Day |
|-------|-----|--------------|------------|
| **A** | Top scorers | ≈ top 35% | Day 1 |
| **B** | Mid scorers | ≈ next 35% | Day 1 |
| **C** | Remaining | ≈ bottom 30% | Day 2 |

The admin sees the ranked list and can move players between groups via a dropdown. Group size targets (e.g., "10 in A, 10 in B, 8 in C") are shown as a guide.

**Score shown per player (admin view):**
```
#3  Priya       Score: 68.50   Skill:4  WR:62%   → Group A  [move ▾]  [ℹ]
#4  Arjun       Score: 65.00   Skill:4  WR:56%   → Group A  [move ▾]  [ℹ]
#5  Mei         Score: 61.25   Skill:3  WR:73%   → Group A  [move ▾]  [ℹ]
...
#11 Kenji       Score: 46.25   Skill:3  WR:55%   → Group B  [move ▾]  [ℹ]
```

`[ℹ]` expands to the one-line explanation. Players manually moved by admin show an override badge.

---

## 6. Data Model

### 6.1 New Tables

#### `finals_events`

Top-level record for a season's Finals. One per season.

```sql
CREATE TABLE finals_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id           uuid NOT NULL REFERENCES seasons(id) UNIQUE,  -- one Finals Event per season
  name                text NOT NULL DEFAULT 'Season Finals',
  status              text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'breakdown_generated', 'sessions_created', 'active', 'completed')),
  finals1_session_id  uuid REFERENCES sessions(id),  -- Day 1 session (set after generation)
  finals2_session_id  uuid REFERENCES sessions(id),  -- Day 2 session (set after generation)
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES players(id)
);
```

**Status transitions:**
```
draft → breakdown_generated → sessions_created → active → completed
```
- `draft`: event created, players being added
- `breakdown_generated`: group assignments computed and confirmed
- `sessions_created`: two session rows exist, dates set
- `active`: at least one Finals Session is open
- `completed`: both Finals Sessions closed

#### `finals_participants`

One row per player in the Finals pool. Snapshots stats at the time the breakdown is generated.

```sql
CREATE TABLE finals_participants (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finals_event_id       uuid NOT NULL REFERENCES finals_events(id) ON DELETE CASCADE,
  player_id             uuid NOT NULL REFERENCES players(id),
  group_label           text CHECK (group_label IN ('A', 'B', 'C')),
  finals_day            int  CHECK (finals_day IN (1, 2)),  -- derived: A+B=1, C=2
  -- Snapshot at breakdown time (for explanation & auditability)
  skill_level           int,
  season_win_rate       numeric(5,2),   -- e.g. 62.50 (from matches + tally, non-test sessions)
  season_wins           int,            -- raw win count (for display)
  season_losses         int,            -- raw loss count (for display)
  finals_score          numeric(6,2),   -- composite 0–100
  score_breakdown       jsonb,          -- { skill: 37.50, win_rate: 31.00 }
  score_explanation     text,           -- Human-readable one-liner
  -- Manually overridden by admin?
  group_override        boolean NOT NULL DEFAULT false,
  -- Metadata
  added_at              timestamptz NOT NULL DEFAULT now(),
  added_by              uuid REFERENCES players(id),
  UNIQUE (finals_event_id, player_id)
);
```

#### `finals_formats`

One row per Finals Session, storing the chosen format and its configuration.

```sql
CREATE TABLE finals_formats (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL REFERENCES sessions(id) UNIQUE,
  format_type  text NOT NULL CHECK (format_type IN ('playoffs', 'fixed_partner')),
  status       text NOT NULL DEFAULT 'configured'
                 CHECK (status IN ('configured', 'matches_generated', 'playoffs_complete', 'completed')),
  config       jsonb NOT NULL DEFAULT '{}',
  -- config shape for playoffs:     { "group_size_a": 10, "group_size_b": 10, "matches_per_player": 4 }
  -- config shape for fixed_partner: { "pairs": [{ "p1": uuid, "p2": uuid, "label": "Pair 1" }, ...] }
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

#### `finals_series`

Tracks a Best-of-3 series (used only in Playoffs Format finals phase).

```sql
CREATE TABLE finals_series (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         uuid NOT NULL REFERENCES sessions(id),
  group_label        text NOT NULL CHECK (group_label IN ('A', 'B')),
  team1_player1_id   uuid NOT NULL REFERENCES players(id),
  team1_player2_id   uuid NOT NULL REFERENCES players(id),
  team2_player1_id   uuid NOT NULL REFERENCES players(id),
  team2_player2_id   uuid NOT NULL REFERENCES players(id),
  games_to_win       int NOT NULL DEFAULT 2,  -- first to 2 = best of 3
  team1_games        int NOT NULL DEFAULT 0,
  team2_games        int NOT NULL DEFAULT 0,
  winning_team       int CHECK (winning_team IN (1, 2)),  -- null until series complete
  status             text NOT NULL DEFAULT 'in_progress'
                       CHECK (status IN ('in_progress', 'completed')),
  created_at         timestamptz NOT NULL DEFAULT now()
);
```

### 6.2 Changes to Existing Tables

#### `sessions` — 2 new columns

```sql
ALTER TABLE sessions
  ADD COLUMN session_type    text NOT NULL DEFAULT 'regular'
               CHECK (session_type IN ('regular', 'finals')),
  ADD COLUMN finals_event_id uuid REFERENCES finals_events(id);
```

Regular sessions: `session_type = 'regular'`, `finals_event_id = null`.
Finals sessions: `session_type = 'finals'`, `finals_event_id = <id>`.

#### `matches` — 3 new columns

```sql
ALTER TABLE matches
  ADD COLUMN match_type    text NOT NULL DEFAULT 'regular'
               CHECK (match_type IN (
                 'regular',
                 'finals_group',     -- group-stage match in playoffs format or fixed-partner round
                 'finals_final'      -- game within a Best-of-3 series
               )),
  ADD COLUMN finals_group  text,     -- 'A' or 'B' — which group this match belongs to
  ADD COLUMN series_id     uuid REFERENCES finals_series(id);  -- non-null only for finals_final matches
```

---

## 7. API Endpoints

All finals endpoints are admin-only unless noted.

### Finals Events

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/finals` | Create a new Finals Event for the current season |
| `GET` | `/api/finals/[id]` | Fetch Finals Event with participants + group assignments |
| `DELETE` | `/api/finals/[id]` | Delete a draft Finals Event (only while status = draft) |

### Finals Participants

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/finals/[id]/participants` | Add a player to the Finals pool |
| `DELETE` | `/api/finals/[id]/participants/[playerId]` | Remove a player from the pool (draft only) |
| `PATCH` | `/api/finals/[id]/participants/[playerId]` | Override a player's group assignment |

### Finals Breakdown

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/finals/[id]/generate-breakdown` | Compute Finals Scores + assign groups. Idempotent — can be re-run before confirming. |
| `POST` | `/api/finals/[id]/confirm-breakdown` | Lock group assignments; transitions status to `breakdown_generated` |

### Finals Sessions

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/finals/[id]/generate-sessions` | Create 2 Finals Sessions with specified dates. Body: `{ day1_date: "2026-05-05", day2_date: "2026-05-12" }` |

### Finals Formats

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/sessions/[id]/finals-format` | Set the format for a Finals Session (playoffs or fixed_partner + config) |
| `GET` | `/api/sessions/[id]/finals-format` | Fetch the current format config for a Finals Session |
| `POST` | `/api/sessions/[id]/finals-format/generate-matches` | Generate all matches for the session based on the chosen format |

### Finals Series (Playoffs only)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/sessions/[id]/finals-series` | List all series for the session |
| `POST` | `/api/sessions/[id]/finals-series` | Create series (auto-created when playoffs phase completes) |
| `PATCH` | `/api/finals-series/[seriesId]` | (Internal use) Update series team_games count after each match recorded |

Match recording for finals uses the existing `POST /api/matches` endpoint with the new `match_type`, `finals_group`, and `series_id` fields added to the request body.

---

## 8. Finals Planning Phase (UI Detail)

### 8.1 Entry Point

In the **Sessions list** (and admin control panel), a new section or card at the top:

```
┌─────────────────────────────────────────────────────────────────┐
│ 🏆  Season Finals                                               │
│  No finals event yet for this season.                           │
│  [Create Finals Event]                 (admin only)             │
└─────────────────────────────────────────────────────────────────┘
```

Once a Finals Event exists:
```
┌─────────────────────────────────────────────────────────────────┐
│ 🏆  Season Finals 2026                                          │
│  Status: Draft  |  28 players added  |  Groups: not generated   │
│  [Manage Finals →]                                              │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Finals Event Page (`/finals/[id]`)

A dedicated page with 3 tabs:

**Tab 1 — Players**

- Shows the list of players currently added to the Finals pool
- Each row: player name, skill badge, season stats (WR%, matches), group badge (after breakdown)
- "Add Player" button → searchable dropdown of all active season players
- "Remove" button per player (while in draft)
- "Auto-add from season" shortcut → adds all players who played ≥N matches this season (configurable threshold, default 5)
- Running count: "28 players added"

**Tab 2 — Groups** (unlocked after clicking "Generate Breakdown")

Layout: ranked table sorted by Finals Score, with columns:
```
Rank | Name        | Skill | WR%  | Score  | Group  | Action
  1  | Rajan       |  ⬛⬛⬛⬛⬛ | 71%  | 85.50  | [A ▾]  | [ℹ]
  2  | Priya       |  ⬛⬛⬛⬛   | 62%  | 68.50  | [A ▾]  | [ℹ]
  ...
 11  | Kenji       |  ⬛⬛⬛    | 55%  | 52.50  | [B ▾]  | [ℹ]
  ...
 22  | Newcomer    |  ⬛⬛      | 38%  | 31.50  | [C ▾]  | [ℹ]
```

- `[ℹ]` expands to full score explanation paragraph
- `[A ▾]` is a dropdown; admin can change to B or C (sets `group_override = true`, shows override badge)
- Group dividers shown visually (dashed line between A/B boundary, B/C boundary)
- Group size summary at bottom: "Group A: 10 players  |  Group B: 10 players  |  Group C: 8 players"
- Warning if any group < 4 players (can't run a meaningful match format)
- Buttons: `[Re-run Breakdown]` (recomputes from scratch, respects overrides) | `[Confirm Groups]`

**Tab 3 — Sessions** (unlocked after confirming groups)

```
Finals Day 1            Day 2
Date: [May 5, 2026  ▾]  Date: [May 12, 2026 ▾]
Groups: A + B           Groups: C

[Generate Finals Sessions]
```

After generating:
```
✅  Finals Day 1 created → May 5, 2026
✅  Finals Day 2 created → May 12, 2026
[View Day 1 →]   [View Day 2 →]
```

---

## 9. Finals Session in the Sessions List

Finals Sessions appear in the **same sessions list** as regular nights but in their own pinned section at the top — the same visual pattern used to separate "Past Sessions" and "Test Sessions". They do not mix into the main chronological list.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🏆  Season Finals 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌──────────────────────────────────────────────────────────┐
│ 🏆 Finals Day 1          Mon, May 5, 2026                │
│    Groups A + B  |  20 players  |  Status: Pending       │
│    Format: Not selected                                   │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ 🏆 Finals Day 2          Mon, May 12, 2026               │
│    Group C  |  8 players  |  Status: Pending             │
│    Format: Not selected                                   │
└──────────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Recent Sessions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [regular session cards below]
```

If no Finals Event exists for the current season, the section is hidden entirely (not shown to regular users; admin sees a prompt in the Manage Finals panel).

---

## 10. Finals Session Page

### 10.1 Header / Status Bar

```
🏆 Finals Day 1 — Groups A & B
Season Finals 2026  |  May 5, 2026
Status: [Open]   [Close Session]          (same lifecycle as regular sessions)
```

### 10.2 Format Selection (shown when no format chosen yet)

A full-width card-based format picker. Cards are shown one after another, full width, selectable:

---

**[Select] 🏆 Playoffs + Finals**

> *20 players split into 2 groups of 10. Each group plays a round-robin style series of matches to accumulate individual points. The top 4 scorers from each group advance to a Best-of-3 Final within their group.*
>
> **How matches are generated:** All players in the group are scheduled for approximately equal playing time. Partners rotate per match (same algorithm logic as regular nights). Each player plays ~4 group-stage matches.
>
> **How the Final works:** Top 4 point-earners from the group stage pair off as two teams (1st+4th vs 2nd+3rd seeding) and play a Best-of-3 series. First team to win 2 games wins the group.
>
> **Best for:** Competitive groups where individual merit should determine the winner.

---

**[Select] 🤝 Fixed-Partner All-Pairs**

> *Admin assigns fixed partner pairs before play begins. All pairs then play against every other pair exactly once in a round-robin. The pair with the most total points (wins × 2, ties ignored) across all their matches wins the group.*
>
> **How matches are generated:** With N pairs, there are N×(N-1)/2 matches total. For 5 pairs = 10 matches; for 4 pairs = 6 matches. All matches are generated upfront.
>
> **How the winner is determined:** No knockout bracket. Total match wins determine the winner. In case of a tie at the top, the pair with the higher combined score difference wins.
>
> **Best for:** Groups where consistent team chemistry matters more than individual brilliance. Simpler to explain to everyone.

---

*(Cards adapt their description text based on actual group sizes. If Group A has 10 players, the card says "10 players in 5 pairs" for fixed-partner, etc.)*

Once a format card is selected, it becomes highlighted. A `[Configure →]` button appears below.

### 10.3 Format Configuration

**Playoffs — no configuration required.** System auto-generates matches. `[Generate Matches]` button appears immediately after format selection.

**Fixed-Partner — partner pairing UI:**

```
Set Partner Pairs — Group A (10 players)
─────────────────────────────────────────
Pair 1:  [Priya      ▾]  +  [Rajan      ▾]
Pair 2:  [Arjun      ▾]  +  [Mei        ▾]
Pair 3:  [Kenji      ▾]  +  [Soo-Jin    ▾]
Pair 4:  [Yusuf      ▾]  +  [Layla      ▾]
Pair 5:  [Tomás      ▾]  +  [Faridah    ▾]
─────────────────────────────────────────
Set Partner Pairs — Group B (10 players)
  [same UI for Group B]

[Auto-suggest pairs by skill balance]   [Generate Matches]
```

- Each player appears in exactly one pair per group — dropdowns exclude already-paired players
- `[Auto-suggest pairs by skill balance]` pairs players by closest Finals Score (1st+2nd, 3rd+4th, etc. — interleaved not sequential, to balance pairs)
- Groups are configured independently
- Validation: all players in the group must be assigned before generating
- Odd group size → warning: "Group A has 9 players — one player will need to sit out a round"

### 10.4 Match Tabs

After matches are generated, the session page shows tabs:

```
[Group A]  [Group B]
```

Within each group tab, matches are displayed condensed (same style as current proposed match cards):

```
┌─ Group A — Round 1 ──────────────────────────────────────────┐
│  Priya + Rajan   vs   Arjun + Mei                            │
│  [  ] : [  ]   ← score entry                                 │
├──────────────────────────────────────────────────────────────┤
│  Kenji + Soo-Jin   vs   Yusuf + Layla                        │
│  [  ] : [  ]                                                 │
└──────────────────────────────────────────────────────────────┘

┌─ Group A — Round 2 ──────────────────────────────────────────┐
  ...
```

"Rounds" are shown as visual separators. In Playoffs format, matches are not strictly divided into rounds (partners rotate), but groups of 2 simultaneous matches are labeled "Round N" for readability.

Within each tab, a live standings sub-section shows:

```
Group A Standings
────────────────────────────────────────
 #  Name        W   L   Pts   Matches
 1  Priya       4   0   8     4/4
 2  Rajan       3   1   6     4/4
 3  Arjun       2   2   4     4/4
 ...
────────────────────────────────────────
🏆 Top 4 advance to Finals
```

Points: 2 per win, 0 per loss (consistent with fixed-partner for simplicity).

---

## 11. Playoffs Format — Full Detail

### 11.1 Group-Stage Match Generation

For a group of N players in Playoffs format:

1. **Minimum players:** 6. With fewer, format is blocked.
2. **Target matches per player:** `floor((N-1) / 2) × 2` rounds, roughly ensuring everyone plays the same number of matches. Practically: for 10 players, target ≈ 4 group-stage matches per player.
3. **Partner rotation:** Same constraint as regular nights — avoid repeat pairings, avoid back-to-back. Uses a simplified version of the existing `proposeNextMatches` algorithm scoped to just the group's players.
4. **All matches generated upfront** (not progressively). This is different from regular sessions. Total group-stage matches = `(N × target_matches) / 4` rounded to a whole number. For 10 players at 4 matches each = 10 total matches.
5. **Court awareness:** All group matches are generated simultaneously. The UI is the source of truth for sequencing (rounds are a display-only grouping of 2–4 matches shown side by side).

### 11.2 Points Accumulation

Individual points per player = 2 per win, 0 per loss (from group-stage matches only).

Partners' wins/losses are tracked individually. If Priya and Rajan are teamed in match 1 and win 21-15, both Priya and Rajan each get +2 points.

### 11.3 Top 4 Determination

After all group-stage matches are recorded:

1. Sort players by individual points (desc)
2. Tiebreak 1: head-to-head result (if exactly 2 tied)
3. Tiebreak 2: total points scored across all matches (sum of team's winning scores)
4. Tiebreak 3: alphabetical by name (deterministic last resort)

Top 4 are highlighted in the standings. A "🏁 Advance to Finals" banner appears.

### 11.4 Finals Seeding

Top 4 → 2 teams:
- **Team 1:** Seed #1 + Seed #4
- **Team 2:** Seed #2 + Seed #3

Rationale: This is the standard "serpentine" seeding used in tennis and other racket sports. It gives #1 a "tougher" partner and balances team strength.

Admin can swap team assignments if there's a personal conflict (e.g., relatives who don't want to be paired).

### 11.5 Best-of-3 Series

A `finals_series` row is created for each group's Final.

```
🏆 Group A Final
────────────────────────────────────────
  Priya & Kenji  vs  Rajan & Arjun

  Game 1:  [ 21 ] – [ 18 ]   ✅ Team 1 wins
  Game 2:  [ 15 ] – [ 21 ]   ✅ Team 2 wins
  Game 3:  [    ] – [    ]   ← pending

  Series: 1 – 1
```

- Games are recorded using the same score entry UI
- `series_id` links each game (match record) to the series
- When team reaches 2 wins → `winning_team` set on series, game 3 entry locked if series over
- Series winner displayed prominently

### 11.6 Simultaneous Groups

Groups A and B run in parallel on the same Finals Day 1 session. The "Group A" and "Group B" tabs are independent. Admins can record scores in any order across groups.

---

## 12. Fixed-Partner Format — Full Detail

### 12.1 Match Generation

For a group of N players configured as `N/2` pairs:

- Total matches = `C(N/2, 2)` = `(N/2) × (N/2 - 1) / 2`
- For 5 pairs: 10 matches; for 4 pairs: 6 matches; for 6 pairs: 15 matches

Every pair plays every other pair exactly once. Matches are generated in a round-robin schedule (standard round-robin tournament scheduling algorithm, distributing matches so no pair plays two consecutive matches if avoidable).

### 12.2 Match Display

Same tab structure. Pairs are shown as labelled teams:

```
Pair 1 (Priya + Rajan)   vs   Pair 2 (Arjun + Mei)
[  21  ] : [  15  ]   ✅ Pair 1 wins
```

### 12.3 Standings

Pair standings, sorted by total wins (not individual):

```
Group A Standings (Fixed-Partner)
────────────────────────────────────────────────────────
 #  Pair                           W   L   PF   PA
 1  Pair 1: Priya + Rajan          4   0   84   60
 2  Pair 3: Kenji + Soo-Jin        3   1   72   68
 ...
────────────────────────────────────────────────────────
 PF = Points For (sum of winning team's scores)
 PA = Points Against
```

**Tiebreak for fixed-partner:**
1. PF − PA (point differential)
2. If still tied between **2 pairs**: highlighted prominently in the standings as a tie. Admin records a singles tiebreak match between one player from each pair (outside the normal match flow — use a simple "Enter tiebreak result" button). Winner advances.
3. If still tied between **3+ pairs** (rare but possible — e.g. A beats B, B beats C, C beats A with equal differentials): ties are highlighted. Admin manually selects the winner in the app for now. A future spec will handle a proper multi-way tiebreak format.

### 12.4 Winner

No knockout phase. Standings at the end of the round-robin are final. The #1 pair per group is the winner (after any tiebreak resolution above).

---

## 13. Edge Cases & Guards

| Scenario | Handling |
|----------|----------|
| Finals pool has <4 players when generating breakdown | Block with error: "Add at least 4 players to generate a breakdown." |
| Group ends up with 0 or 1 player after admin overrides | Show warning banner on Groups tab; block `[Confirm Groups]` until each group has ≥4 players |
| Player in Finals pool is deleted from the system | Show as "(removed)" in the participant list; exclude from breakdown computation; admin must manually reassign or remove |
| Player has 0 season matches (e.g., new member) | Win Rate defaults to 50. Score computed normally. Override recommended. |
| Odd-sized group in fixed-partner format | Block `[Generate Matches]` with error: "Group A has an odd number of players. Adjust pairs or move a player to another group." |
| Score entered ties (21-21) | Reuse existing validation — tied scores blocked in match recording |
| Series game 3 entered after series already decided | Block with "Series already completed" message |
| Finals Session closed before all matches recorded | Allowed — session closes like normal. Incomplete matches remain unscored. Summary shows partial results. |
| Second Finals event attempted for same season | Blocked — one Finals Event per season (`UNIQUE` constraint on `season_id`). Admin must delete the existing draft first if they need to start over. |
| Regular session check-in UI on a Finals Session | Finals Sessions do not show check-in UI. The participant list comes from `finals_participants`, not `session_players`. Check-in routes return 400 for sessions with `session_type = 'finals'`. |
| Admin tries to record a match for a non-participant in a Finals Session | Match recording validates that all 4 players are in `finals_participants` for this `finals_event_id`. Returns 403 if not. |
| `generate-breakdown` called twice before confirming | Idempotent — recomputes scores, resets auto-assigned groups, preserves manual overrides (`group_override = true` rows keep their group). |

---

## 14. Stats Rollup

### Season Leaderboard

Finals matches (`match_type = 'finals_group'` and `match_type = 'finals_final'`) are **permanently excluded** from the regular season leaderboard. There is no toggle.

**Why:** The season leaderboard is locked 1–2 sessions before Finals to allow trophy ordering. Finals results are therefore a separate competition that happens *after* the season standings are sealed. Mixing them would corrupt the leaderboard that was used for trophy decisions.

The leaderboard lock itself is a separate future feature (Spec 28 or similar). For now, by the time Finals happen, the season stats are already effectively final by social convention.

### Player Profiles

Finals sessions appear in a player's session history with a "🏆 Finals Day 1" label instead of a date-only label. Match stats from finals are separated into a "Finals" section on the profile.

### Finals Results Archive

Finals Event page shows final results permanently once status = `completed`:
- Group A winner, Group B winner
- Full final standings per group
- Best-of-3 series game-by-game breakdown

---

## 15. Implementation Phases

This feature is large. Below is the recommended phased rollout. Each phase is independently deployable and functional.

### Phase 1 — Finals Planning (Offline Prep)
**Goal:** Admin can build and save a Finals player pool + group assignments, and create the two Finals Session rows.

Deliverables:
- DB: `finals_events`, `finals_participants` tables + sessions `session_type` + `finals_event_id` columns
- API: `POST /api/finals`, `POST /api/finals/[id]/participants`, `DELETE` participant, `POST /api/finals/[id]/generate-breakdown`, `POST /api/finals/[id]/confirm-breakdown`, `POST /api/finals/[id]/generate-sessions`
- UI: Finals Event page with tabs 1–3, player add/remove, breakdown table, session date picker
- Sessions list: Finals Sessions appear distinctly; no format/match UI yet

### Phase 2 — Fixed-Partner Format (Simpler format first)
**Goal:** Admin can set partner pairs and generate all round-robin matches for both groups. Scores can be entered. Standings update live.

Deliverables:
- DB: `finals_formats` table; `match_type` + `finals_group` columns on `matches`
- API: `POST /api/sessions/[id]/finals-format`, generate-matches endpoint
- UI: Format picker (both cards shown, but only fixed-partner active), partner pairing UI, match tabs (Group A / Group B), standings within tab
- Match recording: works via existing `/api/matches` with new fields

### Phase 3 — Playoffs Format (Group Stage)
**Goal:** Admin can choose Playoffs format; all group-stage matches auto-generated with rotating partners; individual standings computed.

Deliverables:
- Match generation algorithm adapted for group-scoped, upfront, all-at-once scheduling
- Live standings with individual point tracking
- "Top 4" highlight once all group-stage matches complete

### Phase 4 — Playoffs Best-of-3 Final
**Goal:** After group stage, top 4 seed into a Best-of-3 series. Series tracked and closed.

Deliverables:
- DB: `finals_series` table; `series_id` column on `matches`
- API: series creation, PATCH to update game counts
- UI: Series card (game-by-game display), series winner declaration
- `finals_format.status` transitions: `matches_generated → playoffs_complete → completed`

### Phase 5 — Polish, Stats, Archive
**Goal:** Finals results roll up cleanly; profile/leaderboard treatment; archive view.

Deliverables:
- Leaderboard: "Include Finals Matches" toggle
- Player profiles: Finals session labels, separate finals section
- Finals Event page: archive/completed state with full results summary
- Any outstanding edge cases from testing

---

## 16. Resolved Design Decisions

All open questions from v0.1.0 have been answered. Recorded here for traceability.

| # | Question | Decision |
|---|----------|----------|
| 1 | Can a player play both Day 1 and Day 2? | **Deferred.** Out of scope for this spec. Separate spec later. |
| 2 | One Finals Event per season, or multiple? | **One per season.** `UNIQUE` constraint on `season_id`. End-of-season only. |
| 3 | Individual points in playoffs: flat +2 or actual score? | **Flat +2 per win per player.** Simple and consistent with fixed-partner standings. |
| 4 | Best-of-3 seeding: 1+4 vs 2+3, or 1+2 vs 3+4? | **1+4 vs 2+3** (serpentine). Balances team strength. |
| 5 | Fixed-partner tie resolution? | **2-way tie:** admin records a singles tiebreak match. **3+ way tie:** admin manually picks winner in app for now. Both cases highlighted prominently in standings. |
| 6 | Finals in same sessions list or separate route? | **Same sessions list**, in a dedicated pinned section at the top (same pattern as past/test sessions). |
| 7 | Match score format? | **21-point games**, same as regular nights. App accepts whatever scores are entered. |
| 8 | Auto-add: include tally-only players? | **Yes.** Heuristic uses only Skill + Win Rate, both available from tally data. |
| 9 | Participation cap for scoring? | **N/A.** Participation dropped from heuristic entirely. |
| 10 | Finals matches in season leaderboard by default? | **Permanently excluded.** Season leaderboard is locked before finals for trophy ordering. No toggle. |

8. **Should the `[Auto-add from season]` shortcut include players who only have tally session data?** They have W/L but no match-by-match stats, so Recent Form would default to 50.

9. **Participation cap:** This spec defaults to `min(matches / 20, 1)`. Is 20 the right cap, or should it scale with the actual season length?

10. **Should Finals match data be excluded from the regular leaderboard by default (admin can toggle in), or included by default?** This spec defaults to excluded, consistent with the Test Sessions pattern.
