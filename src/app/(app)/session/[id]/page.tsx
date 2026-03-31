import Image from "next/image";
import { redirect } from "next/navigation";
import {
  getSessionById,
  getCheckedInPlayers,
  getPastSessionsThisSeason,
} from "@/lib/db/sessions";
import { getSessionMatches, getSessionScoreboard } from "@/lib/db/matches";
import { getProposedMatches } from "@/lib/db/proposed";
import { getOnlinePlayerIds } from "@/lib/db/players";
import { createClient } from "@/lib/supabase-server";
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

export const dynamic = "force-dynamic";

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function getFirstName(fullName: string) {
  return fullName.split(" ")[0];
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
            <WhoIsHere players={checkedInPlayers} onlinePlayerIds={onlinePlayerIds as Set<string>} />
          </div>

          {/* Proposed matches */}
          <ProposedMatchList
            sessionId={session.id}
            matches={proposedMatches}
            checkedInPlayers={checkedInPlayers}
          />

          {/* Record match */}
          <RecordMatchForm sessionId={session.id} checkedInPlayers={checkedInPlayers} />

          {/* Admin: close session */}
          {isAdmin && <CloseSessionButton sessionId={session.id} />}
        </>
      )}

      {/* Completed session */}
      {isCompleted && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-gray-500">Session closed. No new matches can be recorded.</p>
          {isAdmin && <ReopenSessionButton sessionId={session.id} />}
        </div>
      )}

      {/* Scoreboard — shown for active and completed */}
      {(isActive || isCompleted) && (
        <div className="bg-white rounded-xl shadow-sm px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Tonight's Scores
          </h2>
          {scoreboard.length === 0 ? (
            <p className="text-sm text-gray-400">No matches recorded yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex text-xs text-gray-400 px-1 mb-1">
                <span className="flex-1">Player</span>
                <span className="w-8 text-center">W</span>
                <span className="w-8 text-center">L</span>
                <span className="w-12 text-right">Win%</span>
              </div>
              {scoreboard.map((p, i) => {
                const pct = p.matches_played ? Math.round((p.wins / p.matches_played) * 100) : 0;
                return (
                  <div key={p.player_id} className="flex items-center px-1">
                    <span className="text-xs text-gray-300 w-5 shrink-0">{i + 1}</span>
                    <span className={`flex-1 text-sm font-medium truncate ${p.player_id === playerId ? "text-blue-600" : "text-gray-800"}`}>
                      {p.name}
                    </span>
                    <span className="w-8 text-center text-sm font-bold text-green-600">{p.wins}</span>
                    <span className="w-8 text-center text-sm font-bold text-red-400">{p.losses}</span>
                    <span className="w-12 text-right text-sm text-gray-500">{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Match history — shown for active and completed */}
      {(isActive || isCompleted) && recentMatches.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Matches · {recentMatches.length}
          </h2>
          <div className="flex flex-col gap-3">
            {recentMatches.map((m) => {
              const team1FirstNames = m.team1.map(getFirstName);
              const team2FirstNames = m.team2.map(getFirstName);
              const winnerFirstNames = m.winning_team === 1 ? team1FirstNames : team2FirstNames;
              return (
                <div key={m.id} className="text-sm">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <span className={`font-semibold truncate text-left ${m.winning_team === 1 ? "text-green-600" : "text-gray-400"}`}>
                      {team1FirstNames.join(" & ")}
                    </span>
                    <span className="text-gray-300 text-center w-6">vs</span>
                    <span className={`font-semibold truncate text-left ${m.winning_team === 2 ? "text-green-600" : "text-gray-400"}`}>
                      {team2FirstNames.join(" & ")}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {m.team1_score} – {m.team2_score} · {winnerFirstNames.join(" & ")} won
                  </div>
                  {isAdmin && isActive && (
                    <MatchAdminControls
                      matchId={m.id}
                      team1Names={m.team1}
                      team2Names={m.team2}
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
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{formatDate(s.date)}</span>
                <span className="text-gray-400 capitalize">{s.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
