"use client";

import React, { useState } from "react";
import FormatPicker from "./FormatPicker";
import PairConfigurator from "./PairConfigurator";
import GenerateMatchesButton from "./GenerateMatchesButton";
import FinalsMatchList from "./FinalsMatchList";
import FinalsStandings from "./FinalsStandings";
import type { FinalsFormatData } from "./FormatPicker";
import type { PairPlayer, SavedPair } from "./PairConfigurator";
import type { FinalsMatch, PairInfo } from "./FinalsMatchList";

interface FinalsGroupViewProps {
  sessionId: string;
  finalsGroup: string;
  format: FinalsFormatData | null;
  players: PairPlayer[];
  matches: FinalsMatch[];
  isActive: boolean;
  isGodMode: boolean;
}

export default function FinalsGroupView({
  sessionId,
  finalsGroup,
  format,
  players,
  matches,
  isActive,
  isGodMode,
}: FinalsGroupViewProps) {
  const isFixedPartner = format?.format_type === "fixed_partner";
  const matchesGenerated = format?.status === "matches_generated" || format?.status === "completed";

  // Extract saved pairs from config
  const savedPairs: SavedPair[] = isFixedPartner
    ? (format.config as { pairs?: SavedPair[] })?.pairs ?? []
    : [];

  const hasPairs = savedPairs.length > 0;

  // Build pairsInfo for match display
  const pairsInfo: PairInfo[] = savedPairs.map((pair, idx) => ({
    label: `Pair ${idx + 1}`,
    player1_name: players.find((p) => p.player_id === pair.player1_id)?.name ?? "Unknown",
    player2_name: players.find((p) => p.player_id === pair.player2_id)?.name ?? "Unknown",
    player1_id: pair.player1_id,
    player2_id: pair.player2_id,
  }));

  // Single-group pairsInfo map for standings
  const pairsInfoMap: Record<string, PairInfo[]> = { [finalsGroup]: pairsInfo };

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

      {/* No format yet */}
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

      {/* Generate matches button */}
      {isGodMode && isFixedPartner && !matchesGenerated && (
        <GenerateMatchesButton
          sessionId={sessionId}
          finalsGroup={finalsGroup}
          hasPairs={hasPairs}
        />
      )}

      {/* Match list */}
      {matchesGenerated && matches.length > 0 && (
        <FinalsMatchList
          matches={matches}
          pairsInfo={{ [finalsGroup]: pairsInfo }}
          sessionId={sessionId}
          isActive={isActive}
        />
      )}

      {/* Standings */}
      {matchesGenerated && matches.length > 0 && pairsInfo.length > 0 && (
        <FinalsStandings
          matches={matches}
          pairsInfo={pairsInfoMap}
          sessionId={sessionId}
          formatStatus={format?.status ?? "configured"}
          isGodMode={isGodMode}
        />
      )}
    </div>
  );
}
