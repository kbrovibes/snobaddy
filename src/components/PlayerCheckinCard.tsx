"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { VerifiedBadge, AdminBadge } from "./PlayerBadges";

type Status = "absent" | "present" | "checked-out";

// Shorten long names to "First L" to fit in compact 3-col grid
function compactName(name: string): string {
  if (name.length <= 11) return name;
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}`;
}

interface Props {
  playerId: string;
  name: string;
  isAdminPlayer: boolean;
  hasUserAccount: boolean;
  sessionId?: string;
  initialStatus?: Status;
}

export default function PlayerCheckinCard({
  playerId,
  name,
  isAdminPlayer,
  hasUserAccount,
  sessionId,
  initialStatus = "absent",
}: Props) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const present = status === "present";

  async function checkIn() {
    if (!sessionId) return;
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
    if (!sessionId) return;
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

  return (
    <div
      className={`relative rounded-xl border px-2 py-2 flex flex-col gap-1.5 transition-colors ${
        present
          ? "bg-green-50 border-green-200"
          : "bg-white border-gray-100"
      }`}
    >
      {/* Check-in indicator */}
      {present && (
        <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-white text-[10px] font-bold leading-none">
          ✓
        </span>
      )}

      {/* Name */}
      <div className="text-xs font-semibold text-gray-900 leading-tight pr-5">
        <Link href={`/players/${playerId}`} className="hover:underline" title={name}>
          {compactName(name)}
        </Link>
        {hasUserAccount && <VerifiedBadge />}
        {isAdminPlayer && <AdminBadge />}
      </div>

      {/* Action button — always shown, disabled when no active session */}
      {present ? (
        <button
          onClick={checkOut}
          disabled={loading}
          className="text-[11px] px-1.5 py-0.5 rounded border border-red-200 bg-white text-red-500 font-medium hover:bg-red-50 transition-colors disabled:opacity-40"
        >
          {loading ? "…" : "Check Out"}
        </button>
      ) : (
        <button
          onClick={checkIn}
          disabled={loading || !sessionId}
          className="text-[11px] px-1.5 py-0.5 rounded bg-sky-500 text-white font-semibold hover:bg-sky-600 transition-colors disabled:opacity-50"
        >
          {loading ? "…" : "Check In"}
        </button>
      )}
    </div>
  );
}
