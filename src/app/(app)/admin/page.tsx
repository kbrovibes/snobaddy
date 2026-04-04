import { getAllPlayers } from "@/lib/db/players";
import { createClient } from "@/lib/supabase-server";
import { getTodaySession, getSessionPresence } from "@/lib/db/sessions";
import { redirect } from "next/navigation";
import PlayerCheckinCard from "@/components/PlayerCheckinCard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: currentPlayer } = await supabase
    .from("players").select("is_admin").eq("user_id", user!.id).single();

  if (!currentPlayer?.is_admin) redirect("/");

  const [players, todaySession] = await Promise.all([
    getAllPlayers(),
    getTodaySession(),
  ]);

  const presence = todaySession?.status === "active"
    ? await getSessionPresence(todaySession.id)
    : [];

  const presenceMap = new Map(presence.map((p) => [p.player_id, p]));
  const sessionActive = todaySession?.status === "active";

  return (
    <div className="px-4 py-4 pb-20">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
        <span className="text-sm text-gray-400">{players.length} players</span>
      </div>

      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Player Check-ins
        {sessionActive && (
          <span className="ml-2 normal-case font-normal text-green-600">· Session active</span>
        )}
      </h2>

      {players.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-12">No players yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {players.map((player) => {
            const p = presenceMap.get(player.id);
            const initialStatus = !p ? "absent" : p.checked_out_at ? "checked-out" : "present";

            return (
              <PlayerCheckinCard
                key={player.id}
                playerId={player.id}
                name={player.name}
                skillLevel={player.skill_level}
                isAdminPlayer={player.is_admin ?? false}
                hasUserAccount={!!player.user_id}
                wins={player.wins}
                losses={player.losses}
                sessionId={sessionActive ? todaySession!.id : undefined}
                initialStatus={initialStatus}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
