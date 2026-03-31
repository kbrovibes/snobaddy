# Changelog

All notable changes to snobaddy are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/).

---

## [0.10.1] — 2026-03-30

### Fixed
- **Build error** — resolved Next.js 15 type error in the proposed-match DELETE route handler (async params).
- **Build error** — resolved Next.js 15 type error in the sessions propose POST route handler (async params).
- **Deprecation** — renamed `middleware.ts` to `proxy.ts` per Next.js 16 convention.

---

## [0.10.0] — 2026-03-30

### Added
- **Season Leaderboard** — full player statistics aggregated across all recorded matches this season.
- **Rankings** — top 3 players are highlighted with medals (🥇🥈🥉) and colored backgrounds.
- **Detailed stats** — Win%, wins, losses, matches played, and skill level for every player who has completed at least one match.
- **Total stats** — total number of matches recorded this season shown at the bottom of the leaderboard.

### Fixed
- **Real-time stats** — the "Players" tab and session scoreboard now show accurate season-wide statistics instead of hardcoded zeros.

---

## [0.10.0] — 2026-03-30

### Added
- **Match Generation (The Algorithm)** — intelligent match suggester that proposes the next 4 matches for an active session
- **Anti-Back-to-Back logic** — prioritizes players who didn't play in the most recent matches to ensure everyone gets rest
- **Smart Balancing** — heuristic algorithm that balances combined team skill levels while avoiding "dumb" matchups (e.g., three Skill 5s vs one Skill 1)
- **Proposed Match Queue** — view up to 4 persistent suggestions on the session page; each can be deleted or quickly recorded with a pre-filled form
- **Delta Filling** — tap "Fill Delta" to generate only the number of matches needed to reach the queue limit of 4

---

## [0.9.5] — 2026-03-30

### Fixed
- **Correct emoji used** — replaced the tennis ball (🎾) with a badminton shuttlecock (🏸) on the Record a Match button

---

## [0.9.4] — 2026-03-30

### Changed
- **Name display refined** — full names restored in "Who's Here" list and Scoreboard; first names only **strictly limited** to the Match History table
- **Match history layout** — Team 1 (first column) is now left-aligned for better readability

### Fixed
- **Database update** — corrected the name of chinnu.n.chunni@gmail.com (fixed email address) to "Vinaya Krishnan"

---

## [0.9.3] — 2026-03-30

### Changed
- **First names only** — session scoreboard, match history, and check-in lists now show only the first name of each player to reduce visual clutter on mobile
- **Database update** — corrected the name of chinnu.n.chunni@gmail.com to "Vinaya Krishnan" (Attempt 1: email address was incorrect)

---

## [0.9.2] — 2026-03-30

### Fixed
- **Edit match stuck in "Saving"** — `MatchAdminControls` now properly resets the loading and mode states after a successful score update or deletion, preventing the UI from getting stuck

---

## [0.9.1] — 2026-03-30

### Fixed
- **Match history layout** — switched to a grid layout for better vertical alignment of the "vs" text; team names now truncate if too long to prevent layout breaking

---

## [0.9.0] — 2026-03-30

### Fixed
- **Admin skill editing now actually saves** — was silently failing for any player other than yourself due to RLS blocking the anon client; now uses the service role client

---

## [0.8.0] — 2026-03-30

### Fixed
- **Start session for today** no longer inherits check-ins from a previous test run — every call now wipes the session's check-ins for a clean slate

---

## [0.7.0] — 2026-03-30

### Added
- **Admin: edit match scores** — admins can correct the score of any match recorded during an active session
- **Admin: delete a match** — admins can remove a match from tonight's session (requires confirmation)
- Both actions are locked on completed sessions; re-open the session to unlock them

---

## [0.6.0] — 2026-03-30

### Added
- **Record a Match** — tap "🎾 Record a Match" on the session tab to log a completed doubles game
- Pick 4 players from tonight's checked-in list, split into two teams
- Enter the final score — winner is determined automatically
- **Live session scoreboard** — W / L / Win% for every checked-in player, updates after each match
- **Match history** — list of tonight's matches with scores and winner highlighted in green

→ [Technical details](releases/v0.6.0-record-match.md)

---

## [0.5.0] — 2026-03-30

### Added
- **Check-out** — players can leave the session by tapping "Leave" next to their check-in status
- **Admin presence control** — admins can check in or out any player directly from the Players tab during an active session
- Players who check out and return can be re-added by tapping "Left · Re-add"

→ [Technical details](releases/v0.5.0-checkout.md)

---

## [0.4.0] — 2026-03-30

### Added
- **Session tab** — home screen now shows tonight's session with live status
- Spring 2026 season loaded: 18 sessions across all Mondays and Thursdays (Mar 23 – May 21, 2026)
- Admins can activate a session with one tap — non-admins see "Starting soon" until then
- Players check themselves in once the session is active
- Who's here list shows checked-in players with skill level dots
- Past sessions for this season shown at the bottom
- Serve Sports logo displayed in the session header

→ [Technical details](releases/v0.4.0-session-management.md)

---

## [0.3.0] — 2026-03-30

### Added
- **Players tab** — lists all registered players with name and skill level
- Admins can tap skill level dots to change any player's rating (1–5) inline
- Support for manually-added players (no Google account required — useful for walk-ins)

→ [Technical details](releases/v0.3.0-player-registry.md)

---

## [0.2.0] — 2026-03-30

### Added
- **Google login** — all pages require sign-in with a Google account
- **Onboarding** — first-time users rate their own skill level (1 Beginner → 5 Pro); defaults to 3 if skipped
- App shell with fixed header (logo + logout) and bottom navigation (Session / Players / Leaderboard)
- Player record automatically created on first login using name and email from Google

→ [Technical details](releases/v0.2.0-auth-onboarding.md)

---

## [0.1.0] — 2026-03-29

### Added
- Initial project scaffold: Next.js 14 + Supabase + Vercel + GitHub
- Hello World page with live database query confirming end-to-end connectivity

→ [Technical details](releases/v0.1.0-hello-world.md)

---

[0.10.0]: https://github.com/kbrovibes/snobaddy/compare/v0.9.5...v0.10.0
[0.9.5]: https://github.com/kbrovibes/snobaddy/compare/v0.9.4...v0.9.5
[0.9.4]: https://github.com/kbrovibes/snobaddy/compare/v0.9.3...v0.9.4
[0.9.3]: https://github.com/kbrovibes/snobaddy/compare/v0.9.2...v0.9.3
[0.9.2]: https://github.com/kbrovibes/snobaddy/compare/v0.9.1...v0.9.2
[0.9.1]: https://github.com/kbrovibes/snobaddy/compare/v0.9.0...v0.9.1
[0.6.0]: https://github.com/kbrovibes/snobaddy/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/kbrovibes/snobaddy/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/kbrovibes/snobaddy/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/kbrovibes/snobaddy/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/kbrovibes/snobaddy/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/kbrovibes/snobaddy/releases/tag/v0.1.0
