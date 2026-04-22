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
    <div className="bg-white rounded-xl shadow-sm px-3 py-2.5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Score Entry</span>
        {!isAdmin && <span className="text-xs text-stone-400">(admin only)</span>}
      </div>
      <div className={`flex flex-col gap-1.5 ${switching ? "opacity-50" : ""}`}>
        {MODES.map(({ value, label, desc }) => (
          <button
            key={value}
            onClick={() => setMode(value)}
            disabled={!isAdmin || switching}
            className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
              currentMode === value
                ? "bg-sky-50 border border-sky-200"
                : "border border-stone-100 hover:border-stone-200"
            } ${!isAdmin ? "cursor-default" : ""}`}
          >
            {/* Radio circle */}
            <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
              currentMode === value ? "border-sky-500" : "border-stone-300"
            }`}>
              {currentMode === value && (
                <span className="w-2 h-2 rounded-full bg-sky-500" />
              )}
            </span>
            <div>
              <span className={`text-sm font-medium ${
                currentMode === value ? "text-sky-800" : "text-stone-700"
              }`}>
                {label}
              </span>
              <span className={`text-xs ml-1.5 ${
                currentMode === value ? "text-sky-600" : "text-stone-400"
              }`}>
                {desc}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
