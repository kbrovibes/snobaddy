# Spec 31: Admin-only Leaderboard

## What it does
The Leaderboard is restricted to admin users. Non-admin players no longer see the Leaderboard tab in the bottom nav, and direct navigation to `/leaderboard` redirects them to the home page.

## What it does NOT do
- Does not change the leaderboard content, queries, or data model.
- Does not affect god-mode behavior (god-mode users are already admins).
- Does not remove the leaderboard route; it just guards it.

## Data / DB changes
None.

## API
None.

## UI
- Bottom nav: `Leaderboard` item is hidden for non-admins (filtered by existing `adminOnly` flag).
- `/leaderboard` page: server-side admin check redirects non-admins to `/`.

## Files to create/modify
| File | Action |
|---|---|
| `src/components/BottomNav.tsx` | Modify — flip `adminOnly` to `true` on the Leaderboard item |
| `src/app/(app)/leaderboard/page.tsx` | Modify — redirect non-admins to `/` |

## Acceptance Criteria
- [x] Non-admin users do not see the Leaderboard tab in the bottom nav.
- [x] Non-admin users who navigate directly to `/leaderboard` are redirected to `/`.
- [x] Admin and god-mode users continue to see and access the Leaderboard normally.
