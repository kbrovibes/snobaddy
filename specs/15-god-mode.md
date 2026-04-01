# Spec 15: God Mode

## What it does

Introduces a **God Mode** role — a super-admin tier above regular admins. God Mode
users have access to a set of privileged, destructive, or experimental features that
are too powerful to expose to ordinary admins.

The first God Mode feature is **Reset Session**: a button that wipes all match
results and proposed matches for the current session, effectively resetting it to a
blank slate while keeping the session itself and all check-ins intact.

God Mode is assigned to a single hardcoded user for now: **Karthik Rajan**.

---

## What it does NOT do

- Does not affect session status (the session remains active/open)
- Does not remove check-ins — players stay checked in after a reset
- Does not affect other sessions or season-level stats from other sessions
- Does not add any God Mode UI outside of what is explicitly listed here
- Does not create a management UI for granting/revoking God Mode — it is hardcoded

---

## Data / DB changes

### Add `is_god_mode` column to `players`

```sql
ALTER TABLE players ADD COLUMN is_god_mode BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE players SET is_god_mode = TRUE WHERE name = 'Karthik Rajan' AND email ILIKE '%@gmail.com';
```

### New API route: `POST /api/sessions/[id]/reset`

Deletes all matches and proposed matches (including soft-deleted proposals) for the
given session. Returns counts before deletion for the confirmation UI.

---

## API

### `GET /api/sessions/[id]/reset` (pre-flight — get counts)

Auth: God Mode only.

Response:
```json
{
  "matches": 12,
  "proposed": 4
}
```

Used to populate the confirmation dialog before the user confirms.

### `POST /api/sessions/[id]/reset`

Auth: God Mode only. Hard-deletes all matches and ALL proposed matches
(including soft-deleted ones) for the session.

Response:
```json
{ "deleted_matches": 12, "deleted_proposed": 4 }
```

---

## UI

### Where it appears

On the session detail page (`/session/[id]`), in the admin action area where
**Close Session** currently lives. The Reset Session button appears **above** Close
Session and is only rendered when the current user has `is_god_mode = true`.

```
┌─────────────────────────────────┐
│  ⚡ Reset Session               │  ← GOD MODE only, shown above close button
│  ✕ Close Session                │  ← existing admin button
└─────────────────────────────────┘
```

### Confirmation flow

1. User taps **⚡ Reset Session**
2. App fetches the pre-flight counts (`GET /api/sessions/[id]/reset`)
3. A confirmation dialog appears:

```
┌──────────────────────────────────────────┐
│  Reset Session?                          │
│                                          │
│  This will permanently delete:           │
│    • 12 recorded matches                 │
│    • 4 proposed matches                  │
│                                          │
│  Check-ins will not be affected.         │
│  This cannot be undone.                  │
│                                          │
│         [ Cancel ]  [ Reset ]            │
└──────────────────────────────────────────┘
```

4. On confirm → `POST /api/sessions/[id]/reset` → page refreshes
5. On cancel → dialog closes, nothing changes

### Styling

The Reset Session button uses a visually distinct style to signal danger —
red/destructive tone, not the standard blue. A ⚡ icon signals the God Mode
context without labelling it explicitly to non-God-Mode users (they never see it).

---

## God Mode detection

God Mode is checked server-side on every request that requires it:

```typescript
// In API routes
const { data: player } = await supabase
  .from("players")
  .select("is_god_mode")
  .eq("user_id", user.id)
  .single();

if (!player?.is_god_mode) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
```

In Server Components, the `is_god_mode` field is fetched alongside `is_admin` and
passed down as a prop where needed.

### `isGodMode` in `src/lib/db/players.ts`

Add a `getIsGodMode(userId)` helper, or extend the existing current-player fetch
to also return `is_god_mode`. Either approach is acceptable.

---

## Files to create/modify

| File | Action |
|---|---|
| Supabase SQL | Add `is_god_mode` column; set `true` for Karthik Rajan |
| `src/lib/db/players.ts` | Add `is_god_mode` to `PlayerStats` interface; include in `getAllPlayers()` select; add helper to fetch current user's god mode status |
| `src/app/(app)/session/[id]/page.tsx` | Fetch `is_god_mode` for current user; pass to `ResetSessionButton` |
| `src/app/api/sessions/[id]/reset/route.ts` | Create — GET (counts) + POST (delete); God Mode auth guard |
| `src/components/ResetSessionButton.tsx` | Create — client component; pre-flight fetch; confirmation dialog; POST on confirm |

---

## Acceptance Criteria

- [ ] `is_god_mode` column exists in `players` table; Karthik Rajan's row has it set to `true`
- [ ] Reset Session button is visible on the session page only when the current user has `is_god_mode = true`
- [ ] Non-god-mode users (including regular admins) do not see the button
- [ ] Tapping Reset Session fetches live match and proposal counts before showing the dialog
- [ ] Confirmation dialog shows exact counts: "X recorded matches" and "Y proposed matches"
- [ ] Cancelling the dialog makes no changes
- [ ] Confirming deletes all matches and all proposed matches (including soft-deleted proposals) for that session
- [ ] Session status, check-ins, and player data are unaffected
- [ ] `POST /api/sessions/[id]/reset` returns 403 for non-god-mode users
- [ ] Page refreshes after a successful reset and shows an empty match list and empty queue
