export const dynamic = "force-dynamic";

import { getActivePlayers } from "@/lib/db/players";
import { getSeasonMatchCount } from "@/lib/db/matches";
import LeaderboardTable from "./LeaderboardTable";
import { buildNameMap, shortName } from "@/lib/display-name";
import { createClient } from "@/lib/supabase-server";

interface AwardCardProps {
  emoji: string;
  title: string;
  description: string;
  name: string;
  stat: string;
}

function AwardCard({ emoji, title, description, name, stat }: AwardCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 flex flex-col items-center gap-1 text-center">
      <span className="text-2xl">{emoji}</span>
      <span className="text-xs font-semibold text-gray-700 leading-tight min-h-[2rem] flex items-center justify-center">{title}</span>
      <span className="text-xs text-gray-400 leading-tight min-h-[2rem] flex items-center justify-center">{description}</span>
      <span className="text-base font-bold text-gray-900 leading-tight mt-1">{name}</span>
      <span className="text-xs text-gray-400">{stat}</span>
    </div>
  );
}

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: currentPlayer } = await supabase
    .from("players").select("is_admin").eq("user_id", user!.id).maybeSingle();
  const isAdmin = currentPlayer?.is_admin ?? false;

  const [allPlayers, allPlayersWithTest, totalMatches, totalMatchesWithTest] = await Promise.all([
    getActivePlayers(),
    getActivePlayers({ includeTestSessions: true }),
    getSeasonMatchCount(),
    getSeasonMatchCount({ includeTestSessions: true }),
  ]);

  const activePlayers = allPlayers.filter(p => p.matches_played > 0);
  const activePlayersWithTest = allPlayersWithTest.filter(p => p.matches_played > 0);

  const nameMap = buildNameMap(activePlayers.map(p => p.name));

  // Badminton Nut: most matches played
  const badmintonNut = activePlayers.reduce<typeof activePlayers[0] | null>(
    (best, p) => !best || p.matches_played > best.matches_played ? p : best,
    null
  );

  // Nut Cracker: best win % among players with >= half of Badminton Nut's matches
  const minMatches = badmintonNut ? Math.floor(badmintonNut.matches_played / 2) : 0;
  const nutCracker = activePlayers
    .filter(p => p.matches_played >= minMatches && p.matches_played > 0)
    .reduce<typeof activePlayers[0] | null>((best, p) => {
      const pct = p.wins / p.matches_played;
      const bestPct = best ? best.wins / best.matches_played : -1;
      if (pct > bestPct) return p;
      if (pct === bestPct && best && p.matches_played > best.matches_played) return p;
      return best;
    }, null);

  return (
    <div className="px-4 py-4 pb-20">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Leaderboard</h1>
        <span className="text-sm text-gray-400">{activePlayers.length} active players</span>
      </div>

      {/* Season award cards */}
      {(badmintonNut || nutCracker) && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {badmintonNut && (
            <AwardCard
              emoji="🏸"
              title="Badminton Nut"
              description="Most matches played"
              name={shortName(badmintonNut.name, nameMap)}
              stat={`${badmintonNut.matches_played} matches`}
            />
          )}
          {nutCracker && (
            <AwardCard
              emoji="🎯"
              title="Nut Cracker"
              description={`Best win rate (min ${minMatches} matches)`}
              name={shortName(nutCracker.name, nameMap)}
              stat={`${Math.round((nutCracker.wins / nutCracker.matches_played) * 100)}% win rate`}
            />
          )}
        </div>
      )}

      <LeaderboardTable
        players={activePlayers}
        playersWithTest={activePlayersWithTest}
        nutCrackerId={nutCracker?.id ?? null}
        badmintonNutId={badmintonNut?.id ?? null}
        totalMatches={totalMatches}
        totalMatchesWithTest={totalMatchesWithTest}
        isAdmin={isAdmin}
      />
    </div>
  );
}

