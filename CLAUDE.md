@AGENTS.md

# snobaddy

This is a full-stack web application built entirely with Claude Code.

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Framework  | Next.js 14 (App Router, TypeScript) |
| Styling    | Tailwind CSS                        |
| Database   | Supabase (PostgreSQL)               |
| Deployment | Vercel                              |
| Source     | GitHub                              |

## Project Structure

```
src/
  app/
    page.tsx          # Root page (server component)
    layout.tsx        # Root layout
    api/
      health/
        route.ts      # GET /api/health — DB connectivity check
  lib/
    supabase.ts       # Supabase client (singleton)
```

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in values.
Never commit `.env.local` — it is gitignored.

| Variable                   | Where to find it                                       |
|----------------------------|--------------------------------------------------------|
| `SUPABASE_URL`             | Supabase dashboard → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY`| Supabase dashboard → Project Settings → API → service_role |

These are **server-side only** — no `NEXT_PUBLIC_` prefix, so they are never sent to the browser.

For Vercel deployment, add these same variables in:
Vercel dashboard → Project → Settings → Environment Variables

## Database Setup

Run this SQL once in the Supabase SQL editor:

```sql
create table if not exists health_check (
  id bigint primary key generated always as identity,
  message text not null,
  created_at timestamptz default now()
);

insert into health_check (message) values ('Hello from Supabase!');
```

## Local Development

```bash
npm install
cp .env.local.example .env.local   # fill in your Supabase keys
npm run dev                         # http://localhost:3000
```

## Deployment

1. Push to GitHub (main branch)
2. Vercel auto-deploys on every push to main
3. Set environment variables in Vercel dashboard (one-time setup)

## Coding Conventions

- All database access goes through `src/lib/supabase.ts`
- Prefer React Server Components for data fetching
- Use `src/app/api/` for API routes
- Keep business logic out of components — extract to `src/lib/`
