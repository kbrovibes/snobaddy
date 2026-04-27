"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type ScoreMode = "whiteboard" | "simple" | "full";

const MODES: { value: ScoreMode; label: string; desc: string }[] = [
  { value: "whiteboard", label: "Whiteboard", desc: "— tap +W / +L" },
  { value: "simple", label: "Win/Loss", desc: "— pick 4 players" },
  { value: "full", label: "Full Score", desc: "— with scores" },
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
    <div className="bg-surface rounded-xl shadow-sm dark:shadow-none dark:ring-1 dark:ring-border px-3 py-2.5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-muted-light uppercase tracking-wide">Score Entry</span>
        {!isAdmin && <span className="text-xs text-muted-light">(admin only)</span>}
      </div>
      <div className={`flex gap-1.5 ${switching ? "opacity-50" : ""}`}>
        {MODES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setMode(value)}
            disabled={!isAdmin || switching}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-center transition-colors ${
              currentMode === value
                ? "bg-sky-50 dark:bg-sky-500/10 border border-sky-200"
                : "border border-border-light hover:border-border"
            } ${!isAdmin ? "cursor-default" : ""}`}
          >
            <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
              currentMode === value ? "border-sky-500" : "border-stone-300 dark:border-border"
            }`}>
              {currentMode === value && (
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              )}
            </span>
            <span className={`text-xs font-medium ${
              currentMode === value ? "text-sky-800" : "text-text"
            }`}>
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
