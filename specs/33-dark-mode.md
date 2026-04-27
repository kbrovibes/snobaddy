# Spec 33: Dark Mode (System Default + User Override)

## What it does
Automatically matches the phone's light/dark setting via `prefers-color-scheme`. Users who prefer one mode regardless of their phone setting can override it from their profile/settings. The preference is stored per-player in the database so it persists across devices.

## What it does NOT do
- No scheduled/timed dark mode (e.g. "dark after 8pm")
- No per-page or per-component theme switching
- No custom theme colors beyond light and dark (see Spec 26 for Smash Theme)

## How it works

Three modes: **System** (default), **Light**, **Dark**.

- **System** — respects `prefers-color-scheme` media query (no class needed)
- **Light** — forces light regardless of OS setting
- **Dark** — forces dark regardless of OS setting

Implementation uses Tailwind's `class` dark mode strategy on `<html>`. A tiny inline script in `<head>` reads the stored preference before paint to prevent flash-of-wrong-theme (FOWT).

## Data / DB changes

Add a column to `players`:

```sql
ALTER TABLE players
  ADD COLUMN theme_preference text NOT NULL DEFAULT 'system'
  CHECK (theme_preference IN ('system', 'light', 'dark'));
```

No new tables needed.

## API

### PATCH `/api/players/[id]/theme`
- **Auth:** logged-in user can update own preference; admins can update any
- **Body:** `{ "theme": "system" | "light" | "dark" }`
- **Response:** `{ "ok": true }`
- Updates `players.theme_preference`

## UI

### Theme toggle
Location: **Player profile dropdown** (tap avatar in Header) or a dedicated Settings row.

Simple 3-way segmented control:
```
[ Sun | Moon | System ]
  Light  Dark   Auto
```

Tapping a segment saves immediately (no Save button). Current selection is highlighted.

### Dark color palette

Map the existing stone-based light palette to dark equivalents:

| Token | Light | Dark |
|-------|-------|------|
| --background | #FAFAF9 (stone-50) | #1C1917 (stone-900) |
| --foreground | #1C1917 (stone-900) | #FAFAF9 (stone-50) |
| --surface | white | #292524 (stone-800) |
| --surface-alt | #F5F5F4 (stone-100) | #1C1917 (stone-900) |
| --border | #E7E5E4 (stone-200) | #44403C (stone-700) |
| --muted | #78716C (stone-500) | #A8A29E (stone-400) |

Accent colors (sky, emerald, red, amber) stay the same or shift slightly for contrast on dark backgrounds.

### FOWT prevention script

Inline `<script>` in `<head>` of root layout (runs before React hydration):

```js
(function() {
  try {
    var t = document.cookie.match(/theme=(system|light|dark)/);
    var pref = t ? t[1] : 'system';
    if (pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  } catch(e) {}
})();
```

The cookie is set client-side when the user logs in (from their DB preference) and when they change the toggle.

## Migration strategy

Rather than adding `dark:` variants to 863+ class instances, convert to CSS custom properties (design tokens):

1. Define all color tokens in `globals.css` under `:root` and `.dark` / `@media (prefers-color-scheme: dark)`
2. Replace hardcoded Tailwind color classes with token-based classes (e.g. `bg-stone-50` -> `bg-surface`, `text-stone-900` -> `text-foreground`)
3. Migrate file-by-file, starting with the most-used components

### Migration priority (by usage count)
1. globals.css — define tokens + dark values
2. layout.tsx — add dark mode class strategy + FOWT script
3. Header.tsx, BottomNav.tsx — app shell (seen on every page)
4. WhiteboardTally.tsx, TallyEntryForm.tsx — primary session UI
5. session/[id]/page.tsx — session detail
6. RecordMatchForm.tsx — match recording
7. LeaderboardTable.tsx — leaderboard
8. login/page.tsx — login page
9. FinalsEventTabs.tsx, finals/* — finals UI
10. admin/* — admin pages
11. Remaining components

## Files to create/modify

| File | Action |
|---|---|
| `src/app/globals.css` | Modify — add CSS custom property tokens + dark values |
| `src/app/layout.tsx` | Modify — add FOWT prevention script, dark class on html |
| `src/lib/db/players.ts` | Modify — add `getThemePreference()` and `setThemePreference()` |
| `src/app/api/players/[id]/theme/route.ts` | Create — PATCH endpoint for theme preference |
| `src/components/ThemeToggle.tsx` | Create — 3-way segmented control component |
| `src/components/ThemeProvider.tsx` | Create — client component that syncs cookie + html class |
| `src/components/Header.tsx` | Modify — add ThemeToggle to profile dropdown |
| `src/components/BottomNav.tsx` | Modify — replace hardcoded colors with tokens |
| `src/components/WhiteboardTally.tsx` | Modify — replace hardcoded colors with tokens |
| `src/components/TallyEntryForm.tsx` | Modify — replace hardcoded colors with tokens |
| `src/components/RecordMatchForm.tsx` | Modify — replace hardcoded colors with tokens |
| `src/app/(app)/session/[id]/page.tsx` | Modify — replace hardcoded colors with tokens |
| `src/app/(app)/leaderboard/LeaderboardTable.tsx` | Modify — replace hardcoded colors with tokens |
| `src/app/login/page.tsx` | Modify — replace hardcoded colors with tokens |
| `src/app/(app)/finals/[id]/FinalsEventTabs.tsx` | Modify — replace hardcoded colors with tokens |
| `src/components/finals/*.tsx` | Modify — replace hardcoded colors with tokens |
| `src/app/(app)/admin/**/*.tsx` | Modify — replace hardcoded colors with tokens |
| All remaining components in `src/components/` | Modify — replace hardcoded colors with tokens |

## Acceptance Criteria

- [ ] App renders in dark colors when phone is set to dark mode (default behavior for new/logged-out users)
- [ ] App renders in light colors when phone is set to light mode
- [ ] Logged-in user can override to Light, Dark, or System from the app
- [ ] Preference persists across sessions (stored in DB, synced to cookie)
- [ ] No flash of wrong theme on page load (FOWT script works)
- [ ] All pages are legible and usable in both modes (no white-on-white or black-on-black text)
- [ ] Login page supports dark mode (pre-auth, uses System default)
- [ ] Accent colors (sky, emerald, red, amber) are readable on dark backgrounds

## Estimated scope
~30 files to migrate. This is a large cross-cutting change. Consider splitting into phases:
- **Phase 1:** Token system + app shell + FOWT script + theme toggle (functional dark mode for layout)
- **Phase 2:** Migrate primary session UI (whiteboard, tally, match form)
- **Phase 3:** Migrate remaining pages (finals, admin, leaderboard, login)
