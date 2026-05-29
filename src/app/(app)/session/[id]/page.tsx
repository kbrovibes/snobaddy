import NavLink from "@/components/NavLink";
import { redirect } from "next/navigation";
import {
  getSessionById,
  getCheckedInPlayers,
  getPastSessionsThisSeason,
} from "@/lib/db/sessions";
import { getSessionMatches, getSessionScoreboard, getSessionHighlights } from "@/lib/db/matches";
import { getProposedMatches } from "@/lib/db/proposed";
import { getOnlinePlayerIds, getActivePlayerList } from "@/lib/db/players";
import { getSessionTally, getWhiteboardPlayers, getWhiteboardLog, type TallyEntry } from "@/lib/db/tally";
import WhiteboardTally from "@/components/WhiteboardTally";
import UndoLogEntry from "@/components/UndoLogEntry";
import ScoreModePicker, { type ScoreMode } from "@/components/ScoreModePicker";
import { createClient } from "@/lib/supabase-server";
import { buildNameMap, shortName } from "@/lib/display-name";
import StartSessionButton from "@/components/StartSessionButton";
import UploadScoresButton from "@/components/UploadScoresButton";
import CheckInButton from "@/components/CheckInButton";
import CloseSessionButton from "@/components/CloseSessionButton";
import RecordMatchForm from "@/components/RecordMatchForm";
import ReopenSessionButton from "@/components/ReopenSessionButton";
import MatchAdminControls from "@/components/MatchAdminControls";
import ProposedMatchList from "@/components/ProposedMatchList";
import WhoIsHere from "@/components/WhoIsHere";
import BackToSessionsLink from "@/components/BackToSessionsLink";
import OnlinePing from "@/components/OnlinePing";
import SessionHighlights from "@/components/SessionHighlights";
import SessionScoreboard from "@/components/SessionScoreboard";
import SimpleMatchForm from "@/components/SimpleMatchForm";
import TestSessionToggle from "@/components/TestSessionToggle";
import TallyScoreboard from "@/components/TallyScoreboard";
import TallyEditSection from "@/components/TallyEditSection";
import TallyEntryForm from "@/components/TallyEntryForm";
import TallyHighlights from "@/components/TallyHighlights";
import ResetSessionButton from "@/components/ResetSessionButton";
import AutoRefreshToggle from "@/components/AutoRefreshToggle";
import ActivityShowMore from "@/components/ActivityShowMore";
import FinalizeSessionButton from "@/components/FinalizeSessionButton";
import FinalsSessionTabs from "@/components/finals/FinalsSessionTabs";
import FinalsCompletedView from "@/components/finals/FinalsCompletedView";
import type { FinalsFormatData } from "@/components/finals/FormatPicker";
import type { PairPlayer } from "@/components/finals/PairConfigurator";
import type { FinalsMatch } from "@/components/finals/FinalsMatchList";
import { getFinalsFormats, getFinalsParticipants, getFinalsMatches, getFinalsSeries } from "@/lib/db/finals";

export const dynamic = "force-dynamic";

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}


