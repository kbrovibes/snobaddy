# Spec 10: Email Sign-up / Sign-in

## What it does
Adds email + password authentication alongside Google OAuth.
Users can create an account with a display name, email, and password,
or sign in with existing credentials. A "Forgot password" reset flow
is included. The login page presents both options on a single screen.

## What it does NOT do
- No magic-link / passwordless email (can add later)
- No email change or account merging
- No admin-only email allowlist (any email can register)

## UX — Login page redesign

Single page, no separate sign-up URL. Two modes toggled inline:

```
🏸 snobaddy
Snoqualmie Badminton Club

[ Sign in with Google ]

──────── or ────────

[ Sign in ]  [ Create account ]   ← pill toggle

Sign in mode:
  Email ___________
  Password ___________
  [ Sign in ]
  Forgot password?

Create account mode:
  Display name ___________
  Email ___________
  Password ___________
  [ Create account ]

After sign-up → show inline: "Check your email — we sent a
confirmation link to [email]." (no redirect)

After sign-in error → show inline error message.
```

## Password reset UX

```
Forgot password? link → same login page, "reset" mode:
  Email ___________
  [ Send reset link ]
  ← Back to sign in

After submit → inline: "Check your email for a reset link."

User clicks link in email → /auth/reset-password:
  New password ___________
  [ Update password ]
  → redirect to /
```

## Data / DB changes

None. Supabase Auth handles credentials. Player record creation
re-uses the existing logic in `/auth/confirm` (same as OAuth callback).

### Supabase dashboard steps (manual, one-time)
1. Auth → Providers → Email → Enable
2. Auth → URL Configuration → Site URL → set to production URL
3. Auth → URL Configuration → Redirect URLs → add:
   - `http://localhost:3000/auth/confirm`
   - `https://<production-domain>/auth/confirm`
4. Auth → Email Templates → Confirm signup → set redirect URL to
   `{{ .SiteURL }}/auth/confirm`
5. Auth → Email Templates → Reset Password → set redirect URL to
   `{{ .SiteURL }}/auth/confirm`

## API / Routes

### `GET /auth/confirm`
Handles both email confirmation and password recovery links.
Supabase emails include `?token_hash=...&type=signup|recovery`.

- `type=signup` → `verifyOtp({ token_hash, type: 'email' })` →
  create player record if new → redirect to `/onboarding` or `/`
- `type=recovery` → `verifyOtp({ token_hash, type: 'recovery' })` →
  redirect to `/auth/reset-password`
- Any error → redirect to `/login?error=auth_failed`

### `GET /auth/callback` (existing)
No change. Still handles Google OAuth code exchange.

## UI

### Modified: `src/app/login/page.tsx`
Client component. Modes: `signin` | `signup` | `reset`.
- Default: `signin`
- Toggle between `signin` and `signup` via pill buttons
- "Forgot password?" switches to `reset` mode

### New: `src/app/auth/confirm/route.ts`
Server route. Mirrors logic of `auth/callback` but uses
`verifyOtp` instead of `exchangeCodeForSession`.

### New: `src/app/auth/reset-password/page.tsx`
Client component. New password input + submit.
Calls `supabase.auth.updateUser({ password })`.
Requires the user to already have a valid session
(established by the recovery link).

## Files to create/modify

| File | Action |
|---|---|
| `src/app/login/page.tsx` | Modify — add email form, mode toggle, forgot password |
| `src/app/auth/confirm/route.ts` | Create — OTP verification handler |
| `src/app/auth/reset-password/page.tsx` | Create — new password form |

## Acceptance Criteria

- [ ] Login page shows "Sign in with Google" button and email form below it
- [ ] Toggling to "Create account" shows display name, email, password fields
- [ ] Submitting create account sends confirmation email and shows inline success message
- [ ] Clicking the confirmation link creates the player record and lands on /onboarding
- [ ] Returning sign-in with email/password works and redirects to /
- [ ] Wrong password shows an inline error
- [ ] "Forgot password?" shows a reset form; submitting it sends a reset email
- [ ] Clicking the reset link lands on /auth/reset-password; submitting redirects to /
- [ ] Google sign-in still works unchanged
