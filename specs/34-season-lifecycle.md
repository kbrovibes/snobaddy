# Spec 34: Season Lifecycle Management

**Owner:** @kbrovibes
**Status:** 📝 Draft
**Version:** 0.1.0
**Feature:** Full season lifecycle — create, activate, close, reopen, and browse past seasons. God Mode only.

---

## 1. Overview

Snobaddy runs in **seasons** (Spring, Summer, Fall, Winter). Today, season data exists in the DB but is essentially static — there's one row created manually, and every new session/finals event links to the "most recent season by start_date." There is no UI for creating, closing, or switching seasons.

This spec adds:
- A **Seasons management page** (god mode only) with the full lifecycle
- **Season-aware queries** so the leaderboard, session list, and stats all scope to the active season
- **Season status** on the `seasons` table (`active`, `upcoming`, `completed`)
- A **bottom nav tab** for Seasons (god mode only)

### What changes for regular users?
Nothing — they still see the current season's sessions and leaderboard. The season name label stays visible. When a new season starts, old sessions disappear from the home page and the leaderboard resets.

### What changes for god mode?
A new "Seasons" tab appears in the bottom nav. From there, admins can close the current season, create the next one, and browse past season summaries.

---

## 2. Terminology

| Term | Definition |
|------|-----------|
| **Active season** | The one currently running. At most one at a time. Sessions are created under this season. |
| **Upcoming season** | Created but not yet started. Saved with dates and name, waiting to be activated. |
| **Completed season** | Closed — read-only. Stats frozen. Cannot create sessions under it. |
| **Season cycle** | Spring → Summer → Fall → Winter → Spring → ... |

---

## 3. Database Changes

### 3.1 Add `status` column to `seasons`

```sql
-- Migration: add_season_status.sql
ALTER TABLE seasons ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'upcoming', 'completed'));

-- Set the existing row to 'active'
UPDATE seasons SET status = 'active' WHERE id = (
  SELECT id FROM seasons ORDER BY start_date DESC LIMIT 1
);
```

### 3.2 Enforce at most one active season

```sql
-- Partial unique index: only one row can be 'active'
CREATE UNIQUE INDEX idx_seasons_one_active
  ON seasons ((1)) WHERE status = 'active';
```

This prevents two seasons from being active simultaneously at the DB level.

---

## 4. Season Lifecycle State Machine

```
  ┌──────────┐         ┌──────────┐         ┌───────────┐
  │ upcoming │───▶─────│  active  │───▶─────│ completed │
  └──────────┘         └──────────┘         └───────────┘
     Create               Start                Close
                            │                    │
                            │                    │
                            ◀────── Reopen ──────┘
```

**Transitions:**
1. **Create** → `upcoming` — admin provides name, start_date, end_date
2. **Start** → `active` — only if no other season is active; flips status
3. **Close** → `completed` — marks season done; sessions become read-only
4. **Reopen** → `active` — only if no other season is active; undoes close

---

## 5. API Routes

