# Snobaddy UBR (Universal Badminton Rating) Algorithm

> Version 1.0 — April 2026
> This document defines the rating algorithm used by snobaddy. All code that computes or updates UBR scores **must** reference this file as the source of truth.

---

## 1. Overview

Snobaddy UBR is a **modified Elo rating system** designed for recreational doubles badminton. It draws inspiration from:

- **Universal Badminton Rating (UBR)** — score-aware, performance-based adjustments
- **Glicko-1** — rating deviation (confidence) tracking
- **Universal Tennis Rating (UTR)** — team-average doubles handling, time-weighted recency

### Design goals

1. Work across all three snobaddy scoring modes (full, simple, whiteboard/tally)
2. Reward performing above expectation, not just winning
3. Handle the drop-in nature of club play (irregular attendance, varying opponents)
4. Be transparent and explainable to players

---

## 2. Rating scale

| Range | Tier | Description |
|-------|------|-------------|
| < 2500 | Shuttle | Beginner — learning the game |
| 2500–3499 | Bronze | Recreational — enjoys regular play |
| 3500–4499 | Silver | Intermediate — consistent rallies, developing strategy |
| 4500–5499 | Gold | Advanced-Intermediate — strong court awareness |
| 5500–6499 | Platinum | Advanced — powerful smashes, deceptive drops |
| 6500+ | Diamond | Expert — elite club-level player |

Ratings are displayed as integers. Internal calculations use floating point.

---

## 3. Initial rating

A player's initial UBR is seeded from their `skill_level` (1.0–5.0 numeric, set at onboarding):

```
initial_ubr = 1500 + (skill_level × 1000)
```

| Skill Level | Initial UBR | Tier |
|-------------|-------------|------|
| 1.0 | 2500 | Bronze |
| 1.5 | 3000 | Bronze |
| 2.0 | 3500 | Silver |
| 2.5 | 4000 | Silver |
| 3.0 | 4500 | Gold |
| 3.5 | 5000 | Gold |
| 4.0 | 5500 | Platinum |
| 4.5 | 6000 | Platinum |
| 5.0 | 6500 | Diamond |

Players also start with:
- **Rating Deviation (RD):** 350 (high uncertainty — "we don't know this player well yet")
- **Match count:** 0

---

## 4. Rating Deviation (RD)

RD represents **confidence** in a player's rating. Borrowed from Glicko-1:

- **New player:** RD = 350 (very uncertain)
- **Minimum RD:** 50 (even active players retain some uncertainty)
- **Maximum RD:** 350 (capped — never exceeds initial)

### RD decay (inactivity)

After each **rating period** (= 1 finalized non-test session where the player did NOT participate), RD increases:

```
RD_new = min(350, sqrt(RD_old² + c²))
```

Where `c = 15` (controls how quickly uncertainty grows). This means:
- A player with RD=50 who misses 10 sessions → RD ≈ 80
- A player who misses 50 sessions → RD ≈ 160
- After long absence → caps at 350 (treated like a new player)

### RD after a match

After processing matches in a session:

```
RD_new = max(50, 1 / sqrt(1/RD_old² + 1/d²))
```

Where `d` is the **match impact variance** (see Section 5). In practice, each match reduces RD slightly, so active players converge to low RD.

---

## 5. Core rating update — Match-based (Full & Simple modes)

For sessions with explicit match records (all 4 player IDs known), we use a **doubles Elo** approach.

### Step 1: Team ratings

For a match between Team 1 (players A, B) and Team 2 (players C, D):

```
R_team1 = (R_A + R_B) / 2
R_team2 = (R_C + R_D) / 2
```

### Step 2: Expected outcome

Using the logistic curve (Elo formula):

```
E_team1 = 1 / (1 + 10^((R_team2 - R_team1) / 400))
E_team2 = 1 - E_team1
```

`E` represents the probability that a team wins. If teams are equally rated, E = 0.5.

### Step 3: Actual outcome (S)

```
S = 1.0 if the team won
S = 0.0 if the team lost
```

### Step 4: Score margin multiplier (full mode only)

When exact scores are available (not simple mode where scores are 1/0):

```
score_diff = |winner_score - loser_score|
margin_mult = log2(1 + score_diff) / log2(22)
```

This produces:
| Score | Margin | Multiplier |
|-------|--------|------------|
| 21-19 | 2 | 0.33 |
| 21-17 | 4 | 0.49 |
| 21-15 | 6 | 0.59 |
| 21-12 | 9 | 0.69 |
| 21-10 | 11 | 0.75 |
| 21-5 | 16 | 0.85 |
| 21-0 | 21 | 0.96 |

For simple mode (no real scores): `margin_mult = 0.5` (neutral — equivalent to a 21-15 game).

### Step 5: K-factor

The K-factor controls how much a single match can change a rating:

```
K_base = 48  if match_count < 15     (provisional — rating moves fast)
K_base = 36  if match_count < 40     (establishing — settling in)
K_base = 24  if match_count >= 40    (established — stable rating)
```

