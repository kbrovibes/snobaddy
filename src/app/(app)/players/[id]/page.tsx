import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getPlayerById, getPlayerPoem, getPlayerPoemContext, upsertPlayerPoem } from "@/lib/db/players";
import { getPlayerSessionHistory, getPlayerMatchesBySession } from "@/lib/db/matches";
import { generatePlayerPoem } from "@/lib/ai/poem";
import SessionStatsChart from "@/components/SessionStatsChart";
import BackButton from "@/components/BackButton";
import IncludeTestToggle from "@/components/IncludeTestToggle";
import EditPlayerForm from "@/components/EditPlayerForm";
import RegeneratePoemButton from "@/components/RegeneratePoemButton";
import ThemeToggle from "@/components/ThemeToggle";
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

  // Fetch or generate poem — regenerate when a new session has completed since last generation
  let poem: string | null = null;
  let poemCreatedAt: string | null = null;
  try {
    const saved = await getPlayerPoem(id);
    const lastCompletedDate = sessionHistory.filter(s => !s.isOpen).at(-1)?.date ?? null;
    const poemDate = saved?.created_at.slice(0, 10) ?? null;
    const stale = !saved || (lastCompletedDate != null && lastCompletedDate > poemDate!);
    if (stale) {
      const poemContext = await getPlayerPoemContext(id);
      poem = await generatePlayerPoem(player.name, poemContext);
      await upsertPlayerPoem(id, poem, totalMatches);
      poemCreatedAt = new Date().toISOString();
    } else {
      poem = saved.poem;
      poemCreatedAt = saved.created_at;
    }
  } catch {
    // poem is non-critical — silently skip if generation fails
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">

      <div className="-mb-2">
        <BackButton />
      </div>

      {/* Player header */}
      <div className="bg-surface rounded-xl shadow-sm dark:shadow-none dark:ring-1 dark:ring-border px-4 py-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-sky-100 dark:bg-sky-500/15 flex items-center justify-center text-sky-700 text-xl font-bold shrink-0">
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
            <p className="text-2xl font-bold text-heading">{overallPct}%</p>
            <p className="text-xs text-muted-light">{totalWins}W {totalLosses}L</p>
          </div>
        </div>
        {poem && (
          <div className="mt-3 border-t border-border-light pt-3">
            <p className="text-sm italic text-text-light leading-relaxed">{poem}</p>
            <div className="mt-2">
              <p className="text-[10px] italic text-muted-lighter">— Written by an AI that has never touched a shuttlecock</p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] italic text-muted-lighter">
                  &nbsp;&nbsp;{poemCreatedAt ? new Date(poemCreatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "unknown date"}
                </p>
                {isGodMode && <RegeneratePoemButton playerId={id} />}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Theme toggle — own profile only */}
      {player.user_id === user!.id && (
        <div className="bg-surface rounded-xl shadow-sm dark:shadow-none dark:ring-1 dark:ring-border px-4 py-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
            Appearance
          </h2>
          <ThemeToggle />
        </div>
      )}

      {/* Stats chart */}
      <div className="bg-surface rounded-xl shadow-sm dark:shadow-none dark:ring-1 dark:ring-border px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text-light uppercase tracking-wide">
            Stats by Session
          </h2>
          {isAdmin && <IncludeTestToggle enabled={includeTestSessions} />}
        </div>
        <SessionStatsChart data={sessionHistory} />
      </div>

      {/* Match history */}
      <div className="bg-surface rounded-xl shadow-sm dark:shadow-none dark:ring-1 dark:ring-border px-4 py-3">
        <h2 className="text-sm font-semibold text-text-light uppercase tracking-wide mb-3">
          Match History
        </h2>

        {matchesBySession.length === 0 ? (
          <p className="text-sm text-muted-light">No matches yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {matchesBySession.map((group) => (
              <div key={group.session_id}>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${group.absent ? "text-muted-lighter" : group.isOpen ? "text-sky-400" : "text-muted-light"}`}>
                  {formatDate(group.date)}{group.isOpen ? "*" : ""}
                </p>
                {group.absent ? (
                  <p className="text-sm text-muted-lighter">Did not play</p>
                ) : group.isTally ? (
                  <p className="text-sm text-text-light">
                    <span className="font-semibold text-green-700 dark:text-green-400">{group.tallyWins}W</span>
                    {" "}<span className="font-semibold text-red-500">{group.tallyLosses}L</span>
                    <span className="text-muted-light ml-1 text-xs">(tally)</span>
                  </p>
                ) : (
                  <div className="flex flex-col divide-y divide-border-light">
                    {group.matches.map((m) => (
                      <div key={m.id} className="py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${
                            m.won ? "bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400" : "bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400"
                          }`}>
                            {m.won ? "W" : "L"}
                          </span>
                          <span className="text-sm text-text truncate flex-1">
                            w/ {shortName(m.partner, nameMap)}
                            <span className="text-muted-light"> vs </span>
                            {m.opponents.map((n) => shortName(n, nameMap)).join(" & ")}
                          </span>
                          <span className={`text-sm font-semibold tabular-nums shrink-0 ${m.won ? "text-green-600 dark:text-green-400" : "text-red-400"}`}>
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
