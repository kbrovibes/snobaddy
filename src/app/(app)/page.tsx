import { redirect } from "next/navigation";
import Image from "next/image";
import { getActiveSession, getAllSessions } from "@/lib/db/sessions";
import { getActiveFinals, getFinalsSessionPair } from "@/lib/db/finals";
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
    .select("is_admin, is_god_mode")
    .eq("user_id", user!.id)
    .maybeSingle();
  const isAdmin = currentPlayer?.is_admin ?? false;
  const isGodMode =
    (currentPlayer as unknown as { is_god_mode?: boolean } | null)?.is_god_mode ?? false;

  const [sessions, finalsEvent] = await Promise.all([
    getAllSessions(),
    isGodMode ? getActiveFinals() : Promise.resolve(null),
  ]);
  const finalsSessionPair = finalsEvent
    ? await getFinalsSessionPair(finalsEvent.finals1_session_id, finalsEvent.finals2_session_id)
    : null;
  const seasonName = sessions[0]?.season?.name ?? "Sessions";

  return (
    <div className="flex flex-col px-4 py-4 gap-4">

      <div className="flex items-center gap-3">
        <Image src="/serve-logo.jpg" alt="Serve Sports" width={52} height={52} className="rounded-xl shrink-0" />
        <div>
          <h1 className="text-lg font-bold text-stone-900 leading-tight">{seasonName}</h1>
          <p className="text-sm text-stone-500">No active session</p>
        </div>
      </div>

      {isGodMode && <FinalsSection event={finalsEvent} sessionPair={finalsSessionPair} />}

      <SessionListClient sessions={sessions} isAdmin={isAdmin} />

      {isAdmin && (
        <div className="flex justify-center pt-2">
          <CreateSessionButton />
        </div>
      )}

    </div>
  );
}
