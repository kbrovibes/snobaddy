# Performance Worklog — Faster Tab Switching

## Tasks (ordered by ease, each independently shippable)

- [x] **T1** — Parallelize Session page: batch `getActiveSession` + `getActiveSeason` + auth into one `Promise.all`
- [x] **T2** — Fix Seasons N+1: replace sequential for-loop in `getAllSeasons()` with parallel aggregate queries
- [x] **T3** — Add `loading.tsx` skeletons for all 4 tab routes (Session, Players, Leaderboard, Seasons)
- [x] **T4** — Deduplicate auth checks: `React.cache`-based `getAuthPlayer()` in `src/lib/auth.ts`
- [ ] **T5** — Suspense boundaries: wrap `LeaderboardTable` and Session stats cards in `<Suspense>`
- [ ] **T6** — Player list client cache: context provider with hash-based delta revalidation
- [ ] **T7** — Cache season stats (player count, match count, days) on the `seasons` row, updated on session completion
- [ ] **T8** — Leaderboard cache with content-based signature invalidation

## Completed

_(items moved here on commit)_
