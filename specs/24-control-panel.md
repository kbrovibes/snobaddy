# Spec 24: God Mode Control Panel

## What it does
A live metrics dashboard page at `/admin/control-panel`, accessible only to God Mode users. Shows the health and usage of the app's underlying infrastructure (Supabase database, Vercel hosting) in one place without needing to open external dashboards.

## What it does NOT do
- No ability to modify data, run migrations, or change settings
- No historical trend graphs — point-in-time snapshot only
- No alerts or notifications

## Data / DB changes
None. All data is pulled from external APIs at request time.

## API
No new internal routes. Page uses server-side fetches to:
- `api.supabase.com/v1/projects/{ref}/database/query` — DB size, table row counts, auth user count
- `api.vercel.com/v2/user` — account plan
- `api.vercel.com/v6/deployments` — last 5 deployments

## UI
Page at `/admin/control-panel`, linked from the Admin Panel page (God Mode users only).

```
┌─────────────────────────────────────┐
│ Control Panel              GOD MODE │
├─────────────────────────────────────┤
│ Supabase — Database                 │
│  DB size      8 MB / 500 MB         │
│  ██░░░░░░░░░░░  2%                  │
│  Auth users   12                    │
├─────────────────────────────────────┤
│ Supabase — Table Rows               │
│  players          28   8 kB         │
│  sessions         14   16 kB        │
│  matches         312   64 kB        │
│  ...                                │
├─────────────────────────────────────┤
│ Vercel — Account                    │
│  Plan         Hobby                 │
├─────────────────────────────────────┤
│ Vercel — Recent Deployments         │
│  snobaddy.vercel.app   Apr 6  Ready │
│  ...                                │
└─────────────────────────────────────┘
```

## Files to create/modify
| File | Action |
|---|---|
| `src/app/(app)/admin/control-panel/page.tsx` | Create — God Mode guard, metrics fetch, UI |
| `src/components/AdminPageContent.tsx` | Modify — add Control Panel link card for God Mode users |
| `src/app/(app)/layout.tsx` | Modify — fetch `is_god_mode` for layout |

## Environment variables required
| Variable | Purpose |
|---|---|
| `SUPABASE_MGMT_TOKEN` | Supabase Management API personal access token |
| `SUPABASE_PROJECT_ID` | Supabase project reference ID |
| `VERCEL_API_TOKEN` | Vercel personal access token |
| `VERCEL_PROJECT_ID` | Vercel project ID (optional; enables deployment list) |

## Acceptance Criteria
- [x] Page is only reachable by `is_god_mode = true` users; others are redirected to `/`
- [x] Supabase DB size shown with progress bar vs 500 MB free tier; bar turns red at ≥80%
- [x] Per-table row counts shown for all app tables
- [x] Auth user count shown
- [x] Vercel plan shown when `VERCEL_API_TOKEN` is set
- [x] Recent deployments shown when `VERCEL_PROJECT_ID` is set
- [x] Entry point is a card at the top of the Admin Panel page (not the header)
