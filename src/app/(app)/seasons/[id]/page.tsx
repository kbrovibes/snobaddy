export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getSeasonById } from "@/lib/db/seasons";
import { getNewsletter } from "@/lib/db/newsletters";
import { getAllSessions, getSeasonStats } from "@/lib/db/sessions";
import { getAuthPlayer } from "@/lib/auth";
import LeaderboardData from "@/app/(app)/leaderboard/LeaderboardData";
import NavLink from "@/components/NavLink";
import type { SessionRow } from "@/lib/db/sessions";

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function fmtRange(start: string, end: string) {
  const f = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${f(start)} – ${f(end)}`;
}

const SEASON_STATUS = {
  active:    { text: "Active",    cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" },
  upcoming:  { text: "Upcoming",  cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400" },
  completed: { text: "Completed", cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400" },
};

function TableSkeleton() {
  return (
    <div className="bg-surface rounded-xl border border-border-light overflow-hidden animate-pulse">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex gap-2 px-3 py-2.5 border-b border-border-light last:border-0">
          <div className="h-4 w-5 bg-border-light rounded" />
          <div className="h-4 w-24 bg-border-light rounded flex-1" />
          <div className="h-4 w-5 bg-border-light rounded" />
          <div className="h-4 w-5 bg-border-light rounded" />
          <div className="h-4 w-8 bg-border-light rounded" />
        </div>
      ))}
    </div>
  );
}

function SessionItem({ s, seasonStatus }: { s: SessionRow; seasonStatus: string }) {
  const badge =
    s.status === "active" ? (
      <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-white bg-sky-700 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
        In Progress
      </span>
    ) : s.status === "pending" ? (
      seasonStatus === "completed" ? (
        <span className="text-xs font-semibold uppercase tracking-wide text-stone-400 bg-stone-100 dark:bg-stone-500/10 dark:text-stone-400 px-2 py-0.5 rounded-full">
          Not Held
        </span>
      ) : (
        <span className="text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 px-2 py-0.5 rounded-full">
          Upcoming
        </span>
      )
    ) : s.match_count === 0 && s.tally_count === 0 ? (
      <span className="text-xs font-semibold uppercase tracking-wide text-red-400 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-full">
        No Data
      </span>
    ) : (
      <span className="text-xs font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 px-2 py-0.5 rounded-full">
        Finalized
      </span>
    );

  return (
    <NavLink
      href={`/session/${s.id}`}
      className="flex items-center justify-between px-4 py-3 border-b border-border-light last:border-0 hover:bg-surface-alt active:bg-sky-50 dark:active:bg-sky-500/10 transition-colors"
    >
      <span className="text-sm text-text">{fmtDate(s.date)}</span>
      <div className="flex items-center gap-2">
        {badge}
        <span className="text-muted-lighter text-sm">→</span>
      </div>
    </NavLink>
  );
}

export default async function SeasonSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [season, authPlayer] = await Promise.all([
    getSeasonById(id),
    getAuthPlayer(),
  ]);

  if (!season) notFound();

  const isAdmin = authPlayer?.isAdmin ?? false;
  const sessions = await getAllSessions(season.id);

  const real = sessions.filter((s) => !s.is_test_session);
  const realCompleted = real.filter((s) => s.status === "completed");
  const daysOfPlay = realCompleted.length;

  const [{ playerCount, matchCount }, newsletter] = await Promise.all([
    getSeasonStats(realCompleted.map((s) => s.id)),
    getNewsletter(season.id),
  ]);

  const statusInfo = SEASON_STATUS[season.status];

  // Session list: pending first (ascending), then completed (descending)
  const pendingSessions = real
    .filter((s) => s.status === "pending")
    .sort((a, b) => a.date.localeCompare(b.date));
  const pastSessions = real
    .filter((s) => s.status !== "pending")
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="flex flex-col px-4 py-4 gap-4 pb-24">

      {/* Back link */}
      <NavLink href="/" className="text-xs text-sky-600 dark:text-sky-400 hover:underline px-1 self-start">
        ← Sessions
      </NavLink>

      {/* Season header */}
      <div className="px-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-lg font-bold text-heading">{season.name}</h1>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusInfo.cls}`}>
            {statusInfo.text}
          </span>
        </div>
        <p className="text-xs text-muted-light mt-0.5">{fmtRange(season.start_date, season.end_date)}</p>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { emoji: "🏸", label: "Players",     value: playerCount,  unit: "this season" },
          { emoji: "🎯", label: "Matches",      value: matchCount,   unit: "played"      },
          { emoji: "📅", label: "Days of Play", value: daysOfPlay,   unit: "sessions"    },
        ].map(({ emoji, label, value, unit }) => (
          <div
            key={label}
            className="bg-surface rounded-xl shadow-sm border border-border-light px-3 py-3 flex flex-col items-center gap-0.5 text-center"
          >
            <span className="text-xl">{emoji}</span>
            <span className="text-2xl font-bold text-heading leading-none">{value}</span>
            <span className="text-xs font-semibold text-text leading-tight">{label}</span>
            <span className="text-[10px] text-muted-light leading-tight">{unit}</span>
          </div>
        ))}
      </div>

      {/* Newsletter card */}
      {isAdmin && newsletter && (
        <NavLink
          href={`/admin/seasons/${season.id}/newsletter`}
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface shadow-sm border border-border-light hover:bg-surface-alt active:bg-sky-50 dark:active:bg-sky-500/10 transition-colors"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-stone-900 dark:bg-sky-600 text-white flex-shrink-0">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 4.5 H17 a1.5 1.5 0 0 1 1.5 1.5 V18 a1.5 1.5 0 0 1 -1.5 1.5 H6.5 A1.5 1.5 0 0 1 5 18 V4.5 Z" />
              <path d="M18.5 9.5 H21 a0.5 0.5 0 0 1 0.5 0.5 V18 a1.5 1.5 0 0 1 -1.5 1.5 H18.5" />
              <rect x="7" y="6.5" width="8" height="2" rx="0.4" />
              <path d="M7 11.2 H15 M7 13.4 H15 M7 15.6 H13" />
            </svg>
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-semibold text-heading">Season newsletter</span>
            <span className="text-xs text-muted-light">Stats, awards, and observations from this season</span>
          </div>
          <span className="text-muted-lighter text-sm">→</span>
        </NavLink>
      )}

      {/* Season leaderboard — only when there is data */}
      {daysOfPlay > 0 && (
        <Suspense fallback={<TableSkeleton />}>
          <LeaderboardData
            seasonId={season.id}
            seasonLockDate={season.stats_lock_date}
            isAdmin={isAdmin}
            showFullNames
            sectionLabel="Season Leaderboard"
          />
        </Suspense>
      )}

      {/* Session list — collapsed by default */}
      {real.length > 0 && (
        <details className="group">
          <summary className="flex items-center justify-between px-1 mb-2 cursor-pointer list-none">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-light">
              Sessions <span className="font-normal text-muted-lighter">({real.length})</span>
            </p>
            <span className="text-muted-lighter text-xs transition-transform group-open:rotate-180">▼</span>
          </summary>
          <div className="bg-surface rounded-xl shadow-sm overflow-hidden">
            {pendingSessions.map((s) => (
              <SessionItem key={s.id} s={s} seasonStatus={season.status} />
            ))}
            {pastSessions.map((s) => (
              <SessionItem key={s.id} s={s} seasonStatus={season.status} />
            ))}
          </div>
        </details>
      )}

      {real.length === 0 && (
        <p className="text-sm text-muted-light text-center py-8">No sessions yet this season.</p>
      )}

    </div>
  );
}
