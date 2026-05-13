"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadScoresButton({ sessionId }: { sessionId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const router = useRouter();

  async function handleFinalize() {
    setLoading(true);
    setError(false);
    const res = await fetch(`/api/sessions/${sessionId}/close`, { method: "POST" });
    if (res.ok) {
      router.refresh();
    } else {
      setError(true);
      setLoading(false);
    }
  }

  if (confirming) {
    return (
      <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-xl px-4 py-3 flex flex-col gap-3">
        <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
          Finalize this session without opening it?
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400">
          The session will be marked as completed. You can re-open it later if needed.
        </p>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 font-medium">
            Failed to finalize session. Please try again.
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => { setConfirming(false); setError(false); }}
            className="flex-1 py-2 text-sm font-medium text-text bg-surface border border-border rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleFinalize}
            disabled={loading}
            className="flex-1 py-2 text-sm font-semibold text-white bg-amber-600 rounded-lg disabled:opacity-50"
          >
            {loading ? "Finalizing…" : "Yes, finalize"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="w-full py-2.5 text-sm font-medium rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white transition-colors"
    >
      Finalize Session
    </button>
  );
}
