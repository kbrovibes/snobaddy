import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { getFinalsById, getFinalsParticipants, getFinalsSessionPair } from "@/lib/db/finals";
import type { FinalsSessionPair } from "@/lib/db/finals";
import { getActivePlayers } from "@/lib/db/players";
import FinalsEventTabs from "./FinalsEventTabs";

export const dynamic = "force-dynamic";

export default async function FinalsEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: currentPlayer } = await supabase
    .from("players")
    .select("id, is_admin")
    .eq("user_id", user!.id)
    .maybeSingle();

  const isAdmin = currentPlayer?.is_admin ?? false;

  if (!isAdmin) redirect("/");

  const event = await getFinalsById(id);
  if (!event) redirect("/");

  const [allPlayers, participants, sessionPair] = await Promise.all([
    getActivePlayers(),
    getFinalsParticipants(id),
    getFinalsSessionPair(event.finals1_session_id, event.finals2_session_id),
  ]);

  return (
    <div className="flex flex-col px-4 py-4 gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/?list=1" className="text-sky-600 hover:text-sky-800 text-sm">
          &lt; Sessions
        </Link>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <span className="text-xl">🏆</span>
          <h1 className="text-xl font-bold text-stone-900">{event.name}</h1>
        </div>
        {event.season && (
          <p className="text-sm text-stone-400 mt-0.5 ml-8">{event.season.name}</p>
        )}
      </div>

      <FinalsEventTabs
        event={event}
        allPlayers={allPlayers}
        participants={participants}
        sessionPair={sessionPair}
      />
    </div>
  );
}
