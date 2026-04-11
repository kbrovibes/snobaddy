"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResetSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [counts, setCounts] = useState<{ matches: number; proposed: number; tally: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function openDialog() {
    setLoading(true);
    const res = await fetch(`/api/sessions/${sessionId}/reset`);
    const data = await res.json();
    setCounts(data);
    setLoading(false);
    setConfirming(true);
  }

  async function handleReset() {
    setLoading(true);
    await fetch(`/api/sessions/${sessionId}/reset`, { method: "POST" });
    setConfirming(false);
    setLoading(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={openDialog}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-red-600 text-white text-sm font-semibold rounded-xl px-4 py-2.5 hover:bg-red-700 transition-colors disabled:opacity-50"
      >
        Wipe &amp; Reset Session
      </button>

      {confirming && counts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-stone-900">Reset Session?</h2>
            <div className="text-sm text-stone-600 flex flex-col gap-1">
              <p>This will permanently delete:</p>
              <ul className="mt-1 ml-4 list-disc flex flex-col gap-0.5 text-stone-700">
                <li>{counts.matches} recorded match{counts.matches !== 1 ? "es" : ""}</li>
                <li>{counts.proposed} proposed match{counts.proposed !== 1 ? "es" : ""}</li>
                {counts.tally > 0 && (
                  <li>{counts.tally} tally entr{counts.tally !== 1 ? "ies" : "y"}</li>
                )}
                <li>All check-ins</li>
              </ul>
            </div>
            <p className="text-xs text-stone-400">Session will be restored to Upcoming. This cannot be undone.</p>
            <div className="flex gap-3 mt-1">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold text-stone-600 hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {loading ? "Resetting…" : "Reset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
