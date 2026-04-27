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
        className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 transition-colors font-medium disabled:opacity-40"
      >
        {loading ? "…" : "Check Out"}
      </button>
    );
  }

  return (
    <button
      onClick={checkIn}
      disabled={loading}
      className="text-xs text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 transition-colors font-medium disabled:opacity-40"
    >
      {loading ? "…" : "Check In"}
    </button>
  );
}
