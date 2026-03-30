@AGENTS.md

# snobaddy

**Badminton session and season tracker** for a drop-in doubles club in Snoqualmie, WA.
Replaces a physical whiteboard. ~30-50 players per session, 2 courts, Mondays and Thursdays.

### What it does
- Tracks which players show up each session (drop-in, no pre-registration)
- Records doubles match results (4 players, 2 teams, one winner)
- Shows a live session scoreboard (W/L per player tonight)
- Shows a season leaderboard (total W/L, win %, matches played)
- Helps suggest fair matches based on player skill levels (1–5)

### What it does NOT do (yet)
- No login or authentication — fully open, anyone can record a match
- No player accounts or passwords
- No real-time push updates (page refresh to update)
- No payment, registration, or scheduling integration

### Current phase
**MVP — Replace the whiteboard.** Focus: check players in, record matches, show live stats.
Do not add complexity beyond what is in the current backlog item.

### Key domain terms
- **Session** — one evening of play (e.g. Monday Apr 7, 6–10pm)
- **Season** — a block of sessions (e.g. Spring 2026)
- **Match** — 4 players split into 2 teams, one team wins
- **Skill level** — integer 1–5, set when a player is first added, editable later

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
    page.tsx                  # Root — redirects to /session/today
    layout.tsx                # Root layout
    session/
      [id]/page.tsx           # Active session view (check-in + scoreboard)
    players/
      page.tsx                # All-time player registry
    leaderboard/
      page.tsx                # Season leaderboard
    api/
      health/route.ts         # DB connectivity check
      players/route.ts        # GET all players, POST new player
      sessions/route.ts       # GET/POST sessions
      matches/route.ts        # POST a match result
  lib/
    supabase.ts               # Supabase client (server-side singleton)
    db/
      players.ts              # Player queries
      sessions.ts             # Session queries
      matches.ts              # Match queries
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

- All DB access goes through `src/lib/db/*.ts` — never query Supabase directly in components
- Prefer React Server Components for read-only data fetching
- Use client components (`"use client"`) only when you need interactivity (forms, buttons)
- API routes live in `src/app/api/` — one file per resource
- Keep components thin — business logic goes in `src/lib/db/` or `src/lib/`
- No ORMs — use the Supabase JS client directly
- Tailwind only for styling — no additional CSS frameworks
- Mobile-first — this app is used on phones at the court
