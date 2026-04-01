# Chapter 7: Supabase Backups & Fault Tolerance

> How to ensure SnoBaddy data is safe from "fat-finger" deletes, corruption, or regional outages.

---

## Backup Strategies: RPO and RTO

When thinking about backups, we consider two metrics:
- **RPO (Recovery Point Objective):** How much data can we afford to lose? (e.g., "1 hour of matches").
- **RTO (Recovery Time Objective):** How long can the app be down while we restore? (e.g., "15 minutes").

---

## 1. Daily Backups (The Default)
By default, Supabase Pro projects get daily snapshots stored for 7 days.
- **RPO:** Up to 24 hours. (If a crash happens at 11 PM and the backup was at 2 AM, we lose the whole day).
- **Best Use:** Recovering from a catastrophic project-wide failure that happened yesterday.

---

## 2. Point-in-Time Recovery (PITR) — RECOMMENDED
PITR is the "Gold Standard" for production. It continuously streams changes to S3.
- **RPO:** < 2 minutes.
- **Feature:** You can restore the database to **any specific second** in the last 7 days.
- **Scenario:** You accidentally run `DELETE FROM matches;` at 8:45:12 PM. You can restore the database to exactly 8:45:11 PM and lose **zero** actual data.

---

## 3. Manual Logical Backups (`pg_dump`)
Relying solely on Supabase's managed backups leaves you vulnerable to a **Regional Outage** (e.g., if the entire AWS `us-west-2` region goes dark).

**Best Practice:** Create an external backup in a different cloud provider or region.

**Automation via GitHub Actions:**
```yaml
name: Nightly External Backup
on:
  schedule:
    - cron: '0 0 * * *' # Every night at midnight
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          pg_dump -h db.${PROJECT_ID}.supabase.co -U postgres > backup.sql
          # Now upload backup.sql to Amazon S3 or Google Cloud Storage in a DIFFERENT region.
        env:
          PGPASSWORD: ${{ secrets.DB_PASSWORD }}
```

---

## 4. Disaster Recovery (DR) Procedure

If the production database is corrupted or deleted, follow these steps:

1. **Pause Traffic:** Disable your Vercel deployment (or redirect to a maintenance page).
2. **Restore Options:**
   - **Option A (Managed):** Use the Supabase Dashboard → Database → Backups → Restore. (Note: This creates a **new** project; you'll need to update your Vercel env vars with the new Project URL).
   - **Option B (PITR):** Contact Supabase Support or use the self-service PITR tool (if enabled) to roll back the current project in place.
3. **Verify Data:** Log in to the new database and check the `matches` and `players` tables.
4. **Update Vercel:** Point your production env vars to the new project and redeploy.

---

## The "3-2-1" Rule for SnoBaddy
To ensure we never lose the club's history:
- **3** copies of the data (Supabase, GitHub SQL exports, S3 backup).
- **2** different media/platforms (Supabase Cloud, Amazon S3).
- **1** offsite/different region (Database in US-West, Backup in US-East).

---

## Critical Note: Storage is Separate!
**Database backups do NOT include files in Supabase Storage** (e.g., any player profile photos we might add in the future). Those must be backed up separately by syncing the S3 buckets.
