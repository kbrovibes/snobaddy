# Spec 26: Smash Theme + Theme Switching Infrastructure

## What it does

Applies the "Smash" visual theme across the entire app and adds a CSS-variable-based
token system that makes future theme switching trivial. A god-mode-only toggle in the
header lets admins preview the Smash theme; the choice persists in `localStorage`.
Regular players always see the default theme.

## What it does NOT do

- No layout changes, no component restructuring, no new features
- No spacing/padding changes beyond compensating for font size differences
- No changes to routing, data logic, or API calls
- No new Supabase tables or columns
- Does not expose theme switching to non-god-mode users (for now)

---

## Design tokens

### Step 1 — Semantic tokens in `globals.css`

Replace the current minimal `:root` block with a full set of semantic CSS variables.
Define two theme blocks: the default (current sky/green palette) and `[data-theme="smash"]`.

```css
/* globals.css */

/* ── Default theme (current palette) ─────────────────── */
:root {
  --color-bg:           #FAFAF9;
  --color-surface:      #FFFFFF;
  --color-surface-alt:  #F5F5F4;
  --color-border:       #E7E5E4;
  --color-border-strong:#D6D3D1;

  --color-text-primary: #1C1917;
  --color-text-muted:   #78716C;
  --color-text-subtle:  #A8A29E;

  --color-accent:       #0EA5E9;   /* sky-500 */
  --color-accent-dim:   rgba(14,165,233,0.08);

  --color-wins:         #16A34A;   /* green-600 */
  --color-wins-dim:     rgba(22,163,74,0.08);
  --color-losses:       #EF4444;   /* red-500 */
  --color-losses-dim:   rgba(239,68,68,0.08);

  --color-btn-primary-bg: #0EA5E9;
  --color-btn-primary-fg: #FFFFFF;
  --color-nav-bg:         #FFFFFF;
  --color-nav-border:     #E7E5E4;
  --color-nav-active:     #0EA5E9;
  --color-nav-inactive:   #A8A29E;

  --radius-card:    12px;
  --radius-btn:     10px;
  --radius-badge:   6px;
  --radius-input:   8px;

  --font-display: 'Geist', sans-serif;  /* unchanged in default */
  --font-body:    'Geist', sans-serif;
}

/* ── Smash theme ──────────────────────────────────────── */
[data-theme="smash"] {
  --color-bg:           #F8F8F8;
  --color-surface:      #FFFFFF;
  --color-surface-alt:  #F0F0F0;
  --color-border:       #E2E2E2;
  --color-border-strong:#CCCCCC;

  --color-text-primary: #0A0A0A;
  --color-text-muted:   #888888;
  --color-text-subtle:  #BBBBBB;

  --color-accent:       #E8290B;
  --color-accent-dim:   rgba(232,41,11,0.07);

  --color-wins:         #007A36;
  --color-wins-dim:     rgba(0,122,54,0.07);
  --color-losses:       #E8290B;
  --color-losses-dim:   rgba(232,41,11,0.07);

  --color-btn-primary-bg: #0A0A0A;
  --color-btn-primary-fg: #FFFFFF;
  --color-nav-bg:         #0A0A0A;
  --color-nav-border:     #1A1A1A;
  --color-nav-active:     #E8290B;
  --color-nav-inactive:   #555555;

  --radius-card:    4px;
  --radius-btn:     4px;
  --radius-badge:   2px;
  --radius-input:   4px;

  --font-display: 'Bebas Neue', sans-serif;
  --font-body:    'Outfit', sans-serif;
}
```

### Step 2 — Expose tokens as Tailwind utilities

In `globals.css` under `@theme inline`, add:

