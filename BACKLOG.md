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
- [ ] **09 — Fix Online Indicator** · [spec](specs/09-online-indicator-fix.md) · SSR race condition + missing DB column mean green dots never appear; fix with client-side fetch after ping
- [ ] **08 — Ethan Mode** · [spec](specs/08-ethan-mode.md) · Easter egg: DB-persisted admin toggle that biases match suggestions (Chitra favored, Kiran Iyer skipped); banner visible to all when active

---

- [ ] **06 — Soft-Delete Players** · [spec](specs/06-soft-delete-players.md) · Admin removes/restores players; deleted players hidden from all views and their matches invalidated

---

## Future (unspecced)

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
