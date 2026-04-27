import { redirect } from "next/navigation";
import { getActiveSession, getAllSessions } from "@/lib/db/sessions";
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

  return (
    <div className="flex flex-col px-4 py-4 gap-4">

      <p className="text-xs font-semibold uppercase tracking-wide text-muted-light px-1">{seasonName}</p>

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
