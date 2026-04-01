# Chapter 6: Setting Up a Pre-Prod Stack

> How to create a safe "staging" environment to test migrations and new features before they hit the real club data.

---

## The Problem: "YOLO" Deployments
As the club grows, we can't risk breaking the live database or wiping player records during a bad migration. We need a separate **Pre-Production (Staging)** environment that mirrors the real app.

---

## The Three-Tier Architecture

| Environment | Purpose | Database |
|-------------|---------|----------|
| **Local** | Coding & experiments | Supabase CLI (Docker) |
| **Staging** | Full E2E testing with teammates | Secondary Supabase Project |
| **Production** | The live app used at the court | Primary Supabase Project |

---

## 1. Local Development with Supabase CLI
Stop using the Supabase dashboard to create tables! Use the CLI to track changes.

1. **Install CLI:** `brew install supabase/tap/supabase`
2. **Initialize:** `supabase init`
3. **Start Local DB:** `supabase start` (Requires Docker)
4. **Create a Migration:** `supabase migration new add_last_seen_column`
5. **Apply Changes:** `supabase db reset`

---

## 2. Setting Up the Staging Project
1. **Create a new project** in Supabase (e.g., `snobaddy-staging`).
2. **Get the keys:** Copy the URL and Service Role Key.
3. **Link CLI:** `supabase link --project-ref <staging-project-id>`
4. **Push Schema:** `supabase db push` — this applies all your local migration files to the staging project.

---

## 3. Vercel Integration (The "Preview" Environment)
Vercel has built-in support for different environments.

1. Go to Vercel Dashboard → Settings → Environment Variables.
2. Add your **Staging** keys but set their **Environment Scope** to **Preview** only.
3. Keep your **Production** keys scoped to **Production** only.

**The Magic:** Whenever you open a Pull Request on GitHub, Vercel creates a "Preview Deployment". Because of the scopes, this preview app will automatically talk to your **Staging** database!

---

## 4. CI/CD: Automating the Flow
Use GitHub Actions to keep the database in sync with your code.

**Create `.github/workflows/staging.yml`:**
```yaml
name: Deploy Staging Migrations
on:
  pull_request:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase db push --project-ref ${{ secrets.STAGING_PROJECT_ID }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          DB_PASSWORD: ${{ secrets.STAGING_DB_PASSWORD }}
```

---

## Best Practices for Staging
1. **Never use real user data:** If you need test data, use a seed script (`supabase/seed.sql`).
2. **Sanitize Emails:** If your app sends emails (like our sign-up flow), use a service like **Mailtrap** or a test domain for staging so you don't accidentally email the real players.
3. **Parity:** Keep your Staging and Production project settings (Auth providers, RLS, Storage buckets) identical.
