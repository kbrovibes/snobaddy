# Spec 28: Navigation Loading & Click Feedback

## Problem

Users click links/buttons and get no visual feedback that their action registered. The app takes 1-2 seconds to load the next page (server components fetching data), but during that time the UI looks frozen. Users double-click or think the app is broken.

Two distinct issues:
1. **No click feedback** — tapping a link/button doesn't show any visual response
2. **No loading state** — the gap between click and new page rendering is a dead zone

## What it does

- Every tappable element (links, buttons that navigate) shows an immediate visual press/active state
- A global loading overlay appears during all page transitions: semi-transparent backdrop over the content area with a centered spinner
- Works automatically for all current and future navigations — no per-page wiring needed

## What it does NOT do

- No skeleton screens (too much per-page work for now)
- No progress bar (NProgress-style) — overlay is simpler and more obvious on mobile
- No changes to API mutation loading states (those already have inline spinners)

## Approach

### Part 1: Click/tap feedback (CSS-only)

Add `active:` state styles to all interactive navigation elements. Tailwind's `active:scale-95` + `active:opacity-70` gives instant tactile feedback.

**Files to scan and update:**
- All `<Link>` usages (13 files, ~20 instances)
- All navigation buttons (`router.push` triggers)
- Session cards, player cards, leaderboard rows, bottom nav items

### Part 2: Global navigation loading overlay

**Architecture:** A client-side `NavigationLoader` context provider that:
1. Wraps the app content inside `(app)/layout.tsx`
2. Listens for route changes via a custom `<Link>` wrapper or `usePathname()` changes
3. Shows/hides a loading overlay

**Implementation detail:**

Next.js App Router doesn't expose `router.events`. The recommended pattern is:

- Create `src/components/NavigationLoader.tsx` — a client component that:
  - Uses `usePathname()` and `useSearchParams()` to detect when navigation starts vs completes
  - Provides a `startLoading()` function via React context for programmatic navigations (`router.push`)
  - Renders the overlay (fixed position, covers `<main>`, sits below Header/BottomNav)

- Create `src/components/NavLink.tsx` — a thin wrapper around Next.js `<Link>` that:
  - Calls `startLoading()` on click (before navigation begins)
  - Passes through all Link props

- The overlay: `fixed inset-0 z-40 bg-stone-50/60 flex items-center justify-center` with a simple CSS spinner (no external deps)

### Part 3: Wire it up

- Replace `<Link>` with `<NavLink>` across all files
- Wrap `router.push()` calls with `startLoading()` before the push
- Add `loading.tsx` files for key route segments as a bonus (Next.js Suspense boundaries)

## Files to create

| File | Description |
|---|---|
| `src/components/NavigationLoader.tsx` | Context provider + overlay + spinner |
| `src/components/NavLink.tsx` | Link wrapper that triggers loading state |

## Files to modify

| File | Action |
|---|---|
| `src/app/(app)/layout.tsx` | Wrap children with `<NavigationLoader>` |
| All 13 files with `<Link>` | Replace with `<NavLink>` |
| All 8 files with `router.push` | Add `startLoading()` before push |
| Various components | Add `active:scale-95 active:opacity-70` to tappable elements |

## Tasks (1-2 min each)

### Phase 1: Click feedback (CSS-only, no new components)

- [ ] **28.1** Add `active:scale-[0.98] active:opacity-70 transition-all` to `BottomNav.tsx` nav items
- [ ] **28.2** Add active states to `Header.tsx` tappable elements (logo link, avatar/logout)
- [ ] **28.3** Add active states to session cards in `SessionListClient.tsx`
- [ ] **28.4** Add active states to `PlayerCheckinCard.tsx` and `WhoIsHere.tsx` player links
- [ ] **28.5** Add active states to `SessionScoreboard.tsx` and `TallyScoreboard.tsx` player links
- [ ] **28.6** Add active states to `LeaderboardTable.tsx` player links
- [ ] **28.7** Add active states to `BackButton.tsx` and `BackToSessionsLink.tsx`
- [ ] **28.8** Add active states to session detail page nav links (`session/[id]/page.tsx`)
- [ ] **28.9** Add active states to finals page nav links (`finals/[id]/page.tsx`) and `FinalsSection.tsx`

### Phase 2: Navigation loader infrastructure

- [ ] **28.10** Create `src/components/NavigationLoader.tsx` — context provider with `startLoading()`, auto-detect route completion via `usePathname()`, render overlay with CSS spinner
- [ ] **28.11** Create `src/components/NavLink.tsx` — `<Link>` wrapper that calls `startLoading()` onClick
- [ ] **28.12** Wrap `(app)/layout.tsx` children with `<NavigationLoader>`

### Phase 3: Replace Link → NavLink across the app

- [ ] **28.13** Replace `<Link>` with `<NavLink>` in `BottomNav.tsx` and `Header.tsx`
- [ ] **28.14** Replace in `SessionListClient.tsx`, `PlayerCheckinCard.tsx`, `WhoIsHere.tsx`
- [ ] **28.15** Replace in `SessionScoreboard.tsx`, `TallyScoreboard.tsx`, `LeaderboardTable.tsx`
- [ ] **28.16** Replace in `BackButton.tsx`, `BackToSessionsLink.tsx`
- [ ] **28.17** Replace in `session/[id]/page.tsx` and `finals/[id]/page.tsx`
- [ ] **28.18** Replace in `FinalsEventTabs.tsx` and `FinalsSection.tsx`

### Phase 4: Programmatic navigation loading

- [ ] **28.19** Add `startLoading()` before `router.push()` in `Header.tsx`, `CreateSessionButton.tsx`, `CreateFinalsButton.tsx`
- [ ] **28.20** Add `startLoading()` before `router.push()` in `FinalsEventTabs.tsx` (delete handler), `IncludeTestToggle.tsx`
- [ ] **28.21** Add `startLoading()` in login/onboarding/reset-password pages before `router.push()`

### Phase 5: Next.js loading boundaries (bonus)

- [ ] **28.22** Create `src/app/(app)/loading.tsx` — shows the same spinner for top-level app transitions
- [ ] **28.23** Create `src/app/(app)/session/[id]/loading.tsx` for session detail
- [ ] **28.24** Create `src/app/(app)/finals/[id]/loading.tsx` for finals detail

## Acceptance Criteria

- [ ] Tapping any link/button shows an immediate visual press effect (< 16ms, CSS-only)
- [ ] A loading overlay with spinner appears within 100ms of any navigation click
- [ ] Overlay disappears when the new page renders
- [ ] Overlay covers the content area but Header and BottomNav remain visible
- [ ] Works for both `<NavLink>` (declarative) and `router.push()` (programmatic) navigations
- [ ] No per-page wiring needed for future pages — overlay is automatic
- [ ] Mobile-first: spinner is visible on small screens, overlay doesn't interfere with touch
