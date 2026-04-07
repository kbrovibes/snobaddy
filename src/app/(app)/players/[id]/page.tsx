import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getPlayerById, getPlayerPoem, getPlayerPoemContext, upsertPlayerPoem } from "@/lib/db/players";
import { getPlayerSessionHistory, getPlayerMatchesBySession } from "@/lib/db/matches";
import { generatePlayerPoem } from "@/lib/ai/poem";
import SessionStatsChart from "@/components/SessionStatsChart";
import BackButton from "@/components/BackButton";
import IncludeTestToggle from "@/components/IncludeTestToggle";
import EditPlayerForm from "@/components/EditPlayerForm";
import { buildNameMap, shortName } from "@/lib/display-name";

export const dynamic = "force-dynamic";

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}



export default async function PlayerProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ test?: string }>;
}) {
  const [{ id }, { test }] = await Promise.all([params, searchParams]);
  const includeTestSessions = test === "1";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: currentPlayer } = await supabase
    .from("players")
    .select("is_admin, is_god_mode")
    .eq("user_id", user!.id)
    .maybeSingle();
  const isAdmin = currentPlayer?.is_admin ?? false;
  const isGodMode = (currentPlayer as { is_god_mode?: boolean } | null)?.is_god_mode ?? false;

  const player = await getPlayerById(id);
  if (!player) redirect("/");

  const [sessionHistory, matchesBySession] = await Promise.all([
    getPlayerSessionHistory(id, { includeTestSessions }),
    getPlayerMatchesBySession(id, { includeTestSessions }),
  ]);

  // Collect all names from match history to build disambiguation map
  const allMatchNames = matchesBySession.flatMap((g) =>
    g.matches.flatMap((m) => [m.partner, ...m.opponents])
  );
  const nameMap = buildNameMap(allMatchNames);

  const totalWins = sessionHistory.reduce((s, r) => s + r.wins, 0);
  const totalLosses = sessionHistory.reduce((s, r) => s + r.losses, 0);
  const totalMatches = totalWins + totalLosses;
  const overallPct = totalMatches > 0
    ? Math.round((totalWins / totalMatches) * 100)
    : 0;

  // Fetch or generate poem — regenerate when match count has changed by 3+
  let poem: string | null = null;
  try {
    const saved = await getPlayerPoem(id);
    const stale = !saved || Math.abs(totalMatches - saved.matches_at_generation) >= 3;
    if (stale) {
      const poemContext = await getPlayerPoemContext(id);
      poem = await generatePlayerPoem(player.name, poemContext);
      await upsertPlayerPoem(id, poem, totalMatches);
    } else {
      poem = saved.poem;
    }
  } catch {
    // poem is non-critical — silently skip if generation fails
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">

      <BackButton />

      {/* Player header */}
      <div className="bg-white rounded-xl shadow-sm px-4 py-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 text-xl font-bold shrink-0">
            {player.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <EditPlayerForm
              playerId={id}
              currentName={player.name}
              currentSkillLevel={player.skill_level}
              isGodMode={isGodMode}
            />
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold text-stone-900">{overallPct}%</p>
            <p className="text-xs text-stone-400">{totalWins}W {totalLosses}L</p>
          </div>
        </div>
        {poem && (
          <p className="mt-3 text-sm italic text-stone-500 border-t border-stone-100 pt-3 leading-relaxed">
            {poem}
          </p>
        )}
      </div>

      {/* Stats chart */}
      <div className="bg-white rounded-xl shadow-sm px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">
            Stats by Session
          </h2>
          {isAdmin && <IncludeTestToggle enabled={includeTestSessions} />}
        </div>
        <SessionStatsChart data={sessionHistory} />
      </div>

      {/* Match history */}
      <div className="bg-white rounded-xl shadow-sm px-4 py-3">
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
          Match History
        </h2>

        {matchesBySession.length === 0 ? (
          <p className="text-sm text-stone-400">No matches yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {matchesBySession.map((group) => (
              <div key={group.session_id}>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${group.absent ? "text-stone-300" : group.isOpen ? "text-sky-400" : "text-stone-400"}`}>
                  {formatDate(group.date)}{group.isOpen ? "*" : ""}
                </p>
                {group.absent ? (
                  <p className="text-sm text-stone-300">Did not play</p>
                ) : group.isTally ? (
                  <p className="text-sm text-stone-500">
                    <span className="font-semibold text-green-700">{group.tallyWins}W</span>
                    {" "}<span className="font-semibold text-red-500">{group.tallyLosses}L</span>
                    <span className="text-stone-400 ml-1 text-xs">(tally)</span>
                  </p>
                ) : (
                  <div className="flex flex-col divide-y divide-stone-100">
                    {group.matches.map((m) => (
                      <div key={m.id} className="py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${
                            m.won ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                          }`}>
                            {m.won ? "W" : "L"}
                          </span>
                          <span className="text-sm text-stone-700 truncate flex-1">
                            w/ {shortName(m.partner, nameMap)}
                            <span className="text-stone-400"> vs </span>
                            {m.opponents.map((n) => shortName(n, nameMap)).join(" & ")}
                          </span>
                          <span className={`text-sm font-semibold tabular-nums shrink-0 ${m.won ? "text-green-600" : "text-red-400"}`}>
                            {m.my_score}–{m.opp_score}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
