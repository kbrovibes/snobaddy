# Changelog

All notable changes to snobaddy are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/).

---

## [0.12.1] - 2026-03-31

### Fixed
- **← All Sessions link** — clicking it while a session was active would immediately redirect back to the session. It now always lands on the session list.

---

## [0.12.0] - 2026-03-31

### Added
- **Session list** — the home page now shows all sessions for the season, with date and status (Closed / Active / Pending). Each row links to the session detail.
- **Per-session detail page** — all session content (scoreboard, match log, check-in, proposed matches) now lives at `/session/[id]` instead of the home page.
- **Auto-redirect on login** — if a session is currently active, opening the app goes directly into that session.
- **Start New Session** — admins see a "+ Start New Session" button on the list page when no session is active. Creates today's session and navigates into it.
- **← All Sessions** — link at the top of every session detail page to return to the list.

---

## [0.11.1] - 2026-03-30

### Changed
- **GIF Favicon** — switched to `favicon.gif` (converted from `favicon.png`) for better compatibility and to resolve loading issues with the JPG version.

---

## [0.11.0] - 2026-03-30

### Changed
- **Branding update** — the site title has been updated to "SnoBaddy Dashboard" and the favicon now uses the official logo image.

---

## [0.10.8] - 2026-03-31

### Fixed
- **Duplicate player in proposed match after checkout** — when finding a replacement for a checked-out player, the candidate filter now excludes the 3 players already in that match's other slots. Previously a player already in the match (e.g. Alok on T1) could be selected to fill the departed player's slot on T2, producing "Alok & X vs Alok & Y".

---

## [0.10.7] - 2026-03-31

### Added
- **Who's Here — check-in time column** — the "Who's Here" table now shows arrival time (Pacific time) for each player.
- **Who's Here — sortable columns** — tap Name, Skill, or Arrived to sort; tap again to reverse. Defaults to arrival order.
- **Match generation — wait-time fairness** — players who have been waiting longer (since check-in or last match) now get a scoring bonus, so early arrivals are prioritised over players who just walked in.

### Fixed
- **Re-checkin resets arrival time** — checking back in after checking out now records a fresh `checked_in_at`, so the wait-time logic correctly treats re-arrivals as new arrivals.

---

## [0.10.6] - 2026-03-31

### Fixed
- **Record Match — player names no longer show skill dots** — the `●○` rating indicators have been removed from the player dropdowns on the score entry screen.
- **Record Match — score inputs now show black text** — entered scores were rendering grey; both inputs now correctly display `text-gray-900`.

---

## [0.10.5] - 2026-03-31

### Fixed
- **Deleted match no longer re-added** — deleting a proposed match now soft-deletes it (sets `deleted_at`). The scorer loads deleted matches as history and applies the -5000 duplicate penalty, so "Add Matches" picks a different group instead of immediately re-adding the same one. The deleted group can still come back as a last resort if no other viable combination exists.
- **Checkout updates the match queue** — when a player checks out, any proposed matches containing them are automatically updated: the best available replacement (minimising skill imbalance) is swapped in. If no eligible replacement exists, the match is soft-deleted instead.

> **DB migration required** — run in Supabase SQL editor before deploying:
> ```sql
> ALTER TABLE proposed_matches ADD COLUMN deleted_at timestamptz;
> ```

---

## [0.10.4] - 2026-03-31

### Fixed
- **Match generation — no more repeated matchups** — wave 2 now prefers "fresh" players (not used in wave 1) before falling back to the full pool. With 12 players: match 3 uses the remaining 4 untouched players; match 4 draws from the wave 1 pool with different pairings. Newly proposed matches are also fed into the scoring history mid-batch, so the duplicate penalty fires for intra-batch repeats. Exact-duplicate penalty raised from -200 to -5000.

---

## [0.10.3] - 2026-03-31
### Changed
- Replaced TestPlayer placeholder data with initial real player registry (21 players)
- Preserved match history by mapping real players to existing test IDs

## [0.10.2] - 2026-03-31


### Fixed
- **Match generation** — "Generate Matches" now correctly produces 4 suggestions even with ~12 players. Matches are organized in 2-match waves (one per court pair); wave 2 (matches 3 & 4) reuses players from wave 1 since both courts will have finished by then.

### Changed
- **"Suggest Matches" → "✨ Generate Matches"** — clearer label with generate emoji.
- **"Fill Delta" → "Add Matches"** — plain English for the top-up button.

---

## [0.10.1] — 2026-03-30

### Fixed
- **Build error** — resolved Next.js 15 type error in the proposed-match DELETE route handler (async params).
- **Build error** — resolved Next.js 15 type error in the sessions propose POST route handler (async params).
- **Deprecation** — renamed `middleware.ts` to `proxy.ts` and exported function to `proxy()` per Next.js 16 convention.

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
