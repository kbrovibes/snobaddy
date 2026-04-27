"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function StartSessionButton({ sessionId, sessionDate }: { sessionId: string; sessionDate: string }) {
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const isFuture = sessionDate > today;

  async function start() {
    setLoading(true);
    setConfirming(false);
    await fetch(`/api/sessions/${sessionId}/start`, { method: "POST" });
    router.refresh();
  }

  function handleClick() {
    if (isFuture) {
      setConfirming(true);
    } else {
      start();
    }
  }

  const formattedDate = new Date(sessionDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading}
        className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl disabled:opacity-50 hover:bg-green-700 transition-colors"
      >
        {loading ? "Starting…" : "▶ Start Tonight's Session"}
      </button>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="bg-surface rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-heading">Start a future session?</h2>
            <p className="text-sm text-text">
              This session is scheduled for <span className="font-semibold text-heading">{formattedDate}</span>, which hasn&apos;t arrived yet.
            </p>
            <p className="text-xs text-muted-light">Are you sure you want to open it now?</p>
            <div className="flex gap-3 mt-1">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-text hover:bg-surface-alt transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={start}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {loading ? "Starting…" : "Start anyway"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
