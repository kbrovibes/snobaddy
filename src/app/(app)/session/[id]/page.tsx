import Image from "next/image";
import Link from "next/link";
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
import FormatPicker from "@/components/finals/FormatPicker";
import PairConfigurator from "@/components/finals/PairConfigurator";
import type { PairPlayer, SavedPair } from "@/components/finals/PairConfigurator";
import { getFinalsFormat, getFinalsParticipants } from "@/lib/db/finals";

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

  // Finals format + participants (only for finals sessions with god mode)
  const [finalsFormat, finalsParticipants] = isFinalsSession && isGodMode
    ? await Promise.all([
        getFinalsFormat(session.id),
        session.finals_event_id
          ? getFinalsParticipants(session.finals_event_id)
          : Promise.resolve([]),
      ])
    : [null, []];

  // Derive group sizes from participants
  const finalsGroupSizes = { A: 0, B: 0 };
  for (const p of finalsParticipants) {
    if (p.group_label === "A") finalsGroupSizes.A++;
    else if (p.group_label === "B") finalsGroupSizes.B++;
  }

  // Build pair configurator data when format is fixed_partner
  const isFixedPartner = finalsFormat?.format_type === "fixed_partner";
  const pairGroups: Record<string, PairPlayer[]> = {};
  const savedPairs: Record<string, SavedPair[]> = {};
  if (isFixedPartner) {
    for (const p of finalsParticipants) {
      if (p.group_label === "A" || p.group_label === "B") {
        if (!pairGroups[p.group_label]) pairGroups[p.group_label] = [];
        pairGroups[p.group_label].push({
          player_id: p.player_id,
          name: p.name,
          finals_score: p.finals_score,
          group_label: p.group_label,
        });
      }
    }
    // Load saved pairs from format config
    const configPairs = (finalsFormat.config as { pairs?: Record<string, SavedPair[]> })?.pairs;
    if (configPairs) {
      for (const [label, pairs] of Object.entries(configPairs)) {
        savedPairs[label] = pairs;
      }
    }
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
          <Link href={`/finals/${session.finals_event_id}`} className="text-stone-400 hover:text-stone-600 text-sm">
            ← Finals Event
          </Link>
        ) : (
          <BackToSessionsLink />
        )}
        <div className="flex items-center justify-between text-sm">
          <div>
            {adjacentSessions.newer ? (
              <Link href={`/session/${adjacentSessions.newer.id}`} className="text-sky-600 hover:underline">
                ‹ {new Date(adjacentSessions.newer.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "2-digit" })} Session
              </Link>
            ) : (
              <span className="text-stone-300">‹ Session</span>
            )}
          </div>
          <div>
            {adjacentSessions.older ? (
              <Link href={`/session/${adjacentSessions.older.id}`} className="text-sky-600 hover:underline">
                {new Date(adjacentSessions.older.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "2-digit" })} Session ›
              </Link>
            ) : (
              <span className="text-stone-300">Session ›</span>
            )}
          </div>
        </div>
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

      {/* Finals format picker — God Mode only */}
      {isFinalsSession && isGodMode && (isPending || isActive) && (
        <div className="bg-white rounded-xl shadow-sm px-4 py-3">
          <FormatPicker
            sessionId={session.id}
            currentFormat={finalsFormat as import("@/components/finals/FormatPicker").FinalsFormatData | null}
            groupSizes={finalsGroupSizes}
          />
        </div>
      )}

      {/* Fixed-Partner pair configuration — God Mode only */}
      {isFinalsSession && isGodMode && isFixedPartner && (isPending || isActive) && Object.keys(pairGroups).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm px-4 py-3">
          <PairConfigurator
            sessionId={session.id}
            groups={pairGroups}
            savedPairs={savedPairs}
            isLocked={finalsFormat!.status !== "configured"}
          />
        </div>
      )}

      {/* Placeholder when no format selected yet */}
      {isFinalsSession && isGodMode && isActive && !finalsFormat && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700 text-center">
          Select a format above to configure matches.
        </div>
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

          {/* Finalize prompt — admin only, after 10pm PST, no activity in 20min */}
          {isAdmin && !session.is_test_session && (
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

          {/* Match entry */}
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

      {/* Completed session */}
      {isCompleted && (
        <>
          {highlights && highlights.totalMatches >= 3 && (
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

      {/* Tally scoreboard — shown for completed sessions with tally data (no match records) */}
      {isCompleted && (tallyRows as TallyEntry[]).length > 0 && (
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

      {/* Match scoreboard — shown for active sessions, or completed sessions with match records */}
      {(isActive || isCompleted) && (tallyRows as TallyEntry[]).length === 0 && (
        <SessionScoreboard
          scoreboard={scoreboard}
          playerId={playerId}
          matchCount={(recentMatches as unknown[]).length}
        />
      )}

      {/* Match history — shown for active and completed */}
      {(isActive || isCompleted) && recentMatches.length > 0 && (
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

      {/* Past sessions this season */}
      {pastSessions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm px-4 py-3">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
            Past Sessions
          </h2>
          <div className="flex flex-col gap-2">
            {pastSessions.map((s) => (
              <Link key={s.id} href={`/session/${s.id}`} className="flex items-center justify-between text-sm hover:bg-stone-50 active:bg-sky-50 -mx-1 px-1 rounded-lg transition-colors">
                <span className="text-sky-600">{formatDate(s.date)}</span>
                <span className="text-stone-400 capitalize">{s.status}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
