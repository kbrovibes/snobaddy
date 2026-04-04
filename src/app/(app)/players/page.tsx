import { getAllPlayers } from "@/lib/db/players";
import { createClient } from "@/lib/supabase-server";
import { getTodaySession, getSessionPresence } from "@/lib/db/sessions";
import SkillEditor from "@/components/SkillEditor";
import AdminPresenceToggle from "@/components/AdminPresenceToggle";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: currentPlayer } = await supabase
    .from("players").select("is_admin").eq("user_id", user!.id).single();

  const isAdmin = currentPlayer?.is_admin ?? false;

  const [players, todaySession] = await Promise.all([
    getAllPlayers(),
    isAdmin ? getTodaySession() : Promise.resolve(null),
  ]);

  const presence = isAdmin && todaySession?.status === "active"
    ? await getSessionPresence(todaySession.id)
    : [];

  const presenceMap = new Map(presence.map((p) => [p.player_id, p]));
  const sessionActive = isAdmin && todaySession?.status === "active";

  return (
    <div className="px-4 py-4 pb-20">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
        <span className="text-sm text-gray-400">{players.length} players</span>
      </div>

      <div className="overflow-x-auto -mx-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="w-8 px-4 py-2 text-left text-xs font-medium text-gray-400">#</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Name</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-400 uppercase tracking-wide">Skill</th>
              {sessionActive ? (
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 uppercase tracking-wide">Presence</th>
              ) : (
                <>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 uppercase tracking-wide">W</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 uppercase tracking-wide">L</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {players.map((player, index) => {
              const p = presenceMap.get(player.id);
              const presenceStatus = !p ? "absent" : p.checked_out_at ? "checked-out" : "present";

              return (
                <tr key={player.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-xs font-medium text-gray-300 text-right">{index + 1}</td>
                  <td className="px-2 py-3">
                    <span className="flex items-center gap-1 min-w-0">
                      <span className="font-medium text-gray-900 truncate">{player.name}</span>
                      {player.is_admin && <span className="text-blue-400 text-xs shrink-0">★</span>}
                      {player.user_id && <span className="text-green-500 text-xs shrink-0" title="Verified account">✓</span>}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <SkillEditor playerId={player.id} current={player.skill_level} />
                  </td>
                  {sessionActive ? (
                    <td className="px-3 py-3 text-right">
                      <AdminPresenceToggle
                        sessionId={todaySession!.id}
                        playerId={player.id}
                        initialStatus={presenceStatus}
                      />
                    </td>
                  ) : (
                    <>
                      <td className="px-3 py-3 text-right tabular-nums text-gray-700">{player.wins}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-gray-700">{player.losses}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {players.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-12">
            No players yet.
          </p>
        )}
      </div>
    </div>
  );
}
