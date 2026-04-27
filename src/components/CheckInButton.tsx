"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CheckInButton({
  sessionId,
  alreadyCheckedIn,
}: {
  sessionId: string;
  alreadyCheckedIn: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [checkedIn, setCheckedIn] = useState(alreadyCheckedIn);
  const router = useRouter();

  async function checkIn() {
    setLoading(true);
    await fetch(`/api/sessions/${sessionId}/checkin`, { method: "POST" });
    setCheckedIn(true);
    setLoading(false);
    router.refresh();
  }

  async function checkOut() {
    setLoading(true);
    await fetch(`/api/sessions/${sessionId}/checkout`, { method: "POST" });
    setCheckedIn(false);
    setLoading(false);
    router.refresh();
  }

  if (checkedIn) {
    return (
      <div className="flex gap-2">
        <div className="flex-1 py-3 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 font-semibold rounded-xl text-center">
          ✓ You're checked in
        </div>
        <button
          onClick={checkOut}
          disabled={loading}
          className="px-4 py-3 bg-surface-alt text-text-light font-medium rounded-xl disabled:opacity-50 hover:bg-stone-200 dark:hover:bg-surface-alt transition-colors text-sm"
        >
          {loading ? "…" : "Leave"}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={checkIn}
      disabled={loading}
      className="w-full py-3 bg-stone-900 text-white font-semibold rounded-xl disabled:opacity-50 hover:bg-stone-800 dark:hover:bg-sky-500 transition-colors"
    >
      {loading ? "Checking in…" : "✓ I'm here — Check In"}
    </button>
  );
}
