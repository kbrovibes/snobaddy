# Season Newsletter — Spec & Regeneration Guide

This is the canonical source of truth for **what** the season newsletter contains, **why** each section exists, and **how** to regenerate it. The actual rendering lives in `src/lib/newsletter/generate.ts`; this document explains the intent so a future agent (or human) can rebuild the generator from scratch without losing decisions that took us a few iterations to reach.

If this file and the code disagree, the code wins for behavior, but this file is the place to update the *intent* before changing the code.

---

## Hard rules

1. **Numbers must match the leaderboard.** A reader comparing the newsletter to `/leaderboard` should see the same wins, losses, games, and rankings. Per-player W/L combines `matches` and `session_tally` by **summing** both, with the same exclusions the leaderboard applies (locked sessions excluded, matches involving a soft-deleted player excluded, only `onboarding_complete = true` players appear).
2. **Scope is the current season, up to the stats lock date.** Sessions: non-test, `date <= stats_lock_date`. Matches: `match_type = 'regular'`. The lock date is the cutoff — anything past it is invisible to the recap.
3. **Two tracking modes coexist.** Full-detail nights produce `matches` rows (and only those nights have per-match scores and margins). Whiteboard tally nights produce `session_tally` rows (per-player W/L only, no margin data). The intro must be honest about both.
4. **Self-recusal is honored.** Players in `AWARD_EXCLUDE_NAMES` (currently `{"sekhar durga"}`) are dropped from award eligibility before sorting, but still appear in match stats, math corner, UBR sections, pair stats, and a closing footnote.
5. **Voice is a warm narrator, not a stat sheet.** No fact-dump opening. Numbers are framed with a sentence around them. "1,611 individual W/L outcomes" alone is forbidden; "the recorder's hand cramps from a season of whiteboard tally" is encouraged.
6. **No regeneration UI.** The viewer page renders the saved row. Generation is a one-shot action from the admin Seasons page (button per eligible season) or the CLI seed script. There is no "regenerate with extra context" form anymore.

---

## Section structure (in order)

### 1. Header
```
# {Season Name} — Season Recap
_{Start Date} – {Lock Date or End Date}_
```
Date range uses the **lock date** when present; otherwise the season end. No "X sessions" line under the dateline — that's repeated downstream.

### 2. A Brief Word From The Whiteboard (intro)
Two prose paragraphs. The first is narrator-voice scene setting — Mondays/Thursdays at Snoqualmie, two courts, knees protesting, kids laughing. Mention the session count organically. The second points at what follows — the people who showed up, who won together, what's worth screenshotting. Reassure that numbers match the leaderboard.

**Optional opt-in context.** If an admin passes `extraContext` to `generateNewsletter(snap, { extraContext })`, that string is inserted as a leading paragraph in this section. This is mostly used from the CLI seed script when prepping the end-of-season writeup.

**Do not lead with a count.** No "X sessions, Y matches, Z outcomes". The numbers belong inside sentences.

### 3. 🥜 The Badminton Nut
Mirrors the leaderboard's award of the same name. The winner is the player with the most games. Runners-up are #2 and #3.

Algorithm (matching `LeaderboardTable.tsx`):
- Sort by `games DESC, name ASC`
- Drop players in `AWARD_EXCLUDE_NAMES`
- Top 1 → 🏆 winner with sentence
- Top 2-3 → 🥈 runners-up as bullet list, each with games / W-L / win%

Winner sentence theme: showing up. Avoid "addicted" / "obsessed" — go affectionate.

### 4. ✂️ The Nut Cracker
Mirrors the leaderboard's other award. Highest win rate among players with at least `floor(top_nut_games / 2)` games. The threshold is described in the section subtitle so the reader can sanity-check who was eligible.

Algorithm:
- Filter: `games >= floor(badmintonNut.games / 2) && games > 0`
- Drop players in `AWARD_EXCLUDE_NAMES`
- Sort by `win_pct DESC, games DESC`
- Top 1 → 🏆 winner
- Top 2-3 → 🥈 runners-up

Winner sentence theme: efficiency, walking on, doing the math, walking off.

### 5. 📐 The Math Corner: Who Was *Actually* Efficient?
The thinking-person's section. Compute the **bucket-weighted** average win rate per skill level (1–5), counting only "qualified" players (≥ `MIN_GAMES_FOR_RATE = max(10, ceil(totalSessions * 1.5))` games — enough sample to be meaningful).

Render:
- One opening paragraph explaining the math.
- A table of `skill → avg win % → qualified player count`.
- Top 5 over-performers, with `winPct - bucketAvg = delta` in percentage points.
- A single-sentence callout of the top over-performer.
- 3 under-performers (lowest delta) with a "rating system would like a quiet word" framing.
- UBR Risers (top 5 by `ubr_delta`) — table format.
- UBR Reality Checks (bottom 5, only if at least one is negative) — table format.

The UBR sections include **every** player (no award-recusal filter) — these are ratings, not awards.

