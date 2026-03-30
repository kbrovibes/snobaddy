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

  if (checkedIn) {
    return (
      <div className="w-full py-3 bg-green-50 text-green-700 font-semibold rounded-xl text-center">
        ✓ You're checked in
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
