# Backlog

Work items in priority order. Claude picks up the next `[ ]` item and implements it per the linked spec.
Start each session with: "Implement the next backlog item."

## In Progress
_nothing currently in progress_

## Queue

- [x] **00 — Auth & Onboarding** · [spec](specs/00-auth-onboarding.md) · Google login, first-time skill setup, all routes protected
- [x] **01 — Player Registry** · [spec](specs/01-player-registry.md) · View all players (read-only, populated via auth)
- [x] **02 — Session Management** · [spec](specs/02-session-management.md) · Auto-create Mon/Thu sessions, admin starts, players check in
- [ ] **03 — Record a Match** · [spec](specs/03-record-match.md) · Pick 4 players, record winner, live session scoreboard
- [ ] **04 — Season Leaderboard** · [spec](specs/04-season-leaderboard.md) · Cumulative W/L/win% across all sessions

## Future (unspecced)

- **Prior seasons** — read-only history view of past seasons: leaderboards, match logs, prize winners
- Edit skill level from profile page
- Match suggestions based on skill balance
- "Waiting" queue — who's next to play
- Court assignment (Court 1 / Court 2)
- Per-session history page
- Season management (create new season, archive old one)
- Prize highlights at season end (most matches, highest win%, most improved)
- Push notifications when session goes active
- PWA / add to home screen for phone use at court

## Done

- [x] **Hello World** · Next.js + Supabase + Vercel end-to-end working
