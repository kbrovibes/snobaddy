import { getActivePlayers, getDeletedPlayers } from "@/lib/db/players";
import { createClient } from "@/lib/supabase-server";
import { getTodaySession, getSessionPresence } from "@/lib/db/sessions";
import { redirect } from "next/navigation";
import AdminPageContent from "@/components/AdminPageContent";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: currentPlayer } = await supabase
    .from("players").select("is_admin, is_god_mode").eq("user_id", user!.id).single();

  if (!currentPlayer?.is_admin) redirect("/");

  const isGodMode = currentPlayer?.is_god_mode ?? false;

  const [players, deletedPlayers, todaySession] = await Promise.all([
    getActivePlayers(),
    isGodMode ? getDeletedPlayers() : Promise.resolve([]),
    getTodaySession(),
  ]);

  const presence = todaySession?.status === "active"
    ? await getSessionPresence(todaySession.id)
    : [];

  return (
    <AdminPageContent
      players={players}
      deletedPlayers={deletedPlayers}
      presence={presence}
      sessionId={todaySession?.status === "active" ? todaySession.id : undefined}
      sessionActive={todaySession?.status === "active"}
      isGodMode={isGodMode}
    />
  );
}
