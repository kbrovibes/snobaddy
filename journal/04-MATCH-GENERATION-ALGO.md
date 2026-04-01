# Chapter 4: The Match Generation Algorithm

> A deep dive into how snobaddy proposes fair, diverse, and balanced doubles matches
> for a drop-in badminton club — and the bugs we found along the way.

---

## Table of Contents

1. [The Problem](#the-problem)
2. [High-Level Architecture](#high-level-architecture)
3. [The Queue and the Cap](#the-queue-and-the-cap)
4. [Wave Logic: Two Courts at Once](#wave-logic-two-courts-at-once)
5. [The Scoring Function](#the-scoring-function)
6. [Finding the Best Match: `findBestMatch()`](#finding-the-best-match)
7. [Balancing Teams Within a Match](#balancing-teams-within-a-match)
8. [Memory: How Deleted Matches Are Remembered](#memory-how-deleted-matches-are-remembered)
9. [Substitutions: When a Player Checks Out](#substitutions-when-a-player-checks-out)
10. [Backfill: Keeping the Queue Full Automatically](#backfill-keeping-the-queue-full-automatically)
11. [Why This Works](#why-this-works)
12. [Bugs Found and Fixed](#bugs-found-and-fixed)
13. [Ideas for Future Improvement](#ideas-for-future-improvement)

---

## The Problem

A drop-in badminton session has:
- **2 courts** running simultaneously
- **8–40 players** checked in, varying skill levels (1–5)
- **No pre-registration** — players arrive and leave throughout the evening
- An organizer who, without help, must mentally juggle who played last, who's been waiting
  the longest, and how to balance teams fairly — while also playing

The whiteboard approach breaks down fast. The goal of the match generator is to replace
the organizer's mental model with an automated suggester that proposes the next 2–4 matches
at any time, respecting fairness, balance, and variety.

---

## High-Level Architecture

```
Trigger (score recorded / player checks out / match deleted)
    │
    ▼
backfillMatchQueue(sessionId)
    │
    ├── How many players are checked in right now?
    ├── What is the dynamic queue cap for that count?
    ├── How many active proposals already exist?
    │
    └── needed = cap - existing  ──► 0? → done
                                  ──► >0? → proposeNextMatches(sessionId, cap)
                                                │
                                                ├── Fetch checked-in players + skills
                                                ├── Fetch active proposals (wave state)
                                                ├── Fetch soft-deleted proposals (memory)
                                                ├── Fetch recent matches (back-to-back)
                                                ├── Fetch session history (wait times + diversity)
                                                │
                                                └── for each needed slot:
                                                        findBestMatch()  →  balanceTeams()  →  INSERT
```

All DB work uses the **service role key** (bypasses RLS) so the algorithm can see every
player's history regardless of who triggered the request.

---

## The Queue and the Cap

The queue is not a fixed size. It scales with how many players are checked in:

```
Checked-in count │ Queue cap │ Why
─────────────────┼───────────┼──────────────────────────────────────────────────
    < 8          │     0     │ Can't fill 2 full matches; no auto-generation
   8 – 11        │     2     │ One wave (both courts)
  12 – 15        │     3     │ One wave + one overflow match
  ≥ 16           │     4     │ Two full waves
```

This prevents the algorithm from proposing matches that look absurd (e.g., 4 of 6
available players locked into a queue two waves deep).

### "Needed" is the key

`backfillMatchQueue` computes:

```
needed = cap - count(active_proposals)
```

If the queue is already full, `needed = 0` and the function returns immediately.
This is important: the function is **idempotent** — calling it when the queue is
already full does nothing.

---

## Wave Logic: Two Courts at Once

Two matches run simultaneously on Court 1 and Court 2. A player cannot be in
**both** matches of a wave — that would require being in two places at once.

```
QUEUE SLOT │ WAVE │ COURT
───────────┼──────┼──────
    0      │  1   │  1
    1      │  1   │  2
    2      │  2   │  1
    3      │  2   │  2
```

### Hard lock within a wave

When filling slot 1, the algorithm locks out the 4 players already in slot 0.
When filling slot 2, the wave resets — those players are available again.

```
Wave 1:
  Slot 0 (Court 1): Alice, Bob vs Carol, Dave      ← lock: A, B, C, D
  Slot 1 (Court 2): Eve, Frank vs Grace, Henry     ← only picks from {E, F, G, H, ...}

Wave 2 (lock resets):
  Slot 2 (Court 1): Bob, Grace vs Alice, Eve       ← A, B, C, D back in pool
  Slot 3 (Court 2): ...
```

### Fresh-player preference in Wave 2

When filling Wave 2, the algorithm first tries to form a match using **only**
players who did NOT appear in Wave 1. This ensures that if there are ≥ 8 rested
players, everyone plays before anyone plays twice.

```
12 players checked in:

Wave 1 uses: A, B, C, D, E, F, G, H  (8 players, both courts)
Wave 2 pool first: I, J, K, L         (4 remaining — just enough for 1 match)

If only 9 players checked in:
Wave 1 uses: A, B, C, D, E, F, G, H
Wave 2 fresh pool: I                  (only 1 — not enough for a full match)
Wave 2 falls back to full pool: A–I available
```

---

## The Scoring Function

Every possible 4-player lineup is scored. The highest score wins.

```
score = 1000  (base)
      + Σ wait-time bonus per player
      + phase bonus (early session, wide skill range)
      − back-to-back penalties
      − team imbalance penalty
      − sanity-check penalty
      − diversity penalties
      ± jitter (tie-breaking randomness)
```

Here is each factor in detail:

---

### Factor 1: Back-to-Back Penalty  `−2000 per player`

The single largest penalty. If a player was in the **most recent completed match**
of this session, they receive −2000 points for every lineup that includes them.

```
Last match: Alice, Bob vs Carol, Dave

Candidate lineup: Alice, Eve vs Frank, Grace
  → Alice was in last match → score −2000
  → Result: 1000 − 2000 = −1000 (very likely to lose to any lineup without Alice)

Candidate lineup: Eve, Frank vs Grace, Henry
  → None in last match → no penalty
  → Result: 1000 + (other factors)
```

Note: only the **single most recent match** sets the back-to-back flag. The player
from the second-most-recent match is not penalised by this factor (they may be
naturally disadvantaged by lower wait time anyway).

**Why −2000?** It needs to dominate the wait-time bonus. The largest possible
wait bonus for one player is roughly `wait_minutes × 3`. After 60 minutes of
waiting, that's +180. The −2000 penalty outweighs even extreme waits, so a player
who just came off court almost never gets picked again immediately.

---

### Factor 2: Team Skill Balance  `−100 per skill level of difference`

Each player has a skill level of 1–5. The algorithm sums each team's total skill
and penalises the gap:

```
Teams: [Alice(4) + Bob(3)] vs [Carol(2) + Dave(1)]
  Team 1 total: 7
  Team 2 total: 3
  Diff: 4
  Penalty: −400

Teams: [Alice(4) + Carol(2)] vs [Bob(3) + Dave(3)]
  Team 1 total: 6
  Team 2 total: 6
  Diff: 0
  Penalty: 0  ← ideal
```

The −100/level scaling means a 1-level difference (−100) is meaningful but
beatable by wait-time bonuses. A 4-level difference (−400) is very hard to
overcome and almost always loses to a more balanced lineup.

---

### Factor 3: Outlier Sanity Check  `−1000 per isolated player`

Even if the teams are balanced overall, having one extreme outlier in a 4-player
group makes for a bad game. This penalty fires if any player's skill is more than
2.5 levels away from the average of the other three.

```
Players: Alice(5), Bob(5), Carol(5), Dave(1)
  Dave's distance from avg of others (5): |1 − 5| = 4 > 2.5 → −1000

Players: Alice(4), Bob(4), Carol(3), Dave(2)
  No player is more than 2.5 from the others' average → no penalty
```

This catches the case where two very strong players team up against a
strong and a beginner — technically "balanced" by total skill but unfair to Dave.

---

### Factor 4: Diversity and History  `−5000 / −500 / −150`

The algorithm keeps a **working history** of all matches this session plus all
soft-deleted proposals. For each entry in that history, it checks:

```
Overlap level     │ Penalty  │ Meaning
──────────────────┼──────────┼──────────────────────────────────────────
All 4 same (any   │  −5000   │ Same group played or was already proposed
order)            │          │ and rejected. Very strong deterrent.
──────────────────┼──────────┼──────────────────────────────────────────
3 of 4 same       │   −500   │ Near-identical group, avoid unless needed
──────────────────┼──────────┼──────────────────────────────────────────
Same 2-player     │   −150   │ Same partnership (same side) appeared in
partnership       │          │ history. Mild nudge toward new pairings.
```

**4-player group is order-independent.** Alice+Bob vs Carol+Dave scores the same
−5000 whether history has it as Alice+Bob vs Carol+Dave or Carol+Dave vs Alice+Bob.

**The −5000 is a deterrent, not a hard block.** If all remaining combinations of
4 players from the available pool have been played, the algorithm still picks the
least-bad one. The penalty is large enough that only ±10 pt jitter and extreme
wait times could occasionally surface a repeated combo — but it will never win
against a genuinely new combination.

---

### Factor 5: Wait-Time Fairness  `+3 per minute waited`

For each player in the lineup, compute minutes since their last match (or since
check-in if they haven't played yet):

```
Alice: last match 45 min ago → +135 pts
Bob:   last match 8 min ago  → +24 pts
Carol: checked in 20 min ago, never played → +60 pts
Dave:  last match 30 min ago → +90 pts

Total wait bonus for this lineup: 135 + 24 + 60 + 90 = +309 pts
```

After ~30 minutes, a player accumulates +90 pts — enough to tip a tie between
two equally-balanced lineups in their favour. After ~60 minutes (+180 pts),
they can even overcome a 1-level team skill difference (penalty: −100).

**Why +3/min?** It should be:
- Large enough to matter after realistic wait times (10–40 min at a busy session)
- Small enough not to override meaningful skill imbalance (−100 per level)
- Fast enough that no one waits more than 2–3 waves without getting picked

---

### Factor 6: Phase Logic  `±50–100`

At the start of a session (fewer than 10 matches played), the algorithm applies
a small bonus for lineups with a wide skill spread. This lets beginners get on
court with stronger players early and learn from the game.

Once 10+ matches have been played (convergence phase), it switches to penalising
wide skill spreads instead, pushing toward tighter, more competitive games.

```
Early session (< 10 matches):
  skillRange = max_skill − min_skill of 4 players
  If skillRange ≥ 3: +100

Late session (≥ 10 matches):
  score −= skillRange × 50
```

---

### Factor 7: Jitter  `±10 per player (±40 total)`

A small random perturbation is added to each player's wait-time bonus:

```
score += (waitMinutes × 3) + random(−10, +10)
```

This has two purposes:
1. **Breaks scoring ties.** With identical wait times and skill levels, the same
   lineup always won. Jitter means the second-best combination occasionally wins.
2. **Varies the anchor.** Combined with the shuffle below, different invocations
   of the algorithm with the same inputs produce different outputs.

The ±40 total jitter is intentionally smaller than the minimum meaningful penalty
(−100 for a 1-level skill difference), so it never overrides real balance decisions.

---

## Finding the Best Match

`findBestMatch()` iterates all valid 4-player groups from the available pool and
returns the one with the highest score.

### The anchor pattern

With N available players, an exhaustive search would evaluate C(N,4) × 3 possible
lineups (3 team splits per group of 4). For N=20 that is 4845 × 3 = 14,535 scoring
calls. Too slow for a server-rendered page.

Instead, the algorithm picks one player as the **anchor** and iterates all triplets
from the rest:

```
anchor = sortedAvailable[0]
for each triple (p2, p3, p4) from the remaining players:
    evaluate anchor + p2 + p3 + p4 (all 3 team splits)
```

This reduces the work to C(N−1, 3) × 3 calls. For N=20: C(19,3) × 3 = 969.

### Why randomise the anchor?

**Before the fix:** The sort only separated "just played" from "rested" players.
Within each group, the order was whatever Supabase returned (DB insertion order).
The anchor was always the same person every call. If Alice is always the anchor
and the best Alice-containing lineup has been penalised by the −5000, the
algorithm falls through to the second-best Alice-containing lineup — which is
also always the same. The output converged to a fixed ranked list.

**After the fix:** Each group ("just played" and "rested") is **shuffled before
the sort**. Rested players still come first (the priority is preserved), but *which*
rested player anchors the search changes on every invocation. This surfaces the
full space of combinations over time rather than always exploring the same anchor's
neighbourhood.

```
Before (always same anchor):               After (shuffled):

Available: A(rested), B(rested), C(rested)   Available: shuffled → [C, A, B, ...]
Anchor always: A                             Anchor this call: C
Explores: A+B+C, A+B+D, A+C+D ...           Explores: C+A+B, C+A+D, C+B+D ...
```

### Candidate cap

If there are more than 20 other players, only the first 20 are considered as
candidates. This is a performance cap, not a correctness limit — in practice,
sessions rarely exceed 24 checked-in players.

---

## Balancing Teams Within a Match

Once `findBestMatch()` returns 4 players, `balanceTeams()` determines the optimal
2v2 split. There are exactly **3 possible splits** for any 4 players:

```
Players: Alice(4), Bob(3), Carol(2), Dave(1)

Split A: [Alice+Bob] vs [Carol+Dave]  →  team diffs: 7 vs 3 = gap 4
Split B: [Alice+Carol] vs [Bob+Dave]  →  team diffs: 6 vs 4 = gap 2
Split C: [Alice+Dave] vs [Bob+Carol]  →  team diffs: 5 vs 5 = gap 0  ← winner

Tiebreak (if two splits tie on gap): minimise intra-team skill spread
  = |player1_skill − player2_skill| for each team, summed
```

This step is entirely deterministic and runs after the randomised selection phase.
The same 4 players will always be assigned to the same teams.

---

## Memory: How Deleted Matches Are Remembered

When an admin deletes a proposed match, it is **soft-deleted** (a `deleted_at`
timestamp is set, the row remains). This is deliberate.

At the start of every `proposeNextMatches()` call, soft-deleted proposals are
fetched and seeded into `workingHistory` alongside real completed matches:

```typescript
const workingHistory = [
  ...sessionHistory,       // completed matches this session
  ...deletedProposed,      // previously rejected proposals
];
```

Every lineup in `workingHistory` contributes diversity penalties in `scoreMatch()`.
So a group that was deleted gets the same −5000 (or −500/−150 for partial overlap)
as a group that was already played. The algorithm strongly avoids re-proposing it.

**The memory is session-scoped.** Deleted proposals from previous sessions are not
carried over. If the same group should be avoided at every session, the only
mechanism is the session match history itself (which also feeds `workingHistory`).

---

## Substitutions: When a Player Checks Out

If a player leaves mid-session and they are in one or more proposed matches, the
algorithm tries to find a replacement rather than simply deleting the match:

```
Step 1: Find all active proposals containing the departed player.

Step 2: For each affected proposal:
    a. Who is available? (checked-in, not already in this match, not locked in
       another proposal)
    b. If no one → soft-delete this proposal and move on.
    c. If candidates exist → pick the one that minimises the new team skill diff:
          newSkillDiff = |teammate_skill + candidate_skill − opposing_team_skill|
          Pick candidate with lowest diff.
    d. Update the proposal in DB with the new player.

Step 3: After all replacements → backfillMatchQueue()
    Fills any gaps left by soft-deleted matches.
```

Example:

```
Proposed: Alice(4)+Bob(3) vs Carol(2)+Dave(1)   avg_skill_diff = 2

Bob checks out.

Alice's teammate slot is empty.
Opposing team total: 2+1 = 3
Candidates: Eve(3), Frank(4), Grace(2)

  Eve:   |4+3 − 3| = 4
  Frank: |4+4 − 3| = 5
  Grace: |4+2 − 3| = 3  ← lowest diff

New proposal: Alice(4)+Grace(2) vs Carol(2)+Dave(1)   avg_skill_diff = 3
```

---

## Backfill: Keeping the Queue Full Automatically

`backfillMatchQueue(sessionId)` is the entry point for all automatic queue
maintenance. It is called (awaited, not fire-and-forget) from three places:

```
1. POST /api/matches          (score recorded)
     → match inserted into DB
     → await backfillMatchQueue()
         Note: if the match was from a proposal, that proposal is deleted
         AFTER this call returns (client-side). The backfill here may see
         the queue still at cap and do nothing — that is correct. The next
         call handles it.

2. DELETE /api/proposed-matches/[id]   (admin manually removes a proposal)
     → deleteProposedMatch() soft-deletes, returns sessionId
     → await backfillMatchQueue(sessionId)
         The queue is now one short → generates one new proposal.

3. POST /api/sessions/[id]/checkout    (player leaves)
     → replacePlayerInProposedMatches()  (may soft-delete some proposals)
     → await backfillMatchQueue()
         Fills any gaps created by the substitution failure.
```

### The sequencing matters

When recording a score from a proposed match card, the client does:

```
1. POST /api/matches            → awaited, backfill runs (queue still full → no-op)
2. DELETE /api/proposed-matches → awaited, backfill runs (queue now short → +1 generated)
3. router.refresh()             → page reloads with new proposal in place
```

Step 2 is where the actual new match appears. If it were fire-and-forget (the old
bug), step 3 would run before the DB write and the new proposal would be invisible
until the next page load.

---

## Why This Works

The algorithm combines four independent signals that each address a different
failure mode:

| Failure mode without the signal         | Signal that prevents it           |
|-----------------------------------------|-----------------------------------|
| Same people play each other all night   | Diversity penalty (−5000)         |
| One player waits 90 minutes             | Wait-time bonus (+3/min)          |
| 21–2 blowouts from mismatched teams     | Team balance penalty (−100/level) |
| Player just finished, back on court     | Back-to-back penalty (−2000)      |
| Algorithm always picks same combination | Anchor shuffle + score jitter     |

No single signal is sufficient alone. Together, they produce match suggestions
that feel fair to players without requiring any organizer intervention.

The wave logic layer ensures that both courts always have a full match lined up
and that the algorithm doesn't ignore court capacity when planning ahead.

---

## Bugs Found and Fixed

### Bug 1: Fire-and-forget backfill (race condition)

**Symptom:** After recording a score, sometimes the queue didn't gain a new match.

**Cause:** `matches/route.ts` called `backfillMatchQueue().catch(() => {})`. The
response was sent before the backfill finished writing to the DB. The client's
`router.refresh()` ran before the new row was committed.

**Fix:** Changed to `await backfillMatchQueue(session_id)`.

---

### Bug 2: Delete route never triggered backfill

**Symptom:** Manually deleting a proposed match shrank the queue and it stayed
short until someone recorded a score.

**Cause:** `DELETE /api/proposed-matches/[id]` called `deleteProposedMatch()` and
returned success, but never called `backfillMatchQueue`. The queue had a permanent
gap.

**Fix:** Added `const sessionId = await deleteProposedMatch(id); if (sessionId)
await backfillMatchQueue(sessionId);` to the route handler.

---

### Bug 3: Backfill no-op when recording from a proposed card

**Symptom:** After filling in a score on a proposed match card, the queue was
sometimes one short until a page reload.

**Cause:** The client called POST /api/matches (triggering backfill) *before*
calling DELETE /api/proposed-matches. At the moment of the POST, the proposed
match was still in the DB, so `existingCount = cap` → `needed = 0` → no new
proposal generated. The subsequent DELETE correctly triggered its own backfill
(after Bug 2 was fixed).

**Effect after fix:** The backfill from the POST is a no-op (correct). The backfill
from the DELETE generates the new match. `router.refresh()` then shows it.

---

### Bug 4: Fixed anchor caused identical outputs

**Symptom:** Deleting a proposal and regenerating always produced the same pairing.

**Cause:** `findBestMatch()` sorted players by "just played / rested" but within
each group the order was DB insertion order (constant). The same player was always
the anchor, always exploring the same set of combinations in the same order.

**Fix:** Added `shuffled()` to randomise within each group before selecting the
anchor. Rested players are still preferred as anchors, but *which* rested player
varies per call.

---

### Bug 5: No tie-breaking randomness

**Symptom:** When multiple lineups scored identically (common with symmetric skill
distributions), the same one always won.

**Fix:** Added `±10 pt` jitter per player to the wait-time component. Small enough
to never override a genuine balance decision, large enough to break scoring ties.

---

## Ideas for Future Improvement

### 1. Skill-level drift over a session (in-session rating)

**Idea:** Temporarily adjust a player's effective skill based on their session
performance. If Alice (rated 3) is winning every match tonight, treat her as a 4
for team-balancing purposes within this session.

**How:** After each match, recompute an ephemeral `session_skill = base_skill +
win_rate_adjustment`. Pass this into the scoring function alongside the base level.

**Why it helps:** Long-running sessions surface skill gaps not captured by the
static 1–5 rating. A new player who improves quickly gets better opponents faster.

---

### 2. Partnership memory (avoid always pairing the same two people)

**Idea:** Track how often each 2-player combination has teamed up this session
(not just how often they've been in the same 4-player group). Apply a mild penalty
when a pair has teamed up more than N times.

**How:** Add a query counting team pairings in `sessionHistory`. The existing
−150 penalty covers same-side pairings in the 4-player diversity check, but a
dedicated partnership counter could be more granular.

---

### 3. Cross-session diversity memory

**Idea:** Keep a rolling window of recent sessions' matches per player. When
proposing a match, downweight groups that have played together heavily in recent
weeks — not just tonight.

**How:** Add a `played_recently` boolean or recency score to the `workingHistory`
entries. Weight the −5000 penalty by recency (older matches = smaller penalty).

**Tradeoff:** Adds complexity and a larger DB read on every proposal. Probably
only worth it for clubs where the same core group plays every session.

---

### 4. Explicit "give me a different match" button

**Idea:** Instead of only soft-deleting a proposal and re-running the algorithm,
provide a "re-roll" button that keeps the same 4 players but tries a different
team split or swaps one player.

**How:** Pass a `rerollFor: proposedMatchId` parameter to the propose route.
The algorithm generates a new proposal for the same 4 players with the constraint
that the exact teams from the deleted proposal must score −5000 (already handled
by soft-delete memory).

---

### 5. Automatic re-proposal after a live session delay

**Idea:** If a proposed match has been sitting in the queue for more than N minutes
without being played, soft-delete it and let backfill generate a fresh one. This
handles the case where a court frees up but the next two players in the proposal
have already drifted away.

**How:** Add a `proposed_at` timestamp to `proposed_matches` (already exists as
`created_at`). On any backfill trigger (or via a periodic server action), expire
proposals older than, say, 20 minutes.

---

### 6. Feedback loop: win-rate weighting

**Idea:** If Alice (skill 3) wins 80% of her matches over the season, and Dave
(skill 4) wins 40%, the 1–5 scale is not capturing their relative ability. Fold
season-level win-rate into the skill estimate used by the algorithm.

**How:** `effective_skill = base_skill × 0.7 + win_rate_rank × 0.3` where
`win_rate_rank` is the player's percentile win rate among all players at the
same base skill level.

**Tradeoff:** Requires enough match history to be meaningful (≥ 20 matches per
player). Self-reinforcing: strong players paired with strong opponents may have
lower win rates than their actual skill warrants.

---

### 7. Live "fairness score" display

**Idea:** Show admins a live tally during a session: matches played per player,
minutes waited, last-played timestamp. Surface who's been waiting the longest with
a visual indicator so the admin can intervene manually or trust the algorithm more.

**How:** The `waitMinutes` map computed inside `proposeNextMatches` already has
this data. Expose it via a lightweight endpoint polled every 30 seconds, rendered
as a sorted table alongside the match queue.

---

### 8. Court affinity / player location awareness

**Idea:** If a player is already standing near Court 1, they should be in the
next Court 1 match rather than Court 2. Apply a tiny affinity bonus.

**How:** Add an optional `last_court` field to session_players. Pass it into
the wave-aware slot selection so the algorithm prefers assigning players to the
court they just came off (or the court furthest from them, depending on the club's
preference).

---

### 9. Hard skill-ceiling enforcement

**Idea:** Allow the club to define "hard brackets" — e.g., a Level 1 player should
never be in a match where any other player is Level 4 or 5, regardless of team
balancing. Currently this is handled softly by the sanity-check penalty (−1000
when any player is >2.5 levels from the group average), but it is not a hard block.

**How:** Add a pre-filter step in `findBestMatch()` that rejects any 4-player
group exceeding the configured skill spread ceiling before scoring. Configurable
per session or per club.
