"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Status = "absent" | "present" | "checked-out";

export default function AdminPresenceToggle({
  sessionId,
  playerId,
  initialStatus,
}: {
  sessionId: string;
  playerId: string;
  initialStatus: Status;
}) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function checkIn() {
    setLoading(true);
    await fetch(`/api/sessions/${sessionId}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_id: playerId }),
    });
    setStatus("present");
    setLoading(false);
    router.refresh();
  }

  async function checkOut() {
    setLoading(true);
    await fetch(`/api/sessions/${sessionId}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_id: playerId }),
    });
    setStatus("checked-out");
    setLoading(false);
    router.refresh();
  }

  if (status === "present") {
    return (
      <button
        onClick={checkOut}
        disabled={loading}
        className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 font-medium border border-red-100 hover:bg-red-100 transition-colors disabled:opacity-40 whitespace-nowrap"
      >
        {loading ? "…" : "Check Out"}
      </button>
    );
  }

  return (
    <button
      onClick={checkIn}
      disabled={loading}
      className="text-xs px-3 py-1.5 rounded-lg bg-sky-50 text-sky-600 font-medium border border-sky-100 hover:bg-sky-100 transition-colors disabled:opacity-40 whitespace-nowrap"
    >
      {loading ? "…" : "Check In"}
    </button>
  );
}
