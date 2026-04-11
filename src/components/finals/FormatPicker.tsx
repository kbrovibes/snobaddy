"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export interface FinalsFormatData {
  id: string;
  session_id: string;
  format_type: "playoffs" | "fixed_partner";
  status: string;
  config: Record<string, unknown>;
}

const FORMATS = [
  {
    type: "fixed_partner" as const,
    title: "Fixed-Partner All-Pairs",
    description: "Admin assigns partner pairs. Every pair plays every other pair once. Most wins takes the group.",
    icon: "🤝",
    enabled: true,
  },
  {
    type: "playoffs" as const,
    title: "Playoffs + Finals",
    description: "Players rotate partners in group stage. Top 4 advance to a Best-of-3 Final.",
    icon: "🏆",
    enabled: false,
    tag: "Coming soon",
  },
];

export default function FormatPicker({
  sessionId,
  currentFormat,
  groupSizes,
}: {
  sessionId: string;
  currentFormat: FinalsFormatData | null;
  groupSizes: { A: number; B: number };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLocked = currentFormat && currentFormat.status !== "configured";

  async function selectFormat(formatType: "playoffs" | "fixed_partner") {
    if (isLocked) return;
    setSelecting(true);
    setError(null);
    const res = await fetch(`/api/sessions/${sessionId}/finals-format`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format_type: formatType }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to set format");
    } else {
      startTransition(() => router.refresh());
    }
    setSelecting(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">
        Format
      </h2>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      <div className="flex flex-col gap-2">
        {FORMATS.map((fmt) => {
          const isSelected = currentFormat?.format_type === fmt.type;
          const isDisabled = !fmt.enabled || (selecting || isPending);

          return (
            <button
              key={fmt.type}
              onClick={() => fmt.enabled && !isLocked && selectFormat(fmt.type)}
              disabled={isDisabled}
              className={[
                "relative w-full text-left px-4 py-3 rounded-xl border-2 transition-all",
                isSelected
                  ? "border-stone-900 bg-stone-50 shadow-sm"
                  : fmt.enabled
                  ? "border-stone-200 bg-white hover:border-stone-400 hover:bg-stone-50"
                  : "border-stone-100 bg-stone-50 opacity-60 cursor-not-allowed",
              ].join(" ")}
            >
              {/* Coming soon tag */}
              {fmt.tag && (
                <span className="absolute top-2 right-2 text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">
                  {fmt.tag}
                </span>
              )}

              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">{fmt.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${isSelected ? "text-stone-900" : "text-stone-700"}`}>
                    {fmt.title}
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                    {fmt.description}
                  </p>
                  {/* Adapt description to group sizes */}
                  {fmt.enabled && (groupSizes.A > 0 || groupSizes.B > 0) && (
                    <p className="text-xs text-stone-400 mt-1">
                      Group A: {groupSizes.A} players · Group B: {groupSizes.B} players
                    </p>
                  )}
                </div>

                {/* Selection indicator */}
                {isSelected && (
                  <span className="mt-1 w-5 h-5 rounded-full bg-stone-900 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Status info */}
      {isLocked && (
        <p className="text-xs text-stone-400 text-center">
          Format is locked — matches have already been generated.
        </p>
      )}
    </div>
  );
}
