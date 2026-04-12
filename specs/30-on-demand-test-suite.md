# Spec 29: On-Demand E2E Test Suite

## What it does
A comprehensive Playwright end-to-end test suite that can be run on demand to verify the entire app still works. Tests run against a local dev server with the real Supabase dev database. Designed to be triggered manually (`npm run test`) or by Claude before/after major changes — NOT on every commit or deploy.

## What it does NOT do
- Does not run in CI/CD or block deploys
- Does not mock the database (tests hit real Supabase)
- Does not test auth flows that require real OAuth (Google login) — uses a pre-seeded test account with email/password
- Does not test Vercel-specific features (cron, edge, etc.)
- Does not replace manual QA — it's a safety net, not a substitute

## Why Playwright
- Real browser testing (Chromium + mobile viewport) — matches how the app is actually used
- Built-in mobile emulation (iPhone 14 viewport)
- Screenshot on failure for debugging
- `--grep` flag for running specific test files
- Fast parallel execution

## Test Account Setup
A dedicated test account must exist in both Supabase Auth and the `players` table:

```sql
-- Run once in Supabase SQL editor to create the test player
-- (The auth user is created via email sign-up flow — do this manually once)
-- Test credentials stored in .env.test.local (gitignored)
```

**.env.test.local** (gitignored):
```
TEST_USER_EMAIL=test-bot@snobaddy.app
TEST_USER_PASSWORD=<secure-password>
TEST_ADMIN_EMAIL=<admin-email>
TEST_ADMIN_PASSWORD=<admin-password>
```

Two test accounts needed:
1. **Regular player** — for check-in, viewing leaderboard, basic flows
2. **Admin player** — for session management, match recording, finals, god-mode features

## Test Organization

```
tests/
  playwright.config.ts           # Config: mobile viewport, base URL, env
  helpers/
    auth.ts                      # Login helper (reusable across tests)
    fixtures.ts                  # Test data factories + cleanup
    selectors.ts                 # Common CSS selectors (centralized)
  e2e/
    smoke.spec.ts                # Quick page-load checks (~30s)
    auth.spec.ts                 # Login, onboarding redirect, protected routes
    session-lifecycle.spec.ts    # Create → Start → Close → Reopen → Reset
    checkin.spec.ts              # Check in/out, presence list
    match-recording.spec.ts      # Record, edit, delete matches
    simple-mode.spec.ts          # Simple match form toggle
    tally.spec.ts                # Tally entry (manual, no photo — photo needs real upload)
    player-management.spec.ts    # Add, edit, delete, restore players
    leaderboard.spec.ts          # View rankings, test session filter
    finals-setup.spec.ts         # Create event, add players, groups, drag-and-drop
    finals-matches.spec.ts       # Format pick, generate matches, record, standings
    navigation.spec.ts           # Bottom nav, back buttons, workflow steps
```

## npm Scripts

```json
{
  "test": "npx playwright test",
  "test:smoke": "npx playwright test tests/e2e/smoke.spec.ts",
  "test:feature": "npx playwright test --grep",
  "test:headed": "npx playwright test --headed",
  "test:debug": "npx playwright test --debug"
}
```

## Run Model

| Command | What it does | When to use |
|---------|-------------|-------------|
| `npm run test:smoke` | Load every page, check no crash | After any refactor |
| `npm run test` | Full suite | Before releases, after major changes |
| `npm run test:feature -- "finals"` | Run tests matching "finals" | After changing finals code |
| `npm run test:headed` | Full suite in visible browser | Debugging failures |
| `npm run test:debug` | Step-through debugger | Deep debugging |

## Test Specs by File

### smoke.spec.ts (~30s)
Quick sanity: every page renders without errors.
- [ ] `/login` loads, shows sign-in form
- [ ] `/` (session list) loads after auth
- [ ] `/players` loads, shows player grid
- [ ] `/leaderboard` loads, shows table
- [ ] `/session/[id]` loads for a known session
- [ ] `/players/[id]` loads for a known player
- [ ] `/finals/[id]` loads for a known finals event (if exists)
- [ ] No console errors on any page
- [ ] Bottom nav visible and all 3 tabs clickable

