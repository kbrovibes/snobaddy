import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getPlayerById, getPlayerPoem, getPlayerPoemContext, upsertPlayerPoem } from "@/lib/db/players";
import { getPlayerSessionHistory, getPlayerMatchesBySession } from "@/lib/db/matches";
import { getPlayerUbrRating, getPlayerUbrHistory, getTier } from "@/lib/db/ubr";
import { getAppSetting } from "@/lib/db/settings";
import { generatePlayerPoem } from "@/lib/ai/poem";
import SessionStatsChart from "@/components/SessionStatsChart";
import UbrChart from "@/components/UbrChart";

import IncludeTestToggle from "@/components/IncludeTestToggle";
import EditPlayerForm from "@/components/EditPlayerForm";
import RegeneratePoemButton from "@/components/RegeneratePoemButton";
import RegenerateUbrButton from "@/components/RegenerateUbrButton";
import ThemeToggle from "@/components/ThemeToggle";
import { buildNameMap, shortName } from "@/lib/display-name";
import { PartnerChemistry, StreaksCard, AttendanceHeatmap } from "@/components/PlayerInsights";
import type { PartnerStat, StreakData, SessionDay } from "@/components/PlayerInsights";

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

  const [sessionHistory, matchesBySession, ubrRating, ubrHistory, ubrEnabledSetting] = await Promise.all([
    getPlayerSessionHistory(id, { includeTestSessions }),
    getPlayerMatchesBySession(id, { includeTestSessions }),
    getPlayerUbrRating(id),
    getPlayerUbrHistory(id),
    getAppSetting("ubr_enabled"),
  ]);

  const ubrEnabled = ubrEnabledSetting === "true";

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

  // ── Compute Player Insights ──────────────────────────────────────────────

  // Partner Chemistry
  const partnerMap = new Map<string, { wins: number; losses: number }>();
  for (const group of matchesBySession) {
    for (const m of group.matches) {
      const entry = partnerMap.get(m.partner) ?? { wins: 0, losses: 0 };
      if (m.won) entry.wins++; else entry.losses++;
      partnerMap.set(m.partner, entry);
    }
  }
  const partnerStats: PartnerStat[] = Array.from(partnerMap.entries()).map(([name, s]) => ({
    name, wins: s.wins, losses: s.losses,
  }));

  // Streaks
  const allMatchResults: { won: boolean; date: string }[] = [];
  for (const group of matchesBySession) {
    if (group.absent) continue;
    if (group.isTally) {
      for (let i = 0; i < (group.tallyWins ?? 0); i++) allMatchResults.push({ won: true, date: group.date });
      for (let i = 0; i < (group.tallyLosses ?? 0); i++) allMatchResults.push({ won: false, date: group.date });
    } else {
      for (const m of group.matches) allMatchResults.push({ won: m.won, date: group.date });
    }
  }

  let currentWinStreak = 0;
  let currentWinStreakStart: string | null = null;
  for (let i = allMatchResults.length - 1; i >= 0; i--) {
    if (allMatchResults[i].won) {
      currentWinStreak++;
      currentWinStreakStart = allMatchResults[i].date;
    } else break;
  }

  let bestWinStreak = 0;
  let bestStart: string | null = null;
  let bestEnd: string | null = null;
  let streakRun = 0;
  let runStart: string | null = null;
  for (const r of allMatchResults) {
    if (r.won) {
      if (streakRun === 0) runStart = r.date;
      streakRun++;
      if (streakRun > bestWinStreak) {
        bestWinStreak = streakRun;
        bestStart = runStart;
        bestEnd = r.date;
      }
    } else {
      streakRun = 0;
    }
  }

  function fmtShort(d: string) {
    return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const streakData: StreakData = {
    currentWinStreak,
    bestWinStreak,
    currentWinStreakStart: currentWinStreak > 0 ? currentWinStreakStart : null,
    bestWinStreakRange: bestStart && bestEnd && bestWinStreak > 1
      ? `${fmtShort(bestStart)} – ${fmtShort(bestEnd)}`
      : null,
    sessionsAttended: matchesBySession.filter((g) => !g.absent).length,
    totalSessions: matchesBySession.length,
    careerMatches: totalMatches,
    careerWins: totalWins,
    careerLosses: totalLosses,
  };

  // Attendance Heatmap
  const sessionDays: SessionDay[] = matchesBySession.map((g) => ({
    date: g.date,
    wins: g.isTally ? (g.tallyWins ?? 0) : g.matches.filter((m) => m.won).length,
    losses: g.isTally ? (g.tallyLosses ?? 0) : g.matches.filter((m) => !m.won).length,
    attended: !g.absent,
  }));

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

      {/* Player header — sticky below fixed nav (h-14 = 56px) */}
      <div className="sticky top-14 z-20 -mx-4 -mt-4 px-4 pt-2 pb-2 bg-background border-b border-border-light dark:border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-sky-100 dark:bg-sky-500/15 flex items-center justify-center text-sky-700 dark:text-sky-400 text-lg font-bold shrink-0">
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
            {ubrEnabled && ubrRating && (
              <p className="text-xs font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                UBR {Math.round(ubrRating.rating)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Poem card */}
      {poem && (
        <div className="bg-surface rounded-xl shadow-sm dark:shadow-none dark:ring-1 dark:ring-border px-4 py-3">
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

      {/* Theme toggle — own profile only */}
      {player.user_id === user!.id && (
        <div className="bg-surface rounded-xl shadow-sm dark:shadow-none dark:ring-1 dark:ring-border px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
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

      {/* UBR progression */}
      {ubrEnabled && ubrRating && (
        <div className="bg-surface rounded-xl shadow-sm dark:shadow-none dark:ring-1 dark:ring-border px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-light uppercase tracking-wide">
              UBR Rating
            </h2>
            {isAdmin && <RegenerateUbrButton playerId={id} />}
          </div>
          <UbrChart
            history={ubrHistory.map((h) => ({
              session_date: h.session_date,
              rating_before: h.rating_before,
              rating_after: h.rating_after,
              rating_change: h.rating_change,
            }))}
            currentRating={ubrRating.rating}
          />
        </div>
      )}

      {/* Partner Chemistry */}
      <PartnerChemistry partners={partnerStats} />

      {/* Streaks & Milestones */}
      <StreaksCard data={streakData} />

      {/* Attendance Heatmap */}
      <AttendanceHeatmap sessions={sessionDays} />

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
