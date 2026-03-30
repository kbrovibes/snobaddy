# Chapter 2: Login & OAuth

> Adding Google authentication, protecting all routes, and collecting skill level on first login.

---

## What We Built

- A login page with "Sign in with Google" — the only way into the app
- All routes protected: visiting any page without being logged in redirects to `/login`
- First-time login flow: skill level picker (1–5), defaults to 3 if skipped
- A `players` table in Supabase linked to Google accounts
- A home page that greets the logged-in user by name

---

## Why Google OAuth (Not Email/Password)

We chose Google-only login for simplicity:
- No passwords to manage or reset
- No email verification step
- Everyone already has a Google account
- Supabase supports it natively with minimal config

The tradeoff: anyone with a Google account can sign up. For a club app this is fine — no sensitive data, and we can add email restrictions later if needed.

---

## The Two Keys You Need for Auth

This is where it gets confusing. Supabase has two different keys and they serve different purposes:

| Key | Env Var | Used Where | Why |
|-----|---------|------------|-----|
| **Service role key** (`sb_secret_...`) | `SUPABASE_SERVICE_ROLE_KEY` | Server only | Full DB access, bypasses security rules |
| **Anon / public key** (`eyJ...` JWT) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | Auth flows, safe to expose publicly |

The anon key is safe to put in the browser (hence `NEXT_PUBLIC_`) because it only has access to what your database security rules allow. The service role key bypasses all rules — never put it in the browser.

**Where to find the anon key:** Supabase dashboard → Project Settings → API → Project API Keys → `anon / public`

---

## Three-Platform Setup Required

Getting Google OAuth working requires configuration in three places:

### 1. Google Cloud Console
- Create a project at console.cloud.google.com
- APIs & Services → OAuth consent screen → External
- APIs & Services → Credentials → Create OAuth 2.0 Client ID (Web application)
- Add authorized redirect URI: `https://<project-id>.supabase.co/auth/v1/callback`
- Copy the **Client ID** and **Client Secret**

### 2. Supabase Dashboard
- Authentication → Providers → Google → Enable
- Paste the Client ID and Client Secret from Google
- Authentication → URL Configuration:
  - Site URL: `https://snobaddy.vercel.app`
  - Redirect URLs: add both production and localhost:
    - `https://snobaddy.vercel.app/auth/callback`
    - `http://localhost:3000/auth/callback`

### 3. Vercel Dashboard
- Settings → Environment Variables — add the two new public vars:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**The redirect URL is the most common gotcha.** If it's missing or wrong, Google will reject the OAuth attempt with an error. The flow is: your app → Google → Supabase callback → your app's `/auth/callback`.

---

## How the Auth Flow Works (Step by Step)

```
User clicks "Sign in with Google"
  ↓
Browser calls supabase.auth.signInWithOAuth({ provider: 'google' })
  ↓
Supabase generates a Google OAuth URL and redirects the browser there
  ↓
User picks their Google account on Google's page
  ↓
Google redirects to: https://<project>.supabase.co/auth/v1/callback
  ↓
Supabase exchanges the Google token, sets a session cookie
  ↓
Supabase redirects to: https://snobaddy.vercel.app/auth/callback
  ↓
Our /auth/callback route:
  - Exchanges the code for a session
  - Checks if a player record exists for this user
  - If not → creates one (name + email from Google, skill_level=3)
  - If first time → redirect to /onboarding
  - If returning → redirect to /
  ↓
User lands on the app
```

---

## How Routes Are Protected (Middleware)

Next.js middleware runs before every request. We use it to check for a valid session:

```
src/middleware.ts
```

Logic:
- `/login` and `/auth/*` → always accessible (public)
- Everything else → check for a Supabase session cookie
- No session → redirect to `/login`
- Has session → let the request through

The middleware uses the **anon key** (not service role) because it's just checking session validity, not accessing data.

---

## The Two Supabase Clients

We now have three Supabase client files:

| File | Used In | Key Used | Purpose |
|------|---------|----------|---------|
| `src/lib/supabase.ts` | Server only | Service role | DB queries (bypasses RLS) |
| `src/lib/supabase-server.ts` | Server only | Anon key + cookies | Auth session checks |
| `src/lib/supabase-browser.ts` | Browser (`"use client"`) | Anon key | OAuth sign-in, client-side auth |

**Rule of thumb:**
- Need to read/write DB data server-side → use `supabase.ts`
- Need to check who's logged in → use `supabase-server.ts`
- Need to do anything in a client component (button clicks, forms) → use `supabase-browser.ts`

---

## The Players Table

Created directly in Supabase via Node.js + pg (since we don't have psql installed locally):

```sql
create table players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) unique not null,
  name text not null,
  email text not null unique,
  skill_level integer not null default 3 check (skill_level between 1 and 5),
  is_admin boolean not null default false,
  onboarding_complete boolean not null default false,
  created_at timestamptz default now()
);
```

Key design decisions:
- `user_id` links to Supabase's internal auth table (`auth.users`) — this is what connects a Google login to a player record
- `skill_level` defaults to 3 (intermediate) — safe fallback if onboarding is skipped
- `is_admin` is set manually via SQL, not through the UI

**To make someone an admin** (run once in Supabase SQL editor):
```sql
update players set is_admin = true where email = 'your@email.com';
```

---

## File Map After This Chapter

```
src/
  middleware.ts                  ← protects all routes
  app/
    login/
      page.tsx                   ← "Sign in with Google" page
    onboarding/
      page.tsx                   ← skill level picker (first login only)
    auth/
      callback/
        route.ts                 ← OAuth callback: creates player, redirects
    page.tsx                     ← home (placeholder for now)
  lib/
    supabase.ts                  ← server DB client (service role)
    supabase-server.ts           ← server auth client (anon key + cookies)
    supabase-browser.ts          ← browser auth client (anon key)
```

---

## New Environment Variables

| Variable | Where | What |
|----------|-------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + .env.local | Public project URL (same value as SUPABASE_URL) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + .env.local | Public JWT key for browser auth |

Both must be in Vercel environment variables AND in your local `.env.local`.

---

## Things That Tripped Us Up

1. **Secret scanning blocked our push** — the `.claude/` folder had API keys in it. Fixed by adding `.claude/` to `.gitignore` and rewriting git history with `git filter-branch`. Lesson: add `.claude/` to `.gitignore` before the very first commit.

2. **Anon key vs service role key** — the service role key (`sb_secret_`) doesn't work for OAuth. You specifically need the anon JWT key from the API settings page.

3. **Redirect URLs must be explicitly added** — Supabase rejects OAuth callbacks from any URL not on the allowed list. Always add both `localhost:3000/auth/callback` and your production URL.

4. **Vercel needs a redeploy after adding env vars** — adding variables in the dashboard doesn't affect the currently live deployment. Always trigger a redeploy after changing env vars.

---

## How to Verify It's Working

1. Open the app → you should land on `/login`
2. Click "Sign in with Google" → pick your account
3. First time: lands on `/onboarding` → pick a skill level → continue
4. Returning: skips onboarding, goes straight to home
5. Check Supabase: Table Editor → `players` → your row should be there with your name, email, and skill level
6. Open an incognito window → confirms the route protection works
