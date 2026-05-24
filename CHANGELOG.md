# Changelog

All notable changes to snobaddy are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/).

---

## [0.40.8] - 2026-05-24

### Removed
- **Admin badge and verified tick** — removed from leaderboard table, session scoreboard, and session presence list (WhoIsHere)

---

## [0.40.7] - 2026-05-24

### Changed
- **Bottom nav icons** — replaced emoji with custom SVG icons: racket (Session), two-person silhouette (Players), podium bars (Leaderboard), calendar (Seasons); all use currentColor so they respond to active/inactive and light/dark mode automatically

---

## [0.40.6] - 2026-05-24

### Changed
- **"Season Starting Soon" banner** — removed upcoming session date chip; added a "📊 [Season Name] stats →" link to the previous season's summary page

---

## [0.40.5] - 2026-05-24

### Changed
- **"Season Starting Soon" banner** — switched to Minimal theme: light mode uses a soft slate/blue-50 gradient with dark text; dark mode uses near-black zinc tones — clean and subtle in both modes

---

## [0.40.4] - 2026-05-24

### Changed
- **Seasons page layout** — Past Seasons section now appears directly below Ongoing (before Upcoming); Upcoming seasons are collapsed by default in a `<details>` accordion
- **SeasonCard** — season name is larger (`text-base`); Close Season / Start Season / Reopen Season buttons are now compact inline buttons (not full-width) placed to the right of the date range on the same row

---

## [0.40.3] - 2026-05-24

### Changed
- **"Season Starting Soon" banner colors tuned** — light mode gradient is softer (sky-400→blue-700, was sky-500→blue-950); dark mode switches to a near-black navy (sky-950→slate-900) so it doesn't clash against dark backgrounds

---

## [0.40.2] - 2026-05-24

### Changed
- **"Season Starting Soon" banner redesigned** — now a full-width hero card at the top of the session list with a sky-to-navy gradient, dot texture, large faded racket decoration, "New Season Starting Soon" headline, date chip, and season date range. Disappears after 2 sessions are completed (previously disappeared after 1). When 1 session is done, shows a "1/2 sessions in" pill

---

## [0.40.1] - 2026-05-24

### Changed
- **New favicon** — replaced the serve-icon favicon with the Serve Snoqualmie coat of arms crest across browser tabs, home screen shortcuts, and PWA install icon. Old `favicon.gif` and `serve-icon.png` are preserved in `/public`

---

## [0.40.0] - 2026-05-24

### Added
- **Season Summary page** (`/seasons/[id]`) — a read-only view of any season showing stat tiles (Players, Matches, Days of Play), the full season leaderboard with award cards (Badminton Nut + Nut Cracker), and a complete session list. Accessible to all logged-in users. Linked from "View Season Summary →" on each SeasonCard in the Seasons tab
- **"Season starting soon" banner** — when a new season has no completed sessions yet, the session list page shows a full-width card with the season date range and first scheduled session
- **Season Finals collapsible** — the admin-only Season Finals section on the session list page is now collapsible. It defaults to open when a finals event exists, and collapsed when no finals have been created for the current season

### Fixed
- **SeasonCard finals status label** — raw DB status values (`sessions_created`, `breakdown_generated`, etc.) are now shown as human-readable labels ("Sessions Set", "Groups Ready", etc.)

---

## [0.39.6] - 2026-05-24

### Fixed
- **Spring season finals no longer bleed into the Summer season home page** — the FinalsSection now only considers finals events belonging to the active season
- **Season stat tiles now always appear** at the top of the session list, even before the first session of a new season has been completed (showing 0 values)

### Added
- **Past Seasons expanded by default** on the Seasons tab — the collapsible section now opens automatically so past seasons are immediately visible
- **Summer 2026 sessions pre-created** — all 23 Monday/Thursday sessions from 2026-05-28 through 2026-08-13 have been added as pending sessions tied to the Summer 2026 season

---

## [0.39.5] - 2026-05-15

### Added
- **"Generate newsletter" button** on the admin Seasons page — appears next to a season once its `stats_lock_date` is set and has passed, but only while no newsletter row exists yet. Clicking the button generates the newsletter, persists it, and the button is replaced by a link to the viewer
- `docs/newsletter-spec.md` — canonical spec for the newsletter (sections, sources, voice, awards eligibility, regeneration paths). Future generator changes should update the spec first

### Changed
- **Newsletter visibility** is now gated on the stats lock date. No newsletter link or button on an active season that hasn't reached its lock date yet. The session-list card only renders once a newsletter has been generated
- **Newsletter banner icon** replaced the 📰 emoji with a proper inline SVG (rolled newspaper) so it renders consistently across platforms and matches the app's monochrome icon idiom
- **"Generated" wording removed** from the newsletter UI: page header now reads "As of {date}"; the in-body footer line uses "Compiled" instead

---

## [0.39.4] - 2026-05-15

### Changed
- **Session list newsletter link** restyled as a proper card matching the app's idiom — `rounded-xl` surface card with a stone-900/sky-600 icon disc, title, subtitle ("Stats, awards, and observations from this season"), and chevron. No more pale-sky banner that didn't fit the theme
- **Newsletter header** simplified: dropped the "v2/v3/v4" version label, header now reads simply "Generated &lt;date and time&gt;"
- **Regenerate UI removed** — the in-app regenerate form, "regenerate with extra context" textarea, and `POST /api/admin/seasons/[id]/newsletter` endpoint are gone. Regeneration is now done via the CLI seed script (`npx tsx scripts/seed-newsletter.mts &lt;seasonId&gt;`) by anyone with repo + Supabase access

---

## [0.39.3] - 2026-05-15

