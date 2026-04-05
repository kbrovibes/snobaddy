# Spec 21: Performance & UX Optimizations

## What it does

A batch of targeted fixes across the DB query layer, React rendering, and UX responsiveness.
None of these add new features — they make the existing app faster, smoother, and more correct.

## What it does NOT do

- No new user-visible features
- No schema redesign or table renames
- No changes to the match algorithm logic

---

## Bug Fix (ship first, independently)

### 1. `iSNaN` typo in `RecordMatchForm.tsx`

`iSNaN(s2)` on line 71 should be `isNaN(s2)`. This silently breaks score validation in full scoring mode — the winner is not determined correctly when one score is blank.

**File:** `src/components/RecordMatchForm.tsx`

---

## Database Optimizations

### 2. Add missing indexes

Run in Supabase SQL editor. No code changes needed.

```sql
-- Hit on every session page load (match history, scoreboard)
CREATE INDEX IF NOT EXISTS idx_matches_session_id_played_at
  ON matches(session_id, played_at DESC);

-- Hit on every check-in fetch (Who's Here list)
CREATE INDEX IF NOT EXISTS idx_session_players_session_checked_out
  ON session_players(session_id, checked_out_at);

-- Hit on every session load for the online indicator green dot
CREATE INDEX IF NOT EXISTS idx_players_last_seen_at
  ON players(last_seen_at DESC);

-- Hit on home page session list
CREATE INDEX IF NOT EXISTS idx_sessions_date_status
  ON sessions(date DESC, status);

-- Hit on leaderboard and admin page (player list queries)
CREATE INDEX IF NOT EXISTS idx_players_onboarding_deleted
  ON players(onboarding_complete, deleted_at);
```

### 3. Replace in-memory W/L aggregation in `getActivePlayers()`

Currently loads **every match ever recorded** into JS memory, then manually counts wins and losses per player. At scale this is the worst query in the app.

Replace with a SQL aggregation so the DB does the work:

```sql
-- Pre-computed per-player stats (run as a view or inline subquery)
SELECT
  p.id,
  p.name,
  p.skill_level,
  p.is_admin,
  p.user_id,
  COUNT(m.id) FILTER (WHERE
    (m.winning_team = 1 AND (p.id = m.team1_player1_id OR p.id = m.team1_player2_id)) OR
    (m.winning_team = 2 AND (p.id = m.team2_player1_id OR p.id = m.team2_player2_id))
  ) AS wins,
  COUNT(m.id) FILTER (WHERE
    (m.winning_team = 2 AND (p.id = m.team1_player1_id OR p.id = m.team1_player2_id)) OR
    (m.winning_team = 1 AND (p.id = m.team2_player1_id OR p.id = m.team2_player2_id))
  ) AS losses
FROM players p
LEFT JOIN matches m ON (
  p.id IN (m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id)
)
WHERE p.onboarding_complete = true AND p.deleted_at IS NULL
GROUP BY p.id
```

**File:** `src/lib/db/players.ts` → `getActivePlayers()`

### 4. Parallelise `proposeNextMatches()` queries

Currently fires 5 Supabase queries sequentially at the start of match generation. Wrap independent fetches in `Promise.all`:

```ts
const [checkedIn, existingProposals, deletedProposals, recentMatches, sessionHistory] =
  await Promise.all([
    getCheckedInPlayers(sessionId),
    fetchExistingProposals(sessionId),
    fetchDeletedProposals(sessionId),
    fetchRecentMatches(sessionId, 2),
    fetchSessionHistory(sessionId, 100), // cap at 100 — only need recent history
  ]);
```

Also cap `sessionHistory` at the last 100 matches — the algorithm only meaningfully uses recent ones for duplicate avoidance, and loading all 1000+ is wasteful.

**File:** `src/lib/db/proposed.ts` → `proposeNextMatches()`

### 5. Stop fetching all deleted player IDs as a separate query

`getCheckedInPlayers()`, `getSessionScoreboard()`, and `getSessionMatches()` each fire a separate `getDeletedPlayerIds()` call to filter out deleted players. Push the filter into each query's `.not('players.deleted_at', 'is', null)` condition instead.

**Files:**
- `src/lib/db/sessions.ts` → `getCheckedInPlayers()`
- `src/lib/db/matches.ts` → `getSessionScoreboard()`, `getSessionMatches()`

---

## React Performance

### 6. Add `useMemo` to sort operations in three components

All three rebuild a sorted array on every render, including renders that have nothing to do with sorting.

```ts
// Pattern to apply in each:
const sorted = useMemo(() => {
  return [...items].sort((a, b) => { /* existing sort logic */ });
}, [items, sortKey, sortDir]);
```

**Files:**
- `src/components/SessionScoreboard.tsx` — `scoreboard` sort
- `src/components/WhoIsHere.tsx` — `players` sort + pre-compute `Date.getTime()` values
- `src/app/(app)/leaderboard/LeaderboardTable.tsx` — `players` sort

### 7. Pre-compute timestamps in `WhoIsHere` sort

The sort comparator calls `new Date(a.checked_in_at).getTime()` on every comparison — O(n log n) date parses per render. Pre-compute once:

```ts
const sorted = useMemo(() => {
  const withTime = players.map(p => ({ ...p, _ts: new Date(p.checked_in_at).getTime() }));
  return withTime.sort((a, b) => /* use a._ts, b._ts */);
}, [players, sortKey, sortDir]);
```