Adjusted by rating deviation:

```
K = K_base × (1 + (RD - 50) / 600)
```

This means:
- RD = 50 (confident): K = K_base × 1.0
- RD = 200 (uncertain): K = K_base × 1.25
- RD = 350 (very uncertain): K = K_base × 1.5

### Step 6: Rating change

For each player on the team:

```
ΔR = K × (S - E) × (0.5 + margin_mult)
```

The `(0.5 + margin_mult)` factor scales from ~0.83 (close game) to ~1.46 (blowout). This means:
- **Close loss to a much stronger team** → minimal rating loss (you performed near expectation)
- **Blowout win against a weaker team** → moderate gain (expected, but rewarded for dominance)
- **Upset win against a stronger team** → large gain (you exceeded expectations)
- **Blowout loss to a weaker team** → large loss (significantly underperformed)

### Step 7: Apply

```
R_new = R_old + ΔR
```

Ratings are **floored at 1000** (no one goes below 1000).

---

## 6. Rating update — Tally-based (Whiteboard mode)

Whiteboard/tally sessions record **per-player win/loss totals** without identifying specific opponents. This requires a different approach.

### The Session Pool Method

Since we don't know who played whom, we treat the session as a **round-robin pool** where each player competed against the average strength of the group.

### Step 1: Session pool rating

```
R_pool = average(R_i for all players i in the session)
```

Only players with at least 1 win or 1 loss are included (spectators excluded).

### Step 2: Expected win rate

For each player with rating R_i:

```
E_i = 1 / (1 + 10^((R_pool - R_i) / 400))
```

This is the expected fraction of matches this player should win against an average-rated opponent from the pool.

### Step 3: Actual win rate

```
S_i = wins_i / (wins_i + losses_i)
```

### Step 4: Effective match count

Each session's tally counts as a number of "virtual matches" for K-factor and RD purposes:

```
effective_matches = min(floor((wins + losses) / 2), 8)
```

Capped at 8 to prevent a single high-volume tally session from dominating the rating. Dividing by 2 because each real match involves 2 outcomes (a win for one side, a loss for the other).

### Step 5: K-factor

Same base K as match-based (Section 5, Step 5), but applied per effective match:

```
K_tally = K × 0.75
```

The 0.75 discount reflects the **lower information quality** of tally data (no opponent-specific info).

### Step 6: Rating change

```
ΔR = K_tally × effective_matches × (S_i - E_i)
```

### Step 7: Apply

```
R_new = R_old + ΔR
R_new = max(1000, R_new)
```

### Why discount tally data?

Tally mode loses critical information: who played whom. A player who went 5-3 against top players is very different from 5-3 against beginners. The 0.75 discount and effective match cap prevent tally sessions from having outsized influence on ratings.

---

## 7. Session processing order

When a non-test session is finalized (`status → completed`, `is_test_session = false`):

1. **Identify mode:** Check `whiteboard_mode` and whether match records exist
2. **Fetch all participants:** Players in `session_players` for this session
3. **Decay RD** for all players who have a UBR record but are NOT in this session (Section 4)
4. **Process rating changes:**
   - If match records exist → Section 5 (process each match chronologically by `played_at`)
   - If tally-only → Section 6
   - If both exist (edge case) → process match records first, then ignore tally
5. **Update RD** for all participants (Section 4, "RD after a match")
6. **Increment match count** for all participants
7. **Cache results** to `ubr_ratings` table
8. **Record history** to `ubr_history` table for sparkline/trend display

---

## 8. Finals sessions

Finals sessions (`session_type = 'finals'`) use `finals_matches` which have a different schema but contain the same essential data (4 player IDs, scores, winning team). They are processed identically to full-mode matches (Section 5).

---

## 9. Recalculation

UBR ratings are **cached** but can be **fully recalculated** from match history:

1. Reset all players to initial ratings (from skill_level)
2. Fetch all finalized non-test sessions, ordered by date ascending
3. Process each session sequentially using the rules above
4. Store final state to `ubr_ratings`

This ensures ratings are always reproducible and auditable.

---

## 10. Database schema

### `ubr_ratings` (cache — current state)

| Column | Type | Description |
|--------|------|-------------|
| `player_id` | uuid PK, FK → players | Player reference |
| `rating` | numeric(8,2) | Current UBR rating |
| `rating_deviation` | numeric(6,2) | Current RD (confidence) |
| `match_count` | integer | Total rated matches processed |
| `tier` | text | Computed tier label (Shuttle/Bronze/Silver/Gold/Platinum/Diamond) |
| `updated_at` | timestamptz | Last recalculation time |

### `ubr_history` (audit trail — one row per session per player)

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid PK | Row ID |
| `player_id` | uuid FK → players | Player reference |
| `session_id` | uuid FK → sessions | Session that triggered the update |
| `rating_before` | numeric(8,2) | Rating entering this session |
| `rating_after` | numeric(8,2) | Rating after this session |
| `rating_change` | numeric(8,2) | Delta (positive = gained) |
| `match_count` | integer | Cumulative match count after this session |
| `created_at` | timestamptz | When this record was written |

