import { getAllPlayers } from "@/lib/db/players";
import { createClient } from "@/lib/supabase-server";
import { getTodaySession, getSessionPresence } from "@/lib/db/sessions";
import SkillEditor from "@/components/SkillEditor";
import AdminPresenceToggle from "@/components/AdminPresenceToggle";

export const dynamic = "force-dynamic";

function SkillDots({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`text-sm ${i <= level ? "text-blue-500" : "text-gray-200"}`}>●</span>
      ))}
    </div>
  );
}

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

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Players</h1>
        <span className="text-sm text-gray-400">{players.length} registered</span>
      </div>

      {isAdmin && todaySession?.status === "active" && (
        <p className="text-xs text-blue-600 mb-3 font-medium">
          Session active · tap to check in or out
        </p>
      )}

      <div className="flex flex-col gap-2">
        {players.map((player, index) => {
          const p = presenceMap.get(player.id);
          const presenceStatus = !p ? "absent" : p.checked_out_at ? "checked-out" : "present";

          return (
            <div
              key={player.id}
              className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm"
            >
              <span className="text-sm font-bold text-gray-300 w-5 text-right shrink-0">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 flex items-center gap-1 min-w-0">
                  <span className="truncate">{player.name}</span>
                  {player.is_admin && <span className="text-blue-400 text-xs shrink-0">★</span>}
                </div>
                {isAdmin ? (
                  <SkillEditor playerId={player.id} current={player.skill_level} />
                ) : (
                  <SkillDots level={player.skill_level} />
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {isAdmin && todaySession?.status === "active" && (
                  <AdminPresenceToggle
                    sessionId={todaySession.id}
                    playerId={player.id}
                    initialStatus={presenceStatus}
                  />
                )}
                {(!isAdmin || todaySession?.status !== "active") && (
                  <div className="flex gap-3 text-center">
                    <div>
                      <div className="text-sm font-bold text-gray-900">{player.wins}</div>
                      <div className="text-xs text-gray-400">W</div>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900">{player.losses}</div>
                      <div className="text-xs text-gray-400">L</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {players.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-12">
            No players yet. Players appear here after signing in for the first time.
          </p>
        )}
      </div>
    </div>
  );
}
