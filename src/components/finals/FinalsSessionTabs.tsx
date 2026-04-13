"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import FinalsGroupView from "./FinalsGroupView";
import type { FinalsFormatData } from "./FormatPicker";
import type { PairPlayer } from "./PairConfigurator";
import type { FinalsMatch } from "./FinalsMatchList";

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

interface FinalsSessionTabsProps {
  sessionId: string;
  formats: Record<string, FinalsFormatData>;
  groups: Record<string, PairPlayer[]>;
  matches: FinalsMatch[];
  seriesMap: Record<string, SeriesData>;  // { A: series, B: series }
  isActive: boolean;
  isGodMode: boolean;
}

export default function FinalsSessionTabs({
  sessionId,
  formats,
  groups,
  matches,
  seriesMap,
  isActive,
  isGodMode,
}: FinalsSessionTabsProps) {
  const groupLabels = Object.keys(groups).sort();
  const searchParams = useSearchParams();
  const initialGroup = searchParams.get("group");
  const [activeGroup, setActiveGroup] = useState(
    initialGroup && groupLabels.includes(initialGroup) ? initialGroup : groupLabels[0] ?? "A"
  );

  function selectGroup(g: string) {
    setActiveGroup(g);
    // Persist to URL so router.refresh() preserves the active group
    const url = new URL(window.location.href);
    url.searchParams.set("group", g);
    window.history.replaceState({}, "", url.toString());
  }

  const groupMatches = matches.filter((m) => m.finals_group === activeGroup);

  return (
    <div className="flex flex-col gap-3">
      {/* Group tabs */}
      {groupLabels.length > 1 && (
        <div className="flex gap-1 bg-stone-100 rounded-lg p-0.5">
          {groupLabels.map((g) => {
            const fmt = formats[g];
            const statusHint = fmt
              ? fmt.status === "completed" ? "Done"
              : fmt.status === "playoffs_complete" ? "Finals"
              : fmt.status === "matches_generated" ? "Playing"
              : fmt.format_type === "fixed_partner" ? "Fixed" : "Playoffs"
              : "";
            return (
              <button
                key={g}
                onClick={() => selectGroup(g)}
                className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-colors ${
                  activeGroup === g
                    ? "bg-stone-900 text-white"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                Group {g}
                {statusHint && (
                  <span className={`ml-1 text-[10px] font-normal ${activeGroup === g ? "text-stone-400" : "text-stone-400"}`}>
                    · {statusHint}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Active group content */}
      <FinalsGroupView
        key={activeGroup}
        sessionId={sessionId}
        finalsGroup={activeGroup}
        format={formats[activeGroup] ?? null}
        players={groups[activeGroup] ?? []}
        matches={groupMatches}
        series={seriesMap[activeGroup] ?? null}
        isActive={isActive}
        isGodMode={isGodMode}
      />
    </div>
  );
}
