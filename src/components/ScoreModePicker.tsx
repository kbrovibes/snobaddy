"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type ScoreMode = "whiteboard" | "simple" | "full";

const MODES: { value: ScoreMode; label: string }[] = [
  { value: "whiteboard", label: "Whiteboard" },
  { value: "simple", label: "Win/Loss" },
  { value: "full", label: "Full Score" },
];

export default function ScoreModePicker({
  sessionId,
  currentMode,
  isAdmin,
}: {
  sessionId: string;
  currentMode: ScoreMode;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  async function setMode(mode: ScoreMode) {
    if (mode === currentMode || !isAdmin || switching) return;
    setSwitching(true);
    await fetch(`/api/sessions/${sessionId}/score-mode`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    router.refresh();
    setSwitching(false);
  }

  return (
    <div className="bg-white rounded-xl shadow-sm px-3 py-2.5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Score Entry</span>
        {!isAdmin && <span className="text-xs text-stone-400">(admin only)</span>}
      </div>
      <div className={`flex rounded-lg bg-stone-100 p-0.5 ${switching ? "opacity-50" : ""}`}>
        {MODES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setMode(value)}
            disabled={!isAdmin || switching}
            className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-all duration-200 ${
              currentMode === value
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-700"
            } ${!isAdmin ? "cursor-default" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
