# Spec 05: Session Navigation Redesign

## What it does
Replaces the home page with a proper session list + per-session detail flow.
When any user logs in, if a session is currently open they land directly inside it.
When no session is open they see a list of past sessions. Admins can start a new session from the list.

## What it does NOT do
- No per-session stats summary on the list rows (just date + status)
- No date picker when creating a session — always creates for today
- No ability to have two open sessions at once (enforced in the API)

## Routing

```
/                        → session list, OR redirect to /session/[id] if one is active
/session/[id]            → session detail (all current home page functionality moves here)
```

## Root `/` — Session List page

### Redirect logic
On every load, check for any session with `status = 'active'` across all sessions (not just today).
If found → `redirect("/session/[id]")` immediately.

### When no active session
Show a list of all sessions, ordered by date descending:

```
┌──────────────────────────────────────┐
│  Spring 2026                         │   ← Season header
├──────────────────────────────────────┤
│  Mon, Apr 7            Closed    →   │
│  Thu, Apr 3            Closed    →   │
│  Mon, Mar 31           Closed    →   │
│  ...                                 │
└──────────────────────────────────────┘

[Admin only]  + Start New Session
```

- Each row links to `/session/[id]`
- "Start New Session" button shown only to admins AND only when no active session
- Clicking it creates a session for today's Pacific date, sets it active, and navigates to `/session/[id]`

## Session Detail `/session/[id]`

Move all existing home page content here verbatim. Add one new element:

- `← All Sessions` link in the top-left, above the season header, navigates to `/`

## Data / DB changes

### New function: `getActiveSession()`
Returns any session (across all dates) with `status = 'active'`. Used on the list page for the redirect.

```ts
export async function getActiveSession(): Promise<Session | null>
// SELECT * FROM sessions WHERE status = 'active' LIMIT 1
```

### New function: `getAllSessions()`
Returns all sessions for display in the list, ordered most recent first.

```ts
export async function getAllSessions(): Promise<SessionRow[]>
// SELECT id, date, status, seasons(name) FROM sessions ORDER BY date DESC
```

### API: `POST /api/sessions/create`
Admin-only. Creates and activates a session for today. Replaces the `start-today` test route.

- If a session for today already exists as `pending` → activate it, clear check-ins
- If a session for today already exists as `active` → return `{ ok: true, id }` (already open)
- If a session for today already exists as `completed` → clear check-ins, reactivate
- If no session for today → create as active, link to most recent season
- Enforces no-duplicate-active rule: if any other session is `active`, return 400

Redirect (client-side) to `/session/[id]` on success.

## Components

### `CreateSessionButton` (replaces `StartTodayButton`)
Client component. Same loading/error pattern. On success, `router.push("/session/[session_id]")` using the ID returned by the API.

### `BackToSessionsLink`
Simple `<Link href="/">← All Sessions</Link>` with consistent styling.

## Files to create/modify

| File | Action |
|---|---|
| `src/app/(app)/page.tsx` | Replace with session list + redirect logic |
| `src/app/(app)/session/[id]/page.tsx` | New — move existing home page content here |
| `src/lib/db/sessions.ts` | Add `getActiveSession()`, `getAllSessions()` |
| `src/app/api/sessions/create/route.ts` | New — replaces `/start-today` |
| `src/app/api/sessions/start-today/route.ts` | Delete (superseded) |
| `src/components/CreateSessionButton.tsx` | New — replaces `StartTodayButton` |
| `src/components/StartTodayButton.tsx` | Delete (superseded) |
| `src/components/BackToSessionsLink.tsx` | New |

## Acceptance Criteria

- [ ] Logging in with an active session goes directly to `/session/[id]`
- [ ] Logging in with no active session shows the session list
- [ ] Session list rows are clickable and go to `/session/[id]`
- [ ] Session list shows date + status (Closed / Active) for each row
- [ ] Admin sees "+ Start New Session" button only when no session is active
- [ ] Clicking "Start New Session" creates an active session and navigates into it
- [ ] Cannot create a second active session if one already exists
- [ ] Session detail has "← All Sessions" link that returns to the list
- [ ] Works on mobile
