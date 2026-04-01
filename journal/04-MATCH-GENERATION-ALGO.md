# Chapter 4: The Match Generation Algorithm

> How we built a "Brain" that suggests fair, balanced, and diverse matches for the club.

---

## The Goal

With 30-50 players and only 2 courts, picking the next 4 players for a match is a constant source of stress for the organizer. We built an automated suggester to:
1. **Balance Skills:** No one likes 21-2 blowouts.
2. **Ensure Fairness:** Everyone should play roughly the same amount.
3. **Avoid Repetition:** Don't play the same people every single time.
4. **Prevent Back-to-Backs:** Give people a break between matches.

---

## How it Works: The Scoring Heuristic

The algorithm doesn't just pick players at random. It generates thousands of possible 4-player combinations and "scores" each one. The highest score wins.

### 1. Base Score (1000 points)
Every combination starts with 1000 points. We then add or subtract based on several rules.

### 2. Anti-Back-to-Back (-2000 points)
If a player just finished a match on the previous wave, the combination gets a massive **-2000 point penalty**. This almost guarantees they will sit out for at least one match unless the player pool is very small.

### 3. Skill Balance (-100 points per diff)
We sum the skill levels (1–5) for each team. If Team A is 10 (5+5) and Team B is 6 (3+3), the difference is 4. That's a **-400 point penalty**. The algorithm strongly prefers matches where the skill difference is 0 or 1.

### 4. Wait-Time Fairness (+3 points per minute)
We track how long it's been since a player last played (or since they checked in). For every minute they wait, they get **+3 points**. After 30 minutes, they have a +90 point "bonus" which helps them overcome a slight skill imbalance and get onto the court.

### 5. Diversity & Repetition (-5000 points for duplicates)
This is the most complex part. We store a history of "Proposed Matches".
- **Exact same 4 players:** -5000 points (Strong deterrent).
- **Same 2-player team pairing:** -150 points.
- **3 out of 4 players same:** -500 points.

---

## The "Wave" Logic

The club has **2 courts**. This means matches happen in groups of two.
- **Wave 1:** Matches 1 & 2. Players are "locked" and cannot appear in both.
- **Wave 2:** Matches 3 & 4. The lock resets, but the algorithm **prefers "fresh" players** who weren't in Wave 1. If 12 players are here, all 12 will play before someone has to go twice.

---

## Mid-Session Substitutions

What happens if a match is suggested but a player leaves before it starts?
We built a **Substitution Engine**:
1. Identify all "Proposed Matches" containing the departed player.
2. Find all checked-in players who are NOT currently in a proposed match.
3. Pick the replacement that **minimizes the new skill difference**.
4. If no one is available, delete the proposed match entirely.

---

## Technical Implementation

- **Location:** `src/lib/db/proposed.ts`
- **Soft Deletion:** When an admin deletes a suggestion, we set `deleted_at` instead of deleting the row. This allows the algorithm to "remember" that this combination was rejected and avoid picking it again immediately (via the -5000 point penalty).
- **Service Role:** Match generation runs on the server using the service role key to ensure it can see all player data and history regardless of user permissions.

---

## How to Test the "Brain"

1. **Check in 12 players** with varying skill levels (some 1s, some 5s).
2. Click **"✨ Generate Matches"**.
3. Observe the first two matches (Wave 1) — they should use 8 different players and be skill-balanced.
4. Click **"Add Matches"** to get Wave 2. It should use the remaining 4 players + 4 from Wave 1.
5. **Delete a match** and click "Add Matches" again. The algorithm should suggest a *different* combination than the one you just deleted.
