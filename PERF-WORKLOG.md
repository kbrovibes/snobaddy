# Performance Worklog — Faster Tab Switching

## Tasks (ordered by ease, each independently shippable)

- [x] **T1** — Parallelize Session page: batch `getActiveSession` + `getActiveSeason` + auth into one `Promise.all`
- [x] **T2** — Fix Seasons N+1: replace sequential for-loop in `getAllSeasons()` with parallel aggregate queries
- [x] **T3** — Add `loading.tsx` skeletons for all 4 tab routes (Session, Players, Leaderboard, Seasons)
- [x] **T4** — Deduplicate auth checks: `React.cache`-based `getAuthPlayer()` in `src/lib/auth.ts`
- [x] **T5** — Suspense boundary: leaderboard heading renders instantly, table streams in via `<Suspense>`
- [~] **T6** — Player list client cache — **deferred**: skeleton loading (T3) gives instant feedback; full client cache requires converting to client component, over-engineered since presence data is real-time
- [~] **T7** — Cache season stats — **deferred**: getSeasonStats already parallelized (T1, ~30ms); caching requires modifying 4+ API routes for invalidation
- [x] **T8** — Leaderboard cache with content-based signature invalidation + Refresh button

## Completed

_(items moved here on commit)_
