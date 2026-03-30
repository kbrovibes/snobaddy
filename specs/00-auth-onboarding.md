# Spec 00: Auth & Onboarding

## What it does
Every page requires a Google login via Supabase Auth. On first login, the user is prompted
to set their skill level (1–5). A player record is automatically created and linked to their
Google account. Subsequent logins go straight to the app.

## What it does NOT do
- No email/password login — Google only
- No admin self-assignment — admins are set manually in the DB
- No profile editing after onboarding (yet)
- No invite system — anyone with a Google account can sign up

## Flow

### First-time user
1. Lands on `/` → redirected to `/login`
2. Clicks "Sign in with Google" → Google OAuth → returns to app
3. App detects no player record exists → redirects to `/onboarding`
4. Onboarding page: "Welcome [name]! How would you rate your badminton skill?"
   - 1 = Beginner, 2 = Casual, 3 = Intermediate, 4 = Advanced, 5 = Pro
   - Big tap-friendly buttons for each level
   - "Save & Continue" button
   - If they skip or it errors → defaults to 3, goes to app anyway
5. Player record created → redirected to home

### Returning user
1. Lands on `/` → already has session cookie → straight to home
2. Or lands on `/login` → signs in → straight to home

### Logged-out state
- All routes redirect to `/login` except `/login` itself
- Login page shows: logo + app name + "Sign in with Google" button

## Data

### Table: `players` (revised — linked to auth)
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

### Admin setup (run once in Supabase SQL editor after first login)
```sql
update players set is_admin = true where email = 'karthik220290@gmail.com';
```

## Supabase Auth Setup (one-time, in dashboard)
1. Supabase dashboard → Authentication → Providers → Google → Enable
2. Add Google OAuth Client ID + Secret (from Google Cloud Console)
3. Add redirect URL to Google Console: `https://zwwkcwdqsplztlmyfpyf.supabase.co/auth/v1/callback`

## Middleware
All routes protected by Next.js middleware that checks for a valid Supabase session.
Unauthenticated requests redirect to `/login`.

## Acceptance Criteria
- [ ] Visiting any page without being logged in redirects to `/login`
- [ ] Login page shows logo and "Sign in with Google" button
- [ ] First login → onboarding page with skill level picker
- [ ] Skill level saved to player record
- [ ] Skipping onboarding defaults to skill level 3
- [ ] Returning login skips onboarding, goes straight to home
- [ ] Player record created on first login with name + email from Google
- [ ] Works on mobile