```css
@theme inline {
  --color-bg:           var(--color-bg);
  --color-surface:      var(--color-surface);
  --color-surface-alt:  var(--color-surface-alt);
  --color-border:       var(--color-border);
  --color-border-strong:var(--color-border-strong);
  --color-text-primary: var(--color-text-primary);
  --color-text-muted:   var(--color-text-muted);
  --color-text-subtle:  var(--color-text-subtle);
  --color-accent:       var(--color-accent);
  --color-accent-dim:   var(--color-accent-dim);
  --color-wins:         var(--color-wins);
  --color-wins-dim:     var(--color-wins-dim);
  --color-losses:       var(--color-losses);
  --color-losses-dim:   var(--color-losses-dim);
  --color-btn-primary-bg: var(--color-btn-primary-bg);
  --color-btn-primary-fg: var(--color-btn-primary-fg);
  --color-nav-bg:       var(--color-nav-bg);
  --color-nav-active:   var(--color-nav-active);
  --color-nav-inactive: var(--color-nav-inactive);

  --font-display: var(--font-display);
  --font-body:    var(--font-body);
}
```

This makes `text-accent`, `bg-surface`, `border-border`, `font-display`, etc. available
as Tailwind utilities everywhere.

---

## Fonts

Add to root `layout.tsx` via `next/font/google`:

```ts
import { Bebas_Neue, Outfit } from 'next/font/google';

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
  display: 'swap',
});

const outfit = Outfit({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});
```

Apply both `variable` classes to `<html>`. The CSS variables reference them:
- Default theme: `--font-display` and `--font-body` both point to the existing Geist variable
- Smash theme: `--font-display` → `var(--font-bebas)`, `--font-body` → `var(--font-outfit)`

Fonts only load when their CSS variable is actually referenced by a rendered element
(Next.js font optimization handles this), so Bebas Neue and Outfit are not downloaded
in the default theme.

---

## Component migration

Every component that currently uses hardcoded palette classes gets migrated to semantic
token classes. This is a mechanical find-and-replace per mapping below. No logic changes.

### Color mapping

| Current class | Semantic class | Notes |
|---|---|---|
| `text-sky-{n}` | `text-accent` | links, active states, CTAs |
| `bg-sky-{n}` | `bg-accent` or `bg-accent-dim` | button fills, tinted bgs |
| `border-sky-{n}` | `border-accent` | focus rings, highlights |
| `text-green-{n}` | `text-wins` | W counts, win% |
| `bg-green-50` | `bg-wins-dim` | win badge bg |
| `bg-green-{500-600}` | `bg-wins` | check-in indicator, start button |
| `text-red-{n}` (losses context) | `text-losses` | L counts |
| `bg-red-50` (losses context) | `bg-losses-dim` | loss badge bg |
| `text-gray-900` / `text-gray-800` | `text-text-primary` | primary text |
| `text-gray-500` / `text-gray-400` | `text-text-muted` | secondary text |
| `text-gray-300` / `text-gray-200` | `text-text-subtle` | disabled/placeholder |
| `bg-white` (card context) | `bg-surface` | cards, panels |
| `bg-gray-50` (page bg) | `bg-bg` | page background |
| `bg-gray-50` (alt rows) | `bg-surface-alt` | alternate rows |
| `border-gray-100` | `border-border` | card borders |
| `border-gray-200` | `border-border-strong` | dividers |
| `rounded-xl` (cards) | `rounded-[var(--radius-card)]` | or inline style |
| `rounded-xl` (buttons) | `rounded-[var(--radius-btn)]` | |
| `rounded-lg` (badges) | `rounded-[var(--radius-badge)]` | |

**Do NOT remap:**
- `text-red-600` in destructive-action buttons (delete, reset) — these are intentionally
  red regardless of theme. Use `text-red-600` literally.
- Orange: test session badges, "Starting soon" pill — specialty state, keep as-is
- Purple: tally entry form, AI model picker — specialty feature, keep as-is
- Amber: God Mode toggle — keep as-is
- Teal: "Finalized" badge — keep as-is
- `rounded-full` on avatar circles — always circular, never changes

### Inline styles (`PlayerCheckinCard`)

The redesigned `PlayerCheckinCard` uses inline style objects with hardcoded hex values.
Replace each with `var(--color-*)` references:

