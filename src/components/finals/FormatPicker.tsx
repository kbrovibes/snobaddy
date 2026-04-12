"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";

export interface FinalsFormatData {
  id: string;
  session_id: string;
  finals_group: string | null;
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
    enabled: true,
  },
];

export default function FormatPicker({
  sessionId,
  finalsGroup,
  currentFormat,
  playerCount,
}: {
  sessionId: string;
  finalsGroup: string;
  currentFormat: FinalsFormatData | null;
  playerCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selecting, setSelecting] = useState(false);
  const [optimisticType, setOptimisticType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const isLocked = currentFormat && currentFormat.status !== "configured";
  const displayType = optimisticType ?? currentFormat?.format_type;

  async function selectFormat(formatType: "playoffs" | "fixed_partner") {
    if (isLocked) return;
    setOptimisticType(formatType);
    setSelecting(true);
    setError(null);
    const res = await fetch(`/api/sessions/${sessionId}/finals-format`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format_type: formatType, finals_group: finalsGroup }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to set format");
      setOptimisticType(null);
    } else {
      startTransition(() => router.refresh());
    }
    setSelecting(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
          Format
        </h3>
        <span className="text-xs text-stone-400">{playerCount} players</span>
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      <div className="flex gap-2">
        {FORMATS.map((fmt) => {
          const isSelected = displayType === fmt.type;
          const isDisabled = !fmt.enabled || (selecting && optimisticType !== fmt.type) || isPending;

          return (
            <button
              key={fmt.type}
              onClick={() => fmt.enabled && !isLocked && selectFormat(fmt.type)}
              disabled={isDisabled}
              className={[
                "relative flex-1 text-left px-3 py-2 rounded-lg border transition-all text-sm",
                isSelected
                  ? "border-stone-900 bg-stone-900 text-white shadow-sm"
                  : fmt.enabled
                  ? "border-stone-200 bg-white hover:border-stone-400"
                  : "border-stone-100 bg-stone-50 opacity-60 cursor-not-allowed",
              ].join(" ")}
            >
              <span className={`font-semibold ${isSelected ? "text-white" : "text-stone-700"}`}>{fmt.icon} {fmt.title}</span>
            </button>
          );
        })}
      </div>

      {currentFormat && (
        <>
          <button
            onClick={() => setShowResetConfirm(true)}
            disabled={selecting || isPending}
            className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 self-center"
          >
            Reset format
          </button>
          <ConfirmDialog
            open={showResetConfirm}
            title="Reset Format"
            message="This will delete all matches and series for this group."
            confirmLabel="Reset"
            variant="danger"
            onConfirm={async () => {
              setShowResetConfirm(false);
              setSelecting(true);
              const res = await fetch(`/api/sessions/${sessionId}/finals-format/reset`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ finals_group: finalsGroup }),
              });
              if (res.ok) {
                setOptimisticType(null);
                startTransition(() => router.refresh());
              } else {
                const json = await res.json();
                setError(json.error ?? "Failed to reset");
              }
              setSelecting(false);
            }}
            onCancel={() => setShowResetConfirm(false)}
          />
        </>
      )}
    </div>
  );
}
