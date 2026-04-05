# Backlog

Single source of truth for all planned and completed work.

**To start a new session:** read `AGENTS.md` for the full agent protocol, then pick up the first `[ ]` item below.

---

## Queue

- [x] **00 — Auth & Onboarding** · [spec](specs/00-auth-onboarding.md) · Google login, first-time skill setup, all routes protected
- [x] **01 — Player Registry** · [spec](specs/01-player-registry.md) · View all players, admin skill editor, admin presence toggle
- [x] **02 — Session Management** · [spec](specs/02-session-management.md) · Session check-in, admin start/close/reopen
- [x] **03 — Record a Match** · [spec](specs/03-record-match.md) · Pick 4 players, record winner, live scoreboard, admin edit/delete
- [x] **04 — Season Leaderboard** · [spec](specs/04-season-leaderboard.md) · Cumulative W/L/win% across all sessions
- [x] **05 — Session Navigation** · [spec](specs/05-session-navigation.md) · Session list at `/`, per-session detail at `/session/[id]`, auto-redirect into open session on login, admin creates new session from list
- [x] **07 — Match Generation** · [spec](specs/07-match-generation.md) · Propose next 4 matches based on presence, skill, and history — **Completed.** Algorithmic suggest/queue/record loop implemented and verified.
- [x] **10 — Email Auth** · [spec](specs/10-email-auth.md) · Email sign-up/sign-in alongside Google OAuth; forgot-password reset flow
- [x] **19 — Simple Score Tracking** · [spec](specs/19-simple-score-tracking.md) · Per-session toggle (default on) replaces Generate Matches + score form with a minimal winner/loser picker; records 21–15 internally
- [x] **11 — Admin: Add Player** · [spec](specs/11-admin-add-player.md) · Admin adds a name + skill level from the Players page; player has no auth account (bot/guest)
- [ ] **21 — Performance & UX Optimizations** · [spec](specs/21-optimizations.md) · DB indexes, SQL aggregation for leaderboard, parallelised queries, useMemo fixes, poem Suspense, optimistic UI, batch API call
- [ ] **09 — Fix Online Indicator** · [spec](specs/09-online-indicator-fix.md) · SSR race condition + missing DB column mean green dots never appear; fix with client-side fetch after ping
- [ ] **08 — Ethan Mode** · [spec](specs/08-ethan-mode.md) · Easter egg: DB-persisted admin toggle that biases match suggestions (Chitra favored, Kiran Iyer skipped); banner visible to all when active
- [x] **12 — Match Queue Improvements** · [spec](specs/12-match-queue-improvements.md) · Optimal team balancing within each match; auto-backfill queue when a match is removed; dynamic queue cap based on checked-in count (no auto-gen until 8 players)
- [x] **13 — UI Tweaks** · [spec](specs/13-ui-tweaks.md) · Session stats show total match count; player detail groups results by session; leaderboard drops Skill Level column

---

- [x] **06 — Soft-Delete Players** · [spec](specs/06-soft-delete-players.md) · Admin removes/restores players; deleted players hidden from all views and their matches invalidated

---

- [x] **16 — Email Onboarding Fix** · [spec](specs/16-email-onboarding-fix.md) · Hard onboarding gate in app layout; create player stub if missing; remove skip button; default skill 2
- [ ] **15 — God Mode** · [spec](specs/15-god-mode.md) · Super-admin role (Karthik only); first feature: Reset Session wipes all matches + proposals with confirmation
- [ ] **20 — Edit Player** · [spec](specs/20-edit-player.md) · God Mode only; inline edit form on player detail page to change name and skill level
- [ ] **14 — Multiple Sessions Per Day** · [spec](specs/14-multi-session-per-day.md) · Allow admins to create more than one session on the same date; auto-numbered `#1`, `#2`; primarily for testing
- [x] **17 — Session Highlights** · [spec](specs/17-session-highlights.md) · Award cards for closed sessions: Sultan, Iron Shuttle, Untouchable, Cannon, No Mercy; admin-only; shown at top of completed session view

---

## Future (unspecced)

- **First-name collisions** — when two checked-in players share a first name, show a disambiguating initial or last name; affects session scoreboard, match cards, and player detail page
- **18 — Match Generation Audit Log** · [spec](specs/18-match-generation-audit-log.md) · Per-match decision log (players considered, scores, runners-up); zero-latency JSONB approach; admin ℹ️ button on proposed match cards
- **Long-wait player indicator (admin only)** — surface players who haven't been in a match for a long time; leaning toward contextual hint near proposed matches when a long-waiting player was skipped, but placement TBD

Add specs for these before implementing. Use the spec template in `AGENTS.md`.

- **Prior seasons** — read-only history of past seasons: leaderboard, match log, prize highlights
- **Season management** — admin creates new season, closes/archives old one; name and date range editable
- **Match suggestions** — suggest fair 4-player matchups based on skill balance and recent play
- **Waiting queue** — players mark themselves as waiting; system surfaces who's next
- **Court assignment** — tag each match to Court 1 or Court 2
- **Player profile page** — edit own skill level, view personal match history
- **Prize highlights** — season-end view: most matches, highest win%, most improved
- **PWA / add to home screen** — installable on phones; app-like experience at the court
- **Push notifications** — notify players when a session goes active
- **Per-session history** — browse any past session: who played, match log, scoreboard

---

## Done

- [x] **Hello World** · Next.js + Supabase + Vercel end-to-end connectivity working
