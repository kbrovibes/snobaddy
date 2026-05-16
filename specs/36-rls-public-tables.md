# Spec 36: Enable Row-Level Security on Public Tables

## What it does
Hardens the Supabase backend so that the anon key cannot read or modify rows directly. Every public table currently has RLS disabled, which means the browser-side anon key — present in every Vercel preview and prod build under `NEXT_PUBLIC_SUPABASE_ANON_KEY` — has unrestricted SELECT/INSERT/UPDATE/DELETE on the entire schema. Server-side admin guards in our API routes don't help, because anyone with the anon key can hit `https://<project>.supabase.co/rest/v1/<table>` directly and skip our code.

This spec turns RLS on for every public table and adds the minimal set of policies needed to keep the app working.

## What it does NOT do
- Does not restructure existing API routes — they continue to use the service-role client (which bypasses RLS).
- Does not change how players sign in.
- Does not introduce per-row ownership rules beyond what the app already enforces (e.g. "players can only update their own row" is fine to add, but court-bookings, finals brackets, etc. stay readable to all signed-in users for now).

## Why now
A Supabase advisor surfaced this during the v0.39.0 newsletter feature ship. Tables affected (18 total):

```
public.health_check
public.players
public.seasons
public.sessions
public.session_players
public.matches
public.player_poems
public.session_tally
public.tally_correction_log
public.app_settings
public.session_reset_backups
public.finals_events
public.finals_participants
public.finals_series
public.push_subscriptions
public.whiteboard_log
public.ubr_ratings
public.ubr_history
public.season_newsletters   (added in v0.39.0)
```

`proposed_matches`, `finals_formats`, and `leaderboard_cache` already have RLS enabled.

**Risk if left unfixed:** any signed-in user (and, depending on how `NEXT_PUBLIC_SUPABASE_ANON_KEY` is scoped, any unauthenticated client that can read it from a preview build) can issue arbitrary writes against `players`, `matches`, `seasons`, etc. via the PostgREST endpoint. Examples:
- Set `players.is_admin = true` on themselves.
- Insert phantom matches into a closed season.
- Delete `season_newsletters` rows.
- Overwrite `app_settings` (e.g. flip the UBR toggle).

## Data / DB changes
Two-phase migration so the app keeps working through the cutover.

### Phase A — Enable RLS, add permissive read policies
For every table above, enable RLS and add an authenticated-read policy. This blocks anon-key writes immediately while keeping our existing read paths working through the supabase-server client (which uses anon auth + the user's cookie session).

```sql
alter table public.<table> enable row level security;

create policy "<table>_authenticated_select"
  on public.<table>
  for select
  to authenticated
  using (true);
```

For the `app_settings` table specifically: allow `select` to `anon` too, since the login page reads `welcome_message` (or similar) before auth.

### Phase B — Tighten write policies per table
Default rule: no anon/auth writes. Service-role bypasses RLS automatically, so server-side admin routes continue to work.

Per-table write policies:

| Table | Insert | Update | Delete |
|---|---|---|---|
| `players` | service role only | `auth.uid() = user_id` for their own row, but only on whitelisted columns (skill_level adjustments stay server-side) | service role only |
| `seasons` | service role only | service role only | service role only |
| `sessions` | service role only | service role only | service role only |
| `session_players` | `auth.uid() = (select user_id from players where id = player_id)` (self check-in) | same | same |
| `matches` | service role only | service role only | service role only |
| `session_tally` | service role only | service role only | service role only |
| `tally_correction_log` | service role only | service role only | service role only |
| `app_settings` | service role only | service role only | service role only |
| `session_reset_backups` | service role only | service role only | service role only |
| `finals_events` | service role only | service role only | service role only |
| `finals_participants` | service role only | service role only | service role only |
| `finals_series` | service role only | service role only | service role only |
| `push_subscriptions` | `auth.uid() = (select user_id from players where id = player_id)` | same | same |
| `whiteboard_log` | service role only | service role only | service role only |
| `ubr_ratings` | service role only | service role only | service role only |
| `ubr_history` | service role only | service role only | service role only |
| `player_poems` | service role only | service role only | service role only |
| `season_newsletters` | service role only | service role only | service role only |

The "service role only" rule is implicit: with RLS on and no INSERT/UPDATE/DELETE policy in place for the `authenticated` role, those operations are denied for the anon key. The service-role key bypasses RLS by design, so all of `src/lib/db/*.ts` writes that go through `supabase` (the service-role client in `src/lib/supabase.ts`) keep working.

## API
No API changes. All write routes already use the service-role client.

## UI
No UI changes.

## Files to create/modify
| File | Action |
|---|---|
| `supabase/migrations/<date>_enable_rls_phase_a.sql` | Create — `enable row level security` + authenticated SELECT policies for all 19 tables |
| `supabase/migrations/<date>_enable_rls_phase_b_writes.sql` | Create — per-table write policies as described in the table above |
| `releases/v0.X.Y-rls.md` | Create — record of the migration and any client paths that had to change |
| `CLAUDE.md` / `GEMINI.md` | Append a "Database access rules" note that all writes must go through `src/lib/supabase.ts` (service role), never through `supabase-server` or `supabase-browser` |

## Rollout plan
1. Apply phase-A migration on a Friday after the session window — there's no risk to reads.
2. Smoke-test login, leaderboard, session checkin/checkout, match recording, admin pages.
3. Apply phase-B migration once phase A is confirmed stable in production.
4. Re-run the Supabase advisor and confirm the `rls_disabled` warning is gone.
5. Add a regression: a CI job that runs the Supabase advisor and fails if any new table is added without RLS.

## Acceptance Criteria
- [ ] `supabase` advisor shows zero tables with `rls_disabled`.
- [ ] Anon-key direct REST calls against `players` / `seasons` / `matches` / `season_newsletters` return 401 or empty results for writes.
- [ ] All existing screens (login, session list, leaderboard, players, admin pages, newsletter) continue to work end-to-end.
- [ ] Self check-in still works for a non-admin player.
- [ ] Push subscription registration still works.
- [ ] The two phase migrations are recorded in `supabase/migrations/` and `releases/`.
- [ ] CLAUDE.md / GEMINI.md document the "writes always go through service-role client" rule.
