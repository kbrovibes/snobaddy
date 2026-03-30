import { getAllPlayers } from "@/lib/db/players";
import { createClient } from "@/lib/supabase-server";
import SkillEditor from "@/components/SkillEditor";

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
  const [players, supabase] = await Promise.all([
    getAllPlayers(),
    createClient(),
  ]);

  const { data: { user } } = await supabase.auth.getUser();
  const { data: currentPlayer } = await supabase
    .from("players")
    .select("is_admin")
    .eq("user_id", user!.id)
    .single();

  const isAdmin = currentPlayer?.is_admin ?? false;

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Players</h1>
        <span className="text-sm text-gray-400">{players.length} registered</span>
      </div>

      <div className="flex flex-col gap-2">
        {players.map((player, index) => (
          <div
            key={player.id}
            className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm"
          >
            <span className="text-sm font-bold text-gray-300 w-5 text-right">
              {index + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-900 truncate">{player.name}</div>
              {isAdmin ? (
                <SkillEditor playerId={player.id} current={player.skill_level} />
              ) : (
                <SkillDots level={player.skill_level} />
              )}
            </div>
            <div className="flex gap-4 text-center shrink-0">
              <div>
                <div className="text-sm font-bold text-gray-900">{player.wins}</div>
                <div className="text-xs text-gray-400">W</div>
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900">{player.losses}</div>
                <div className="text-xs text-gray-400">L</div>
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900">{player.matches_played}</div>
                <div className="text-xs text-gray-400">played</div>
              </div>
            </div>
          </div>
        ))}

        {players.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-12">
            No players yet. Players appear here after signing in for the first time.
          </p>
        )}
      </div>
    </div>
  );
}
