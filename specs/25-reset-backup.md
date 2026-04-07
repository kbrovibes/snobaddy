# Spec 25: Reset Session Backup

## What it does

Every time **God Mode → Reset Session** (Wipe & Reset) is triggered, the entire
session's data is serialised to a JSON snapshot and persisted to a
`session_reset_backups` table in Supabase **before any rows are deleted**.

A session may be reset multiple times (common for test sessions). Each wipe
creates a new, independent backup row. No backup is ever overwritten or deleted.

---

## What it does NOT do

- Does not implement a restore flow — restore is documented below for future use
- Does not expose any UI for browsing or downloading backups (God Mode only if added later)
- Does not affect the reset UX at all — the backup happens server-side before deletion
- Does not back up `session_players` (check-ins) — those are preserved by the reset anyway
- Does not back up player profiles, seasons, or anything outside the session being reset

---

## Data / DB changes

### New table: `session_reset_backups`

```sql
CREATE TABLE session_reset_backups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES sessions(id),
  backed_up_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  snapshot      JSONB NOT NULL
);

-- Index for quick lookup by session
CREATE INDEX idx_session_reset_backups_session_id
  ON session_reset_backups (session_id);
```

No RLS required — only accessible via the service role key (server-side only).

### Snapshot JSON shape

```jsonc
{
  // Top-level session metadata
  "session_id": "uuid",
  "session_date": "2026-03-30",
  "is_test_session": true,
  "backed_up_at": "2026-04-06T18:32:00Z",

  // All matches recorded in this session at time of wipe
  "matches": [
    {
      "id": "uuid",
      "played_at": "2026-03-30T19:45:00Z",
      "winning_team": 1,
      "team1_score": 21,
      "team2_score": 15,
      // Player IDs (stable foreign keys)
      "team1_player1_id": "uuid",
      "team1_player2_id": "uuid",
      "team2_player1_id": "uuid",
      "team2_player2_id": "uuid",
      // Player names at time of backup (denormalised for human readability)
      "team1_player1_name": "Sekhar Durga",
      "team1_player2_name": "Kiran Iyer",
      "team2_player1_name": "Vinoj Stanley",
      "team2_player2_name": "Arjun Raman"
    }
    // ...
  ],

  // Tally rows (present when session used photo-import scoring)
  "tally": [
    {
      "player_id": "uuid",
      "player_name": "Sekhar Durga",
      "wins": 8,
      "losses": 2
    }
    // ...
  ],

  // Proposed (AI-generated) match queue at time of wipe
  "proposed_matches": [
    {
      "id": "uuid",
      "team1_player1_id": "uuid",
      "team1_player2_id": "uuid",
      "team2_player1_id": "uuid",
      "team2_player2_id": "uuid",
      "team1_player1_name": "...",
      "team1_player2_name": "...",
      "team2_player1_name": "...",
      "team2_player2_name": "...",
      "deleted_at": null   // null = active, ISO string = soft-deleted
    }
    // ...
  ],

  // Summary counts for quick inspection without parsing the arrays
  "summary": {
    "match_count": 12,
    "tally_count": 0,
    "proposed_count": 4
  }
}
```

---

## API

### `POST /api/sessions/[id]/reset` — modified

The existing endpoint gains a **backup step before deletion**:

1. Fetch all matches (with player names via join)
2. Fetch all tally rows (with player names via join)
3. Fetch all proposed matches (with player names via join)
4. Insert one row into `session_reset_backups` with the full snapshot
5. Hard-delete matches, proposed_matches, session_tally as before
6. Return existing response shape (unchanged)

The backup insert is **not** wrapped in a transaction with the deletes — if the
backup insert fails, the entire request returns 500 and the data is NOT deleted.
This ensures we never lose data due to a backup failure.

---

## How to restore from a backup (future implementation guide)

### Step 1 — Retrieve the snapshot

```sql
SELECT id, backed_up_at, snapshot
FROM session_reset_backups
WHERE session_id = '<target-session-id>'
ORDER BY backed_up_at DESC;
```

Pick the snapshot you want to restore (most recent, or a specific timestamp).

### Step 2 — Re-insert matches

```sql
-- For each object in snapshot->>'matches':
INSERT INTO matches (
  id, session_id, played_at, winning_team, team1_score, team2_score,
  team1_player1_id, team1_player2_id,
  team2_player1_id, team2_player2_id
)
VALUES (
  '<original id or new uuid>',
  '<session_id>',
  '<played_at>',
  <winning_team>,
  <team1_score>, <team2_score>,
  '<team1_player1_id>', '<team1_player2_id>',
  '<team2_player1_id>', '<team2_player2_id>'
)
ON CONFLICT (id) DO NOTHING;
```

Use the original `id` so that re-running the restore is idempotent.

### Step 3 — Re-insert tally rows (if present)

```sql
INSERT INTO session_tally (session_id, player_id, wins, losses)
VALUES ('<session_id>', '<player_id>', <wins>, <losses>)
ON CONFLICT (session_id, player_id) DO UPDATE
  SET wins = EXCLUDED.wins, losses = EXCLUDED.losses;
```

### Step 4 — Re-insert proposed matches (optional)

Usually not worth restoring — they're AI-generated and can be regenerated.
Include only if needed for auditing.

### Coding up a restore API route (future)

```typescript
// POST /api/sessions/[id]/restore-backup
// Body: { backup_id: string }
// Auth: God Mode only

// 1. Fetch snapshot from session_reset_backups WHERE id = backup_id
// 2. For each match in snapshot.matches: upsert into matches (ON CONFLICT DO NOTHING)
// 3. For each tally row in snapshot.tally: upsert into session_tally
// 4. Return counts of restored rows
```

---

## Files to create/modify

| File | Action |
|---|---|
| Supabase migration | Create `session_reset_backups` table + index |
| `src/app/api/sessions/[id]/reset/route.ts` | Modify POST — add backup step before deletion |

---

## Acceptance Criteria

- [ ] `session_reset_backups` table exists in Supabase with `id`, `session_id`, `backed_up_at`, `snapshot` columns
- [ ] Every `POST /api/sessions/[id]/reset` inserts a backup row before deleting any data
- [ ] If the backup insert fails, the entire request returns 500 and no data is deleted
- [ ] Multiple resets on the same session produce multiple backup rows (one per wipe)
- [ ] Each snapshot contains matches (with player names), tally rows, proposed matches, and a summary count
- [ ] Backup rows are queryable by `session_id` ordered by `backed_up_at`
- [ ] The reset response shape is unchanged — no UI changes required