| Hardcoded | Replace with |
|---|---|
| `border: '2px solid #34D399'` | `border: '2px solid var(--color-wins)'` |
| `boxShadow: '0 2px 8px rgba(52,211,153,0.18)'` | `boxShadow: '0 2px 8px var(--color-wins-dim)'` |
| `borderColor: '... #34D399 ...'` | `borderColor: '... var(--color-wins) ...'` |
| `color: '#059669'` (present text) | `color: 'var(--color-wins)'` |
| `color: '#78716C'` (muted text) | `color: 'var(--color-text-muted)'` |
| `color: '#1C1917'` (name) | `color: 'var(--color-text-primary)'` |
| `borderRadius: 12` (card) | `borderRadius: 'var(--radius-card)'` |
| `borderRadius: 8` (avatar) | `borderRadius: 4` (fixed, not theme-driven) |
| `border: '1.5px solid #E7E5E4'` | `border: '1.5px solid var(--color-border)'` |

### SVG chart (`SessionStatsChart`)

Hardcoded `fill` attributes in `<rect>` and `<text>` elements need replacing:

| Hardcoded hex | Replace with |
|---|---|
| `fill="#4ade80"` (win bars) | `fill="var(--color-wins)"` |
| `fill="#f87171"` (loss bars) | `fill="var(--color-losses)"` |
| `fill="#93c5fd"` (open session bar) | `fill="var(--color-accent)"` with opacity |
| `fill="#e5e7eb"` (reference line) | `fill="var(--color-border)"` |
| `fill="#d1d5db"` (absent bar) | `fill="var(--color-border-strong)"` |
| `fill="#9ca3af"` (date labels) | `fill="var(--color-text-muted)"` |
| `fill="#60a5fa"` (open session label) | `fill="var(--color-accent)"` |

Note: SVG `fill` attributes accept CSS variables in all modern browsers.

### `VerifiedBadge` (`PlayerBadges.tsx`)

Change hardcoded `fill="#3B82F6"` to `fill="var(--color-accent)"`.

### `nextjs-toploader` (`layout.tsx`)

Change the `color` prop from `"#0ea5e9"` to `"var(--color-accent)"`. Note: verify that
nextjs-toploader accepts CSS variable strings; if not, use `color="#E8290B"` as a
hard-coded Smash value and document it.

---

## Theme toggle

### Where

God-mode-only. A small icon button in the `Header` component (next to the existing
gear icon). Visible only when `isGodMode === true`. Regular users never see it.

### Behaviour

- Toggles `data-theme="smash"` on `document.documentElement`
- Persists choice to `localStorage` key `"snobaddy-theme"`
- On app load, reads `localStorage` and applies the attribute before first paint
  (add a small inline `<script>` in `layout.tsx` to avoid flash)
- Icon: 🎨 or a simple "S" badge — something lightweight

### Implementation sketch

```tsx
// ThemeToggle.tsx (new component, god-mode only)
"use client";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [smash, setSmash] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("snobaddy-theme") === "smash";
    setSmash(saved);
    document.documentElement.dataset.theme = saved ? "smash" : "";
  }, []);

  function toggle() {
    const next = !smash;
    setSmash(next);
    document.documentElement.dataset.theme = next ? "smash" : "";
    localStorage.setItem("snobaddy-theme", next ? "smash" : "default");
  }

  return (
    <button onClick={toggle} title={smash ? "Smash theme ON" : "Smash theme OFF"}
      className="text-xs font-semibold px-2 py-1 rounded border transition-colors ...">
      {smash ? "S" : "◌"}
    </button>
  );
}
```

The anti-flash inline script in `layout.tsx`:

```html
<script dangerouslySetInnerHTML={{ __html: `
  (function(){
    var t = localStorage.getItem('snobaddy-theme');
    if (t === 'smash') document.documentElement.dataset.theme = 'smash';
  })();
`}} />
```

---

## Files to create/modify