**File:** `src/components/WhoIsHere.tsx`

### 8. Hoist `Intl.DateTimeFormat` out of render in `WhoIsHere`

Currently created inside a `.map()` callback on every render. Move to module level:

```ts
const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles'
});
```

**File:** `src/components/WhoIsHere.tsx`

---

## UX Improvements

### 9. Defer AI poem generation behind Suspense

The poem fetch (and potential AI generation) blocks the entire player profile page from rendering. It's non-critical — the stats and match history are what players care about.

Extract the poem into its own async Server Component and wrap in `<Suspense fallback={<PoemSkeleton />}`:

```tsx
// PlayerPoem.tsx — async Server Component
export async function PlayerPoem({ playerId, matchCount }: Props) {
  const poem = await getPlayerPoem(playerId, matchCount);
  return <div className="...">{poem}</div>;
}

// In player profile page:
<Suspense fallback={<div className="h-16 animate-pulse bg-zinc-800 rounded" />}>
  <PlayerPoem playerId={player.id} matchCount={totalMatches} />
</Suspense>
```

**Files:**
- `src/app/(app)/players/[id]/page.tsx`
- New: `src/components/PlayerPoem.tsx`

### 10. Optimistic UI on match recording

After submitting a score via `RecordMatchForm` or `SimpleMatchForm`, the UI currently waits for `router.refresh()` before anything changes. Add instant feedback:

- For `SimpleMatchForm`: the "Score saved!" toast is already there ✓ — extend by also optimistically removing the match from the proposal queue if it was recorded from there
- For `RecordMatchForm` / `ProposedMatchList`: after POST `/api/matches` succeeds, immediately remove the proposal card from local state before the refresh lands

**Files:**
- `src/components/ProposedMatchList.tsx`
- `src/components/RecordMatchForm.tsx`

### 11. Batch proposal save into one API call

Recording a match from a proposed match card currently fires:
1. `POST /api/matches` — save the match
2. `DELETE /api/proposed-matches/[id]` — remove the proposal

Combine into one: accept an optional `proposalId` on the match POST endpoint, and delete it atomically in the same handler.

**Files:**
- `src/app/api/matches/route.ts`
- `src/components/ProposedMatchList.tsx`

### 12. Add skeleton screens on session detail page

`SessionHighlights` and `SessionScoreboard` both resolve asynchronously but have no placeholder. The page content jumps in after load. Add `<Suspense>` boundaries with lightweight skeleton divs.

**File:** `src/app/(app)/session/[id]/page.tsx`

---

## Data Safety

### 13. Paginate player match history

`getPlayerMatchesBySession()` loads every match a player has ever played with no limit. Add a server-side cap and paginate client-side (20 sessions at a time is fine — profiles currently show "20 matches per page" but the underlying query is unbounded).

**File:** `src/lib/db/matches.ts` → `getPlayerMatchesBySession()`

---

## Acceptance Criteria

- [ ] Typo fixed: `iSNaN` → `isNaN` in RecordMatchForm; score validation works correctly in full mode
- [ ] All 5 DB indexes created in Supabase; leaderboard query no longer does a full match table scan
- [ ] `getActivePlayers()` uses SQL aggregation; leaderboard load does not fetch individual match rows
- [ ] `proposeNextMatches()` parallelises its initial fetches; match generation is noticeably faster
- [ ] Deleted player filter removed as a standalone query in the three affected db functions
- [ ] `useMemo` applied to sort in SessionScoreboard, WhoIsHere, LeaderboardTable
- [ ] Player profile page renders immediately; poem loads async behind a Suspense boundary
- [ ] Recording a match from the proposal queue removes it from local state immediately (no wait for refresh)
- [ ] Match POST + proposal DELETE consolidated into one round-trip
- [ ] Skeleton screens present on session detail while highlights and scoreboard load

---

## Files to create / modify

| File | Action |
|---|---|
| `src/components/RecordMatchForm.tsx` | Fix `iSNaN` typo |
| `src/lib/db/players.ts` | Replace `getActivePlayers()` with SQL aggregation |
| `src/lib/db/proposed.ts` | Parallelise initial queries; cap sessionHistory at 100 |
| `src/lib/db/sessions.ts` | Remove standalone `getDeletedPlayerIds()` call in `getCheckedInPlayers()` |
| `src/lib/db/matches.ts` | Same removal in `getSessionScoreboard()` and `getSessionMatches()`; paginate `getPlayerMatchesBySession()` |
| `src/components/SessionScoreboard.tsx` | Add useMemo to sort |
| `src/components/WhoIsHere.tsx` | Add useMemo, pre-compute timestamps, hoist Intl formatter |
| `src/app/(app)/leaderboard/LeaderboardTable.tsx` | Add useMemo to sort |
| `src/app/(app)/players/[id]/page.tsx` | Wrap poem in Suspense |
| `src/components/PlayerPoem.tsx` | Create: async Server Component for poem |
| `src/components/ProposedMatchList.tsx` | Optimistic removal after match save |
| `src/app/api/matches/route.ts` | Accept optional `proposalId`, delete it atomically |
| `src/app/(app)/session/[id]/page.tsx` | Add Suspense skeleton wrappers |
| Supabase SQL editor | Run 5 CREATE INDEX statements (no code file) |