### auth.spec.ts
- [ ] Unauthenticated user redirected to `/login`
- [ ] Email sign-in with valid credentials → redirects to `/`
- [ ] Email sign-in with wrong password → shows error
- [ ] After login, player record exists in DB
- [ ] Onboarding redirect if `onboarding_complete` is false
- [ ] Skill picker saves level and marks onboarding complete
- [ ] Logout clears session and redirects to `/login`

### session-lifecycle.spec.ts (admin)
- [ ] Admin sees "Create Session" button on `/`
- [ ] Create session → new session appears in list
- [ ] Navigate to pending session → "Start Session" button visible
- [ ] Start session → status becomes active, check-in enabled
- [ ] Close session → status becomes completed, matches locked
- [ ] Reopen session → status reverts to active
- [ ] Session scoreboard shows correct W/L after matches recorded
- [ ] Test session toggle works (checkbox visible, persists)

### checkin.spec.ts
- [ ] Active session shows "Check In" button for logged-in player
- [ ] Click check in → button changes to "You're checked in" + "Leave"
- [ ] Player appears in checked-in list / scoreboard
- [ ] Click "Leave" → player removed from checked-in list
- [ ] Admin can check in other players (AdminPresenceToggle)
- [ ] Check-in disabled on pending/completed sessions

### match-recording.spec.ts (admin)
- [ ] "Record a Match" button opens full-screen modal
- [ ] 4 player dropdowns show only checked-in players
- [ ] Selecting a player removes them from other dropdowns
- [ ] Score inputs accept numbers only
- [ ] Submit with tied scores → validation error
- [ ] Submit with duplicate players → validation error
- [ ] Valid submission → match appears in match list, scoreboard updates
- [ ] Edit match: change score → score updates in list
- [ ] Delete match: confirmation → match removed from list
- [ ] Scoreboard W/L counts update after add/edit/delete

### simple-mode.spec.ts (admin)
- [ ] Toggle simple mode on → "Record a Match" changes to SimpleMatchForm
- [ ] SimpleMatchForm: pick 2 winners + 2 losers
- [ ] Submit → match recorded with 21-15 score
- [ ] Toggle simple mode off → full RecordMatchForm returns

### tally.spec.ts (admin)
- [ ] Tally form opens on completed session
- [ ] Can add player + W/L counts manually
- [ ] Validation: total wins must equal total losses
- [ ] Save tally → tally scoreboard appears
- [ ] Edit existing tally → values update
- [ ] Tally results reflected in leaderboard

### player-management.spec.ts
- [ ] `/players` shows all active players in grid
- [ ] Admin: "Add Player" form appears, enter name + skill
- [ ] Submit → new player appears in grid
- [ ] God-mode: edit player name and skill level
- [ ] God-mode: soft-delete player → disappears from grid
- [ ] God-mode: "Removed players" section shows deleted player
- [ ] God-mode: restore player → reappears in grid
- [ ] Player detail page (`/players/[id]`) shows bio + stats
- [ ] Player detail shows match history grouped by session

### leaderboard.spec.ts
- [ ] Leaderboard table renders with correct columns
- [ ] Players sorted by win% descending
- [ ] Stats (W/L/%) match actual match data
- [ ] Admin: "Include test sessions" toggle filters correctly
- [ ] Player row click navigates to player detail

### finals-setup.spec.ts (admin)
- [ ] Create finals event → redirects to `/finals/[id]`
- [ ] Players tab: add participants from player list
- [ ] Players tab: remove participant
- [ ] Groups tab: "Generate Breakdown" creates group assignments
- [ ] Groups tab: drag player from Group A to Group B → moves instantly (local state)
- [ ] Groups tab: dropdown group selector works
- [ ] Groups tab: unsaved changes banner appears after drag
- [ ] Groups tab: "Confirm Groups" saves all changes
- [ ] Workflow steps: correct colors (blue active, green done, light green ahead)
- [ ] Sessions tab: shows Day 1 and Day 2 links

### finals-matches.spec.ts (admin)
- [ ] Finals session page shows format picker
- [ ] Select Round-robin format → pairs auto-generated
- [ ] "Generate Matches" creates match cards
- [ ] Record a finals match → standings update
- [ ] Standings table shows correct W/L/points per player
- [ ] Series card shows progress (if series format)

