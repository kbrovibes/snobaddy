# Chapter 3: Sessions & Match Logic

> Moving from a static app to a live tracker. Implementing session check-ins, match recording, and real-time scoreboards.

---

## The Core Loop

The goal of this phase was to replace the physical whiteboard. The workflow we built:
1. **Admin starts a session** for today (e.g., "Monday, April 7").
2. **Players check in** as they arrive.
3. **Admin/Players record matches** (4 players, 2 teams, final score).
4. **Live Scoreboard** updates instantly to show tonight's W/L and Win %.
5. **Admin closes the session** when the night ends.

---

## Data Model: The "Big Three" Tables

To support this, we added three core tables to Supabase:

### 1. `sessions`
Tracks the date and status of play nights.
- `id`: UUID (primary key)
- `date`: date (e.g., 2026-04-07)
- `status`: text (Pending, Active, Closed)
- `season_id`: UUID (link to a `seasons` table for grouping)

### 2. `session_players` (The Check-In Table)
A many-to-many join table between `players` and `sessions`.
- `session_id`: UUID
- `player_id`: UUID
- `checked_in_at`: timestamptz
- `checked_out_at`: timestamptz (nullable)

**Key Logic:** If `checked_out_at` is NULL, the player is currently "here". If they leave and come back, we reset `checked_out_at` to NULL and update `checked_in_at`.

### 3. `matches`
The record of every game played.
- `session_id`: UUID
- `t1p1_id`, `t1p2_id`, `t2p1_id`, `t2p2_id`: UUIDs (the 4 players)
- `t1_score`, `t2_score`: integer
- `winning_team`: integer (1 or 2)
- `created_at`: timestamptz

---

## Technical Highlights

### 1. Server-Side Calculations
Instead of storing a "total wins" column that we update, we calculate everything on the fly. When you load a session page:
1. Fetch all `matches` for `session_id`.
2. Map over them to count wins/losses for every player.
3. Sort the list by Win % (descending).

This ensures data integrity—the scoreboard can never be "out of sync" with the match history because it *is* the match history.

### 2. Admin Presence Controls
While players can check themselves in, admins need to be able to fix mistakes (e.g., someone forgot to check in, or someone left without checking out). We added an `AdminPresenceToggle` component that:
- Shows "In/Out" buttons next to every player in the registry.
- Uses the **Supabase Service Role client** (`lib/supabase.ts`) to bypass RLS and update any player's status.

### 3. Match History Alignment
Rendering match history on mobile is hard. We tried several layouts:
- **Table:** Too wide for 4 names + scores.
- **Flexbox:** Names would wrap at different heights, breaking alignment.
- **Grid (The Winner):** We used a 3-column CSS Grid: `[Team 1] [vs] [Team 2]`. This keeps the "vs" and the scores perfectly centered regardless of name length.

---

## What We Learned (Gotchas)

### 1. The "Stuck in Saving" Bug
In early versions, the "Record Match" form would get stuck with a spinning loader if an admin edited a match.
**Fix:** We had to explicitly reset the `isSaving` state in the `finally` block of the async call. Always use `try/catch/finally` for UI loading states.

### 2. The 🎾 vs 🏸 Incident
The initial "Record Match" button used a tennis ball emoji (🎾). Players noticed immediately. We swapped it for the badminton shuttlecock (🏸). Detail matters in niche sports apps!

### 3. Service Role for Admin Actions
Regular players shouldn't be able to edit other people's skill levels or delete matches. We enforced this by:
1. Checking `player.is_admin` in the API route.
2. Using the `supabase` client (service role) to perform the update only *after* that check passes.

---

## How to Verify the Core Loop

1. **Start Session:** Admin clicks "Start Session" on the home page. Status changes to "Active".
2. **Check In:** Visit the session page as a player. Click "I'm Here". Your name appears in "Who's Here".
3. **Record Match:** Click "🏸 Record a Match". Pick 4 players. Enter scores (e.g., 21-18).
4. **Scoreboard:** Your name should now show `1W - 0L (100%)`.
5. **Check Out:** Click "Leave". Your name moves to the "Checked Out" section.
6. **Re-Add:** Admin goes to Players tab, finds you, and clicks "Re-add". You're back in.
