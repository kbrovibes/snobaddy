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
- No real-time push updates (page refresh to update)
- No match scheduling or court assignment
- No payment or registration integration
- No per-session history browsing

### Current phase
**MVP — Replace the whiteboard.** Core loop (login → check in → record match → see stats) is working.
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
  middleware.ts                        # Auth guard — redirects unauthenticated users to /login
  app/
    layout.tsx                         # Root layout
    login/page.tsx                     # Google OAuth sign-in page
    onboarding/page.tsx                # First-login skill level picker
    auth/callback/route.ts             # OAuth callback — creates player record
    (app)/                             # Authenticated route group
      layout.tsx                       # App shell: Header + BottomNav
      page.tsx                         # Session tab (home)
      players/page.tsx                 # Player registry
      leaderboard/page.tsx             # Season leaderboard
    api/
      health/route.ts                  # DB connectivity check
      players/route.ts                 # GET all players
      players/[id]/route.ts            # PATCH skill level (admin only)
      matches/route.ts                 # POST a match result
      sessions/[id]/start/route.ts     # Admin: activate session
      sessions/[id]/checkin/route.ts   # Check self or player in
      sessions/[id]/checkout/route.ts  # Check self or player out
  components/
    Header.tsx                         # Fixed top bar with logo + logout avatar
    BottomNav.tsx                       # Fixed bottom nav: Session / Players / Leaderboard
    StartSessionButton.tsx             # Admin: start pending session
    CheckInButton.tsx                  # Self check-in / check-out
    AdminPresenceToggle.tsx            # Admin: per-player check-in/out on players page
    SkillEditor.tsx                    # Admin: inline skill level editor (dots)
    RecordMatchForm.tsx                # Full-screen match recording form
  lib/
    supabase.ts                        # Server DB client (service role key)
    supabase-server.ts                 # Server auth client (anon key + cookies)
    supabase-browser.ts                # Browser auth client (anon key)
    db/
      players.ts                       # Player queries + admin email list
      sessions.ts                      # Session queries + presence
      matches.ts                       # Match queries + scoreboard computation
```

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in values.
Never commit `.env.local` — it is gitignored.

| Variable                        | Scope         | Where to find it |
|---------------------------------|---------------|-----------------|
| `SUPABASE_URL`                  | Server only   | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server only   | Supabase → Project Settings → API → service_role |
| `NEXT_PUBLIC_SUPABASE_URL`      | Browser + server | Same URL as above |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | Supabase → Project Settings → API → anon/public |

All four must be set in Vercel dashboard → Project → Settings → Environment Variables.

## Database Tables

| Table | Purpose |
|-------|---------|
| `health_check` | Connectivity check |
| `players` | All players (user_id nullable for manually-added players) |
| `seasons` | Season definitions (name, start/end date) |
| `sessions` | Individual Mon/Thu sessions, linked to a season |
| `session_players` | Check-in records (player × session, with checked_out_at) |
| `matches` | Match results (4 player IDs, scores, winning_team) |

## Admin Setup

Admin emails are whitelisted in `src/lib/db/players.ts` → `ADMIN_EMAILS`.
To grant admin to an existing player run in Supabase SQL editor:
```sql
update players set is_admin = true where email = 'email@example.com';
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

## AI Agent Sync

This project supports both Claude Code and Gemini CLI.
- `CLAUDE.md` — loaded automatically by Claude Code
- `GEMINI.md` — loaded automatically by Gemini CLI
- **These files must always be kept in sync.** Whenever `CLAUDE.md` is updated, apply the same changes to `GEMINI.md`.
- Release notes live in `CHANGELOG.md` (user-facing) and `releases/` (technical detail per release).

### Changelog enforcement

Two hooks enforce changelog discipline:

1. **Claude Code** — `PostToolUse` hook in `.claude/settings.json` fires after every `Write` or `Edit` to a `src/` file and prints a reminder to update `CHANGELOG.md` and `releases/`.

2. **Git pre-commit** — `scripts/pre-commit` (installed via `bash scripts/install-hooks.sh`) blocks any commit that stages `src/` changes without also staging `CHANGELOG.md`. This covers Gemini CLI and human commits. Use `git commit --no-verify` to skip for WIP commits.

**When the pre-commit hook blocks your commit**, you must:
1. Update `CHANGELOG.md` with a user-facing entry under the correct version
2. Create or update `releases/v{version}-{slug}.md` with technical detail
3. Stage those files and commit again

**When `CHANGELOG.md` has a merge conflict**, do NOT merge the two entries into one. Instead:
1. Give the incoming change its own version number (increment the patch: e.g. `0.24.0` → `0.24.1`)
2. Keep both version blocks as separate entries
3. Resolve the conflict marker so each version has its own clean `## [x.y.z]` heading
