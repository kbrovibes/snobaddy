import Image from "next/image";
import NavLink from "@/components/NavLink";
import { redirect } from "next/navigation";
import {
  getSessionById,
  getCheckedInPlayers,
  getPastSessionsThisSeason,
  getAdjacentNonTestSessions,
} from "@/lib/db/sessions";
import { getSessionMatches, getSessionScoreboard, getSessionHighlights } from "@/lib/db/matches";
import { getProposedMatches } from "@/lib/db/proposed";
import { getOnlinePlayerIds, getActivePlayerList } from "@/lib/db/players";
import { getSessionTally, type TallyEntry } from "@/lib/db/tally";
import { getAppSetting } from "@/lib/db/settings";
import { createClient } from "@/lib/supabase-server";
import { buildNameMap, shortName } from "@/lib/display-name";
import StartSessionButton from "@/components/StartSessionButton";
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
import TallyEntryForm from "@/components/TallyEntryForm";
import TallyHighlights from "@/components/TallyHighlights";
import ResetSessionButton from "@/components/ResetSessionButton";
import AutoRefreshToggle from "@/components/AutoRefreshToggle";
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

  const tallyModel = isGodMode
    ? (await getAppSetting("tally_extraction_model")) ?? "claude-haiku-4-5-20251001"
    : null;

  const session = await getSessionById(id);
  if (!session) redirect("/");

  const checkedInPlayers = session.status === "active"
    ? await getCheckedInPlayers(session.id)
    : [];

  const isCheckedIn = checkedInPlayers.some((p) => p.player_id === playerId);

  const [pastSessions, adjacentSessions] = await Promise.all([
    getPastSessionsThisSeason(session.season.id, session.date),
    getAdjacentNonTestSessions(session.date),
  ]);

  const isFinalsSession = session.session_type === "finals";
  const isPending = session.status === "pending";
  const isActive = session.status === "active";
  const isCompleted = session.status === "completed";
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
          isCompleted ? getSessionTally(session.id) : Promise.resolve([] as TallyEntry[]),
          isCompleted && isAdmin ? getActivePlayerList() : Promise.resolve([] as { id: string; name: string }[]),
        ])
      : [[], [], [], new Set<string>(), [], []];

  const highlights = isCompleted
    ? await getSessionHighlights(session.id)
    : null;

  // Build display name map from all session players (scoreboard + tally entries)
  const allSessionNames = [
    ...(scoreboard as { name: string }[]).map((p) => p.name),
    ...(tallyRows as TallyEntry[]).map((e) => e.player_name),
  ];
  const nameMap = buildNameMap(allSessionNames);

  return (
    <div className="flex flex-col gap-4 px-4 py-4">

      <OnlinePing />

      {/* Session nav */}
      <div className="flex flex-col gap-0.5 -mb-2">
        {isFinalsSession && session.finals_event_id ? (
          <NavLink href={`/finals/${session.finals_event_id}`} className="text-sky-600 hover:text-sky-800 text-sm">
            ‹ Finals Event
          </NavLink>
        ) : (
          <BackToSessionsLink />
        )}
        {!isFinalsSession && (
        <div className="flex items-center justify-between text-sm">
          <div>
            {adjacentSessions.newer ? (
              <NavLink href={`/session/${adjacentSessions.newer.id}`} className="text-sky-600 hover:underline">
                ‹ {new Date(adjacentSessions.newer.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "2-digit" })} Session
              </NavLink>
            ) : (
              <span className="text-stone-300">‹ Session</span>
            )}
          </div>
          <div>
            {adjacentSessions.older ? (
              <NavLink href={`/session/${adjacentSessions.older.id}`} className="text-sky-600 hover:underline">
                {new Date(adjacentSessions.older.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "2-digit" })} Session ›
              </NavLink>
            ) : (
              <span className="text-stone-300">Session ›</span>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Season header */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-3">
          <Image src="/serve-logo.jpg" alt="Serve Sports" width={52} height={52} className="rounded-xl shrink-0" />
          <div>
            <h1 className="text-lg font-bold text-stone-900 leading-tight">
              {isFinalsSession ? "🏆 Season Finals" : (session.season?.name ?? "Tonight")}
            </h1>
            <div className="flex items-center gap-2">
              <p className="text-sm text-stone-500">{formatDate(session.date)}</p>
              {isAdmin && session.is_test_session && (
                <span className="text-xs font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">TEST</span>
              )}
            </div>
          </div>
          <div className="ml-auto shrink-0">
            {isActive && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-white bg-sky-700 px-2.5 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-white/80 animate-pulse" />
                In Progress
              </span>
            )}
            {isPending && (
              <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">
                Starting soon
              </span>
            )}
            {isCompleted && (
              <span className="text-xs font-semibold text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full">
                Finalized
              </span>
            )}
          </div>
        </div>
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
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700 text-center">
          Season Finals — this session hasn't started yet.
        </div>
      )}

      {/* Admin: start session */}
      {isPending && isAdmin && (
        <StartSessionButton sessionId={session.id} sessionDate={session.date} />
      )}

      {/* Finals: Group A / Group B tabs with format, pairs, matches, standings */}
      {isFinalsSession && (isPending || isActive) && Object.keys(finalsGroups).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm px-4 py-3">
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
        <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 text-sm text-orange-700 text-center">
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
            <div className="bg-white rounded-xl shadow-sm px-4 py-3">
              <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
                Who's Here · {checkedInPlayers.length}
              </h2>
              <WhoIsHere players={checkedInPlayers} onlinePlayerIds={onlinePlayerIds as Set<string>} isAdmin={isAdmin} sessionId={session.id} />
            </div>
          )}

          {/* Match entry — not shown for Finals sessions */}
          {!isFinalsSession && (
            <>
              <SimpleMatchForm
                sessionId={session.id}
                checkedInPlayers={checkedInPlayers}
                isAdmin={isAdmin}
                simpleMode={session.simple_score_tracking}
              />
              {!session.simple_score_tracking && (
                <ProposedMatchList
                  sessionId={session.id}
                  matches={proposedMatches}
                  checkedInPlayers={checkedInPlayers}
                  isAdmin={isAdmin}
                  autoGenerate={session.auto_generate_matches ?? true}
                />
              )}
            </>
          )}

        </>
      )}

      {/* Completed session */}
      {isCompleted && (
        <>
          {!isFinalsSession && highlights && highlights.totalMatches >= 3 && (
            <SessionHighlights highlights={highlights} nameMap={nameMap} />
          )}
          <div className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-stone-500">Session closed. No new matches can be recorded.</p>
            {isAdmin && <ReopenSessionButton sessionId={session.id} />}
          </div>
          {/* Tally entry: shown when no matches recorded yet */}
          {isAdmin && !isFinalsSession && (recentMatches as unknown[]).length === 0 && (tallyRows as TallyEntry[]).length === 0 && (
            <TallyEntryForm
              sessionId={session.id}
              allPlayers={formPlayers as { id: string; name: string }[]}
              isGodMode={isGodMode}
              tallyModel={tallyModel ?? undefined}
            />
          )}
        </>
      )}

      {/* Tally scoreboard — shown for completed sessions with tally data (no match records), not finals */}
      {isCompleted && !isFinalsSession && (tallyRows as TallyEntry[]).length > 0 && (
        <>
          <TallyHighlights entries={tallyRows as TallyEntry[]} nameMap={nameMap} />
          <TallyScoreboard
            entries={tallyRows as TallyEntry[]}
            sessionId={session.id}
            isGodMode={isGodMode}
            hasPhoto={!!session.tally_photo_path}
          />
          {isAdmin && (
            <TallyEntryForm
              sessionId={session.id}
              allPlayers={formPlayers as { id: string; name: string }[]}
              initialEntries={tallyRows as TallyEntry[]}
              isEdit
              isGodMode={isGodMode}
              tallyModel={tallyModel ?? undefined}
            />
          )}
          {isGodMode && <ResetSessionButton sessionId={session.id} />}
        </>
      )}

      {/* Match scoreboard — not shown for Finals sessions */}
      {!isFinalsSession && (isActive || isCompleted) && (tallyRows as TallyEntry[]).length === 0 && (
        <SessionScoreboard
          scoreboard={scoreboard}
          playerId={playerId}
          matchCount={(recentMatches as unknown[]).length}
        />
      )}

      {/* Match history — not shown for Finals sessions */}
      {!isFinalsSession && (isActive || isCompleted) && recentMatches.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm px-4 py-3">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
            Matches · {recentMatches.length}
          </h2>
          <div className="flex flex-col gap-3">
            {recentMatches.map((m) => {
              const team1Names = m.team1.map((n) => shortName(n, nameMap));
              const team2Names = m.team2.map((n) => shortName(n, nameMap));
              const winnerNames = m.winning_team === 1 ? team1Names : team2Names;
              return (
                <div key={m.id} className="text-sm">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <span className={`font-semibold truncate text-left ${m.winning_team === 1 ? "text-green-600" : "text-stone-400"}`}>
                      {team1Names.join(" & ")}
                    </span>
                    <span className="text-stone-300 text-center w-6">vs</span>
                    <span className={`font-semibold truncate text-left ${m.winning_team === 2 ? "text-green-600" : "text-stone-400"}`}>
                      {team2Names.join(" & ")}
                    </span>
                  </div>
                  <div className="text-xs text-stone-400 mt-0.5">
                    {m.team1_score} – {m.team2_score} · {winnerNames.join(" & ")} won
                  </div>
                  {isAdmin && isActive && (
                    <MatchAdminControls
                      matchId={m.id}
                      team1Names={m.team1.map((n) => shortName(n, nameMap)) as [string, string]}
                      team2Names={m.team2.map((n) => shortName(n, nameMap)) as [string, string]}
                      team1Score={m.team1_score}
                      team2Score={m.team2_score}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Admin: finalize + God Mode: reset — grouped at bottom */}
      {isAdmin && isActive && <CloseSessionButton sessionId={session.id} />}
      {isGodMode && (isActive || (isCompleted && (tallyRows as TallyEntry[]).length === 0)) && (
        <ResetSessionButton sessionId={session.id} />
      )}

      {/* Past sessions this season (hidden for finals) */}
      {pastSessions.length > 0 && !isFinalsSession && (
        <div className="bg-white rounded-xl shadow-sm px-4 py-3">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
            Past Sessions
          </h2>
          <div className="flex flex-col gap-2">
            {pastSessions.map((s) => (
              <NavLink key={s.id} href={`/session/${s.id}`} className="flex items-center justify-between text-sm hover:bg-stone-50 active:bg-sky-50 -mx-1 px-1 rounded-lg transition-colors">
                <span className="text-sky-600">{formatDate(s.date)}</span>
                <span className="text-stone-400 capitalize">{s.status}</span>
              </NavLink>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