### navigation.spec.ts
- [ ] Bottom nav: "Sessions" tab → `/`
- [ ] Bottom nav: "Players" tab → `/players`
- [ ] Bottom nav: "Leaderboard" tab → `/leaderboard`
- [ ] Back links use `‹` prefix consistently
- [ ] Session detail: prev/next session arrows work
- [ ] Finals session: prev/next arrows hidden, "‹ Finals Event" shown
- [ ] Finals event: "‹ Sessions" back link works

## Playwright Config

```ts
// tests/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 390, height: 844 },  // iPhone 14
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'mobile-chrome', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,    // Don't start new server if already running
    timeout: 30_000,
  },
});
```

## Test Data Strategy

Tests should be **self-contained** — each test creates what it needs and cleans up after:

1. **Auth**: Login once per test file using `beforeAll` with stored auth state
2. **Sessions**: Create a test session (flagged `is_test = true`) at start of each lifecycle test, delete at end
3. **Players**: Use existing test player accounts; any new players created in tests get soft-deleted in `afterAll`
4. **Matches**: Created during session tests, deleted when test session is wiped
5. **Finals**: Create a test finals event, delete at end

**Cleanup helper** (`helpers/fixtures.ts`):
- `createTestSession(date)` → returns session ID
- `deleteTestSession(id)` → wipes session + all related data
- `createTestFinalsEvent()` → returns event ID
- `deleteTestFinalsEvent(id)` → wipes event + sessions + participants

## When Claude Should Run Tests

Add to CLAUDE.md:

```markdown
## Testing

Run tests on demand — they are NOT part of the deploy pipeline.

| Situation | Command |
|-----------|---------|
| After refactoring shared components | `npm run test:smoke` |
| After changing a specific feature | `npm run test:feature -- "feature-name"` |
| Before a version bump / release | `npm run test` |
| After DB schema changes | `npm run test` |
| After changing auth/middleware | `npm run test:smoke` + `npm run test:feature -- "auth"` |
```

## Dependencies to Install

```bash
npm install -D @playwright/test
npx playwright install chromium
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `tests/playwright.config.ts` | Create — Playwright config (mobile viewport, dev server) |
| `tests/helpers/auth.ts` | Create — Login/logout helpers |
| `tests/helpers/fixtures.ts` | Create — Test data factories + cleanup |
| `tests/helpers/selectors.ts` | Create — Centralized CSS selectors |
| `tests/e2e/smoke.spec.ts` | Create — Quick page-load checks |
| `tests/e2e/auth.spec.ts` | Create — Auth flow tests |
| `tests/e2e/session-lifecycle.spec.ts` | Create — Session CRUD tests |
| `tests/e2e/checkin.spec.ts` | Create — Check-in/out tests |
| `tests/e2e/match-recording.spec.ts` | Create — Match CRUD tests |
| `tests/e2e/simple-mode.spec.ts` | Create — Simple mode toggle tests |
| `tests/e2e/tally.spec.ts` | Create — Tally entry tests |
| `tests/e2e/player-management.spec.ts` | Create — Player CRUD tests |
| `tests/e2e/leaderboard.spec.ts` | Create — Leaderboard tests |
| `tests/e2e/finals-setup.spec.ts` | Create — Finals setup + drag-and-drop tests |
| `tests/e2e/finals-matches.spec.ts` | Create — Finals match + standings tests |
| `tests/e2e/navigation.spec.ts` | Create — Nav + routing tests |
| `.env.test.local.example` | Create — Template for test credentials |
| `package.json` | Modify — Add test scripts |
| `CLAUDE.md` | Modify — Add testing section |
| `.gitignore` | Modify — Add `.env.test.local`, `test-results/`, `playwright-report/` |

## Acceptance Criteria
- [ ] `npm run test:smoke` passes — all pages load without errors
- [ ] `npm run test` runs full suite in < 10 minutes
- [ ] `npm run test:feature -- "session"` runs only session-related tests
- [ ] Tests use mobile viewport (iPhone 14, 390x844)
- [ ] Failed tests produce screenshots in `test-results/`
- [ ] Test data is cleaned up after each test file
- [ ] No test depends on another test's state (independent)
- [ ] CLAUDE.md documents when to run which tests
