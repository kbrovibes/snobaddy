# Chapter 5: Transitioning to Email Auth

> Adding professional sign-up, sign-in, and password recovery alongside Google OAuth.

---

## The Need for Email Auth

While Google Login (OAuth) is easy, not everyone wants to link their Google account. To make the app more accessible and professional, we added a full email-based authentication system.

---

## Unified Login UI

We redesigned the `/login` page to handle four different states in one clean interface:
1. **Google OAuth:** A single button for the quickest entry.
2. **Email Sign-In:** Traditional email/password form.
3. **Email Sign-Up:** Create an account with a Display Name, Email, and Password.
4. **Password Recovery:** Request a reset link if you forget your password.

We used a "Pill Toggle" (Sign in / Create account) to switch modes without reloading the page, keeping the experience smooth on mobile.

---

## The Email Confirmation Flow

Supabase handles the heavy lifting of sending emails, but we had to build the "plumbing" to handle the return trips:

### 1. Sign Up
When a user signs up, Supabase sends a confirmation email. We configured the `emailRedirectTo` to point to `/auth/confirm`.
```ts
const { error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { full_name: displayName },
    emailRedirectTo: `${origin}/auth/confirm`,
  },
});
```

### 2. The Confirmation Route (`/auth/confirm`)
This is a **GET** route that Supabase hits with a `token_hash`. It:
1. Verifies the OTP (One-Time Password) hash.
2. Establishes the user's session (sets cookies).
3. **Crucial:** Checks if a `players` record exists. If not, it creates one using the metadata (full_name) we passed during sign-up.
4. Redirects to `/onboarding` (for new users) or `/` (for returning users).

---

## Password Recovery

Forgot your password? Here's the 3-step loop:
1. **Request:** User enters email on the login page → `supabase.auth.resetPasswordForEmail()` is called.
2. **Email:** User gets a link with a recovery token.
3. **Reset:** Clicking the link hits `/auth/confirm?type=recovery`. It verifies the token and redirects the user to a special `/auth/reset-password` page where they can type a new password.

---

## Managing Supabase (RLS vs Service Role)

As the app grew, we refined how we talk to the database:

### The "Anon" Client (`supabase-browser.ts` / `supabase-server.ts`)
- Used for everything a **normal player** does.
- Subject to **Row Level Security (RLS)** rules in Supabase.
- If a user isn't logged in, they can't see or change anything.

### The "Service Role" Client (`lib/supabase.ts`)
- Used for **Admin-only** actions.
- Bypasses all security rules.
- **Never used in the browser.** We only call this from API routes after verifying the user is an admin.

**Example Admin Check in API:**
```ts
const { data: { user } } = await supabaseAuth.auth.getUser();
const { data: player } = await supabase.from('players').select('is_admin').eq('user_id', user.id).single();

if (!player?.is_admin) return new Response("Forbidden", { status: 403 });

// Now we can safely use the service role client to do admin things...
```

---

## Key Learnings & Gotchas

### 1. Async Params in Next.js 15/16
Next.js recently changed `params` and `searchParams` to be **Promises**. We hit build errors because we were accessing them directly.
**Fix:** Always `await searchParams` in route handlers and server components.

### 2. Password Length
Supabase defaults to a minimum of 6 characters. We added `minLength={6}` to our HTML input to catch this on the client before the user even hits "Submit".

### 3. Display Name Persistence
In OAuth, we get the name from Google. In Email Sign-Up, we have to collect it manually. We store it in the `user_metadata` field of the auth record so it's available to our `/auth/confirm` route when creating the player record.