---

## 11. Edge cases

| Scenario | Handling |
|----------|----------|
| Player has no UBR record | Create one using initial rating from skill_level |
| Player's skill_level changes | Does NOT retroactively change UBR (only affects initial seed) |
| Test session finalized | Skip entirely — no UBR processing |
| Session with 0 matches and 0 tally | Skip — no data to process |
| Player checked in but has 0W/0L in tally | Skip that player — no information |
| Match with same player on both teams | Should not happen (validated at record time) — skip if found |
| Rating would drop below 1000 | Floor at 1000 |
| Very lopsided teams (>1500 rating gap) | K-factor still applies but expected outcome is ~0.97/0.03, so change is naturally small for favorites |

---

## 12. Constants reference

| Constant | Value | Description |
|----------|-------|-------------|
| `INITIAL_RD` | 350 | Starting rating deviation |
| `MIN_RD` | 50 | Floor for rating deviation |
| `MAX_RD` | 350 | Cap for rating deviation |
| `RD_DECAY_C` | 15 | Inactivity RD growth rate |
| `K_PROVISIONAL` | 48 | K-factor for < 15 matches |
| `K_ESTABLISHING` | 36 | K-factor for 15–39 matches |
| `K_ESTABLISHED` | 24 | K-factor for 40+ matches |
| `ELO_DIVISOR` | 400 | Standard Elo scaling |
| `TALLY_DISCOUNT` | 0.75 | Tally data quality discount |
| `TALLY_MAX_EFFECTIVE` | 8 | Max effective matches per tally session |
| `RATING_FLOOR` | 1000 | Minimum possible rating |
| `MARGIN_LOG_BASE` | log2(22) | Score margin normalization |
| `SIMPLE_MODE_MARGIN` | 0.5 | Default margin multiplier when no scores |

---

## 13. Example calculations

### Example 1: Full-mode match

**Setup:** Player A (4800, RD=80, 25 matches) paired with Player B (4200, RD=120, 18 matches) vs Player C (5100, RD=60, 50 matches) and Player D (4600, RD=90, 35 matches). Score: Team 1 wins 21-17.

```
R_team1 = (4800 + 4200) / 2 = 4500
R_team2 = (5100 + 4600) / 2 = 4850

E_team1 = 1 / (1 + 10^((4850 - 4500) / 400))
        = 1 / (1 + 10^0.875)
        = 1 / (1 + 7.499)
        = 0.118

score_diff = 21 - 17 = 4
margin_mult = log2(1 + 4) / log2(22) = log2(5) / 4.459 = 2.322 / 4.459 = 0.521

For Player A (25 matches, RD=80):
  K_base = 36  (15 ≤ 25 < 40)
  K = 36 × (1 + (80 - 50) / 600) = 36 × 1.05 = 37.8
  ΔR = 37.8 × (1.0 - 0.118) × (0.5 + 0.521)
     = 37.8 × 0.882 × 1.021
     = 34.0

Player A: 4800 → 4834 (+34) — big gain for upset win

For Player C (50 matches, RD=60):
  K_base = 24
  K = 24 × (1 + (60 - 50) / 600) = 24 × 1.017 = 24.4
  ΔR = 24.4 × (0.0 - 0.882) × (0.5 + 0.521)
     = 24.4 × (-0.882) × 1.021
     = -22.0

Player C: 5100 → 5078 (-22) — moderate loss for upset loss
```

### Example 2: Tally-only session

**Setup:** 8 players in a whiteboard session. Player X has rating 4500, RD=100, 30 matches. Session pool average = 4200. Player X goes 6W-2L.

```
E_x = 1 / (1 + 10^((4200 - 4500) / 400))
    = 1 / (1 + 10^(-0.75))
    = 1 / (1 + 0.178)
    = 0.849

S_x = 6 / (6 + 2) = 0.75

effective_matches = min(floor(8/2), 8) = 4

K_base = 36 (30 matches)
K = 36 × (1 + (100 - 50) / 600) = 36 × 1.083 = 39.0
K_tally = 39.0 × 0.75 = 29.25

ΔR = 29.25 × 4 × (0.75 - 0.849)
   = 29.25 × 4 × (-0.099)
   = -11.6

Player X: 4500 → 4488 (-12)
```

Player X was expected to win 85% but only won 75% — slight rating drop despite a winning record. This is the "performance vs expectation" principle at work.

---

## 14. Display

- **Leaderboard:** Show UBR rating, tier badge, and trend arrow (up/down/stable based on last 3 sessions)
- **Player profile:** Show UBR rating, tier, RD (as "confidence: high/medium/low"), rating history sparkline
- **Session results:** Show per-player rating change (+/- after each session)

### Confidence labels

| RD Range | Label |
|----------|-------|
| 50–100 | High confidence |
| 101–200 | Medium confidence |
| 201–350 | Low confidence (provisional) |
