import { getActivePlayers, getDeletedPlayers } from "@/lib/db/players";
import { createClient } from "@/lib/supabase-server";
import { getActiveSession, getSessionPresence } from "@/lib/db/sessions";
import AdminPageContent from "@/components/AdminPageContent";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: currentPlayer } = await supabase
    .from("players").select("is_admin, is_god_mode").eq("user_id", user!.id).single();

  const isAdmin = currentPlayer?.is_admin ?? false;
  const isGodMode = currentPlayer?.is_god_mode ?? false;

  const [players, deletedPlayers, activeSession] = await Promise.all([
    getActivePlayers(),
    isGodMode ? getDeletedPlayers() : Promise.resolve([]),
    getActiveSession(),
  ]);

  const presence = activeSession
    ? await getSessionPresence(activeSession.id)
    : [];

  return (
    <AdminPageContent
      players={players}
      deletedPlayers={deletedPlayers}
      presence={presence}
      sessionId={activeSession?.id}
      sessionDate={activeSession?.date}
      sessionActive={!!activeSession}
      isAdmin={isAdmin}
      isGodMode={isGodMode}
    />
  );
}
