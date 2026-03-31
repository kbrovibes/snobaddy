# Spec 10: Admin — Add Player from UI

## What it does
Admins can add a new player directly from the Players page by entering a name and skill
level (1–5). No email or Google account required. These players have no auth identity and
are treated as bots — they can be checked in and assigned to matches by admins but cannot
log in themselves.

## What it does NOT do
- Does not send any invitation or notification.
- Does not create a Supabase auth user record.
- Does not allow the added player to log in or manage their own account.
- Does not expose a "bot" label in the UI — they appear identical to real players in all
  lists and scoreboards.

## Bot definition
A player is a bot if `user_id IS NULL` in the `players` table. This is already true for
any player added outside the OAuth onboarding flow. No new column or flag needed.

## DB changes
None. The `players` table already supports `user_id = NULL` and `email = NULL`.
The new row just needs:
- `name` — provided by admin
- `skill_level` — provided by admin (1–5)
- `user_id = NULL`
- `email = NULL`
- `is_admin = FALSE`
- `onboarding_complete = TRUE` — so the player appears in all player lists immediately

## API

### `POST /api/players`
- Auth: admin only (reject with 403 if not admin)
- Request body: `{ name: string, skill_level: number }`
- Validation: name non-empty, skill_level integer 1–5
- Action: insert row via service role client (bypasses RLS)
- Response: `{ id: string }` on success, `{ error: string }` on failure

## UI

### Players page — Add Player button
Admins see an **"+ Add Player"** button in the top-right of the Players page header
(same row as the page title). Non-admins see nothing.

### Add Player form (inline expand or bottom sheet)
A simple form that slides in below the header (no full-page navigation):

```
┌─────────────────────────────┐
│  Add Player                 │
│                             │
│  Name  [________________]   │
│                             │
│  Skill  ● ● ● ○ ○  (tap)   │
│                             │
│  [Cancel]      [Add Player] │
└─────────────────────────────┘
```

- Name: text input, trimmed, required
- Skill level: tap-to-set dot selector (reuse the existing dot pattern)
- "Add Player" button: disabled until name is non-empty; shows loading state while POSTing
- On success: form collapses, player list refreshes (router.refresh())
- On error: show inline error message below the button

## Files to create/modify
| File | Action |
|---|---|
| `src/app/api/players/route.ts` | Modify — add POST handler (GET already exists) |
| `src/components/AddPlayerForm.tsx` | Create — client component with the inline form |
| `src/app/(app)/players/page.tsx` | Modify — render `<AddPlayerForm />` when `isAdmin` |

## Acceptance Criteria
- [ ] "+ Add Player" button is visible to admins on the Players page, hidden for non-admins
- [ ] Submitting a valid name + skill level creates a new player row with `user_id = NULL`
- [ ] The new player appears immediately in the Players list after submission
- [ ] The new player can be checked in via the admin presence toggle on the same page
- [ ] Submitting with an empty name is blocked (button disabled or validation error)
- [ ] Skill level defaults to 3 (middle of the range)
- [ ] A non-admin hitting `POST /api/players` directly gets a 403