### `GET /api/seasons`
Returns all seasons ordered by `start_date DESC`.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Spring 2026",
    "start_date": "2026-03-03",
    "end_date": "2026-06-05",
    "status": "active",
    "session_count": 18,
    "player_count": 42,
    "match_count": 156,
    "finals_status": "completed" | "in_progress" | null
  }
]
```

### `POST /api/seasons`
Create a new season. God mode only.

**Body:** `{ "name": "Summer 2026", "start_date": "2026-06-09", "end_date": "2026-09-04" }`

**Logic:**
- If no active season exists → create as `active`
- If an active season exists → create as `upcoming`

### `PATCH /api/seasons/[id]/status`
Change season status. God mode only.

**Body:** `{ "status": "active" | "completed" }`

**Logic:**
- `active` → fail if another season is already active
- `completed` → set status, no other checks needed

---

## 6. UI: Seasons Page (`/admin/seasons`)

God mode only. Accessible from bottom nav "Seasons" tab.

### 6.1 Layout

```
┌────────────────────────────────────┐
│  SEASONS                           │
├────────────────────────────────────┤
│                                    │
│  ┌──────────────────────────────┐  │
│  │ 🟢 Spring 2026     ACTIVE   │  │
│  │ Mar 3 – Jun 5               │  │
│  │                              │  │
│  │ 🏸 42 players  🎯 156 matches│  │
│  │ 📅 18 sessions  🏆 Finals ✓ │  │
│  │                              │  │
│  │ [ Close Season ]             │  │
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │ ⏳ Summer 2026   UPCOMING   │  │
│  │ Jun 9 – Sep 4               │  │
│  │                              │  │
│  │ [ Start Season ]             │  │
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │ ✅ Winter 2025   COMPLETED  │  │
│  │ Dec 1 – Feb 27              │  │
│  │ ▸ tap to expand             │  │
│  └──────────────────────────────┘  │
│                                    │
│  ╔══════════════════════════════╗  │
│  ║  + Create New Season        ║  │
│  ╚══════════════════════════════╝  │
│                                    │
└────────────────────────────────────┘
```

### 6.2 Season Card (expanded)

Each season card shows:
- **Status badge:** 🟢 Active / ⏳ Upcoming / ✅ Completed
- **Date range:** `Mar 3 – Jun 5`
- **Stats row (if active or completed):** players, matches, sessions, finals status
- **Action buttons:**
  - Active season: `Close Season` (with confirmation dialog)
  - Upcoming season: `Start Season` (disabled if another is active)
  - Completed season: `Reopen Season` (disabled if another is active)

### 6.3 Create Season Form

Inline collapsible form at the bottom:
- **Season name** — text input (pre-filled with next in cycle: "Summer 2026")
- **Start date** — date picker
- **End date** — date picker
- **Save** button

---

## 7. Season-Aware Changes to Existing Features

### 7.1 Session List Page (`/` — home)

**Currently:** `getAllSessions()` returns ALL sessions from ALL seasons (filtered to non-finals only).

**Change:** `getAllSessions()` must accept an optional `seasonId` parameter. The home page passes the **active season's ID**.

```typescript
// sessions.ts
export async function getAllSessions(seasonId?: string): Promise<SessionRow[]> {
  let query = supabase
    .from("sessions")
    .select("id, date, status, is_test_session, session_type, seasons(name), matches(count), session_tally(count)")
    .order("date", { ascending: false });

  if (seasonId) {
    query = query.eq("season_id", seasonId);
  }

  // ... rest stays the same
}
```

**Also need:** A new `getActiveSeason()` function:

```typescript
export async function getActiveSeason(): Promise<{ id: string; name: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seasons")
    .select("id, name")
    .eq("status", "active")
    .maybeSingle();
  return data;
}
```

### 7.2 Session Creation Routes

**Currently:** Both `/api/sessions/create` and `/api/sessions/start-today` pick the season via `ORDER BY start_date DESC LIMIT 1`.

**Change:** Use `getActiveSeason()` instead — only create sessions under the active season. If no season is active, return an error.

```typescript
// Before (fragile):
const { data: season } = await adminDb
  .from("seasons").select("id").order("start_date", { ascending: false }).limit(1).maybeSingle();

// After (explicit):
const { data: season } = await adminDb
  .from("seasons").select("id").eq("status", "active").maybeSingle();
