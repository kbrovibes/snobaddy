import { redirect } from "next/navigation";
import { getActiveSession, getAllSessions, getSeasonStats } from "@/lib/db/sessions";
import { getActiveSeason } from "@/lib/db/seasons";
import { getAllFinals, getFinalsSessionPair } from "@/lib/db/finals";
import { getAuthPlayer } from "@/lib/auth";
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
  // Current = most recent non-completed, or most recent overall
  const finalsEvent = allFinalsEvents.find((e) => e.status !== "completed") ?? allFinalsEvents[0] ?? null;
  const pastFinalsEvents = allFinalsEvents.filter((e) => e.id !== finalsEvent?.id);
  const seasonName = sessions[0]?.season?.name ?? "Sessions";

  // Season stats + finals session pair — independent, run in parallel
  const realCompleted = sessions.filter((s) => !s.is_test_session && s.status === "completed");
  const daysOfPlay = realCompleted.length;
  const [{ playerCount, matchCount: totalMatches }, finalsSessionPair] = await Promise.all([
    getSeasonStats(realCompleted.map((s) => s.id)),
    finalsEvent
      ? getFinalsSessionPair(finalsEvent.finals1_session_id, finalsEvent.finals2_session_id)
      : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-col px-4 py-4 gap-4">

      <p className="text-xs font-semibold uppercase tracking-wide text-muted-light px-1">{seasonName}</p>

      {/* Season stat cards */}
      {daysOfPlay > 0 && (
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
      )}

      {isAdmin && <FinalsSection event={finalsEvent} sessionPair={finalsSessionPair} pastEvents={pastFinalsEvents} />}

      {isAdmin && sessions.length > 5 && (
        <div className="flex justify-center">
          <CreateSessionButton />
        </div>
      )}

      <SessionListClient sessions={sessions} isAdmin={isAdmin} seasonLockDate={activeSeason.stats_lock_date ?? null} activeSeasonId={activeSeason.id} />

      {isAdmin && sessions.length <= 5 && (
        <div className="flex justify-center pt-2">
          <CreateSessionButton />
        </div>
      )}

    </div>
  );
}
