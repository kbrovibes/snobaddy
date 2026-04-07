"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CloseSessionButton({ sessionId }: { sessionId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClose() {
    setLoading(true);
    await fetch(`/api/sessions/${sessionId}/close`, { method: "POST" });
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="bg-sky-50 border border-sky-100 rounded-xl px-4 py-3 flex flex-col gap-3">
        <p className="text-sm text-sky-800 font-medium">
          Finalize scores and close tonight's session?
        </p>
        <p className="text-xs text-sky-600">
          No new matches can be recorded after this. You can re-open if needed.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirming(false)}
            className="flex-1 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleClose}
            disabled={loading}
            className="flex-1 py-2 text-sm font-semibold text-white bg-stone-900 rounded-lg disabled:opacity-50"
          >
            {loading ? "Closing…" : "Yes, finalize it"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="w-full py-2.5 text-sm font-semibold text-white bg-stone-900 rounded-xl hover:bg-stone-800 transition-colors"
    >
      Finalize Scores &amp; Close
    </button>
  );
}
