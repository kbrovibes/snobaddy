import { redirect } from "next/navigation";
import { getActiveSession, getAllSessions, getSeasonStats } from "@/lib/db/sessions";
import { getActiveFinals, getAllFinals, getFinalsSessionPair } from "@/lib/db/finals";
import { createClient } from "@/lib/supabase-server";
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

  if (!list) {
    const active = await getActiveSession();
    if (active) redirect(`/session/${active.id}`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: currentPlayer } = await supabase
    .from("players")
    .select("is_admin")
    .eq("user_id", user!.id)
    .maybeSingle();
  const isAdmin = currentPlayer?.is_admin ?? false;

  const [sessions, allFinalsEvents] = await Promise.all([
    getAllSessions(),
    isAdmin ? getAllFinals() : Promise.resolve([]),
  ]);
  // Current = most recent non-completed, or most recent overall
  const finalsEvent = allFinalsEvents.find((e) => e.status !== "completed") ?? allFinalsEvents[0] ?? null;
  const pastFinalsEvents = allFinalsEvents.filter((e) => e.id !== finalsEvent?.id);
  const finalsSessionPair = finalsEvent
    ? await getFinalsSessionPair(finalsEvent.finals1_session_id, finalsEvent.finals2_session_id)
    : null;
  const seasonName = sessions[0]?.season?.name ?? "Sessions";

  // Season stats — non-test completed sessions only (finals already excluded by getAllSessions)
  const realCompleted = sessions.filter((s) => !s.is_test_session && s.status === "completed");
  const daysOfPlay = realCompleted.length;
  const { playerCount, matchCount: totalMatches } = await getSeasonStats(realCompleted.map((s) => s.id));

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

      <SessionListClient sessions={sessions} isAdmin={isAdmin} />

      {isAdmin && sessions.length <= 5 && (
        <div className="flex justify-center pt-2">
          <CreateSessionButton />
        </div>
      )}

    </div>
  );
}
