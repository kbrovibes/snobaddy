import { redirect } from "next/navigation";
import NavLink from "@/components/NavLink";
import { createClient } from "@/lib/supabase-server";
import { getFinalsById, getFinalsParticipants, getFinalsSessionPair, getFinalsFormats, getFinalsMatches, getFinalsSeries } from "@/lib/db/finals";
import type { FinalsSessionPair } from "@/lib/db/finals";
import { getActivePlayers } from "@/lib/db/players";
import FinalsEventTabs from "./FinalsEventTabs";
import FinalsCompletedView from "@/components/finals/FinalsCompletedView";
import DeleteFinalsButton from "@/components/finals/DeleteFinalsButton";
import type { FinalsFormatData } from "@/components/finals/FormatPicker";
import type { PairPlayer } from "@/components/finals/PairConfigurator";
import type { FinalsMatch } from "@/components/finals/FinalsMatchList";

export const dynamic = "force-dynamic";

export default async function FinalsEventPage({
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

  if (!isAdmin) redirect("/");

  const event = await getFinalsById(id);
  if (!event) redirect("/");

  const [allPlayers, participants, sessionPair] = await Promise.all([
    getActivePlayers(),
    getFinalsParticipants(id),
    getFinalsSessionPair(event.finals1_session_id, event.finals2_session_id),
  ]);

  const isCompleted = event.status === "completed";

  // For completed view: load formats, matches, and series across both sessions
  let completedFormats: Record<string, FinalsFormatData> = {};
  let completedGroups: Record<string, PairPlayer[]> = {};
  let completedMatches: FinalsMatch[] = [];
  let completedSeriesMap: Record<string, {
    id: string; team1_player1_id: string; team1_player2_id: string; team1_seed: string | null;
    team2_player1_id: string; team2_player2_id: string; team2_seed: string | null;
    team1_wins: number; team2_wins: number; winning_team: number | null; status: string;
  }> = {};

  if (isCompleted) {
    const sessionIds = [event.finals1_session_id, event.finals2_session_id].filter(Boolean) as string[];

    // Fetch formats and matches from all sessions
    const [formatResults, matchResults] = await Promise.all([
      Promise.all(sessionIds.map((sid) => getFinalsFormats(sid))),
      Promise.all(sessionIds.map((sid) => getFinalsMatches(sid))),
    ]);

    // Merge formats
    for (const fmts of formatResults) {
      for (const [g, f] of Object.entries(fmts)) {
        completedFormats[g] = {
          id: f.id, session_id: f.session_id, finals_group: f.finals_group,
          format_type: f.format_type, status: f.status, config: f.config,
        };
      }
    }

    // Merge matches
    for (const ms of matchResults) {
      completedMatches.push(
        ...ms.map((m) => ({
          id: m.id,
          team1_player1: m.team1_player1_id,
          team1_player2: m.team1_player2_id,
          team2_player1: m.team2_player1_id,
          team2_player2: m.team2_player2_id,
          team1_score: m.team1_score,
          team2_score: m.team2_score,
          winning_team: m.winning_team,
          finals_group: m.finals_group,
        }))
      );
    }

    // Build per-group player lists
    for (const p of participants) {
      if (p.group_label) {
        if (!completedGroups[p.group_label]) completedGroups[p.group_label] = [];
        completedGroups[p.group_label].push({
          player_id: p.player_id,
          name: p.name,
          finals_score: p.finals_score,
          group_label: p.group_label,
        });
      }
    }

    // Fetch series per group
    const groupLabels = Object.keys(completedGroups);
    for (const g of groupLabels) {
      const fmt = completedFormats[g];
      if (!fmt) continue;
      const series = await getFinalsSeries(fmt.session_id, g);
      if (series) completedSeriesMap[g] = series;
    }
  }

  return (
    <div className="flex flex-col px-4 py-4 gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <NavLink href="/?list=1" className="text-sky-600 hover:text-sky-800 text-sm">
          ‹ Sessions
        </NavLink>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🏆</span>
            <h1 className="text-xl font-bold text-stone-900">{event.name}</h1>
          </div>
          {event.season && (
            <p className="text-sm text-stone-400 mt-0.5 ml-8">{event.season.name}</p>
          )}
        </div>
        {isCompleted && (
          <span className="text-xs font-semibold text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full">
            Finalized
          </span>
        )}
      </div>

      {isCompleted ? (
        <FinalsEventCompletedWrapper
          event={event}
          allPlayers={allPlayers}
          participants={participants}
          sessionPair={sessionPair}
          completedFormats={completedFormats}
          completedGroups={completedGroups}
          completedMatches={completedMatches}
          completedSeriesMap={completedSeriesMap}
        />
      ) : (
        <FinalsEventTabs
          event={event}
          allPlayers={allPlayers}
          participants={participants}
          sessionPair={sessionPair}
        />
      )}
    </div>
  );
}

function FinalsEventCompletedWrapper({
  event,
  allPlayers,
  participants,
  sessionPair,
  completedFormats,
  completedGroups,
  completedMatches,
  completedSeriesMap,
}: {
  event: Awaited<ReturnType<typeof getFinalsById>> & {};
  allPlayers: Awaited<ReturnType<typeof getActivePlayers>>;
  participants: Awaited<ReturnType<typeof getFinalsParticipants>>;
  sessionPair: FinalsSessionPair;
  completedFormats: Record<string, FinalsFormatData>;
  completedGroups: Record<string, PairPlayer[]>;
  completedMatches: FinalsMatch[];
  completedSeriesMap: Record<string, {
    id: string; team1_player1_id: string; team1_player2_id: string; team1_seed: string | null;
    team2_player1_id: string; team2_player2_id: string; team2_seed: string | null;
    team1_wins: number; team2_wins: number; winning_team: number | null; status: string;
  }>;
}) {
  return (
    <FinalsCompletedView
      formats={completedFormats}
      groups={completedGroups}
      matches={completedMatches}
      seriesMap={completedSeriesMap}
      hideOverallRankings
    >
      {/* Session links */}
      {(sessionPair.day1 || sessionPair.day2) && (
        <div className="bg-white rounded-xl shadow-sm border border-stone-100 overflow-hidden">
          <div className="bg-stone-50 px-4 py-2 border-b border-stone-100">
            <h3 className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide">
              Sessions
            </h3>
          </div>
          {sessionPair.day1 && (
            <NavLink
              href={`/session/${sessionPair.day1.id}`}
              className="flex items-center justify-between px-4 py-2.5 hover:bg-stone-50 active:bg-sky-50 transition-colors border-b border-stone-100 last:border-0"
            >
              <span className="text-sm text-stone-700">Day 1 — Groups A & B</span>
              <span className="text-xs text-sky-600">View →</span>
            </NavLink>
          )}
          {sessionPair.day2 && (
            <NavLink
              href={`/session/${sessionPair.day2.id}`}
              className="flex items-center justify-between px-4 py-2.5 hover:bg-stone-50 active:bg-sky-50 transition-colors"
            >
              <span className="text-sm text-stone-700">Day 2 — Group C</span>
              <span className="text-xs text-sky-600">View →</span>
            </NavLink>
          )}
        </div>
      )}

      {/* Setup details toggle — between winner cards and group details */}
      <details className="group">
        <summary className="flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-stone-400 hover:text-stone-600 cursor-pointer transition-colors">
          <span>View Setup Details</span>
          <span className="group-open:rotate-180 transition-transform text-xs">▼</span>
        </summary>
        <div className="mt-2">
          <FinalsEventTabs
            event={event}
            allPlayers={allPlayers}
            participants={participants}
            sessionPair={sessionPair}
          />
        </div>
      </details>

      <DeleteFinalsButton eventId={event!.id} />
    </FinalsCompletedView>
  );
}