if (!season) return NextResponse.json({ error: "No active season" }, { status: 400 });
```

### 7.3 Finals Creation Route

**Currently:** `/api/finals` also picks the most recent season by date.

**Change:** Same as above — use `status = 'active'` instead of `ORDER BY start_date DESC`.

### 7.4 Leaderboard Page

**Currently:** `getActivePlayers()` and `getSeasonMatchCount()` aggregate across ALL seasons. There is no season filtering.

**Change:** Both functions must accept an optional `seasonId` parameter. The leaderboard page passes the active season's ID.

**`getActivePlayers(options)`** — needs a `seasonId` option. When set:
- Match query joins through `sessions` to filter by `season_id`
- Tally query joins through `sessions` to filter by `season_id`
- Only stats from that season are computed

**`getSeasonMatchCount(options)`** — needs a `seasonId` option:
- Match query: `.eq("sessions.season_id", seasonId)`
- Tally query: `.eq("sessions.season_id", seasonId)`

### 7.5 Season Stats Cards (Home Page)

**Currently:** Computed from `realCompleted.map(s => s.id)` — which is already scoped to the sessions on the page. Once `getAllSessions()` is season-scoped, this automatically works correctly.

**No additional change needed.**

### 7.6 Player Profile / Session History

The player profile page (`/players/[id]`) shows session history. This should continue showing all-time stats (not season-scoped) since player history transcends seasons.

**No change needed.**

### 7.7 UBR Ratings

UBR ratings are **all-time** — they do not reset per season. The UBR algorithm processes matches across all seasons. The `getAllUbrRatings()` function is explicitly **not** passed a `seasonId` in the leaderboard page, ensuring ratings remain cross-season while W/L stats are season-scoped.

**No change needed for UBR.** This is enforced by keeping UBR queries separate from the season-scoped `getActivePlayers()` and `getSeasonMatchCount()` calls.

---

## 8. Bottom Nav Changes

Add a "Seasons" tab visible only to god mode users:

```typescript
const NAV_ITEMS = [
  { href: "/", label: "Session", icon: "🏸", adminOnly: false, godModeOnly: false },
  { href: "/players", label: "Players", icon: "👥", adminOnly: false, godModeOnly: false },
  { href: "/leaderboard", label: "Leaderboard", icon: "🏆", adminOnly: true, godModeOnly: false },
  { href: "/admin/seasons", label: "Seasons", icon: "📅", adminOnly: false, godModeOnly: true },
];
```

---

## 9. Edge Cases

| Scenario | Behavior |
|----------|----------|
| No active season, user hits `/` | Show "No active season" message + link to Seasons page (admin) |
| Admin tries to create session with no active season | API returns 400: "No active season. Start a season first." |
| Admin closes season while sessions are still active | Block: "Close all active sessions before closing the season" |
| Admin reopens a completed season | Allowed — sets status back to `active` (only if no other season is active) |
| Two seasons created but neither active | Home page shows empty state |
| Season with no sessions | Stats cards hidden (already handled: `daysOfPlay > 0` check) |

---

## 10. Files to Create / Modify

| File | Action |
|------|--------|
| `supabase/migrations/XXXXXXXX_season_status.sql` | **Create** — add `status` column + unique index |
| `src/lib/db/seasons.ts` | **Create** — season queries: getAll, getActive, create, updateStatus |
| `src/app/api/seasons/route.ts` | **Create** — GET (list) + POST (create) |
| `src/app/api/seasons/[id]/status/route.ts` | **Create** — PATCH status change |
| `src/app/(app)/admin/seasons/page.tsx` | **Create** — Seasons management page |
| `src/components/SeasonCard.tsx` | **Create** — reusable card component |
| `src/components/CreateSeasonForm.tsx` | **Create** — inline form for new season |
| `src/components/BottomNav.tsx` | **Modify** — add Seasons tab (god mode only) |
| `src/app/(app)/page.tsx` | **Modify** — pass active seasonId to `getAllSessions()` |
| `src/lib/db/sessions.ts` | **Modify** — add `seasonId` param to `getAllSessions()`, add `getActiveSeason()` |
| `src/lib/db/players.ts` | **Modify** — add `seasonId` param to `getActivePlayers()` |
| `src/lib/db/matches.ts` | **Modify** — add `seasonId` param to `getSeasonMatchCount()` |
| `src/app/api/sessions/create/route.ts` | **Modify** — use `status = 'active'` instead of most-recent |
| `src/app/api/sessions/start-today/route.ts` | **Modify** — use `status = 'active'` instead of most-recent |
| `src/app/api/finals/route.ts` | **Modify** — use `status = 'active'` instead of most-recent |
| `src/app/(app)/leaderboard/page.tsx` | **Modify** — pass active seasonId to queries |

---

## 11. Implementation Phases

### Phase 1: Database + Foundation (Day 1)
1. Write and run migration: `status` column + unique index
2. Create `src/lib/db/seasons.ts` with all season queries
3. Add `getActiveSeason()` to sessions.ts
4. Update session creation routes to use `status = 'active'`

### Phase 2: Seasons Management UI (Day 1–2)
5. Create `/admin/seasons` page with SeasonCard and CreateSeasonForm
6. Create API routes: `GET/POST /api/seasons`, `PATCH /api/seasons/[id]/status`
7. Add "Seasons" tab to BottomNav (god mode only)

### Phase 3: Season-Scoped Queries (Day 2)
8. Add `seasonId` param to `getAllSessions()`
9. Add `seasonId` param to `getActivePlayers()`
10. Add `seasonId` param to `getSeasonMatchCount()`
11. Update home page and leaderboard to pass active season ID

### Phase 4: Polish + Edge Cases (Day 2–3)
12. Empty state when no active season
13. Confirmation dialogs for close/start/reopen
14. Season name auto-suggestion (next in cycle)
15. Past season cards show summary stats (read-only)

---

## 12. Acceptance Criteria

- [ ] `seasons` table has `status` column with values `active`, `upcoming`, `completed`
- [ ] At most one season can be `active` at any time (DB constraint)
- [ ] God mode users see a "Seasons" tab in bottom nav
- [ ] Seasons page lists all seasons with status badges and stats
- [ ] Admin can create a new season with name + dates
- [ ] Admin can close the active season (if no active sessions)
- [ ] Admin can start an upcoming season (if no other is active)
- [ ] Admin can reopen a completed season (if no other is active)
- [ ] Home page only shows sessions from the active season
- [ ] Leaderboard only shows stats from the active season
- [ ] Session creation fails gracefully when no season is active
- [ ] Finals creation uses the active season, not most-recent-by-date
- [ ] UBR ratings remain unchanged (all-time, cross-season)
- [ ] Regular (non-god-mode) users see no changes in their experience
