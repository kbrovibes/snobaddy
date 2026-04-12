# Regenerate App Mockups

Regenerate the interactive HTML mockups in `docs/mockups/` to reflect the current state of the app.

## Instructions

1. **Archive current mockups:**
   - Create `docs/mockups/archive/YYYY-MM-DD/` using today's date
   - Copy all current `.html` files from `docs/mockups/` into the archive folder (not the archive folder itself)
   - This preserves history — never delete old versions

2. **Research current app state:**
   - Read all pages in `src/app/(app)/` to understand current routes and layouts
   - Read key components in `src/components/` for current UI patterns
   - Check `CHANGELOG.md` for recent changes that affect the UI
   - Note any new features, changed layouts, or removed screens

3. **Regenerate each mockup file:**
   - `docs/mockups/auth-flow.html` — Login, Google SSO, email signup, password reset
   - `docs/mockups/account-linking.html` — "Is this you?" merge flow on sign-up
   - `docs/mockups/sessions.html` — Session list, session detail (player + admin views), record match
   - `docs/mockups/players-leaderboard.html` — Players page, player detail, leaderboard
   - `docs/mockups/finals-setup.html` — Finals event creation, players/groups/sessions tabs
   - `docs/mockups/finals-matchday.html` — Format picker, match generation, playoffs, finals series
   - `docs/mockups/index.html` — Landing page linking to all mockups, update version date

4. **Mockup requirements:**
   - Each file is a standalone HTML with Tailwind CDN (`<script src="https://cdn.tailwindcss.com"></script>`)
   - Phone frame: 390px wide, rounded-3xl border, stone-50 bg, shadow
   - Step navigation buttons at top to click through screens
   - Must match current app styling: stone color palette, sky-600 accents, rounded-xl cards
   - Include header (🏸 Serve Snoqualmie + BADMINTON) and bottom nav (Session/Players/Leaderboard)
   - Use realistic data (real player names from the club: Ajay, Alok, Arjun, Deepa, Gautham, etc.)
   - **Left sidebar TOC** (fixed, w-48, bg-white, border-r) with links to all mockup pages. Current page highlighted with bg-sky-50 text-sky-700. Body content offset with ml-48.
   - **Back/Next buttons** inside phone frame at bottom (border-t, bg-white). Back = text-stone-500, Next = text-sky-600 font-semibold. Hidden on first/last step respectively.
   - **Keyboard navigation**: Left/Right arrow keys move between steps
   - **End-of-flow link**: Last step shows "All Mockups" link back to index.html instead of Next

5. **Update index.html:**
   - Update the version display with today's date
   - Add/remove cards if mockup files changed
   - Keep screen counts accurate

6. **Commit and push:**
   - Stage all files in `docs/mockups/`
   - Commit with message: `docs: regenerate app mockups vN — YYYY-MM-DD`
   - Push to main

## Notes
- These mockups are for documentation only — they don't affect the app
- GitHub Pages serves them from `docs/mockups/` at the project's GitHub Pages URL
- The archive folder preserves all historical versions