### 6. 🔍 Fun Observations
A bulleted list, 12–20 items. Each bullet is one short paragraph, written in the warm narrator voice. Some bullets are **individual** (one or two players); others are **collective** (the season as a whole). Bullets gate on data availability — if there's no "undefeated player", that bullet is skipped, not stubbed.

Required bullet candidates (emit when data supports):
- **Tracking-mode mix** ("X of N nights tracked match-by-match, the rest tally-only")
- **Close-match percentage** of scored matches
- **Average match margin** (scoped to scored subset)
- **Most-played frequent partnership**
- **Strongest vs unluckiest** frequent pair, compared in percentage points
- **Clean-sweep partnerships** (4+ games, 0 losses)
- **Winless partnerships** (3+ games, 0 wins)
- **Underdog crew** (level ≤ 2 with ≥ 55% win rate, qualified)
- **Slumpers** (level ≥ 4 with ≤ 50% win rate, qualified)
- **Wins-per-session champion**
- **Biggest UBR shake-up** in absolute terms
- **Top-3 UBR risers** as a cohort
- **Top-2 UBR sliders** as a cohort
- **Tally-mode workload** (when ≥ 1 tally night exists)
- **Gender split** of court time + top women's win rate
- **Best cross-skill partnership** (`s1 !== s2`, 3+ games)
- **Undefeated player** (6+ games, 0 losses)
- **Drop-in count** (players with < ~5 games — debuts/comebacks)
- **Roster breadth** ("X unique humans took the court")
- **Self-recused footnote** — for each excluded player, their actual record with a one-line acknowledgment that they declined to be considered

Keep observations relentlessly specific to *this season's* data. No evergreen platitudes.

### 7. Footer
One-line italic line at the bottom:
```
_Compiled {Long Date} from match data through {Lock Date}. Stats locked, drama unlocked._
```
The word "Generated" is intentionally **not** used anywhere in the rendered newsletter or the viewer page — we use "Compiled" in the footer and "As of" on the page header.

---

## Data sources (and where they come from)

| Source | Provides | Notes |
|---|---|---|
| `seasons` | Season name, dates, `stats_lock_date` | The lock date defines the scope cutoff |
| `sessions` | All in-scope sessions (non-test, on/before lock) | Used to split into full-detail vs tally-only |
| `matches` | Per-match rosters, scores, winning team | `match_type='regular'` only; skip matches with any soft-deleted player |
| `session_tally` | Per-player W/L per session | Whiteboard-mode source |
| `session_players` | Check-in records | Helps attendance but is **not** required — tally rows and match rosters also imply attendance |
| `ubr_history` | Per-session rating before/after | Used for season-wide delta |
| `players` | Name, skill level, gender, deletion, onboarding-complete | Roster filter mirrors leaderboard |

`getSeasonStats(seasonId)` aggregates all of the above into `SeasonStatsSnapshot`. That snapshot is the **only** input to `generateNewsletter`. If a stat is missing from the snapshot, the generator cannot use it — extend the snapshot first.

---

## Generation: three paths

### Path A — Admin clicks the Generate button (production)
Only available on a season whose `stats_lock_date` is set and in the past, and which doesn't yet have a `season_newsletters` row.
- UI: button on the season card (`GenerateNewsletterButton`)
- Endpoint: `POST /api/admin/seasons/[id]/newsletter/generate`
- Auth: admin (server-side)
- Side effect: writes one row to `season_newsletters`; the page refresh swaps the button for a link.

### Path B — First-visit auto-generate (viewer page fallback)
If an admin lands on `/admin/seasons/[id]/newsletter` for a season that has no row yet, the page generates and saves on the fly. This is a safety net — Path A is the intended UX.

### Path C — CLI seed (operator)
```
set -a && source .env.local && set +a && \
npx tsx scripts/seed-newsletter.mts <seasonId>
```
The seed script imports the same `getSeasonStats` + `generateNewsletter` + `upsertNewsletter` functions the runtime uses, so the output is identical. Use this when:
- You need to regenerate (the in-app regenerate UI is gone)
- You're updating the generator and want to refresh existing seasons

`upsertNewsletter` updates the row in place; the database trigger increments `version` automatically but the version is **not** surfaced in the UI.

---

## How to update the algorithm without breaking things

1. **Touch the snapshot first.** If you need a new stat, add it to `SeasonStatsSnapshot` in `src/lib/newsletter/stats.ts` and populate it in `getSeasonStats`. Do not compute stats inline in `generate.ts`.
2. **Keep alignment with the leaderboard.** Any change to "what counts as a win" must match `getActivePlayers` in `src/lib/db/players.ts`. If you can't keep them aligned, refactor both behind a shared helper.
3. **Skip-when-empty.** Every section and bullet should gracefully omit itself when its data isn't present. No "TBD", no zero-state placeholders.
4. **Re-seed every existing newsletter** after a generator change so the saved markdown reflects the new logic. The seed script does that for one season at a time; loop if you have multiple.
5. **Update this file** when you change section structure or eligibility rules. Future agents read this.
