# Spec 08: Ethan Mode

## What it does

A persistent, server-side easter egg flag. When enabled by an admin, the match suggestion
algorithm is biased:

1. **Chitra is greatly favored** — included in every proposed match if checked in, regardless of wait time or rotation fairness.
2. **Kiran Iyer is completely skipped** — never included in any proposed match while the mode is active.

The flag is stored in the database so it is shared across all devices and all users. Only admins
can toggle it. When active, a visible banner shows at the top of the Session page for everyone —
admins and regular users alike — so that anyone scheduling matches knows the mode is on.

Named after a real event where Ethan kept lining up back-to-back matches for Chitra while Kiran
Iyer sat waiting on the bench.

## What it does NOT do

- Does not affect manually recorded matches (RecordMatchForm is unchanged).
- Does not affect any other algorithm weights or fairness scoring.
- Does not affect session scoreboard or leaderboard data.
- Does not hardcode player IDs — looks up Chitra and Kiran Iyer by name at runtime.
- The toggle control itself is only visible to admins. The active banner is visible to everyone.

## Data / DB changes

New table `app_settings` — a single-row config store:

```sql
create table app_settings (
  id            boolean primary key default true check (id = true),  -- enforces single row
  ethan_mode    boolean not null default false
);

insert into app_settings (ethan_mode) values (false);
```

The `check (id = true)` constraint on the primary key is the standard Postgres single-row
table pattern. No RLS needed — reads are open, writes go through the service-role API route.

## API

### Read current flag (all authenticated users)

```
GET /api/settings
→ 200 { ethan_mode: boolean }
```

### Toggle flag (admin only)

```
PATCH /api/settings
Body: { ethan_mode: boolean }
→ 200 { ethan_mode: boolean }
→ 403 if caller is not admin
```

### Match suggestion integration (Spec 07, not yet built)

The `suggestMatches()` DB function reads `ethan_mode` from `app_settings` directly — no
query param needed. The flag is an internal server concern, not exposed on the suggestion
endpoint's public interface.

## UI

### Toggle — Header top-right (admin only)

A small, unobtrusive button in the `Header` component, rendered only for admins. It sits in
the top-right alongside the logout avatar. Low visual weight — no prominent styling.

```
┌─ Header ──────────────────────────────────────────────┐
│  🏸 snobaddy          [🎭]  [avatar / logout]          │
└───────────────────────────────────────────────────────┘
```

- The `🎭` button (or equivalent subtle icon/text) is the toggle.
- Clicking it calls `PATCH /api/settings` to flip the boolean.
- Shows a filled/active state when on, muted when off.
- No label text visible — tooltip on hover: `"Ethan Mode"`.

### Banner — Session page, top of content (all users, when active)

When `ethan_mode` is `true`, a banner renders at the top of the Session page content area,
above everything else. Visible to all users — not admin-only.

```
┌───────────────────────────────────────────────────────┐
│  🎭  Ethan Mode is active · Chitra supremacy.          │
│      Kiran who?                                        │
└───────────────────────────────────────────────────────┘
```

- Renders only on the Session page (`/(app)/page.tsx` or future `/session/[id]`).
- Uses a muted/warm tone — not an error red, not a success green. Amber or neutral works.
- Non-dismissible — it stays until an admin turns the mode off.
- No banner is shown on other pages (Players, Leaderboard).

### Match suggestion UI (Spec 07, all users)

When the match suggestion UI (Spec 07) is built, it should display a small inline badge or
note whenever `ethan_mode` is active:

```
Suggested Matches  [🎭 Ethan Mode]
```

This makes it clear to anyone using the suggester why the results look the way they do.

## Files to create/modify

| File | Action |
|---|---|
| `src/app/api/settings/route.ts` | Create — `GET` returns `app_settings` row; `PATCH` updates `ethan_mode` (admin only) |
| `src/lib/db/settings.ts` | Create — `getSettings()` and `setEthanMode(enabled: boolean)` queries |
| `src/components/Header.tsx` | Modify — render `EthanModeToggle` button in top-right, visible to admins only |
| `src/components/EthanModeToggle.tsx` | Create — client component, calls `PATCH /api/settings`, shows active state |
| `src/components/EthanModeBanner.tsx` | Create — read-only banner, shown to all users when mode is active |
| `src/app/(app)/page.tsx` | Modify — fetch `app_settings`, render `EthanModeBanner` at top when active |
| `src/lib/db/matches.ts` | Modify (when Spec 07 is built) — `suggestMatches()` reads `ethan_mode` from `app_settings` and applies Chitra-favor / Kiran-skip |

## Acceptance Criteria

- [ ] `app_settings` table created with single-row constraint, seeded with `ethan_mode = false`
- [ ] `GET /api/settings` returns current flag value for any authenticated user
- [ ] `PATCH /api/settings` updates the flag; returns 403 for non-admins
- [ ] Toggle button appears in Header top-right for admins only; non-admins see no trace of it
- [ ] Toggle correctly reflects current DB state on load
- [ ] Clicking the toggle flips the DB value and updates UI state immediately (optimistic or refetch)
- [ ] When active, banner is visible to all users at the top of the Session page
- [ ] When inactive, no banner is shown anywhere
- [ ] Match suggestion logic (Spec 07) reads the flag from DB; Chitra appears in every match when flag is on and she is checked in
- [ ] Match suggestion logic (Spec 07) never includes Kiran Iyer in a suggested match when flag is on
- [ ] Player lookup is by name — no hardcoded IDs
- [ ] Manually recorded matches (RecordMatchForm) are completely unaffected regardless of flag state
