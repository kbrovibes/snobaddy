# Changelog

All notable changes to snobaddy are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/).

---

## [0.17.7] - 2026-04-01

### Changed
- **Session Awards** — 5 cards now lay out in 2 rows (3 + 2) instead of 3 rows; player name font size increased.

---

## [0.17.6] - 2026-04-01

### Changed
- **Session Awards** — renamed four awards: The Sultan → The Slayer, Iron Shuttle → The Unstoppable, The Cannon → The Point Collector, No Mercy → The One with No Mercy. Updated emojis to match.

---

## [0.17.5] - 2026-04-01

### Changed
- **Session Awards** — odd card (e.g. 5th) now spans full width so the grid is always fully packed; card content is center-aligned.

---

## [0.17.4] - 2026-03-31

### Added
- **Sortable session scoreboard** — "Tonight's Scores" table columns (Player, M, W, L, Win%) are now clickable to sort ascending or descending. Defaults to Win% descending.
- **Admin checkout from Who's Here** — admins now see an "Out" button next to each player in the Who's Here list, making it easy to remove someone who left without checking themselves out.

---

## [0.17.3] - 2026-04-01

### Changed
- **Session Awards** — each card now shows a short description of what the award means.

---

## [0.17.2] - 2026-04-01

### Changed
- **Session Awards** — cards now display in a 2-column grid instead of a horizontal scroll row.

---

## [0.17.1] - 2026-04-01

### Fixed
- **Session Awards** — build error caused by `isCompleted` being used before its declaration; variable ordering corrected.

---

## [0.17.0] - 2026-03-31

### Added
- **Session Awards** — when a session is closed, admins see a row of award cards at the top of the session page: The Sultan (most wins), Iron Shuttle (most matches), The Untouchable (best win rate, min 3 matches), The Cannon (most points scored), and No Mercy (biggest margin of victory). Requires at least 3 matches in the session.

---

## [0.16.0] - 2026-04-01

### Fixed
- **Email sign-up onboarding** — users who signed in via email/password without clicking their confirmation link would land in a broken state (invisible in player list, unable to check in, no onboarding prompt). The app layout now creates a player stub if none exists and hard-redirects to onboarding until `onboarding_complete` is set.
- **Onboarding gate** — any authenticated user who hasn't completed onboarding is now redirected to `/onboarding` regardless of which path they took to get into the app.

### Changed
- **Onboarding page** — removed the "Skip for now" button. Players must pick a skill level to continue. A note is shown that it can be updated from the Players page.
- **Default skill level for new stubs** — player records created without onboarding default to skill 2 (Casual) instead of 3 (Intermediate).

---

## [0.15.7] - 2026-03-31

### Fixed
- **Queue cap for 12–15 players** — the cap was 3, so deleting a match from a 4-match queue left it permanently at 3. Now 12+ players always maintain a 4-match queue.
- **Wave 2 candidate pool** — wave 2 matches now draw from all checked-in players (not just those who didn't play in wave 1). Wait-time scoring already deprioritises wave 1 players naturally; the hard exclusion was unnecessary and caused generation failures at mid-range player counts.

---

## [0.15.6] - 2026-03-31

### Changed
- **Verified account badge** — players with a linked auth account now show a green ✓ next to their name on the Players page and Leaderboard. Manually-added guest players have no badge.

---

## [0.15.5] - 2026-03-31

### Fixed
- **Match queue backfill race condition** — backfill is now awaited before the API response returns, so the new proposed match is always visible on the next page load after recording a score.
- **Deleting a proposed match now triggers backfill** — manually removing a match from the queue immediately generates a replacement; the queue no longer stays one short until the next score is recorded.
- **Same pairing re-generated after deletion** — the match selection algorithm now shuffles the available player pool (within rested/just-played groups) before choosing the anchor, so different combinations are explored each call. A ±10 pt score jitter also breaks ties between equally-ranked lineups.

---

## [0.15.4] - 2026-03-31

### Changed
- **Admin badge on Players page** — admin players now show a small ★ next to their name.

---

## [0.15.3] - 2026-03-31

### Fixed
- **Auto-backfill scope** — queue backfill now only fires when a match is recorded with a score, or when a player checks out and their proposed match is removed. Manually deleting a proposed match and checking in no longer trigger backfill.

---

## [0.15.2] - 2026-03-31

### Changed
- **Team balancing** — proposed matches now always assign the 4 selected players to the most skill-balanced teams (all 3 possible 2v2 splits evaluated; tiebreak by minimising intra-team skill gap).
- **Dynamic queue cap** — the queue auto-maintains 2 matches for 8–11 players, 3 for 12–15, 4 for 16+. No matches auto-generate until at least 8 players are checked in.
- **Auto-backfill** — the queue automatically refills after a match is recorded, a proposed match is deleted, or a player checks in.

---

## [0.15.1] - 2026-03-31

### Changed
- **Proposed Matches reformatted** — player names are first-name only; team columns are equal-width with "vs" centered, matching the Matches section below.
- **Tonight's Scores heading shows match count** — e.g. "Tonight's Scores · 7 matches".
- **Tonight's Scores table uses full names** — the per-player scoreboard keeps full names for clarity.

---

## [0.15.0] - 2026-03-31

### Changed
- **Match history grouped by session** — the player profile page now groups match history by session with a date header per session, instead of a flat paginated list.
- **Session scoreboard shows match count** — the per-player scoreboard table now includes an "M" (matches played) column.
- **Leaderboard drops Skill Level column** — removed the "S" column from the season leaderboard.

---

## [0.14.0] - 2026-03-31

### Added
- **Email Sign-up / Sign-in** — users can now create accounts and sign in with email/password alongside Google OAuth.
- **Password Reset** — added a "Forgot password" flow with email reset links.

---

## [0.13.1] - 2026-03-31

### Changed
- **Past Sessions links** — entries in the Past Sessions section at the bottom of a session view are now tappable links to those sessions.

---

## [0.13.0] - 2026-03-31

### Added
- **Player profile page** — tap any player name in the "Who's Here" list to open their profile at `/players/[id]`.
- **Win % chart** — bar chart showing win percentage per session. Blue = above 50%, red = below. Horizontally scrollable on mobile.
- **Match history** — paginated table of all matches (20 per page), showing date, W/L, partner, opponents, and score. Pagination goes all the way back.

---

## [0.14.0] - 2026-03-31

### Added
- **Email sign-up** — create an account with display name, email, and password. Confirmation email sent automatically; clicking the link activates the account and lands on onboarding.
- **Email sign-in** — sign in with email and password from the same login page.
- **Forgot password** — "Forgot password?" link on the sign-in form sends a reset email; clicking the link lands on a new password form.
- **Login page redesign** — single page with Google button + "Sign in / Create account" pill toggle for email. Clean inline success/error messages.

---

## [0.12.3] - 2026-03-31

### Fixed
- **Online indicator** — green dot now works correctly. Previously used Supabase's `last_sign_in_at` which only updates on OAuth login, not page loads. Now uses a `last_seen_at` column updated by a client-side ping on every session page open. Requires DB migration: `ALTER TABLE players ADD COLUMN last_seen_at TIMESTAMPTZ;`

## [0.12.2] - 2026-03-31

### Added
- **Online indicator** — a small green dot appears next to players in the "Who's Here" list when they've signed in within the last 5 minutes (i.e. app open on their phone).

### Changed
- **Session list cutoff** — the list now stops at the next upcoming session. Future sessions beyond the next one are hidden. On a play night the list ends with today's session; on an off-day it ends with the next scheduled session.

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
