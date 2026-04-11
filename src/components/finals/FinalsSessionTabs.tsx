"use client";

import React, { useState } from "react";
import FinalsGroupView from "./FinalsGroupView";
import type { FinalsFormatData } from "./FormatPicker";
import type { PairPlayer } from "./PairConfigurator";
import type { FinalsMatch } from "./FinalsMatchList";

interface FinalsSessionTabsProps {
  sessionId: string;
  formats: Record<string, FinalsFormatData>;  // { A: ..., B: ... }
  groups: Record<string, PairPlayer[]>;        // { A: [...], B: [...] }
  matches: FinalsMatch[];
  isActive: boolean;
  isGodMode: boolean;
}

export default function FinalsSessionTabs({
  sessionId,
  formats,
  groups,
  matches,
  isActive,
  isGodMode,
}: FinalsSessionTabsProps) {
  const groupLabels = Object.keys(groups).sort();
  const [activeGroup, setActiveGroup] = useState(groupLabels[0] ?? "A");

  const groupMatches = matches.filter((m) => m.finals_group === activeGroup);

  return (
    <div className="flex flex-col gap-3">
      {/* Group tabs */}
      {groupLabels.length > 1 && (
        <div className="flex gap-1 bg-stone-100 rounded-lg p-0.5">
          {groupLabels.map((g) => {
            const fmt = formats[g];
            const statusHint = fmt
              ? fmt.status === "matches_generated" ? "Playing" : fmt.format_type === "fixed_partner" ? "Fixed" : "Playoffs"
              : "";
            return (
              <button
                key={g}
                onClick={() => setActiveGroup(g)}
                className={`flex-1 text-sm font-semibold py-2 rounded-md transition-colors ${
                  activeGroup === g
                    ? "bg-white text-stone-900 shadow-sm"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                Group {g}
                {statusHint && (
                  <span className="ml-1 text-[10px] font-normal text-stone-400">
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
        isActive={isActive}
        isGodMode={isGodMode}
      />
    </div>
  );
}