export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: currentPlayer } = await supabase
    .from("players")
    .select("id, is_admin, is_god_mode")
    .eq("user_id", user!.id)
    .maybeSingle();

  const isAdmin = currentPlayer?.is_admin ?? false;
  const isGodMode = (currentPlayer as unknown as { is_god_mode?: boolean } | null)?.is_god_mode ?? false;
  const playerId = currentPlayer?.id;


  const session = await getSessionById(id);
  if (!session) redirect("/");

  const checkedInPlayers = session.status === "active"
    ? await getCheckedInPlayers(session.id)
    : [];

  const whiteboardPlayers = (session.status === "active" && session.whiteboard_mode)
    ? await getWhiteboardPlayers(session.id)
    : [];

  const whiteboardLog = (session.status === "active" && session.whiteboard_mode)
    ? await getWhiteboardLog(session.id)
    : [];

  const isCheckedIn = checkedInPlayers.some((p) => p.player_id === playerId);

  const pastSessions = await getPastSessionsThisSeason(session.season.id, session.date);

  const isFinalsSession = session.session_type === "finals";
  const isPending = session.status === "pending";
  const isActive = session.status === "active";
  const isCompleted = session.status === "completed";
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const statsLocked = !!session.stats_lock_date && session.stats_lock_date < todayStr;
  const statsLockPending = !!session.stats_lock_date && session.stats_lock_date >= todayStr;
  const needsScoreboard = isActive || isCompleted;

  // Finals: formats (per group), participants, and matches
  const [finalsFormatsMap, finalsParticipants, finalsMatches] = isFinalsSession
    ? await Promise.all([
        getFinalsFormats(session.id),
        session.finals_event_id
          ? getFinalsParticipants(session.finals_event_id)
          : Promise.resolve([]),
        getFinalsMatches(session.id),
      ])
    : [{} as Record<string, import("@/lib/db/finals").FinalsFormat>, [], []];

  // Determine which groups belong to this session
  // Day 1 (finals1_session_id) = Groups A & B, Day 2 (finals2_session_id) = Group C
  let sessionGroupLabels: Set<string>;
  if (isFinalsSession && session.finals_event_id) {
    const { data: eventRow } = await (await createClient())
      .from("finals_events")
      .select("finals1_session_id, finals2_session_id")
      .eq("id", session.finals_event_id)
      .maybeSingle();
    if (eventRow?.finals2_session_id === session.id) {
      sessionGroupLabels = new Set(["C"]);
    } else {
      sessionGroupLabels = new Set(["A", "B"]);
    }
  } else {
    sessionGroupLabels = new Set(["A", "B"]);
  }

  // Build per-group player lists (only for this session's groups)
  const finalsGroups: Record<string, PairPlayer[]> = {};
  for (const p of finalsParticipants) {
    if (p.group_label && sessionGroupLabels.has(p.group_label)) {
      if (!finalsGroups[p.group_label]) finalsGroups[p.group_label] = [];
      finalsGroups[p.group_label].push({
        player_id: p.player_id,
        name: p.name,
        finals_score: p.finals_score,
        group_label: p.group_label,
      });
    }
  }

  // Cast formats for client component
  const finalsFormatsClient: Record<string, FinalsFormatData> = {};
  for (const [g, f] of Object.entries(finalsFormatsMap)) {
    finalsFormatsClient[g] = {
      id: f.id,
      session_id: f.session_id,
      finals_group: f.finals_group,
      format_type: f.format_type,
      status: f.status,
      config: f.config,
    };
  }

  // Cast matches for client component
  const finalsMatchesClient: FinalsMatch[] = finalsMatches.map((m) => ({
    id: m.id,
    team1_player1: m.team1_player1_id,
    team1_player2: m.team1_player2_id,
    team2_player1: m.team2_player1_id,
    team2_player2: m.team2_player2_id,
    team1_score: m.team1_score,
    team2_score: m.team2_score,
    winning_team: m.winning_team,
    finals_group: m.finals_group,
  }));

  // Fetch series for each group
  const finalsSeriesMap: Record<string, {
    id: string; team1_player1_id: string; team1_player2_id: string; team1_seed: string | null;
    team2_player1_id: string; team2_player2_id: string; team2_seed: string | null;
    team1_wins: number; team2_wins: number; winning_team: number | null; status: string;
  }> = {};
  if (isFinalsSession) {
    const groupLabels = Object.keys(finalsGroups);
    const seriesResults = await Promise.all(
      groupLabels.map((g) => getFinalsSeries(session.id, g))
    );
    groupLabels.forEach((g, i) => {
      if (seriesResults[i]) finalsSeriesMap[g] = seriesResults[i]!;
    });
  }

  const [scoreboard, recentMatches, proposedMatches, onlinePlayerIds, tallyRows, formPlayers] =
    needsScoreboard
      ? await Promise.all([
          getSessionScoreboard(session.id),
          getSessionMatches(session.id),
          getProposedMatches(session.id),
          getOnlinePlayerIds(checkedInPlayers.map((p) => p.player_id)),
          getSessionTally(session.id),
          isAdmin ? getActivePlayerList() : Promise.resolve([] as { id: string; name: string }[]),
        ])
      : await (async () => {
          const [tally, players] = await Promise.all([
            getSessionTally(session.id),
            isAdmin ? getActivePlayerList() : Promise.resolve([] as { id: string; name: string }[]),
          ]);
          return [[], [], [], new Set<string>(), tally, players];
        })();

  const highlights = isCompleted
    ? await getSessionHighlights(session.id)
    : null;

  // Build display name map from all session players (scoreboard + tally + whiteboard)
  const allSessionNames = [
    ...(scoreboard as { name: string }[]).map((p) => p.name),
    ...(tallyRows as TallyEntry[]).map((e) => e.player_name),
    ...whiteboardPlayers.map((p) => p.name),
    ...whiteboardLog.map((e) => e.player_name),
  ];
  const nameMap = buildNameMap(allSessionNames);

  return (
    <div className="flex flex-col gap-4 px-4 py-4">

      <OnlinePing />

      {/* Session header */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-light">
              {isFinalsSession ? "🏆 Season Finals" : (session.season?.name ?? "Tonight")}
            </p>
            <div className="flex items-center gap-2">
              <p className="text-sm text-heading font-semibold">{formatDate(session.date)}</p>
              {isAdmin && session.is_test_session && (
                <span className="text-xs font-bold text-orange-500 bg-orange-50 dark:bg-orange-500/10 dark:bg-orange-500/10 px-1.5 py-0.5 rounded">TEST</span>
              )}
            </div>
            {statsLocked && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                🔒 Stats excluded from leaderboard
              </p>
            )}
            {statsLockPending && (
              <p className="text-[11px] text-muted-light mt-0.5">
                🔒 Stats lock after {new Date(session.stats_lock_date! + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            )}
          </div>
          <div className="ml-auto shrink-0">
            {isActive && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-white bg-sky-700 px-2.5 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-white/80 animate-pulse" />
                In Progress
              </span>
            )}
            {isPending && (
              <span className="text-xs font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 px-2.5 py-1 rounded-full">
                Starting soon
              </span>
            )}
            {isCompleted && (
              <span className="text-xs font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 px-2.5 py-1 rounded-full">
                Finalized
              </span>
            )}
          </div>
        </div>
        {isFinalsSession && session.finals_event_id ? (
          <NavLink href={`/finals/${session.finals_event_id}`} className="text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 text-sm">
            ‹ Finals Event
          </NavLink>
        ) : (
          <BackToSessionsLink />
        )}
        {/* Admin toggles — own row, right-aligned */}
        {isAdmin && (
          <div className="flex items-center justify-end gap-3">
            {isActive && <AutoRefreshToggle />}
            <TestSessionToggle sessionId={session.id} isTestSession={session.is_test_session} />
          </div>
        )}
      </div>

      {/* Finals session info banner */}
      {isFinalsSession && isPending && !isAdmin && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700 text-center">
          Season Finals — this session hasn't started yet.
        </div>
      )}

      {/* Admin: pending session actions — finalize, tally entry, start */}
      {isPending && isAdmin && (
        <div className="flex flex-col gap-3">
          {!isFinalsSession && (
            <UploadScoresButton sessionId={session.id} />
          )}
          {!isFinalsSession && (tallyRows as TallyEntry[]).length === 0 && (
            <TallyEntryForm
              sessionId={session.id}
              allPlayers={formPlayers as { id: string; name: string }[]}
              isGodMode={isAdmin}
            />
          )}
          <StartSessionButton sessionId={session.id} sessionDate={session.date} />
        </div>
      )}

      {/* Finals: Group A / Group B tabs with format, pairs, matches, standings */}
      {isFinalsSession && (isPending || isActive) && Object.keys(finalsGroups).length > 0 && (
        <div className="bg-surface rounded-xl shadow-sm dark:shadow-none dark:ring-1 dark:ring-border px-4 py-3">
          <FinalsSessionTabs
            sessionId={session.id}
            formats={finalsFormatsClient}
            groups={finalsGroups}
            matches={finalsMatchesClient}
            seriesMap={finalsSeriesMap}
            isActive={isActive}
            isGodMode={isAdmin}
          />
        </div>
      )}

      {/* Finals: completed view — winners, runner-ups, rankings */}
      {isFinalsSession && isCompleted && Object.keys(finalsGroups).length > 0 && (
        <FinalsCompletedView
          formats={finalsFormatsClient}
          groups={finalsGroups}
          matches={finalsMatchesClient}
          seriesMap={finalsSeriesMap}
          hideOverallRankings
        />
      )}

      {/* Non-admin pending (regular sessions only) */}
      {isPending && !isAdmin && !isFinalsSession && (
        <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-100 rounded-xl px-4 py-3 text-sm text-orange-700 text-center">
          Tonight's session hasn't started yet. Check back soon!
        </div>
      )}

      {/* Active session */}
      {isActive && (
        <>
          {/* Check-in — not shown for Finals sessions */}
          {!isFinalsSession && (
            <CheckInButton sessionId={session.id} alreadyCheckedIn={isCheckedIn} />
          )}

          {/* Finalize prompt — admin only, not for finals, after 10pm PST, no activity in 20min */}
          {isAdmin && !session.is_test_session && !isFinalsSession && (
            <FinalizeSessionButton
              sessionId={session.id}
              lastMatchAt={(recentMatches as { played_at?: string }[])[0]?.played_at ?? null}
            />
          )}

          {/* Who's here — not shown for Finals sessions */}
          {!isFinalsSession && (
            <div className="bg-surface rounded-xl shadow-sm dark:shadow-none dark:ring-1 dark:ring-border px-4 py-3">
              <h2 className="text-sm font-semibold text-text-light uppercase tracking-wide mb-3">
                Who's Here · {checkedInPlayers.length}
              </h2>
              <WhoIsHere players={checkedInPlayers} onlinePlayerIds={onlinePlayerIds as Set<string>} isAdmin={isAdmin} sessionId={session.id} />
            </div>
          )}

          {/* Score entry — not shown for Finals sessions */}
          {!isFinalsSession && (() => {
            const scoreMode: ScoreMode = session.whiteboard_mode
              ? "whiteboard"
              : session.simple_score_tracking ? "simple" : "full";
            return (
              <>
                <ScoreModePicker
                  sessionId={session.id}
                  currentMode={scoreMode}
                  isAdmin={isAdmin}
                />
                {scoreMode === "whiteboard" && (
                  <WhiteboardTally
                    sessionId={session.id}
                    players={whiteboardPlayers}
                    nameMap={Object.fromEntries(nameMap)}
                  />
                )}
                {scoreMode !== "whiteboard" && (
                  <SimpleMatchForm
                    sessionId={session.id}
                    checkedInPlayers={checkedInPlayers}
                    isAdmin={isAdmin}
                    simpleMode={session.simple_score_tracking}
                  />
                )}
                <ProposedMatchList
                  sessionId={session.id}
                  matches={proposedMatches}
                  checkedInPlayers={checkedInPlayers}
                  isAdmin={isAdmin}
                  autoGenerate={session.auto_generate_matches ?? true}
                />
              </>
            );
          })()}

        </>
      )}

      {/* Completed session */}
      {isCompleted && (
        <>
          {!isFinalsSession && (tallyRows as unknown[]).length === 0 && highlights && highlights.totalMatches >= 3 && (
            <SessionHighlights highlights={highlights} nameMap={nameMap} />
          )}
          <p className="text-sm text-muted-light text-center">Session closed. No new matches can be recorded.</p>
          {/* Tally entry: shown when no matches recorded yet */}
          {isAdmin && !isFinalsSession && (recentMatches as unknown[]).length === 0 && (tallyRows as TallyEntry[]).length === 0 && (
            <TallyEntryForm
              sessionId={session.id}
              allPlayers={formPlayers as { id: string; name: string }[]}
              isGodMode={isAdmin}
    
            />
          )}
        </>
      )}

      {/* Tally scoreboard — shown for sessions with tally data, not finals */}
      {!isFinalsSession && (tallyRows as TallyEntry[]).length > 0 && (
        <>
          <TallyHighlights entries={tallyRows as TallyEntry[]} nameMap={nameMap} />
          <TallyEditSection
            entries={tallyRows as TallyEntry[]}
            sessionId={session.id}
            isGodMode={isGodMode}
            hasPhoto={!!session.tally_photo_path}
            allPlayers={formPlayers as { id: string; name: string }[]}
            isAdmin={isAdmin && !isCompleted}
          />
          {isGodMode && <ResetSessionButton sessionId={session.id} />}
        </>
      )}

      {/* Match scoreboard — not shown for Finals or active whiteboard sessions */}
      {!isFinalsSession && (isActive || isCompleted) && (tallyRows as TallyEntry[]).length === 0 && !(isActive && session.whiteboard_mode) && (
        <SessionScoreboard
          scoreboard={scoreboard}
          playerId={playerId}
          matchCount={(recentMatches as unknown[]).length}
        />
      )}

      {/* Match history + whiteboard edits — not shown for Finals sessions */}
      {!isFinalsSession && (isActive || isCompleted) && (recentMatches.length > 0 || whiteboardLog.length > 0) && (
        <div className="bg-surface rounded-xl shadow-sm dark:shadow-none dark:ring-1 dark:ring-border px-4 py-3">
          <h2 className="text-sm font-semibold text-text-light uppercase tracking-wide mb-3">
            {isActive && session.whiteboard_mode ? "Activity" : `Matches · ${recentMatches.length}`}
          </h2>
          {(() => {
              type FeedItem = { type: "match"; data: typeof recentMatches[0]; ts: number }
                | { type: "log"; data: typeof whiteboardLog[0]; ts: number };
              const items: FeedItem[] = [
                ...recentMatches.map((m) => ({ type: "match" as const, data: m, ts: new Date(m.played_at).getTime() })),
                ...whiteboardLog.map((e) => ({ type: "log" as const, data: e, ts: new Date(e.created_at).getTime() })),
              ].sort((a, b) => b.ts - a.ts);

              const renderedItems = items.map((item) => {
                if (item.type === "match") {
                  const m = item.data;
                  const team1Names = m.team1.map((n: string) => shortName(n, nameMap));
                  const team2Names = m.team2.map((n: string) => shortName(n, nameMap));
                  const winnerNames = m.winning_team === 1 ? team1Names : team2Names;
                  return (
                    <div key={m.id} className="text-sm">
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        <span className={`font-semibold truncate text-left ${m.winning_team === 1 ? "text-green-600 dark:text-green-400" : "text-muted-light"}`}>
                          {team1Names.join(" & ")}
                        </span>
                        <span className="text-muted-lighter text-center w-6">vs</span>
                        <span className={`font-semibold truncate text-left ${m.winning_team === 2 ? "text-green-600 dark:text-green-400" : "text-muted-light"}`}>
                          {team2Names.join(" & ")}
                        </span>
                      </div>
                      <div className="text-xs text-muted-light mt-0.5">
                        {m.team1_score} – {m.team2_score} · {winnerNames.join(" & ")} won
                      </div>
                      {isAdmin && isActive && (
                        <MatchAdminControls
                          matchId={m.id}
                          team1Names={m.team1.map((n: string) => shortName(n, nameMap)) as [string, string]}
                          team2Names={m.team2.map((n: string) => shortName(n, nameMap)) as [string, string]}
                          team1Score={m.team1_score}
                          team2Score={m.team2_score}
                        />
                      )}
                    </div>
                  );
                }

                const e = item.data;
                const isWin = e.field === "wins";
                return (
                  <div key={e.id} className="flex items-center gap-2 text-xs text-text-light">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isWin ? "bg-green-400" : "bg-orange-400"}`} />
                    <span className="font-medium text-text flex-1">{shortName(e.player_name, nameMap)}</span>
                    <span className={isWin ? "text-green-600 dark:text-green-400" : "text-orange-500"}>
                      {e.delta > 0 ? "+" : "−"}1 {isWin ? "W" : "L"}
                    </span>
                    {isActive && (
                      <UndoLogEntry sessionId={session.id} logId={e.id} />
                    )}
                  </div>
                );
              });

              return (
                <ActivityShowMore totalCount={renderedItems.length}>
                  {renderedItems}
                </ActivityShowMore>
              );
            })()}
        </div>
      )}

      {/* Admin: finalize, reopen, reset — grouped at bottom */}
      {isAdmin && isActive && <CloseSessionButton sessionId={session.id} />}
      {isAdmin && isCompleted && <ReopenSessionButton sessionId={session.id} />}
      {isGodMode && (tallyRows as TallyEntry[]).length === 0 && (isActive || isCompleted) && (
        <ResetSessionButton sessionId={session.id} />
      )}

      {/* Past sessions this season (hidden for finals) */}
      {pastSessions.length > 0 && !isFinalsSession && (
        <div className="bg-surface rounded-xl shadow-sm dark:shadow-none dark:ring-1 dark:ring-border px-4 py-3">
          <h2 className="text-sm font-semibold text-text-light uppercase tracking-wide mb-3">
            Past Sessions
          </h2>
          <div className="flex flex-col gap-2">
            {pastSessions.map((s) => (
              <NavLink key={s.id} href={`/session/${s.id}`} className="flex items-center justify-between text-sm hover:bg-surface-alt active:bg-sky-50 dark:active:bg-sky-500/10 -mx-1 px-1 rounded-lg transition-colors">
                <span className="text-sky-600 dark:text-sky-400">{formatDate(s.date)}</span>
                <span className="text-muted-light capitalize">{s.status}</span>
              </NavLink>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
