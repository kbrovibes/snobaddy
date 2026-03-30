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

  async function toggle() {
    setLoading(true);
    if (status === "present") {
      // Check out
      await fetch(`/api/sessions/${sessionId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_id: playerId }),
      });
      setStatus("checked-out");
    } else {
      // Check in (or re-check in after checkout)
      await fetch(`/api/sessions/${sessionId}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_id: playerId }),
      });
      setStatus("present");
    }
    setLoading(false);
    router.refresh();
  }

  if (status === "present") {
    return (
      <button
        onClick={toggle}
        disabled={loading}
        className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium whitespace-nowrap"
      >
        {loading ? "…" : "✓ Here · Leave"}
      </button>
    );
  }

  if (status === "checked-out") {
    return (
      <button
        onClick={toggle}
        disabled={loading}
        className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 font-medium whitespace-nowrap"
      >
        {loading ? "…" : "Left · Re-add"}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 font-medium whitespace-nowrap"
    >
      {loading ? "…" : "+ Check In"}
    </button>
  );
}
