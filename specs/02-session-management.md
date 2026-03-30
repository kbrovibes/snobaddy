# Spec 02: Session Management

## What it does
Sessions are auto-created for every Monday and Thursday. They start in `pending` state.
Only admins can activate a session. Once active, any logged-in user can check in.
The home page always reflects the current session state.

## What it does NOT do
- No manual session creation — only Mon/Thu, auto-generated
- No session closing (ends naturally — no explicit close needed for now)
- No historical session browsing yet
- Non-admins cannot activate sessions

## Session States

| State | Who sees what |
|-------|--------------|
| `pending` | Non-admins: "Session starting soon". Admins: "Start Session" button |
| `active` | Everyone: check-in available, match recording available |

## Home Page Behavior by State

### No session today (e.g. Tuesday)
```
Next session: Thursday, Apr 10
```

### Session pending (Mon/Thu, not yet started)
- Non-admin: "Tonight's session hasn't started yet. Check back soon."
- Admin: "Tonight's session is ready. [Start Session] button"

### Session active
- Full session view: who's here, scoreboard, record match button

## Data

### Table: `sessions` (revised)
```sql
create table sessions (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  status text not null default 'pending' check (status in ('pending', 'active')),
  started_by uuid references players(id),
  started_at timestamptz,
  created_at timestamptz default now()
);
```

### Table: `session_players`
```sql
create table session_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id),
  player_id uuid references players(id),
  checked_in_at timestamptz default now(),
  unique(session_id, player_id)
);
```

## Auto-creation Logic
On any visit to the home page, the server checks:
- Is today Monday or Thursday?
- Does a session row exist for today?
- If not → create one with status `pending`

Sessions for future days are NOT pre-created. Only today's session is created on demand.

## API
- `GET /api/sessions/today` — returns today's session (creates pending if needed), or null if not a session day
- `POST /api/sessions/[id]/start` — admin only — sets status to `active`, records started_by + started_at
- `POST /api/sessions/[id]/checkin` — active session only — body: `{ player_id }` — checks logged-in user in

## Check-in behavior
- Players check themselves in (not others) — they tap "I'm here" on the session page
- Check-in only works when session is `active`
- Can't check in twice

## Acceptance Criteria
- [ ] Home page shows correct state for today (no session / pending / active)
- [ ] Non-admin sees "starting soon" message on pending session
- [ ] Admin sees "Start Session" button on pending session
- [ ] Clicking Start Session activates it — page updates immediately
- [ ] Once active, "I'm here" / check-in button appears for all users
- [ ] Checked-in players appear in the "Who's here" list
- [ ] Non-session days show next session date
- [ ] Works on mobile
