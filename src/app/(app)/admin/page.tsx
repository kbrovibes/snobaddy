import { getActivePlayers, getDeletedPlayers } from "@/lib/db/players";
import { createClient } from "@/lib/supabase-server";
import { getTodaySession, getSessionPresence } from "@/lib/db/sessions";
import { redirect } from "next/navigation";
import PlayerCheckinCard from "@/components/PlayerCheckinCard";
import AddPlayerForm from "@/components/AddPlayerForm";
import DeletePlayerButton from "@/components/DeletePlayerButton";
import RestorePlayerButton from "@/components/RestorePlayerButton";

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

  const presenceMap = new Map(presence.map((p) => [p.player_id, p]));
  const sessionActive = todaySession?.status === "active";

  return (
    <div className="px-4 py-4 pb-20">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
        <span className="text-sm text-gray-400">{players.length} active</span>
      </div>

      <AddPlayerForm />

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
              <div key={player.id} className="flex flex-col gap-1">
                <PlayerCheckinCard
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
                <DeletePlayerButton playerId={player.id} playerName={player.name} />
              </div>
            );
          })}
        </div>
      )}

      {isGodMode && deletedPlayers.length > 0 && (
        <details className="mt-8">
          <summary className="text-sm font-semibold text-gray-400 cursor-pointer select-none py-2 list-none flex items-center gap-1">
            <span>▶</span>
            <span>Removed players ({deletedPlayers.length})</span>
          </summary>
          <div className="mt-2 space-y-2">
            {deletedPlayers.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 opacity-60"
              >
                <div>
                  <span className="text-sm text-gray-500 font-medium">{player.name}</span>
                  <div className="flex gap-0.5 mt-0.5">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <span
                        key={level}
                        className={`text-sm leading-none ${
                          level <= player.skill_level ? "text-gray-400" : "text-gray-200"
                        }`}
                      >
                        ●
                      </span>
                    ))}
                  </div>
                </div>
                <RestorePlayerButton playerId={player.id} />
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