| File | Action |
|---|---|
| `src/app/globals.css` | Add full token `:root` and `[data-theme="smash"]` blocks; expand `@theme inline` |
| `src/app/layout.tsx` | Add Bebas Neue + Outfit via `next/font/google`; add anti-flash script |
| `src/components/ThemeToggle.tsx` | **Create** — god-mode theme switch button |
| `src/components/Header.tsx` | Add `ThemeToggle` (god-mode only); apply semantic token classes |
| `src/components/BottomNav.tsx` | `bg-nav-bg`, `text-nav-active`, `text-nav-inactive`, `border-nav-border` |
| `src/components/PlayerCheckinCard.tsx` | Replace inline hex colors with `var(--color-*)` |
| `src/components/SessionStatsChart.tsx` | Replace hardcoded SVG fills with `var(--color-*)` |
| `src/components/SessionHighlights.tsx` | Semantic classes on award cards |
| `src/components/SessionScoreboard.tsx` | `text-accent`, `text-wins`, `text-losses` |
| `src/components/TallyScoreboard.tsx` | `text-wins`, `text-losses` |
| `src/components/PlayerBadges.tsx` | `fill="var(--color-accent)"` on VerifiedBadge |
| `src/components/CheckInButton.tsx` | Semantic classes |
| `src/components/StartSessionButton.tsx` | `bg-btn-primary-bg`, `text-btn-primary-fg` |
| `src/components/CreateSessionButton.tsx` | Same as above |
| `src/components/CloseSessionButton.tsx` | Semantic classes |
| `src/components/ReopenSessionButton.tsx` | Semantic classes |
| `src/components/FinalizeSessionButton.tsx` | Semantic classes (keep red destructive styles) |
| `src/components/AdminPresenceToggle.tsx` | Semantic classes |
| `src/components/RestorePlayerButton.tsx` | Semantic classes |
| `src/components/BackButton.tsx` | `text-accent` |
| `src/components/BackToSessionsLink.tsx` | `text-accent` |
| `src/components/AddPlayerForm.tsx` | Semantic classes |
| `src/components/ProposedMatchList.tsx` | `border-accent`, `text-accent`, `bg-accent-dim` |
| `src/components/WhoIsHere.tsx` | `text-accent` on player links |
| `src/components/IncludeTestToggle.tsx` | `bg-accent` when on |
| `src/components/AdminPageContent.tsx` | Semantic classes |
| `src/app/(app)/leaderboard/LeaderboardTable.tsx` | `text-accent`, `text-wins`, `text-losses` |
| `src/app/(app)/session/[id]/page.tsx` | Status badges, section labels, nav links |
| `src/app/(app)/players/[id]/page.tsx` | `text-accent`, stat numbers |
| `src/app/(app)/page.tsx` | Session list links and status pills |

**Do NOT touch:**
- Any file under `src/lib/` or `src/app/api/`
- `TallyEntryForm.tsx`, `TallyModelPicker.tsx` (purple — specialty)
- `TestSessionToggle.tsx` (orange — specialty)
- `ResetSessionButton.tsx` (destructive red — intentional)
- `DeletePlayerButton.tsx` (destructive red — intentional)
- `RecordMatchForm.tsx` / `SimpleMatchForm.tsx` — team colors (sky vs orange) are
  meaningful distinction; defer to a follow-up spec if needed

---

## Acceptance Criteria

- [ ] Default theme is visually identical to today's app
- [ ] `[data-theme="smash"]` on `<html>` applies the Smash palette globally — no component
      needs a JS prop change
- [ ] No flash of wrong theme on page load (anti-flash script works)
- [ ] God-mode toggle in header switches theme instantly; persists across refresh
- [ ] Regular (non-god-mode) users see no toggle and always get the default theme
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] Fonts: Bebas Neue and Outfit load only in Smash theme; default theme unchanged
- [ ] SVG chart bars reflect the active theme's win/loss colors
- [ ] Specialty colors (orange test badges, purple tally form, amber god mode, teal
      finalized) are unchanged in both themes
- [ ] Destructive actions (Delete, Reset, Wipe) remain visually red in both themes
