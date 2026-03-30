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
        <div className="flex-1 py-3 bg-green-50 text-green-700 font-semibold rounded-xl text-center">
          ✓ You're checked in
        </div>
        <button
          onClick={checkOut}
          disabled={loading}
          className="px-4 py-3 bg-gray-100 text-gray-500 font-medium rounded-xl disabled:opacity-50 hover:bg-gray-200 transition-colors text-sm"
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
      className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl disabled:opacity-50 hover:bg-blue-700 transition-colors"
    >
      {loading ? "Checking in…" : "✓ I'm here — Check In"}
    </button>
  );
}
