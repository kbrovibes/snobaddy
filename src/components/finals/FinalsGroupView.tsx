"use client";

import React, { useState } from "react";
import FormatPicker from "./FormatPicker";
import PairConfigurator from "./PairConfigurator";
import GenerateMatchesButton from "./GenerateMatchesButton";
import FinalsMatchList from "./FinalsMatchList";
import FinalsStandings from "./FinalsStandings";
import PlayoffsStandings from "./PlayoffsStandings";
import SeriesCard from "./SeriesCard";
import type { FinalsFormatData } from "./FormatPicker";
import type { PairPlayer, SavedPair } from "./PairConfigurator";
import type { FinalsMatch, PairInfo } from "./FinalsMatchList";

interface SeriesData {
  id: string;
  team1_player1_id: string;
  team1_player2_id: string;
  team1_seed: string | null;
  team2_player1_id: string;
  team2_player2_id: string;
  team2_seed: string | null;
  team1_wins: number;
  team2_wins: number;
  winning_team: number | null;
  status: string;
}

interface FinalsGroupViewProps {
  sessionId: string;
  finalsGroup: string;
  format: FinalsFormatData | null;
  players: PairPlayer[];
  matches: FinalsMatch[];
  series: SeriesData | null;
  isActive: boolean;
  isGodMode: boolean;
}

export default function FinalsGroupView({
  sessionId,
  finalsGroup,
  format,
  players,
  matches,
  series,
  isActive,
  isGodMode,
}: FinalsGroupViewProps) {
  const [funNames, setFunNames] = useState(false);
  const isFixedPartner = format?.format_type === "fixed_partner";
  const isPlayoffs = format?.format_type === "playoffs";
  const matchesGenerated = format?.status === "matches_generated" || format?.status === "playoffs_complete" || format?.status === "completed";

  // Fixed-partner: pairs from config
  const savedPairs: SavedPair[] = isFixedPartner
    ? (format.config as { pairs?: SavedPair[] })?.pairs ?? []
    : [];
  const hasPairs = savedPairs.length > 0;

  const pairsInfo: PairInfo[] = savedPairs.map((pair, idx) => {
    const p1 = players.find((p) => p.player_id === pair.player1_id);
    const p2 = players.find((p) => p.player_id === pair.player2_id);
    const teamScore = (p1?.finals_score ?? 0) + (p2?.finals_score ?? 0);
    const scoreStr = p1?.finals_score != null && p2?.finals_score != null ? ` (${teamScore.toFixed(1)})` : "";
    return {
      label: `Team ${idx + 1}${scoreStr}`,
      player1_name: p1?.name ?? "Unknown",
      player2_name: p2?.name ?? "Unknown",
      player1_id: pair.player1_id,
      player2_id: pair.player2_id,
    };
  });
  const pairsInfoMap: Record<string, PairInfo[]> = { [finalsGroup]: pairsInfo };

  const playerNames = new Map(players.map((p) => [p.player_id, p.name]));

  // Separate group-stage matches from series (finals_final) matches
  const groupStageMatches = matches.filter((m) => m.finals_group === finalsGroup && !isSeriesMatch(m, series));
  const seriesMatches = series
    ? matches.filter((m) => m.finals_group === finalsGroup && isSeriesMatch(m, series))
    : [];

  return (
    <div className="flex flex-col gap-3">
      {/* Format picker */}
      {isGodMode && (
        <FormatPicker
          sessionId={sessionId}
          finalsGroup={finalsGroup}
          currentFormat={format}
          playerCount={players.length}
        />
      )}

      {!format && (
        <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg text-center">
          Select a format above to get started.
        </p>
      )}

      {/* Fixed-Partner: pair config */}
      {isGodMode && isFixedPartner && !matchesGenerated && players.length > 0 && (
        <PairConfigurator
          sessionId={sessionId}
          finalsGroup={finalsGroup}
          players={players}
          savedPairs={savedPairs}
          isLocked={format!.status !== "configured"}
        />
      )}

      {/* Generate matches — playoffs only (fixed_partner auto-generates on save) */}
      {isGodMode && format && format.status === "configured" && isPlayoffs && (
        <GenerateMatchesButton
          sessionId={sessionId}
          finalsGroup={finalsGroup}
          hasPairs={true}
        />
      )}

      {/* Best-of-3 Series — shown first (latest stage on top) */}
      {series && (
        <SeriesCard
          series={series}
          seriesMatches={seriesMatches}
          playerNames={playerNames}
          sessionId={sessionId}
          isActive={isActive}
        />
      )}

      {/* Standings */}
      {matchesGenerated && groupStageMatches.length > 0 && isFixedPartner && pairsInfo.length > 0 && (
        <FinalsStandings
          matches={groupStageMatches}
          pairsInfo={pairsInfoMap}
          sessionId={sessionId}
          formatStatus={format?.status ?? "configured"}
          isGodMode={isGodMode}
        />
      )}
      {matchesGenerated && groupStageMatches.length > 0 && isPlayoffs && (
        <PlayoffsStandings
          matches={groupStageMatches}
          playerNames={playerNames}
          sessionId={sessionId}
          finalsGroup={finalsGroup}
          formatId={format!.id}
          formatStatus={format?.status ?? "configured"}
          isGodMode={isGodMode}
        />
      )}

      {/* Fun team names toggle — testing only */}
      {matchesGenerated && groupStageMatches.length > 0 && isGodMode && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-[11px] text-stone-400">Fun names</span>
          <button
            onClick={() => setFunNames(!funNames)}
            className={`relative w-9 h-5 rounded-full transition-colors ${funNames ? "bg-sky-500" : "bg-stone-300"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${funNames ? "translate-x-4" : ""}`} />
          </button>
        </div>
      )}

      {/* Group stage matches — scroll down for history */}
      {matchesGenerated && groupStageMatches.length > 0 && (
        <FinalsMatchList
          matches={groupStageMatches}
          pairsInfo={isFixedPartner ? pairsInfoMap : {}}
          playerNames={isPlayoffs ? playerNames : undefined}
          sessionId={sessionId}
          isActive={isActive}
          funNames={funNames}
        />
      )}
    </div>
  );
}

function isSeriesMatch(m: FinalsMatch, series: { team1_player1_id: string; team1_player2_id: string; team2_player1_id: string; team2_player2_id: string } | null): boolean {
  if (!series) return false;
  return (
    m.team1_player1 === series.team1_player1_id &&
    m.team1_player2 === series.team1_player2_id &&
    m.team2_player1 === series.team2_player1_id &&
    m.team2_player2 === series.team2_player2_id
  );
}
