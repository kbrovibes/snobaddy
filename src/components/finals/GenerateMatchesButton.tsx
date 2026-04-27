"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function GenerateMatchesButton({
  sessionId,
  finalsGroup,
  hasPairs,
}: {
  sessionId: string;
  finalsGroup: string;
  hasPairs: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    const res = await fetch(`/api/sessions/${sessionId}/finals-format/generate-matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ finals_group: finalsGroup }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to generate matches");
    } else {
      startTransition(() => router.refresh());
    }
    setGenerating(false);
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>
      )}
      <button
        onClick={handleGenerate}
        disabled={!hasPairs || generating || isPending}
        className="w-full py-2 rounded-xl text-sm font-semibold text-white bg-sky-700 hover:bg-sky-600 disabled:opacity-40 transition-colors"
      >
        {generating ? "Generating…" : "Generate Matches"}
      </button>
      {!hasPairs && (
        <p className="text-xs text-muted-light text-center">Save pairs first.</p>
      )}
    </div>
  );
}
