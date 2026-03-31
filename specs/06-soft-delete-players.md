# Spec 06: Soft-Delete Players

## What it does

Admins can remove a player from active circulation without permanently deleting their record.
A deleted player:
- disappears from the active player list and all session views
- has all their matches hidden (scoreboard, match history, leaderboard)
- is listed at the bottom of the Players tab (admin-only section) with a Restore button

Restoring a player reverses everything: they reappear in all views, and all their matches
become valid again with stats intact.

## What it does NOT do

- No hard deletes — data is never destroyed
- Does not auto-check-out a deleted player mid-session (admin should check them out first if needed)
- Does not affect sessions or seasons — only player visibility and match validity
- Non-admins never see the deleted players section or the delete/restore controls

---

## Data / DB changes

### Schema

```sql
-- Add deleted_at to players table
ALTER TABLE players ADD COLUMN deleted_at timestamptz DEFAULT NULL;

-- Index for the common "active players only" filter
CREATE INDEX players_deleted_at_idx ON players (deleted_at) WHERE deleted_at IS NULL;
```

### Match invalidation strategy

**No new columns needed on `matches`.**

A match is considered invalid if *any* of its 4 player IDs belongs to a player with a non-null
`deleted_at`. All queries that read matches join to the players table and filter accordingly.
Restoring a player (setting `deleted_at = NULL`) automatically revalidates their matches — no
backfill needed.

This means:
- If two players in a match are deleted independently, both must be restored before the match reappears.
- No reference counting or cascade updates required.

---

## API

### `POST /api/players/[id]/delete`
- **Auth**: admin only (403 otherwise); 404 if player not found
- **Body**: none
- **Action**: sets `players.deleted_at = now()` for the given player id
- **Response**: `{ ok: true }`
- **Guard**: no-op if already deleted (idempotent)

### `POST /api/players/[id]/restore`
- **Auth**: admin only (403 otherwise); 404 if player not found
- **Body**: none
- **Action**: sets `players.deleted_at = NULL`
- **Response**: `{ ok: true }`
- **Guard**: no-op if already active (idempotent)

---

## Queries to update (`src/lib/db/`)

### `players.ts` — `getAllPlayers()`
Split into two functions:

```ts
// Returns only active (non-deleted) players — used everywhere except admin deleted section
getActivePlayers(): Promise<PlayerStats[]>
  .is("deleted_at", null)

// Returns only deleted players — used for admin section in Players tab
getDeletedPlayers(): Promise<PlayerStats[]>
  .not("deleted_at", "is", null)
  .order("deleted_at", { ascending: false })
```

Rename `getAllPlayers` → `getActivePlayers` and update all call sites:
- `src/app/(app)/players/page.tsx`
- `src/app/(app)/page.tsx` (indirectly through session queries — already filtered via check-in)

### `matches.ts` — filter invalid matches

Add a shared Supabase sub-select condition that excludes matches where any player is deleted.
Both `getSessionMatches()` and `getSessionScoreboard()` must apply this filter.

The safest approach for Supabase JS is to fetch matches normally, then do a secondary lookup
of deleted player IDs and filter in application code (avoids complex nested RPC):

```ts
async function getDeletedPlayerIds(supabase): Promise<Set<string>> {
  const { data } = await supabase
    .from("players")
    .select("id")
    .not("deleted_at", "is", null);
  return new Set((data ?? []).map((p) => p.id));
}
```

Then in `getSessionMatches` and `getSessionScoreboard`:
```ts
const deleted = await getDeletedPlayerIds(supabase);
// filter: skip any match where any of the 4 player IDs is in `deleted`
```

### `sessions.ts` — `getCheckedInPlayers()`
Add `.is("players.deleted_at", null)` to the join so deleted players don't appear in
"Who's Here" or the match recording form.

---

## UI

### Players tab — admin view

```
┌─────────────────────────────────────┐
│ Players                    32 active │
├─────────────────────────────────────┤
│  1  Alice   ●●●●○          [✓] Here  │
│  2  Bob     ●●○○○          [+] Add   │
│  ...                                 │
│  N  Zara    ●●●○○          [✓] Here  │
│                          [🗑 Remove] │  ← new, per row, admin only
├─────────────────────────────────────┤
│  Removed players (2)             ▼  │  ← collapsible, admin only
│  ░ Charlie  ●●●○○       [Restore]   │
│  ░ Dave     ●●○○○       [Restore]   │
└─────────────────────────────────────┘
```

Notes:
- "Remove" button appears on each active player row for admins (alongside existing SkillEditor/AdminPresenceToggle)
- Tapping "Remove" shows an inline confirmation: "Remove [Name]? Their matches will be hidden. [Confirm] [Cancel]"
- The "Removed players" section is collapsed by default; tap the header to expand
- Deleted player rows are visually muted (gray name, opacity-50)
- The active player count in the header reflects only non-deleted players

### Players tab — non-admin view
No changes. Deleted players are simply absent.

---

## Components

| Component | Description |
|---|---|
| `DeletePlayerButton` | Client component. Inline confirm → POST `/api/players/[id]/delete` → `router.refresh()` |
| `RestorePlayerButton` | Client component. Single tap (no confirm needed) → POST `/api/players/[id]/restore` → `router.refresh()` |

---

## Files to create / modify

| File | Action |
|---|---|
| `src/app/api/players/[id]/delete/route.ts` | **Create** — `POST` handler, admin auth, set `deleted_at` |
| `src/app/api/players/[id]/restore/route.ts` | **Create** — `POST` handler, admin auth, clear `deleted_at` |
| `src/components/DeletePlayerButton.tsx` | **Create** — inline confirm delete UI |
| `src/components/RestorePlayerButton.tsx` | **Create** — single-tap restore UI |
| `src/lib/db/players.ts` | **Modify** — rename `getAllPlayers` → `getActivePlayers`, add `getDeletedPlayers()` |
| `src/lib/db/matches.ts` | **Modify** — `getSessionMatches()` and `getSessionScoreboard()` filter matches with deleted players |
| `src/lib/db/sessions.ts` | **Modify** — `getCheckedInPlayers()` excludes deleted players |
| `src/app/(app)/players/page.tsx` | **Modify** — "Remove" button per active row, "Removed players" collapsible section |
| `supabase/migrations/` | **Create** — `ALTER TABLE players ADD COLUMN deleted_at timestamptz` |

---

## Acceptance Criteria

- [ ] Admin sees a "Remove" button on each active player row in the Players tab
- [ ] Tapping Remove shows inline confirmation before executing
- [ ] After deletion: player disappears from the active list immediately
- [ ] After deletion: player's matches no longer appear in session match history
- [ ] After deletion: deleted player's W/L no longer counts in session scoreboard
- [ ] After deletion: deleted player does not appear in the match recording player picker
- [ ] After deletion: deleted player does not appear in "Who's Here"
- [ ] Admin sees a "Removed players (N)" section at the bottom of Players tab (collapsed by default)
- [ ] Deleted players are visually distinct in the removed section (muted/gray)
- [ ] Non-admins do not see the removed section or any delete/restore controls
- [ ] Tapping Restore makes the player reappear in the active list immediately
- [ ] After restore: all of the player's matches reappear in history and scoreboard
- [ ] Delete and Restore are idempotent (double-tapping causes no error)
- [ ] Season leaderboard (spec 04) also excludes matches with deleted players
