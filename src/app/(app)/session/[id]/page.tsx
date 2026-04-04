import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getSessionById,
  getCheckedInPlayers,
  getPastSessionsThisSeason,
} from "@/lib/db/sessions";
import { getSessionMatches, getSessionScoreboard, getSessionHighlights } from "@/lib/db/matches";
import { getProposedMatches } from "@/lib/db/proposed";
import { getOnlinePlayerIds } from "@/lib/db/players";
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
    .select("id, is_admin")
    .eq("user_id", user!.id)
    .maybeSingle();

  const isAdmin = currentPlayer?.is_admin ?? false;
  const playerId = currentPlayer?.id;

  const session = await getSessionById(id);
  if (!session) redirect("/");

  const checkedInPlayers = session.status === "active"
    ? await getCheckedInPlayers(session.id)
    : [];

  const isCheckedIn = checkedInPlayers.some((p) => p.player_id === playerId);

  const pastSessions = await getPastSessionsThisSeason(session.season.id, session.date);

  const needsScoreboard =
    session.status === "active" || session.status === "completed";

  const [scoreboard, recentMatches, proposedMatches, onlinePlayerIds] = needsScoreboard
    ? await Promise.all([
        getSessionScoreboard(session.id),
        getSessionMatches(session.id),
        getProposedMatches(session.id),
        getOnlinePlayerIds(checkedInPlayers.map((p) => p.player_id)),
      ])
    : [[], [], [], new Set<string>()];

  const isPending = session.status === "pending";
  const isActive = session.status === "active";
  const isCompleted = session.status === "completed";

  const highlights = isCompleted
    ? await getSessionHighlights(session.id)
    : null;

  // Build display name map from all session players (scoreboard covers everyone who played)
  const allSessionNames = (scoreboard as { name: string }[]).map((p) => p.name);
  const nameMap = buildNameMap(allSessionNames);

  return (
    <div className="flex flex-col gap-4 px-4 py-4">

      <OnlinePing />
      <BackToSessionsLink />

      {/* Season header */}
      <div className="flex items-center gap-3">
        <Image src="/serve-logo.jpg" alt="Serve Sports" width={52} height={52} className="rounded-xl shrink-0" />
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">{session.season?.name ?? "Tonight"}</h1>
          <p className="text-sm text-gray-500">{formatDate(session.date)}</p>
        </div>
        <div className="ml-auto shrink-0">
          {isActive && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Ongoing
            </span>
          )}
          {isPending && (
            <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">
              Starting soon
            </span>
          )}
          {isCompleted && (
            <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
              Closed
            </span>
          )}
        </div>
      </div>

      {/* Admin: start session */}
      {isPending && isAdmin && (
        <StartSessionButton sessionId={session.id} />
      )}

      {/* Non-admin pending */}
      {isPending && !isAdmin && (
        <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 text-sm text-orange-700 text-center">
          Tonight's session hasn't started yet. Check back soon!
        </div>
      )}

      {/* Active session */}
      {isActive && (
        <>
          {/* Check-in */}
          <CheckInButton sessionId={session.id} alreadyCheckedIn={isCheckedIn} />

          {/* Who's here */}
          <div className="bg-white rounded-xl shadow-sm px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Who's Here · {checkedInPlayers.length}
            </h2>
            <WhoIsHere players={checkedInPlayers} onlinePlayerIds={onlinePlayerIds as Set<string>} isAdmin={isAdmin} sessionId={session.id} />
          </div>

          {/* Proposed matches */}
          <ProposedMatchList
            sessionId={session.id}
            matches={proposedMatches}
            checkedInPlayers={checkedInPlayers}
            isAdmin={isAdmin}
            autoGenerate={session.auto_generate_matches ?? true}
          />

          {/* Record match */}
          <RecordMatchForm sessionId={session.id} checkedInPlayers={checkedInPlayers} />

          {/* Admin: close session */}
          {isAdmin && <CloseSessionButton sessionId={session.id} />}
        </>
      )}

      {/* Completed session */}
      {isCompleted && (
        <>
          {highlights && highlights.totalMatches >= 3 && (
            <SessionHighlights highlights={highlights} nameMap={nameMap} />
          )}
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-gray-500">Session closed. No new matches can be recorded.</p>
            {isAdmin && <ReopenSessionButton sessionId={session.id} />}
          </div>
        </>
      )}

      {/* Scoreboard — shown for active and completed */}
      {(isActive || isCompleted) && (
        <SessionScoreboard
          scoreboard={scoreboard}
          playerId={playerId}
          matchCount={recentMatches.length}
        />
      )}

      {/* Match history — shown for active and completed */}
      {(isActive || isCompleted) && recentMatches.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
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
                    <span className={`font-semibold truncate text-left ${m.winning_team === 1 ? "text-green-600" : "text-gray-400"}`}>
                      {team1Names.join(" & ")}
                    </span>
                    <span className="text-gray-300 text-center w-6">vs</span>
                    <span className={`font-semibold truncate text-left ${m.winning_team === 2 ? "text-green-600" : "text-gray-400"}`}>
                      {team2Names.join(" & ")}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
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

      {/* Past sessions this season */}
      {pastSessions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Past Sessions
          </h2>
          <div className="flex flex-col gap-2">
            {pastSessions.map((s) => (
              <Link key={s.id} href={`/session/${s.id}`} className="flex items-center justify-between text-sm hover:bg-gray-50 -mx-1 px-1 rounded-lg transition-colors">
                <span className="text-blue-600">{formatDate(s.date)}</span>
                <span className="text-gray-400 capitalize">{s.status}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