### Changed
- **Newsletter intro** rewritten — warmer narrator voice, no more fact-dump opening (the "1,611 W/L outcomes" line is gone)
- **Awards section** now mirrors the leaderboard exactly: 🥜 **Badminton Nut** (most games played) and ✂️ **Nut Cracker** (highest win rate among players with at least half of the leader's games), each with two runners-up
- Players can self-recuse from awards via `AWARD_EXCLUDE_NAMES`; the first opt-out is **Sekhar Durga** at his request. The newsletter ends with a small footnote acknowledging his record without listing him as a winner
- **Fun Observations** expanded from 6 to 17 bullets — mix of individual and collective notes (mode mix, pair dominance, mixed-skill partnerships, UBR cohort movement, gender split, drop-in count, roster breadth, etc.)

---

## [0.39.2] - 2026-05-15

### Fixed
- **Newsletter intro** now distinguishes full-detail nights (per-match scoring) from whiteboard-tally nights (W/L only). The average match margin is scoped to the matches with scores; the total "individual W/L outcomes" number covers both modes
- **Sessions attended** now counts a player as present if they show up in `session_players` OR `session_tally` OR any match roster. Previously only formal check-ins counted, so whiteboard nights were missed and "wins per session" / perfect-attendance figures were off
- Spring 2026 newsletter re-seeded as v3 with the corrected framing

---

## [0.39.1] - 2026-05-15

### Fixed
- **Season newsletter** stats now match the leaderboard exactly — combined match and tally W/L are **summed** (previously the max of the two sources was used, undercounting players who had both detailed matches and whiteboard tallies)
- Newsletter session scope aligned with leaderboard: drops the `status='completed'` / `session_type='regular'` filters, skips matches involving any soft-deleted player, and only includes onboarding-complete players in the roster

### Changed
- Newsletter regeneration is now restricted to **god-mode users** (the view stays admin-readable). Regular admins see a note explaining the restriction
- Spring 2026 newsletter has been re-seeded as v2 with the corrected numbers

---

## [0.39.0] - 2026-05-15

### Added
- **Season newsletter** (admin only) — auto-generates a humorous season recap from real match data, with sections for top attendees ("The Badminton Nut"), category awards ("The Nutcracker Awards"), per-skill efficiency math, and fun observations
- Newsletter is persisted in a new `season_newsletters` table and versioned on every regeneration
- Admins can paste extra free-form context (anecdotes, inside jokes) and regenerate the newsletter with that context folded into the intro
- New "📰 Season newsletter" link on the session list (admin only) and next to each ongoing/completed season on the Seasons admin page

---

## [0.38.0] - 2026-05-13

### Added
- **Public landing page** at `/welcome` — hero with app branding, session schedule details, and CTA buttons
- **Welcome page** now includes season stats, live session indicator, upcoming sessions — all in one compact view without scrolling
- Unauthenticated users now land on `/welcome` instead of `/login` (middleware, layout, and logout all updated)

---

## [0.37.1] - 2026-05-13

### Changed
- **Leaderboard** — shows full player name on wider screens, short display name on small screens; badges (verified, admin) now visible regardless of UBR toggle

---

## [0.37.0] - 2026-05-12

### Improved
- **Faster tab switching** — parallelized DB queries on Session and Seasons pages, added skeleton loading states for all tabs, and deduplicated auth checks across pages
- **Seasons page** — eliminated sequential N+1 query pattern (20+ serial DB calls → 4 parallel), loads dramatically faster
- **All tabs** — skeleton loading animations appear instantly during navigation instead of a spinner overlay
- **Leaderboard** — heading and season name render instantly; table streams in via Suspense; cached with smart signature-based invalidation (repeat visits load from cache if no data changed); added "Refresh" button

---

## [0.36.10] - 2026-05-12

### Changed
- **Seasons page** — seasons now split into three sections: Ongoing at top, Upcoming (sorted by date), and a collapsible Past Seasons folder showing the count

---

## [0.36.9] - 2026-05-12

### Changed
- **Profile dropdown** — tighter vertical padding on menu items (`py-1.5` instead of `py-2`)

---

## [0.36.8] - 2026-05-12

### Changed
- **Session list pills** — all status badges (In Progress, Upcoming, No Data, Finalized) are now uppercase to match the Cutoff pill style

---

## [0.36.7] - 2026-05-12

### Fixed
- **Tally player list empty** — player list for manual score entry was empty on pending and active sessions; now fetches all active players regardless of session state

---

## [0.36.6] - 2026-05-12

### Changed
- **Tally entry UX overhaul** — "Enter Scoreboard Manually" and "Upload Scoreboard Photo" are now full-width solid buttons; player selection uses a multi-select checkbox picker instead of a single dropdown; removed model name labels from UI
- **Name correction learning** — after uploading a scoreboard photo, name corrections (e.g. "Tredeb" → "Tridib") are shown in a summary banner; corrections are persisted and automatically applied on future photo uploads

---

## [0.36.5] - 2026-05-12

### Fixed
- **Check-in button sync** — the self check-in/check-out button now correctly updates when an admin checks you out from the player list

---

## [0.36.4] - 2026-05-12

### Changed
- **Session list lock UX** — replaced the divider line with a "🔒 last counted session" sublabel on the most recent session that counts toward the leaderboard; sessions after the cutoff remain dimmed

---

## [0.36.3] - 2026-05-12

### Changed
- **Finalize & Upload Scores split** — the "Upload Scores & Finalize" button on pending sessions is now two separate actions: a "Finalize Session" button (with in-app confirmation instead of a browser popup) and an "Upload Scores" widget (tally entry with photo import) that works on both pending and finalized sessions

---

## [0.36.2] - 2026-05-12

### Changed
- **Session list lock UX** — replaced the per-row 🔒 emoji with a full-width amber divider ("🔒 leaderboard cutoff · Apr 28") inserted between the last counted session and the first excluded one; sessions after the cutoff are dimmed to 50% opacity

---

## [0.36.1] - 2026-05-12

### Fixed
- **UBR tally algorithm** — rewrote the tally-session rating engine with a doubles-dampened expected win rate model; high-rated players who perform well (e.g. 9-2) now correctly see their UBR go UP instead of dropping due to unrealistic 1v1-style expectations. Added a performance bonus for standout sessions and increased tally match credit from 50% to 75%.

---

## [0.36.0] - 2026-05-12

### Changed
- **Season lock date** — rearchitected from per-session to per-season; set one date in the season edit form and all sessions after that date are excluded from the leaderboard
- **Seasons page** — season edit form now has a "Lock date" field alongside Start/End; the lock date is shown subtly in the collapsed view (🔒 May 15)
- **Session list** — locked sessions show 🔒 badge based on the season lock date
- **Leaderboard** — locked session count uses the season's lock date

---

## [0.35.1] - 2026-05-12

### Changed
- **Session lock date** — simplified to an always-visible date picker in the Seasons admin page; pick a date and it saves immediately, no more "set lock" button flow
- **Session list** — locked sessions (lock date in the past) now show a subtle 🔒 badge next to the status pill
- **Leaderboard** — already showed "N sessions excluded · stats locked" at the bottom (unchanged)

---

## [0.35.0] - 2026-05-12

### Added
- **Upload Scores & Finalize button** — admins see a new "📷 Upload Scores & Finalize" button on pending (unopened) sessions; clicking it finalizes the session immediately and opens the tally photo-upload widget so scores can be entered without ever opening the session for live play

---

## [0.34.3] - 2026-05-12

### Fixed
- **Session list page** — fixed blank session list caused by querying a column (`stats_lock_date`) before the DB migration was run

---

## [0.34.2] - 2026-05-12

### Added
- **Session stats lock-in date** — admins can set a lock date per session on the Seasons page; after that date the session's stats are excluded from the leaderboard
- **Session detail page** — shows a subtle 🔒 indicator when a session has a lock date (upcoming or active)
- **Leaderboard** — shows a subtle "N sessions excluded · stats locked" note at the bottom when locked sessions exist for the season

---

## [0.34.1] - 2026-05-12

### Fixed
- **UBR chart missing recent sessions** — whiteboard-mode sessions (all sessions since 4/30) have no check-in rows, so the UBR engine was silently skipping them; participants are now derived from tally data when no check-in records exist

---

## [0.34.0] - 2026-05-12

### Added
- **UBR regenerate button** — admins see a "↺ regenerate" button in the UBR Rating card on any player profile; clicking it recalculates all UBR ratings and refreshes the chart

### Fixed
- **UBR chart ordering** — chart data now orders by session date instead of insertion timestamp, preventing scrambled progressions after a full recalculation

---

## [0.33.2] - 2026-05-11

### Added
- **Leaderboard runner-ups** — below the Badminton Nut and Nut Cracker winner cards, a second row now shows 🥈 and 🥉 runners-up for each award

---

## [0.33.1] - 2026-05-05

### Improved
- **Win-loss chart** — consecutive absent sessions are now compressed into a single `···×N` marker, reducing scroll length
- **Win-loss chart** — chart auto-scrolls to the right on load so the most recent sessions are visible first

---

## [0.33.0] - 2026-05-02

### Changed
- **UBR tiers removed** — no more Shuttle/Bronze/Silver/Gold/Platinum/Diamond labels. UBR now displays as a number only throughout the app.

---

## [0.32.8] - 2026-05-02

### Fixed
- **Player profile sticky header** — now anchors below the fixed nav bar (`top-14`) instead of `top-0`. Back button included in sticky area. No more overlap with the Serve Sports header.

---

## [0.32.9] - 2026-05-01

### Changed
- **Player profile** — removed back button from the sticky header.

---

## [0.32.8] - 2026-05-01

### Changed
- **Player list UBR** — removed tier label (Gold, Silver, etc.), now shows just "UBR 2650". Still admin-only.

---

## [0.32.7] - 2026-05-01

### Fixed
- **UBR chart interaction** — tooltip now only appears when tapping a specific dot (toggle on/off). No more accidental activation while scrolling.

---

## [0.32.6] - 2026-05-01

### Fixed
- **Player profile sticky header** — now blends with the nav bar (uses page background instead of card surface). Back button moved inside the sticky area. No more floating grey card.

---

## [0.32.5] - 2026-05-01

### Changed
- **Appearance toggle** — now displays inline (label left, toggle right) instead of stacked.

---

## [0.32.4] - 2026-05-01

### Changed
- **Player profile** — header (name, win%, UBR) now stays sticky at the top while scrolling. Poem moved to its own card below.

---

## [0.32.3] - 2026-05-01

### Added
- **Partner Chemistry** — player profile widget showing top partners ranked by win rate with color-coded bars.
- **Streaks & Milestones** — 4-card grid: current win streak, best win streak, sessions attended, career matches.
- **Attendance Heatmap** — color-coded grid of all sessions (green = high win rate, red = below 50%, gray = absent) with attendance stats and streak counter.

---

## [0.32.2] - 2026-05-01

### Added
- **Edit season** — admins can rename a season and change its start/end dates from the Seasons page.

---

## [0.32.1] - 2026-05-01

### Changed
- **UBR chart** — interactive stock-ticker style: touch/hover shows rating + delta at any point. Shows all session dates on x-axis. Initial rating shown as hollow circle.
- **Players page** — UBR rating + tier shown on each player card (admin only, when UBR enabled).
- **Leaderboard** — removed "Include Test Sessions" toggle.
- **PWA** — disabled pinch-to-zoom for native app feel.

---

## [0.32.0] - 2026-05-01

### Added
- **Season Lifecycle Management** — Seasons now have status (active/upcoming/completed). At most one season can be active at a time. Session and finals creation automatically link to the active season. New Seasons management page with create/close/start/reopen. New 📅 Seasons tab in bottom nav for all admins. Home page and leaderboard now show stats for the active season only. UBR ratings remain all-time (cross-season). Empty state shown when no season is active. (Spec 34)

---

## [0.31.1] - 2026-05-01

### Fixed
- **UBR chart dark mode** — axis labels and grid lines now visible in dark mode.

---

## [0.31.0] - 2026-05-01

### Added
- **UBR (Universal Badminton Rating)** — Elo-based rating system for all players.
  - Ratings computed from match results (full scores, simple W/L, and whiteboard tallies)
  - Score margin awareness: blowouts move ratings more than close games
  - Tally-only sessions use session pool method with a quality discount
  - Automatically recalculated when a non-test session is finalized
  - **Leaderboard** — toggle to show UBR column (uses display names when shown for space)
  - **Player profile** — UBR rating + tier badge in header, progression chart showing rating over time
  - **God mode** — global toggle to enable/disable UBR visibility, full recalculate button
- Rating tiers: Shuttle / Bronze / Silver / Gold / Platinum / Diamond (1000-6500+)
- Full algorithm documented at `docs/ubr-algorithm.md` and visual version at GitHub Pages `/ubr.html`

---

## [0.30.13] - 2026-05-01

### Fixed
- **Tally photo import** — Players extracted with 0 wins and 0 losses are now automatically excluded from the tally list.

---

## [0.30.12] - 2026-04-28

### Fixed
- **Season stat cards** — Players now counts unique players who played ≥1 match (not just check-ins). Matches now correctly sums match records, with tally-only sessions approximated from win totals (sum of wins ÷ 2). Days of play already excluded test and finals sessions correctly.

---

## [0.30.11] - 2026-04-27

### Added
- **Season snapshot** — home page now shows 3 stat cards: 🏸 Players this season, 🎯 Matches played, 📅 Days of play.

---

## [0.30.10] - 2026-04-27

### Fixed
- **Edit scores for checked-out players** — the pencil (✎) edit button now appears for checked-out players too, so you can adjust their W/L without reopening or re-checking them in.

---

## [0.30.9] - 2026-04-27

### Fixed
- **Wipe & Reset** — now also clears the whiteboard activity log entries, not just matches and tallies.

---

## [0.30.8] - 2026-04-27

### Fixed
- **Dark mode: checked-out players** — names and scores are now visible (light grey) instead of invisible black text.
- **Undo sync** — undoing an activity log entry now immediately updates the whiteboard tally table.
- **Display name conflicts** — when two players share a first name (e.g. Arjun Raman & Arjun Junior), the whiteboard table and activity log now show disambiguated names (Arjun-R, Arjun-J).

### Added
- **Activity "Show more"** — activity feed now shows 10 entries by default with a "Show more" button for the rest.
- **Edit button** — pencil (✎) button next to +W/+L opens −/+ steppers to adjust a player's score in-place.

---

## [0.30.7] - 2026-04-27

### Fixed
- **Logo link** — tapping "Serve Sports" in the header now always goes to the session list, not the open session.

---

## [0.30.6] - 2026-04-27

### Changed
- **Activity log** — "undo" button on whiteboard log entries renamed to "delete".

---

## [0.30.5] - 2026-04-27

### Fixed
- **Check In button** — now shows blue in dark mode by default, not just on hover.

---

## [0.30.4] - 2026-04-27

### Improved
- **Tally photo upload** — the 📷 "Import from photo" button is now available to all admins, not just God Mode.

---

## [0.30.3] - 2026-04-26

### Improved
- **Header logo** — "Serve Sports" uses system-ui bold.

---

## [0.30.2] - 2026-04-26

### Improved
- **Visual hierarchy** — Title bar logo is slightly bigger and page headings (e.g. "Spring 2026") are slightly smaller, so they no longer look like the same size text.
- **Session page header** — Removed the Serve Sports logo, split season name and date back to separate lines, replaced prev/next session links with a simple "All Sessions" link.
- **Title bar** — Renamed "Serve Snoqualmie" to "Serve Sports", adjusted text size.
- **Session list** — Past sessions collapse after 6 entries with a "Show older sessions" toggle.
- **Dark mode** — Full dark mode support across all pages. Toggle between Light / Dark / Auto from your player profile page. Near-black WhatsApp-style palette. Loading overlays and pull-to-refresh adapted for dark mode. Light mode unchanged.

---

## [0.30.1] - 2026-04-24

### Fixed
- **Tally session awards** — Tally/whiteboard sessions now only show the 3 relevant award cards (Slayer, Unstoppable, Untouchable) instead of also showing the 5-card match-based awards.

---

## [0.30.0] - 2026-04-22

### Added
- **Push Notifications** — Opt-in browser push notifications via Web Push API. Admins get notified when a session is opened or closed. Players get notified when an admin checks them in or out. Works on Android Chrome and iOS Safari (16.4+, home screen required).
- **Notification opt-in banner** — A dismissable banner prompts users to enable notifications. Tap "Enable" to subscribe, or dismiss to hide it permanently.

### Changed
- **Whiteboard mode layout** — W/L counts are now the hero element (large bold numbers), with +/- buttons smaller underneath.

---

## [0.29.0] - 2026-04-21

### Added
- **Whiteboard Mode** — New default score-tracking mode for regular sessions. Shows a 2-column grid of all checked-in players with quick-tap +W/+L buttons. No need to pick 4 players or enter scores — just tap wins and losses as they happen.
- **4-tap match detection** — When 4 consecutive taps form a valid match (2 wins + 2 losses across 4 players), a toast offers to save it as a match record with assumed 21-15 score.
- **Checked-out player handling** — Players who leave early appear greyed out at the bottom of the whiteboard with their stats preserved (read-only).
- **Whiteboard mode toggle** — Admins can toggle whiteboard mode off to fall back to the existing simple/full score entry modes.

### Changed
- **Whiteboard layout** — 2-column compact rows inside a single box (half the scroll for 20+ players).
- **Auto-save matches** — 4-tap match detection now auto-saves silently with a brief flash confirmation.
- **Score entry mode picker** — Replaced separate toggles with a unified 3-way segmented control: Whiteboard / Win/Loss / Full Score. Admin-only, shown above the score entry area.
- **Save feedback** — Each tally tap shows a brief "Saved" flash in the whiteboard header so you know it persisted.

---

## [0.28.3] - 2026-04-21

### Improved
- **Alphabetical player dropdowns** — Player selection dropdowns in match recording (both simple and full score modes) are now sorted alphabetically instead of by check-in order.

---

## [0.28.2] - 2026-04-18

### Fixed
- **Fun names in all finals modes** — Fun names toggle now works in both fixed-partner and playoffs modes (was only working in playoffs).
- **Fun name blending** — Names now use at least 2 characters from each player, preferring 3 at syllable breaks for more readable mashups.

---

## [0.28.1] - 2026-04-18

### Fixed
- **Delete finals event** — Fixed foreign key constraint error when deleting a finalized finals event (now queries all sessions linked via `finals_event_id` rather than only the two stored on the event).
- **Delete confirmation dialog** — Replaced native browser popup with a styled in-app confirmation modal matching the rest of the UI.

---

## [0.28.0] - 2026-04-17

### Changed
- **Finals completed view** — Winner/runner-up cards for all groups shown at top, then per-group details (standings, series timeline, collapsible match history) below, followed by overall rankings. Applies to both session and event pages.
- **Finals event auto-finalization** — When both finals sessions are closed, the finals event automatically marks itself as completed. Reopening a session reverts the event to active.
- **Finals event summary page** — A finalized finals event shows winner cards at top, then "View Setup Details" toggle, then per-group details. Overall rankings hidden on session pages. The preparatory tabs (Players, Groups, Sessions) are available behind the toggle.
- **Pair configurator redesign** — Replaced native dropdowns with custom styled player pickers. Team cards have bordered containers, tap-to-open player lists with scores, and clear visual states for assigned/unassigned slots.
- **Live sessions banner** — Finals setup page shows a banner above the workflow when sessions are active or completed, with links to each session and a Live/Done badge.
- **Create new finals** — When a finals event is completed, a "Create New Finals" button appears on the home page. The API now allows multiple finals per season (only one active at a time).
- **Session links on finalized event** — Finalized finals event page shows clickable links to Day 1 and Day 2 sessions between the winner cards and setup details.
- **Start session button placement** — When there are more than 5 past sessions, the "Start New Session" button moves above the session list so admins don't have to scroll down.

### Fixed
- **Create new finals** — Dropped unique constraint on `finals_events.season_id` that prevented creating a second finals event for the same season.
- **Under Construction banner removed** — Finals section no longer shows the "Under Construction" badge.
- **Create Finals button style** — Matched the "Create Finals" button to the same size and color as "Start New Session" (stone-900, compact).
- **Past finals visible** — All previous finals events now show in a "Past Finals" section below the current one on the home page, with links to each.

---

## [0.27.1] - 2026-04-17

### Changed
- **Leaderboard is admin-only** — The Leaderboard tab is now hidden from non-admin players, and `/leaderboard` redirects non-admins to the home page.

### Added
- **Player gender field (backend only)** — Added a `gender` column on `players` (default `male`, also accepts `female`). Not shown anywhere in the UI — it's only used to guide pronoun choice in generated player poems. Seven players (Swathi, Kiran Iyer, Deepa, Jeeta, Nihita, Gazal, Robyn) marked female.

### Fixed
- **Production build restored** — Fixed undeclared `aSplits`/`bSplits` in `FinalsMatchList.generateFunName` that had been failing Vercel typecheck since 2026-04-12, preventing production deploys.
- **Leaderboard now counts regular matches** — Season leaderboard and season match count were filtering on `match_type IS NULL` to exclude finals, but regular matches use `match_type = 'regular'` (not NULL), so every individual match record was being excluded. Filter now explicitly selects regular matches. Players who had only recorded individual matches (no tallies) were missing from the leaderboard entirely.
- **Poem pronouns** — Player poem prompts now hint the player's gender, so poems for players like Kiran Iyer no longer mistakenly use he/him. (Re-run `scripts/regenerate-poems.mjs` to regenerate existing poems.)
- **Finals Group C match generation** — DB `matches_finals_group_check` was restricted to `('A','B')`, so generating matches for Group C failed with a constraint violation. Constraint now allows A/B/C. Stale "must be A or B" error message updated.

### Added
- **Playoffs Top-4 tie-breaker picker** — When the Top-4 cutoff in playoffs mode has a tie on both Pts and PF, the admin now sees an amber banner listing the tied players and must manually check the one(s) that should advance. "Generate Best-of-3 Finals" is blocked until the tie is resolved. Previously the 4th seed was silently chosen alphabetically.

---

## [0.27.0] - 2026-04-12

### Added
- **Drag-and-drop group assignment** — In the Finals Groups tab, drag players between groups using the grip handle on the left. Works on mobile (press-and-hold to start). The group dropdown still works as an alternative.
- **Edit Groups after confirmation** — New "Edit Groups" button on the Groups tab when groups have been confirmed but finals isn't completed. Reverts to editable state (deletes generated sessions, keeps group assignments).
- **Score legend** — Brief explanation of what the score means, shown above group cards in the Groups tab.

### Fixed
- **Finals session cleanup** — Hid regular session sections (Record a Score, Tonight's Scores, Matches) from finals sessions, since finals have their own dedicated UI.
- **Finals badge on session list** — Badge now derives status from actual session states (In Progress if any session is active/completed, Completed only when all are done).
- **Leaderboard excludes finals** — Finals matches (`finals_group` / `finals_final`) are no longer counted in the season leaderboard or match totals.
- **No close/finalize on finals sessions** — Hid "Finalize Scores and Close" and "Close Session" buttons on finals sessions.
- **Balanced auto-suggest pairing** — Fixed partner auto-suggest now uses fold pairing (#1 with #last, #2 with #second-last) so pair scores are balanced instead of top-heavy.
- **Team labels + combined score** — Renamed "Pair" to "Team" everywhere (configurator, standings, match list). Shows combined team score in both the configurator and the locked/match view.
- **Group tab persistence** — Active group tab (A/B/C) is preserved in URL when saving, so page refreshes don't jump back to Group A.
- **One-step team save** — "Confirm Teams & Generate Matches" now saves teams and auto-generates matches in one click. Teams lock immediately, no separate generate step.

### Fixed
- **Group tab state preserved** — Switching between Group A/B tabs no longer resets unsaved format selections or team configurations.
- **Format locks after save** — Saving a format now shows the compact locked view immediately (no more toggling between options after save).
- **Auto-generate matches for playoffs** — Saving playoffs format now auto-generates matches in one step, like fixed-partner.
- **Re-generate matches** — "Re-generate matches" link available when no scores have been entered yet. Disappears once scoring starts.
- **Player names in standings/matches** — Fixed-partner standings and match list now show player names (e.g. "Karthik & Swathi") instead of "Team 1", "Team 2". Removed duplicate name subtitle in standings table.
- **Group tab "Done" status** — Tab now shows "Done" when all matches in a group have scores, regardless of the format's internal status.

### Improved
- **Instant group moves** — Dragging or changing a player's group now updates instantly in the UI. Changes are saved in batch when you confirm groups, not on every move.
- **Drop target highlight** — Destination group shows a blue ring and subtle highlight when dragging a player over it.
- **Unsaved changes banner** — Purple banner appears above group cards when you have pending group changes.
- **Workflow step colors** — Completed steps ahead of your current step now show an even lighter green, making it clearer which step you're on.
- **Info toggle glyph** — Replaced ℹ/▲ with ▸/▾ disclosure triangles on player score explanations in the groups table.
- **Workflow arrow clipping** — Added padding to SVG viewBox so the rightmost arrow tip is no longer trimmed.
- **Loading spinner for header & bottom nav** — Profile badge and bottom nav tabs now show the loading spinner during navigation (they were outside the NavigationLoader context).
- **Back button on player profile** — Repositioned to top-left with ‹ prefix, matching other pages. Also triggers loading spinner.
- **Workflow arrow borders** — Thinner stroke (1px instead of 2px) on the finals workflow step arrows.
- **Workflow done-ahead style** — Completed steps ahead of current now show green dashed border with no fill (instead of light green solid fill).

### Fixed
- **Nav links** — "‹ Sessions" and "‹ Finals Event" back-links now use the consistent ‹ prefix instead of <.
- **Finals session nav** — Hide prev/next session arrows on finals sessions (not needed, back-link to Finals Event is sufficient).

---

## [0.26.8] - 2026-04-11

### Improved
- **Season Finals — Cleaner player listings** — Player names are now links to profiles. Removed stats column from Players tab. Kept skill dots. "Remove" label instead of ×.

---

## [0.26.7] - 2026-04-11

### Added
- **Season Finals — Reset & Delete always available** — "Reset to Draft" button clears groups, sessions, and matches but keeps players. "Delete Finals Event" fully removes everything. Both available at any stage with confirmation dialogs.

---

## [0.26.6] - 2026-04-11

### Fixed
- **Season Finals — Confirm Groups now works** — The confirm-breakdown endpoint was validating groups but not updating the event status, so the Sessions tab never unlocked. Now transitions status to `sessions_created` and unlocks Sessions tab.

---

## [0.26.5] - 2026-04-11

### Improved
- **Season Finals — Editable player list after breakdown** — Players can now be added/removed even after generating the breakdown. Status banners explain the current state and next steps. Groups tab has an "Edit Players" button to switch back.

---

## [0.26.4] - 2026-04-11

### Fixed
- **Season Finals — Player list not showing** — Fixed ambiguous FK join in `getFinalsParticipants`. The `finals_participants` table has two foreign keys to `players` (`player_id` and `added_by`), causing Supabase/PostgREST to silently return empty results. Now uses explicit FK hint.

---

## [0.26.3] - 2026-04-11

### Added
- **Season Finals — Standings & Winners** (God Mode only) — Live pair standings per group with W/L/PF/PA/+- columns. Automatic winner detection when all matches played. Tiebreak handling: 2-way tie prompts for tiebreak match, 3+ way tie shows manual winner selection.

---

## [0.26.2] - 2026-04-11

### Added
- **Season Finals — Match Generation** (God Mode only) — Generate round-robin matches for Fixed-Partner format. Every pair plays every other pair once per group. Match cards with group tabs, progress bar, and inline score entry.

---

## [0.26.1] - 2026-04-11

### Added
- **Season Finals — Pair Configuration** (God Mode only) — After selecting Fixed-Partner format, admin can assign partner pairs per group. Auto-suggest pairs players by closest Finals Score. Validates even group sizes and full assignment before saving.

---

## [0.26.0] - 2026-04-11

### Added
- **Season Finals — Format Selection** (God Mode only) — Finals Session pages now show a format picker card UI. Admin can select "Fixed-Partner All-Pairs" (active) or "Playoffs + Finals" (coming soon, greyed). Selection persists to a new `finals_formats` DB table and can be changed until matches are generated.

---

## [0.25.4] - 2026-04-11

### Fixed
- **Build fix** — cast `finals_participants` query result explicitly so the production TypeScript build passes (Supabase generated types don't include the new finals tables yet).

---

## [0.25.3] - 2026-04-11

### Added
- **Season Finals — Session Generation** (God Mode only) — Tab 3 (Sessions) is now functional. Admins pick dates for Finals Day 1 (Groups A & B) and Day 2 (Group C) and generate two linked session records. Sessions appear as cards with status badges and direct links. Finals Sessions show a "Season Finals" header on the session page with a "← Finals Event" back link; check-in, Who's Here, and tally entry are hidden.
- `POST /api/finals/[id]/generate-sessions` — creates two `session_type='finals'` session rows, links them back to the finals event, advances status to `sessions_created`
- Check-in route now returns 400 for Finals sessions (check-in not applicable)
- `getFinalsSessionPair()` helper in `src/lib/db/finals.ts`

---

## [0.25.2] - 2026-04-11

### Added
- **Season Finals — Breakdown Generation** (God Mode only) — Tab 2 (Groups) is now fully functional. Admins can generate a breakdown that scores all participants using Skill (50%) + Win Rate (50%), auto-assigns groups (top 35% → A, next 35% → B, rest → C), and shows a ranked table with score, WR%, group badges, and expandable score explanations. Individual group overrides can be set via dropdown. A "Confirm Groups" button validates that each group has ≥ 4 players before proceeding to session generation.
- `POST /api/finals/[id]/generate-breakdown` — computes Finals Score for all participants and auto-assigns groups
- `POST /api/finals/[id]/confirm-breakdown` — validates group sizes (≥ 4 per group) before proceeding
- `PATCH /api/finals/[id]/participants/[playerId]/group` — manual group label override

---

## [0.25.1] - 2026-04-11

### Added
- **Season Finals — Player Management** (God Mode only) — Tab 1 of the Finals Event page is now fully functional. Admins can search and add players to the Finals pool, remove players, and use "Auto-add from season" to bulk-add all players who have any season record (matches or tally). Each player shows skill level dots and their season W/L/win-rate.

---

## [0.25.0] - 2026-04-11

### Added
- **Season Finals** (God Mode only) — Season Finals planning is now available behind God Mode. A pinned "Season Finals" section appears on the sessions list for God Mode users, with a button to create a Finals Event for the current season. The Finals Event page provides a 3-tab planning workspace (Players / Groups / Sessions) that unlocks progressively as the event is built out.

---

## [0.24.32] - 2026-04-07

### Changed
- **Who's Here table** — check-in time font reduced to 10px so the time and Checkout button fit on a single line.

---

## [0.24.31] - 2026-04-07

### Fixed
- **Players list — Check In / Check Out** — removed underline and corrected color to match the Logout button style (`text-sky-600` / `text-red-600`, no underline).

---

## [0.24.30] - 2026-04-07

### Changed
- **Players list — Check In / Check Out buttons** — now styled as plain text links matching the Logout button in the header (`text-sky-600` / `text-red-600`), instead of pill buttons with backgrounds and borders.

---

## [0.24.29] - 2026-04-07

### Added
- **Speed Insights** — Vercel Speed Insights enabled. Real-user Core Web Vitals (LCP, FCP, CLS, INP, TTFB) will appear in the Vercel dashboard after deploy.

---

## [0.24.29] - 2026-04-07

### Added
- **Vercel Analytics** — page view tracking enabled. Visible in the Vercel dashboard under Analytics.

---

## [0.24.28] - 2026-04-07

### Changed
- **Players list** — now visible to all logged-in users, not just admins. The "Players" tab in the bottom nav is shown to everyone.
- **Players list — check-in/out** — only admins see the "Check in" / "Check out" links on each player card. Non-admins see a read-only presence status.
- **Players list — card interaction** — tapping a player's avatar or name opens their profile page. Check-in/out are now plain text links (no button styling) below the name.
- **Players list — admin actions** — the "+ Add" button is now hidden for non-admins.
- **Routing** — Players list moved from `/admin` to `/players`. `/admin` now redirects to `/players`.

---

## [0.24.27] - 2026-04-07

### Changed
- **Players screen** — grid back to 3 columns (was 2).

---

## [0.24.26] - 2026-04-07

### Changed
- **Global design system** — font switched to Plus Jakarta Sans; color palette migrated from cool gray to warm stone throughout (backgrounds, borders, text); primary action buttons now use dark `#1C1917` fill.
- **Players / check-in screen** — redesigned as a 2-column card grid. Header shows total/in/out pill badges and a "+ Add" button. Each player card is fully tappable (no separate button), shows a colored avatar, name, status line, and a green corner ribbon when present.

---

## [0.24.25] - 2026-04-07

### Changed
- **Login page** — removed image from logo, text-only lockup now.

---

## [0.24.24] - 2026-04-07

### Fixed
- Vercel builds failing: `nextjs-toploader` missing from lockfile; `getPlayerPoemContext` missing `onlyTestSessions` in return value.

---

## [0.24.23] - 2026-04-07

### Fixed
- **Link tap feedback** — tapping any link or nav tab now shows immediate visual feedback (sky highlight or opacity drop) before the page loads. Also bumped the navigation progress bar from 3px to 4px for visibility.

---

## [0.24.22] - 2026-04-06

### Changed
- **Color scheme** — replaced all blue (`blue-*`) with sky (`sky-*`) throughout the app for a lighter, more modern feel.

---

## [0.24.21] - 2026-04-06

### Changed
- **Session detail page** — session nav is two rows: "All Sessions" on its own line, then `‹ MM/DD Session` and `MM/DD Session ›` below for adjacent non-test sessions. Grayed out at boundaries.

---

## [0.24.20] - 2026-04-06

### Changed
- **Players page** — player cards are now more compact: skill dots and match counts removed. The Check In / Check Out button is always visible; it's disabled (grayed out) when no session is active.

---

## [0.24.19] - 2026-04-06

### Changed
- **Player profile — Stats by Session** — the current in-progress session now appears in the chart and match history alongside completed ones. Dates for live sessions are highlighted in blue with an asterisk (`*`). The legend "* In progress" sits inline with the Wins / Losses key in the chart.

---

## [0.24.18] - 2026-04-06

### Changed
- **Player poems** — regenerated for all 35 players using improved context: non-test sessions only, includes tally-session results (not just individual match records). Players who only appear in test sessions (Kiran Bertil, Vasu, Vinaya, Chitra) get a playful "QA tester on the court" poem instead.

---

## [0.24.18] - 2026-04-06

### Added
- **Navigation loading indicator** — a thin blue progress bar appears at the top of the screen whenever a link click triggers a page load, so it's always clear something is happening.

---

## [0.24.17] - 2026-04-06

### Changed
- **Player profile — Stats chart** — all completed sessions now appear as bars, including ones the player missed. Absent sessions render as a thin gray stub so attendance gaps are visible at a glance.
- **Player profile — Match history** — sessions the player didn't attend now show as dimmed "Did not play" entries. Same filter applies: test sessions included/excluded based on the toggle.

---

## [0.24.16] - 2026-04-06

### Changed
- **Control Panel** — moved from bottom nav tab to a gear icon (⚙) in the top header, next to the profile badge. Only visible to God Mode users.

---

## [0.24.15] - 2026-04-06

### Changed
- **Session badges** — "Active" renamed to "In Progress" with a dark blue filled badge and pulsing dot, making it visually distinct from the teal "Finalized" badge. Updated on both the session list and session detail pages.

---

## [0.24.14] - 2026-04-06

### Fixed
- **Leaderboard season total** — "Total matches this season" now includes tally sessions (previously only counted full match-recording sessions, causing individual player totals to appear higher than the season count)

---

## [0.24.13] - 2026-04-06

### Added
- **Reset Session Backup** — every Wipe & Reset now saves a full JSON snapshot of all matches (with player names), tally rows, and proposed matches to a `session_reset_backups` table before deleting anything. If the backup fails, the reset is aborted — data is never deleted without a backup. Multiple wipes on the same session each produce their own snapshot.

---

## [0.24.12] - 2026-04-06

### Fixed
- **Player profile** — stats chart and W/L totals now include sessions that were recorded as tallies (3/23, 3/26, 3/30). Match history shows these sessions as a "3W 4L (tally)" summary since individual match records don't exist for them. Leaderboard was already correct.

---

## [0.24.11] - 2026-04-06

### Changed
- **Who's Here** — preview reduced from 4 to 2 rows; remaining players shown under "See More".

---

## [0.24.10] - 2026-04-06

### Changed
- **Finalize Scores & Close** — renamed from "Close Session"; now a solid blue button matching the Check In style; moved to sit directly above the Reset button (was separated by scoreboard + match history).
- **Wipe & Reset Session** — renamed from "Reset Session"; now a solid red button.

---

## [0.24.9] - 2026-04-06

### Changed
- **Who's Here** — newest check-ins now appear at the top by default. List collapses to 4 players with a "See More (N more)" button; expands to full list on tap.

---

## [0.24.9b] - 2026-04-06

### Changed
- **Who's Here & Tonight's Scores** — verified (✓) and admin badges now appear next to player names.

---

## [0.24.8] - 2026-04-06

### Changed
- **Control Panel** — moved from a card inside Admin Panel to its own ⚙️ tab in the bottom nav, after Leaderboard. Only visible to God Mode users.

---

## [0.24.7] - 2026-04-06

### Changed
- **Control Panel caption** — subtext updated to "Settings for nerds — Supabase, Vercel & Claude".
- **Add Player** — moved from a standalone button above the grid to a compact text link (`+ Add Player`) on the right side of the "Player Check-ins" header row. Form still expands inline below the header when tapped.

---

## [0.24.6] - 2026-04-06

### Changed
- **Session header toggles** — Labels updated ("Live" → "Auto Refresh", "Test" → "Testing Only") and moved to the left of the switch on both toggles.

---

## [0.24.5] - 2026-04-06

### Added
- **Pull-to-refresh** — In the installed PWA (iOS/Android), pull down from the top of any page to refresh it. A spinner appears as you pull and spins while refreshing. Has no effect in a regular browser (uses the browser's native gesture instead).

---

## [0.24.4] - 2026-04-06

### Fixed
- **Auto-refresh toggle label** — "Live" text was hidden on mobile (`hidden sm:inline`). Now always visible.

---

## [0.24.3] - 2026-04-06

### Changed
- **Session header toggles** — Auto-refresh and Test Session toggles now sit on their own row below the session status badge, right-aligned. Previously they were squeezed into the same row as "Ongoing" / "Finalized".

---

## [0.24.2] - 2026-04-06

### Added
- **Auto-refresh** — Active session pages refresh every 5 seconds automatically. An iOS-style "Live" toggle in the top-right lets you turn it off. Preference is remembered across visits.
- **Player profile links** — Player names in Tonight's Scores are now tappable links to their profile pages.

---

## [0.24.1] - 2026-04-06

### Added
- **PWA / Add to Home Screen** — App is now installable on iPhone and Android. Open in Safari/Chrome, tap Share → "Add to Home Screen". Launches full-screen with no browser chrome.
- **Club crest icon** — PWA and Apple touch icon now use the Serve Snoqualmie club crest (`serve-icon.png`).

### Changed
- **Close Session button** — now teal/green instead of red, reflecting it's a positive "wrap up" action rather than a destructive one.
- **Reset Session button** — moved below Close Session during active sessions; also now available on completed (closed) sessions for God Mode users, enabling recovery from tally-mode sessions.
- **Reset clears tally data** — resetting a session now also deletes any tally entries (not just match records and proposed matches). The confirmation dialog lists tally entries when present.

---

## [0.24.0] - 2026-04-06

### Added
- **Edit Player (God Mode)** — God Mode users see a ✏️ button on any player profile page. Tapping it opens an inline form to rename the player and change their skill level. Save is disabled until something changes. Regular admins and non-admins see no edit controls.

---

## [0.23.3] - 2026-04-06

### Added
- **Tally model indicator** — God Mode users see the active AI model name (e.g. "Haiku 4.5") as a small label next to the 📷 camera button on session pages. Other admins and regular users see nothing.

---

## [0.23.2] - 2026-04-06

### Changed
- **Combined stats chart** — Player profile now shows a single stacked bar chart (wins green, losses red), replacing the two separate charts.

### Added
- **Exclude test sessions** — Test session data is filtered out of player profile stats and match history by default. Admins see an iOS-style toggle to include them.

---

## [0.23.1] - 2026-04-06

### Performance
- **DB indexes** — Added 4 indexes covering the most-hit query patterns: session match history, check-in list, session list, and leaderboard/player queries. Fifth index (`last_seen_at`) deferred until the online indicator feature is built.

---

## [0.23.0] - 2026-04-06

### Added
- **Reset Session** (God Mode only) — ⚡ Reset Session button on active session pages. Fetches live match and proposal counts, shows a confirmation dialog, then hard-deletes all matches and proposed matches for the session. Check-ins are unaffected.

---

## [0.22.21] - 2026-04-06

### Fixed
- **Tally photo extraction** — Replaced assistant prefill (unsupported by Sonnet 4.6) with regex extraction of the outermost JSON object, handling any preamble the model adds.

---

## [0.22.20] - 2026-04-06

### Fixed
- **Tally photo extraction** — Sonnet 4.6 was prepending conversational text before the JSON. Fixed using assistant prefill: seeding the response with `{` forces the model to output pure JSON with no preamble.

---

## [0.22.19] - 2026-04-06

### Fixed
- **Tally photo extraction** — Sonnet 4.6 returns a thinking block before the text block; the code now finds the text block correctly instead of blindly reading index 0, which was causing JSON parse errors.

---

## [0.22.18] - 2026-04-06

### Fixed
- **Tally model picker** — Corrected model IDs to ones actually available on this account: `claude-haiku-4-5-20251001` and `claude-sonnet-4-6` (verified via API).

---

## [0.22.17] - 2026-04-06

### Added
- **Session list** — Finalized sessions with no matches and no tally data now show a light red "No Data" badge instead of "Finalized".

---

## [0.22.16] - 2026-04-06

### Fixed
- **Tally model picker** — Sonnet option now uses `claude-3-sonnet-20240229` (available on all tiers).

---

## [0.22.15] - 2026-04-06

### Fixed
- **Tally photo extraction** — Switched to `claude-3-haiku-20240307` which is available on all Anthropic account tiers.

---

## [0.22.14] - 2026-04-06

### Changed
- **Tally photo extraction** — Switched from Google Gemini to Claude (Haiku by default). Cost is ~$0.003 per photo.

### Added
- **Control Panel — AI Model picker** — God mode users can switch the tally extraction model between Haiku and Sonnet. Takes effect immediately on the next upload.

---

## [0.22.13] - 2026-04-06

### Added
- **Tally correction logging** — When a tally is saved after photo import, the raw AI extraction and any previous tally values are recorded in `tally_correction_log`. This data will be used to improve photo recognition over time.

---

## [0.22.12] - 2026-04-06

### Fixed
- **Tally photo extraction** — Updated Gemini model from `gemini-1.5-flash` (deprecated) to `gemini-2.0-flash`.

---

## [0.22.11] - 2026-04-06

### Fixed
- **Session detail** — "Past Sessions" list at the bottom of a session page no longer includes test sessions.

---

## [0.22.10] - 2026-04-06

### Changed
- **Finalized badge** — Changed color from indigo to teal to avoid clash with the blue Upcoming badge.

---

## [0.22.9] - 2026-04-06

### Fixed
- **Tally photo import** — On iPhone, tapping "Import from photo" now opens the file picker (photo library or camera) instead of launching the camera directly.

---

## [0.22.8] - 2026-04-06

### Changed
- **Session list & session detail** — "Closed" badge renamed to "Finalized" with indigo color.

---

## [0.22.7] - 2026-04-06

### Fixed
- **Session list** — Restored the Test Sessions toggle. The "Test Sessions" section header now has an inline on/off toggle (saved per device); sessions are hidden until toggled on.

---

## [0.22.6] - 2026-04-06

### Changed
- **Control Panel** — Moved entry point from the top header bar into the Admin Panel page. God Mode users see a "Control Panel" card at the top of Admin Panel linking to `/admin/control-panel`.

---

## [0.22.5] - 2026-04-06

### Changed
- **Session list** — Test sessions (admin only) now appear in their own "Test Sessions" section at the bottom, separate from Past Sessions. The "Show Test Sessions" toggle is removed — test sessions are always visible to admins in their own section.

---

## [0.22.4] - 2026-04-06

### Fixed
- **Session list** — Pending sessions with a past date now appear in Past Sessions instead of being hidden. Previously they were excluded from both Upcoming and Past sections.

---

## [0.22.3] - 2026-04-06

### Added
- **Tally session awards** — Closed tally-mode sessions now show Session Awards cards: The Slayer (most wins), The Unstoppable (most matches), and The Untouchable (best win rate, min 3 matches). Uses the same card layout as match-based sessions.

---

## [0.22.2] - 2026-04-06

### Added
- **Control Panel link** — God Mode users now see a "⚙ Panel" link in the header that goes directly to `/admin/control-panel`.

---

## [0.22.1] - 2026-04-06

### Changed
- **Tally Photo Import** — Unmatched players now shown in red (not amber) with the raw board name as a hint. Save is blocked until all red rows are resolved or deleted. A yellow warning appears when wins ≠ losses totals (sanity check). Prompt updated with tally-mark-specific counting rules for better accuracy.

---

## [0.22.0] - 2026-04-06

### Added
- **Tally Photo Import (God Mode)** — On sessions with tally mode, Karthik can tap 📷 to upload a whiteboard photo. Gemini AI extracts player names and W/L counts and pre-fills the tally form. Unmatched names are highlighted for manual resolution. Photos are stored in Supabase Storage and viewable via "Source photo →" link.

---

## [0.21.5] - 2026-04-05

### Added
- **Control Panel** (God Mode only) — new page at `/admin/control-panel` showing live Supabase DB size (with progress bar vs 500 MB free tier), table row counts, auth user count, Vercel plan, and recent deployment statuses.

---

## [0.21.4] - 2026-04-05

### Changed
- **Tally Scoreboard** — All columns now sortable (Player, M, W, L, Win%); default sort is wins descending. Added match count (M) column. Player names link to their profile page.

---

## [0.21.3] - 2026-04-06

### Changed
- **Session list** — Upcoming section shows only the single next pending session.

---

## [0.21.2] - 2026-04-05

### Fixed
- **Session list** — Upcoming sessions (e.g. Monday 4/6) were disappearing when a same-day session was created. Removed the broken date-cutoff logic; all sessions are now always returned.

### Changed
- **Session list** — Split into **Upcoming** and **Past Sessions** sections. Upcoming sessions show "Opens at 6pm" and an "Upcoming" badge instead of "Pending".

---

## [0.21.1] - 2026-04-05

### Changed
- **Leaderboard** — "Include Test Sessions" toggle now sits above the award cards so toggling it flips the entire leaderboard view: award winners, player count, table stats, and match total all update together.

---

## [0.21.0] - 2026-04-05

### Added
- **Test Sessions** — Sessions created on a non-Monday/Thursday are automatically flagged as test sessions. Admins can toggle the flag on any session from the session header.
- **Session list** — Admins see a "Show Test Sessions" toggle (off by default, saved per device). Test sessions are hidden from non-admins.
- **Leaderboard** — Admins see an "Include Test Sessions" toggle (off by default, saved per device). When on, stats and match totals include test session data. Non-admins always see stats excluding test sessions.
- **Tally Mode** — Admins can now enter final W/L tallies for sessions where individual matches were never recorded. On any completed session with no match history, a new "Enter Final Scores" button appears. Pick players, enter their win and loss counts, and save. The session shows a tally scoreboard (W/L/Win%) and the totals roll up into the season leaderboard alongside match-recorded sessions.

---

## [0.20.6] - 2026-04-05

### Fixed
- **Record a Score** — In full score mode (Win/Loss Only toggle OFF), the first column no longer shows the green "Winning Team" border and label. Both columns show neutral styling ("Team 1" / "Team 2") and the winner is determined by the scores entered.

---

## [0.20.5] - 2026-04-04

### Changed
- **Leaderboard** — player names are now links to their profile pages.

---

## [0.20.4] - 2026-04-04

### Changed
- **Record a Score** — "Winners" → "Winning Team"; opposing column label removed.

---

## [0.20.3] - 2026-04-04

### Changed
- **Who's Here** — "Out" button renamed to "Checkout".
- **Record a Score** — Winners and Losers columns now each sit inside a bordered card (green tint for Winners, gray for Losers) making the team grouping visually clear. "Losers" label added to match the "Winners" label.

---

## [0.20.2] - 2026-04-04

### Fixed
- **Add Player** — name input now shows black text instead of grey; bot players are created with a unique `@example.com` placeholder email to satisfy the DB's NOT NULL constraint.

---

## [0.20.1] - 2026-04-04

### Changed
- **God Mode toggle** — A ⚡ OFF/ON button appears in the Admin Panel header for God Mode users only. Off by default: no delete buttons, no removed-players section. Toggle on to reveal full God Mode UI.

---

## [0.20.0] - 2026-04-04

### Added
- **Add Player** — Admins can add players directly from the Admin Panel (name + skill level, no account required). New players appear immediately and can be checked in.
- **Remove Player** — Admins can remove a player from the Admin Panel with an inline confirmation. Removed players disappear from all views, check-ins, and match history.
- **Restore Player** — A "Removed players" section (God Mode only) at the bottom of the Admin Panel shows removed players and lets God Mode users restore them.
- **God Mode** — `is_god_mode` column added to players; currently granted to Karthik Rajan. Gates the removed-players section and future privileged features.

---

## [0.19.5] - 2026-04-04

### Fixed
- **Match history** — disambiguated names now show as "Kiran-I" / "Kiran-B" instead of "KiranI" / "KiranB".

### Changed
- **Win/Loss Only toggle** — now visible to all users (not just admins); non-admins see it as read-only.
- **Score saved feedback** — "Score saved!" green text appears for 1.5 seconds after a match is recorded before the form clears.

---

## [0.19.3] - 2026-04-03

### Changed
- **Win/Loss Only toggle** — moved from session header into the "Record a Score" card as an iOS-style toggle, visible to admins only.

---

## [0.19.2] - 2026-04-04

### Changed
- **Player poems** — poems now reference recent session results and a player's most frequent partner, making them more personal and specific.

---

## [0.19.1] - 2026-04-04

### Changed
- **Admin panel** — player names on check-in cards are now links to the player's profile page.

---

## [0.19.0] - 2026-04-04

### Added
- **Player poems** — each player's profile now shows a short AI-generated funny poem below their name. Poems are persisted in a new `player_poems` table and regenerate automatically when a player's match count changes by 3 or more.

---

## [0.18.1] - 2026-04-04

### Fixed
- **Session page** — no longer crashes into an infinite redirect loop when the `simple_score_tracking` DB column hasn't been migrated yet; falls back gracefully with simple mode defaulting to on.

### Changed
- **Player badges** — added spacing between player name and the verified/admin badges.

---

## [0.18.0] - 2026-04-04

### Added
- **Simple Score Tracking** — new per-session mode (default on) for quick win/loss recording without score entry or match generation.
  - Admins see a **⚡ Simple / 🔢 Full** toggle in the session header; setting persists per session.
  - In simple mode: a compact "Record a Win" form replaces the Generate Matches queue and full score form. Pick 2 winners and 2 losers, hit Save. Score is stored internally as 21–15.
  - In full mode: existing Generate Matches + score entry flow is unchanged.

---

## [0.17.22] - 2026-04-04

### Changed
- **Player badges** — verified accounts now show an Instagram-style blue circle checkmark (SVG) instead of a plain green ✓.
- **Player badges** — admin indicator changed from ★ to 🛡️ and now appears after the verified badge.
- Both badges updated consistently across the leaderboard and admin panel.

---

## [0.17.21] - 2026-04-04

### Changed
- **Admin Panel** — moved from `/players` to `/admin`. Non-admin users who navigate to `/admin` are redirected to the session page.

---

## [0.17.20] - 2026-04-04

### Changed
- **Admin Panel** — player list redesigned as a 3-column card grid under "Player Check-ins" heading.
- **Admin Panel** — checked-in players now show a green card background and a ✓ badge so it's instantly clear who is present.
- **Admin Panel** — "Check In" (blue, solid) and "Check Out" (red, outline) buttons are full-width inside each card.
- **Admin Panel** — when no session is active, cards show each player's W/L record instead of action buttons.

---

## [0.17.19] - 2026-04-03

### Fixed
- **Tonight's Scores** — scoreboard now only lists players who played at least one match, not everyone who checked in.

---

## [0.17.18] - 2026-04-03

### Changed
- **Admin Panel** — Players tab renamed to "Admin". Page title updated to "Admin Panel".
- **Admin Panel** — player list redesigned as a minimalist flat table (consistent with session and leaderboard views).
- **Admin Panel** — presence buttons replaced with explicit "Check In" and "Check Out" buttons so the action is always unambiguous.

---

## [0.17.17] - 2026-04-03

### Added
- **Leaderboard awards** — two season award cards above the stats table:
  - 🏸 **Badminton Nut** — player with the most matches played this season
  - 🎯 **Nut Cracker** — best win rate among players who've played at least half as many matches as the Badminton Nut
- **Leaderboard winner** — 🏆 badge and row highlight in the table now follow the Nut Cracker eligibility rule rather than raw win %.

---

## [0.17.16] - 2026-04-03

### Changed
- **Admin badge** — admin users now see a red avatar in the top-right corner instead of blue, making it easy to know when you're logged in with admin privileges.

---

## [0.17.15] - 2026-04-03

### Changed
- **Name display** — players who share a first name now show a last name initial to disambiguate (e.g. "KiranB" and "KiranI"). Applies everywhere short names are used: match history, proposed matches, session awards, and player profile.

---

## [0.17.14] - 2026-04-03

### Changed
- **Session Awards** — when multiple players tie for an award, all of their names are shown alphabetically, separated by commas.

---

## [0.17.13] - 2026-04-03

### Changed
- **Leaderboard** — #1 rank badge is now 🏆; silver and bronze medals removed (just numbers). The player with the most matches played earns the 🥜 badge.

---

## [0.17.12] - 2026-04-03

### Changed
- **Close Session** — closing a session now automatically checks out all players who are still marked as present.
- **Players tab** — now only visible to admins in the bottom navigation.

---

## [0.17.11] - 2026-04-03

### Fixed
- **Tonight's Scores** — scoreboard now shows all players who attended the session, including those who checked out early.

---

## [0.17.10] - 2026-04-01

### Changed
- **Session Awards** — now visible to all users (not just admins) on closed sessions.

---

## [0.17.9] - 2026-04-01

### Changed
- **Session Awards** — "The One with No Mercy" renamed to "The Ones with No Mercy" (team award).

---

## [0.17.8] - 2026-04-01

### Fixed
- **Session Awards** — title and description lines now have a minimum height so name and stat stay vertically aligned across cards in the same row.

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
