import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveSession, getAllSessions, getSeasonStats } from "@/lib/db/sessions";
import { getActiveSeason, getLastCompletedSeason } from "@/lib/db/seasons";
import { getAllFinals, getFinalsSessionPair } from "@/lib/db/finals";
import { getAuthPlayer } from "@/lib/auth";
import { getNewsletter } from "@/lib/db/newsletters";
import CreateSessionButton from "@/components/CreateSessionButton";
import FinalsSection from "@/components/finals/FinalsSection";
import SessionListClient from "./SessionListClient";

export const dynamic = "force-dynamic";


export default async function SessionListPage({
  searchParams,
}: {
  searchParams: Promise<{ list?: string }>;
}) {
  const { list } = await searchParams;

  // Parallelize all independent initial queries (auth is cached via React.cache)
  const [activeSession, activeSeason, authPlayer] = await Promise.all([
    list ? Promise.resolve(null) : getActiveSession(),
    getActiveSeason(),
    getAuthPlayer(),
  ]);

  if (!list && activeSession) redirect(`/session/${activeSession.id}`);

  const isAdmin = authPlayer?.isAdmin ?? false;

  // If no active season, show empty state (god mode can go create one)
  if (!activeSeason) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-16 gap-4 text-center">
        <span className="text-4xl">📅</span>
        <h2 className="text-lg font-bold text-heading">No Active Season</h2>
        <p className="text-sm text-muted-light max-w-xs">
          There is no season currently running. {isAdmin ? "An admin with god mode can start one from the Seasons page." : "Check back soon!"}
        </p>
      </div>
    );
  }

  const [sessions, allFinalsEvents] = await Promise.all([
    getAllSessions(activeSeason.id),
    isAdmin ? getAllFinals() : Promise.resolve([]),
  ]);
  // Scope finals to the active season only
  const seasonFinalsEvents = allFinalsEvents.filter((e) => e.season_id === activeSeason.id);
  // Current = most recent non-completed, or most recent overall
  const finalsEvent = seasonFinalsEvents.find((e) => e.status !== "completed") ?? seasonFinalsEvents[0] ?? null;
  const pastFinalsEvents = seasonFinalsEvents.filter((e) => e.id !== finalsEvent?.id);
  const seasonName = sessions[0]?.season?.name ?? "Sessions";

  // Season stats + finals session pair — independent, run in parallel
  const realCompleted = sessions.filter((s) => !s.is_test_session && s.status === "completed");
  const daysOfPlay = realCompleted.length;
  const showSeasonHero = sessions.length > 0;
  const isEarlySeason = daysOfPlay < 2;

  const [{ playerCount, matchCount: totalMatches }, finalsSessionPair, lastSeason] = await Promise.all([
    getSeasonStats(realCompleted.map((s) => s.id)),
    finalsEvent
      ? getFinalsSessionPair(finalsEvent.finals1_session_id, finalsEvent.finals2_session_id)
      : Promise.resolve(null),
    isEarlySeason ? getLastCompletedSeason() : Promise.resolve(null),
  ]);

  function fmtDate(dateStr: string) {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <div className="flex flex-col px-4 py-4 gap-4">

      {/* Season hero banner */}
      {showSeasonHero && (
        <div className="relative rounded-2xl overflow-hidden shadow-lg">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-blue-50 to-slate-200 dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-950" />
          {/* Dot texture */}
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{ backgroundImage: "radial-gradient(circle, #64748b 1px, transparent 1px)", backgroundSize: "18px 18px" }}
          />
          {/* Decorative racket — big, faded, rotated */}
          <span className="absolute -top-2 right-3 text-7xl opacity-[0.12] select-none rotate-[20deg] pointer-events-none dark:opacity-[0.15]">🏸</span>

          <div className="relative px-5 py-7 flex flex-col gap-3">
            <h2 className="text-[1.6rem] font-extrabold text-slate-800 dark:text-zinc-100 leading-snug">
              {seasonName}<br />{daysOfPlay === 0 ? "Starting Soon" : "Is Underway"}
            </h2>

            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {fmtDate(activeSeason.start_date)} – {fmtDate(activeSeason.end_date)}
              </p>
              {isEarlySeason && daysOfPlay > 0 && (
                <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 bg-slate-800/10 dark:bg-white/[0.08] px-2 py-0.5 rounded-full">
                  {daysOfPlay}/2 sessions in
                </span>
              )}
            </div>

            {isEarlySeason && lastSeason && (
              <div className="flex flex-col gap-1 pt-1 border-t border-slate-200/60 dark:border-zinc-700/60">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-600">
                  Previous Season
                </p>
                <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 dark:text-zinc-500">
                  <Link href={`/seasons/${lastSeason.id}`} className="transition-colors hover:text-slate-800 dark:hover:text-zinc-200">
                    {lastSeason.name} Stats
                  </Link>
                  {lastSeason.has_newsletter && (
                    <>
                      <span className="text-slate-300 dark:text-zinc-700">·</span>
                      <Link href={`/admin/seasons/${lastSeason.id}/newsletter`} className="transition-colors hover:text-slate-800 dark:hover:text-zinc-200">
                        Newsletter
                      </Link>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Season stat cards */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { emoji: "🏸", label: "Players", value: playerCount, unit: "this season" },
          { emoji: "🎯", label: "Matches", value: totalMatches, unit: "played" },
          { emoji: "📅", label: "Days of Play", value: daysOfPlay, unit: "sessions" },
        ].map(({ emoji, label, value, unit }) => (
          <div key={label} className="bg-surface rounded-xl shadow-sm border border-border-light px-3 py-3 flex flex-col items-center gap-0.5 text-center">
            <span className="text-xl">{emoji}</span>
            <span className="text-2xl font-bold text-heading leading-none">{value}</span>
            <span className="text-xs font-semibold text-text leading-tight">{label}</span>
            <span className="text-[10px] text-muted-light leading-tight">{unit}</span>
          </div>
        ))}
      </div>

      {isAdmin && <FinalsSection event={finalsEvent} sessionPair={finalsSessionPair} pastEvents={pastFinalsEvents} />}

      {isAdmin && sessions.length > 5 && (
        <div className="flex justify-center">
          <CreateSessionButton />
        </div>
      )}

      <SessionListClient
        sessions={sessions}
        isAdmin={isAdmin}
        seasonLockDate={activeSeason.stats_lock_date ?? null}
        activeSeasonId={activeSeason.id}
        activeSeasonHasNewsletter={Boolean(await getNewsletter(activeSeason.id))}
      />

      {isAdmin && sessions.length <= 5 && (
        <div className="flex justify-center pt-2">
          <CreateSessionButton />
        </div>
      )}

    </div>
  );
}
