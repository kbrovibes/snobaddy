# Spec 16: Email Sign-up Onboarding Fix

## What it does

Fixes three connected gaps in the email sign-up flow that leave users authenticated
but effectively broken — invisible in the player list, unable to check in, and never
prompted for a skill level.

---

## What it does NOT do

- Does not change the Google OAuth sign-up flow (it works correctly)
- Does not add new onboarding screens or steps beyond what already exists
- Does not change the existing onboarding UI layout — just removes the skip button
  and adds a hard gate

---

## Root Cause Analysis

### Bug 1: No gate enforcing onboarding completion

`src/app/(app)/layout.tsx` checks that the user is authenticated but never checks
`onboarding_complete`. There is no `middleware.ts`. A user who enters the app
without completing onboarding can freely navigate, but:
- `getAllPlayers()` filters `onboarding_complete = true` → they're invisible
- `CheckInButton` receives `playerId = null` → check-in silently fails
- No redirect fires anywhere

### Bug 2: Player record only created at `/auth/confirm`, never at login

The intended email flow:
```
sign up → click confirmation email → /auth/confirm → player record created → /onboarding
```

If a user signs up and immediately tries to log in via `signInWithPassword` (before or
instead of clicking the confirmation link), Supabase establishes a session but no player
record exists. The app layout passes `player = null` throughout, and everything silently
fails with no onboarding redirect.

### Bug 3: Skip button defaults skill level to 3 (too high for unknown email signups)

The onboarding page has a "Skip for now (I'll be set to Intermediate)" button that sets
`skill_level: 3`. For email signups — who may be new players testing the system — 3 is
arguably too high. More importantly, the skip path bypasses intentional skill selection
entirely.

---

## Fixes

### Fix 1: Hard onboarding gate in the app layout

`(app)/layout.tsx` must redirect to `/onboarding` if:
- No player record exists for the authenticated user, OR
- Player record exists but `onboarding_complete = false`

```
if (!player || !player.onboarding_complete) → redirect("/onboarding")
```

Update the layout's player query to also select `onboarding_complete`:
```typescript
.select("id, onboarding_complete")
```

### Fix 2: Create player record at login if missing

`/auth/confirm` already creates the player record on email confirmation — this is
correct. But `signInWithPassword` has no equivalent safety net. Two sub-fixes:

**2a.** The onboarding page (`/onboarding/page.tsx`) must handle the case where no
player record exists yet. Currently it only does an UPDATE. If no record exists, it
should INSERT one first (upsert pattern), then redirect to `/`.

**2b.** A new API route `POST /api/auth/ensure-player` (or equivalent logic in the
app layout) should create a player stub if one doesn't exist when the user first
enters the app. This catches any path that reaches the app without going through
`/auth/confirm`.

The simplest implementation: move the "create player if missing" logic into the
app layout itself, immediately before the onboarding gate check.

```
Layout:
  1. Get auth user
  2. Fetch player record (id, onboarding_complete)
  3. If no player record → INSERT stub (name from user_metadata, skill_level: 2,
     onboarding_complete: false)
  4. If onboarding_complete is false → redirect("/onboarding")
  5. Otherwise render normally
```

This makes the layout the single source of truth for "does this user have a valid
player record?"

### Fix 3: Remove the Skip button; require explicit skill selection

Remove the "Skip for now" button from `/onboarding/page.tsx`. Every new user must
pick a skill level to proceed. The five options are clear and quick to tap.

If an admin ever needs to override, they can edit it from the Players page.

**Default for stubs created without onboarding (fallback only):** `skill_level: 2`
(Casual). This is used when a player record must be created programmatically and
onboarding hasn't happened yet. It is intentionally conservative — it's better to
underrate a new player than to throw them into advanced matches.

---

## Data / DB changes

No schema changes required. `onboarding_complete` and `skill_level` already exist.

---

## API

### No new routes needed.

The player stub creation moves into the app layout (server component). The
`/auth/confirm` route already handles the email confirmation path correctly —
no changes needed there.

---

## UI

### Onboarding page changes

Remove the "Skip for now" button entirely. The Save & Continue button remains
disabled until a skill level is selected.

```
BEFORE:
  [ Save & Continue ]   ← disabled until selection
  Skip for now (I'll be set to Intermediate)

AFTER:
  [ Save & Continue ]   ← disabled until selection
  (no skip)
```

Optional: add a note below the buttons: "You can update this anytime from the
Players page."

### App layout: no visible UI change

The gate is server-side. Users who haven't completed onboarding just get
redirected before the page renders.

---

## Files to create/modify

| File | Action |
|---|---|
| `src/app/(app)/layout.tsx` | Fetch `onboarding_complete`; create player stub if missing; redirect to `/onboarding` if incomplete |
| `src/app/onboarding/page.tsx` | Remove Skip button; handle upsert (create if missing, update if exists) |

---

## Flow diagrams

### Email sign-up (fixed)

```
User signs up with email
        │
        ▼
Supabase sends confirmation email
        │
   ┌────┴────────────────────────────────┐
   │                                     │
   ▼                                     ▼
User clicks link                  User logs in directly
/auth/confirm runs                (before confirming)
Player record created             Session established
onboarding_complete: false        No player record yet
        │                                │
        ▼                                ▼
Redirect → /onboarding           Hits (app)/layout.tsx
        │                        No player record found
        │                        Stub created (skill: 2)
        │                        onboarding_complete: false
        │                                │
        └──────────────┬─────────────────┘
                       ▼
              /onboarding (hard gate)
              User picks skill level 1–5
              onboarding_complete → true
                       │
                       ▼
                    / (home)
```

### Returning user (both auth methods)

```
User logs in
     │
     ▼
(app)/layout.tsx
     │
     ├─ No player record? → create stub → redirect /onboarding
     ├─ onboarding_complete: false? → redirect /onboarding
     └─ onboarding_complete: true? → render app normally
```

---

## Acceptance Criteria

- [ ] Email user who logs in without clicking confirmation email is redirected to `/onboarding` rather than landing in a broken state
- [ ] Onboarding page creates a player record if one doesn't already exist (upsert instead of update-only)
- [ ] After completing onboarding, email user appears in the Players list and can check in
- [ ] Skip button is removed from the onboarding page
- [ ] Save & Continue remains disabled until a skill level is selected
- [ ] Player stubs created without onboarding default to `skill_level: 2`
- [ ] Google OAuth flow is unaffected — still works exactly as before
- [ ] A user with `onboarding_complete: false` who somehow reaches any `(app)` route is redirected to `/onboarding`, not left in a broken state
- [ ] A returning user with `onboarding_complete: true` is not redirected and sees the app normally
