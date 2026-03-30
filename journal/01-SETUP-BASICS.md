# Chapter 1: Setup Basics

> First working deployment of snobaddy — a Hello World app with a live database query.

---

## The Stack We Chose

| Layer | Tool | Why |
|-------|------|-----|
| Framework | Next.js 14 (App Router) | Works natively with Vercel, TypeScript by default, server components make DB calls simple |
| Styling | Tailwind CSS | Utility-first, ships with create-next-app |
| Database | Supabase | Postgres under the hood, has a REST API, generous free tier |
| Deployment | Vercel | Auto-deploys from GitHub on every push, made by the Next.js team |
| Source control | GitHub | Standard, integrates with Vercel |

---

## Accounts to Create (One-Time Setup)

You need accounts on three platforms before starting any project with this stack:

1. **GitHub** — github.com → Sign up → Create a new **empty** repo (no README, no .gitignore — leave it completely empty)
2. **Supabase** — supabase.com → Sign up → New project → give it a name and a strong DB password → wait ~2 min for it to provision
3. **Vercel** — vercel.com → Sign up (use your GitHub account so they're linked)

**Order matters:** Get the GitHub repo and Supabase project created first. Connect Vercel last, *after* your code is already pushed to GitHub — otherwise Vercel can't detect your framework correctly.

---

## Keys and Credentials — What We Learned

Supabase gives you several different credentials. It is important to know which one to use where:

### Supabase Keys

| Key | Prefix | Where to find it | What it can do | Safe to expose? |
|-----|--------|-----------------|----------------|-----------------|
| **anon / public key** | `eyJ...` (JWT) | Project Settings → API | Read/write within Row Level Security rules | Yes — safe for browser |
| **service role key** | `sb_secret_...` | Project Settings → API | Bypasses all RLS, full DB access | **No — server only** |
| **DB password** | (you set it) | Project Settings → Database | Direct Postgres connection | No |
| **Management API token** | `sbp_...` | supabase.com/dashboard/account/tokens | Manage projects via API | No |

**What we used:** The service role key (`sb_secret_...`) server-side only, with no `NEXT_PUBLIC_` prefix on the env var so it never reaches the browser.

### Vercel Keys

| Key | Prefix | Use |
|-----|--------|-----|
| **API token** | `vck_...` | CLI and API access to your Vercel account |

**Lesson learned:** The `vck_` token we had was invalid. The reliable way to authenticate Vercel is `vercel login` in the terminal (opens browser) rather than passing a token.

### GitHub Keys

| Key | Prefix | Use |
|-----|--------|-----|
| **Personal Access Token (PAT)** | `ghp_...` | Push/pull from terminal when SSH isn't set up |

To create one: GitHub → Settings → Developer Settings → Personal access tokens → Tokens (classic) → Generate → check `repo` scope.

**To use it for git push:**
```bash
git remote set-url origin https://YOUR_TOKEN@github.com/username/repo.git
git push -u origin main
```

---

## Gotchas We Hit (Learn From These)

### 1. GitHub repo must be empty when you first create it
If GitHub auto-creates a README, your local repo and remote have "unrelated histories" — git refuses to push. Either delete and recreate the repo empty, or force push:
```bash
git push origin main --force
```

### 2. Never commit secrets
GitHub has secret scanning that blocks pushes containing API keys. We accidentally committed keys inside `.claude/settings.local.json`. Fix: add `.claude/` to `.gitignore` before the first commit. We had to rewrite git history to remove it:
```bash
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .claude/settings.local.json' \
  --prune-empty -- --all
git push origin main --force
```

### 3. Connect Vercel only after code is on GitHub
Vercel detects your framework (Next.js, static site, etc.) from the code at connection time. If the repo is empty, it detects "Other" — and then serves your Next.js app as a static site, which returns 404 on every route. Fix: Settings → General → Framework Preset → change to Next.js → Redeploy.

### 4. Env vars need a redeploy to take effect
Adding env vars in the Vercel dashboard does not update the currently live deployment. You must trigger a new deploy: Deployments → `...` menu → Redeploy.

### 5. `NEXT_PUBLIC_` prefix exposes vars to the browser
Any env var starting with `NEXT_PUBLIC_` is bundled into the client-side JavaScript — anyone can see it. Since we're only doing server-side DB calls, we used plain var names:
```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## Prompt to Bootstrap This Stack in the Future

Use this prompt with Claude to scaffold a new Hello World project with this exact stack:

```
I want to build a full-stack web app using:
- Next.js 14 (App Router, TypeScript, Tailwind)
- Supabase for the database
- Vercel for deployment
- GitHub for source control

I already have accounts on all three platforms.
My Supabase project ID is: <project-id>
My Supabase service role key is: <sb_secret_...>
My Supabase DB password is: <password>

Please:
1. Scaffold the Next.js app
2. Create a `health_check` table in Supabase and seed it with one row
3. Wire up a server-side Supabase client (no NEXT_PUBLIC_ prefix)
4. Create a Hello World page that queries the health_check table and shows the result
5. Create a /api/health JSON endpoint that does the same
6. Write a CLAUDE.md with the stack, env vars, and conventions
7. Set up .gitignore correctly (exclude .env.local, .claude/)
8. Tell me how to test locally and push to GitHub
```

---

## How the Hello World App Works

### File map

```
src/
  lib/
    supabase.ts          ← creates the Supabase client (runs on server)
  app/
    page.tsx             ← the Hello World page
    api/
      health/
        route.ts         ← GET /api/health — returns JSON
```

### The DB call — where it happens

`src/app/page.tsx` is a **React Server Component**. It runs on the server (not in the browser) every time someone visits `/`. The DB query happens inside the component function itself:

```ts
// src/app/page.tsx
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic"; // never cache — always fresh from DB

export default async function Home() {
  const { data, error } = await supabase
    .from("health_check")   // table name
    .select("message")      // column to fetch
    .limit(1)
    .maybeSingle();         // return one row or null (not an error if empty)

  const dbStatus = error
    ? `DB error: ${error.message}`
    : `DB says: "${data?.message ?? "no rows yet"}"`;

  return (
    <main>
      <h1>Hello World</h1>
      <p>{dbStatus}</p>
    </main>
  );
}
```

No `useEffect`, no `fetch()` in the browser — the data is fetched server-side and the HTML arrives ready. This is the key advantage of server components.

### How to know it's working

**Locally:**
```bash
npm run dev
# open http://localhost:3000
# you should see: DB says: "Hello from Supabase!"
```

**In production:**
- Visit your live URL — same message should appear
- Visit `/api/health` — returns `{"ok":true,"message":"Hello from Supabase!"}`

### How to check what's in the DB

**Option 1 — Supabase dashboard:**
supabase.com → your project → Table Editor → `health_check`

**Option 2 — Supabase SQL editor:**
supabase.com → your project → SQL Editor → run:
```sql
SELECT * FROM health_check;
```

**Option 3 — curl (from terminal):**
```bash
curl "https://<project-id>.supabase.co/rest/v1/health_check?select=message" \
  -H "apikey: <your-service-role-key>" \
  -H "Authorization: Bearer <your-service-role-key>"
```

**Option 4 — the /api/health endpoint:**
```bash
curl https://snobaddy.vercel.app/api/health
```

---

## The Deployment Flow Going Forward

```
You write code → git push origin main → Vercel detects the push
→ Vercel pulls code from GitHub → runs npm run build
→ deploys to snobaddy.vercel.app (takes ~60 seconds)
```

You never have to touch Vercel manually again. Every push to `main` is a deploy.

---

## Key Files to Never Commit

| File/Folder | Why |
|-------------|-----|
| `.env.local` | Contains your real secrets |
| `.claude/` | Claude Code stores session context here, may contain secrets |
| `node_modules/` | Installed dependencies — huge, regenerated by `npm install` |
| `.next/` | Build output — regenerated by `npm run build` |
