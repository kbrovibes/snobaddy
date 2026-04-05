# Spec 20: Edit Player (God Mode)

## What it does

God Mode users see a pencil (✏️) edit button on any player's profile page. Tapping it
reveals an inline edit form that allows changing the player's **name** and **skill level**.
On save, the player record is updated immediately and the page refreshes.

## What it does NOT do

- Does not appear for regular admins or non-admins — God Mode only
- Does not expose edit controls anywhere other than the player detail page (`/players/[id]`)
- Does not allow editing email, user_id, or auth-related fields
- Does not allow granting or revoking God Mode or admin status
- Does not show a "delete" action here — deletion is already handled in the Admin Panel

---

## Data / DB changes

None. The `players` table already has `name` and `skill_level`. The existing
`PATCH /api/players/[id]` route will be extended to accept `name`.

---

## API

### `PATCH /api/players/[id]`

**Extended** (currently only handles `skill_level`).

- **Auth**: `name` changes require `is_god_mode = true`; `skill_level` changes continue to
  require `is_admin = true` (no change to existing behavior)
- **Request body** (all fields optional):
  ```json
  { "name": "Alice", "skill_level": 3 }
  ```
- **Validation**:
  - `name`: non-empty string after trim; max 50 chars
  - `skill_level`: integer 1–5 (existing validation unchanged)
- **Response**: `{ ok: true }` on success, `{ error: string }` on failure

---

## UI

### Player detail page (`/players/[id]`)

God Mode users see a small ✏️ button in the player header card, next to the player name.

```
┌──────────────────────────────────────────┐
│  [A]   Alice                        ✏️   │
│        ●●●○○                             │
│                                67%       │
│                               10W 5L     │
│        ─────────────────────────────     │
│        "haiku poem here…"                │
└──────────────────────────────────────────┘
```

Tapping ✏️ replaces the player name + skill dots row with an inline edit form:

```
┌──────────────────────────────────────────┐
│  [A]   [Alice______________]        💾   │
│        ● ● ● ○ ○  (tap to change)        │
│                                          │
│        [Cancel]                          │
└──────────────────────────────────────────┘
```

- Name field is pre-filled with the current name; auto-focused
- Skill level dots are interactive (same tap-to-set pattern as SkillEditor)
- 💾 Save button is disabled until something has changed
- On save: PATCH → router.refresh() → edit form closes
- On cancel: edit form closes, no changes

### Non-God-Mode users

No ✏️ button. Player header looks exactly as it does today.

---

## Components

| Component | Description |
|---|---|
| `EditPlayerForm` | Client component. Renders the ✏️ button when closed; inline form when open. |

---

## Files to create / modify

| File | Action |
|---|---|
| `src/app/api/players/[id]/route.ts` | **Modify** — extend PATCH to accept `name`; require God Mode for name changes |
| `src/components/EditPlayerForm.tsx` | **Create** — ✏️ button + inline edit form |
| `src/app/(app)/players/[id]/page.tsx` | **Modify** — fetch current user's `is_god_mode`; render `<EditPlayerForm>` in header when true |

---

## Acceptance Criteria

- [ ] God Mode user sees a ✏️ button in the player header on any player detail page
- [ ] Non-God-Mode users (including regular admins) do not see the button
- [ ] Tapping ✏️ reveals an inline form pre-filled with current name and skill level
- [ ] Name field accepts up to 50 characters; empty name disables Save
- [ ] Skill level can be changed via dot selector
- [ ] Save is disabled until at least one field differs from the current value
- [ ] Submitting with a valid name + skill level PATCHes the player and refreshes the page
- [ ] The updated name is immediately visible in the header after save
- [ ] `PATCH /api/players/[id]` with a `name` field returns 403 for non-God-Mode users
- [ ] `PATCH /api/players/[id]` with only `skill_level` continues to work for all admins
