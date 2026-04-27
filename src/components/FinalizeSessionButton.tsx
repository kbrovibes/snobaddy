"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const INACTIVE_MS = 20 * 60 * 1000; // 20 minutes

function isAfter10pmPST(): boolean {
  const now = new Date();
  const pstHour = parseInt(
    now.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Los_Angeles" }),
    10
  );
  return pstHour >= 22;
}

function isInactive(lastMatchAt: string | null): boolean {
  if (!lastMatchAt) return true; // no matches ever recorded = inactive
  return Date.now() - new Date(lastMatchAt).getTime() > INACTIVE_MS;
}

export default function FinalizeSessionButton({
  sessionId,
  lastMatchAt,
}: {
  sessionId: string;
  lastMatchAt: string | null;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    function check() {
      setVisible(isAfter10pmPST() && isInactive(lastMatchAt));
    }
    check();
    // Re-evaluate every minute in case the clock ticks past 10pm
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [lastMatchAt]);

  if (!visible) return null;

  async function handleFinalize() {
    setLoading(true);
    await fetch(`/api/sessions/${sessionId}/close`, { method: "POST" });
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 rounded-xl px-4 py-3 flex flex-col gap-2">
        <p className="text-sm font-semibold text-red-700">Finalize this session?</p>
        <p className="text-xs text-red-500">All remaining players will be checked out. This cannot be undone.</p>
        <div className="flex gap-2 mt-1">
          <button
            onClick={handleFinalize}
            disabled={loading}
            className="flex-1 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Finalizing…" : "Yes, Finalize"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={loading}
            className="flex-1 py-1.5 bg-surface border border-border text-text-light text-xs font-bold rounded-lg hover:bg-surface-alt disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="w-full py-2.5 bg-red-50 dark:bg-red-500/10 border border-red-200 text-red-600 dark:text-red-400 text-sm font-semibold rounded-xl hover:bg-red-100 dark:bg-red-500/15 transition-colors"
    >
      Finalize Session?
    </button>
  );
}
