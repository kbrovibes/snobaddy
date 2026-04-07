"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SkillEditor from "./SkillEditor";
import { VerifiedBadge, AdminBadge } from "./PlayerBadges";

type Status = "absent" | "present" | "checked-out";

interface Props {
  playerId: string;
  name: string;
  skillLevel: number;
  isAdminPlayer: boolean;
  hasUserAccount: boolean;
  wins: number;
  losses: number;
  sessionId?: string;
  initialStatus?: Status;
}

export default function PlayerCheckinCard({
  playerId,
  name,
  skillLevel,
  isAdminPlayer,
  hasUserAccount,
  wins,
  losses,
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
      className={`relative rounded-xl border px-2 py-1.5 flex flex-col gap-1 transition-colors ${
        present
          ? "bg-green-50 border-green-200"
          : "bg-white border-gray-100"
      }`}
    >
      {/* Check-in badge */}
      {present && (
        <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-white text-[10px] font-bold leading-none">
          ✓
        </span>
      )}

      {/* Row 1: Name — fixed 2-line height so all cards align */}
      <div className="text-xs font-semibold text-gray-900 leading-tight pr-5 min-h-[2rem]">
        <Link href={`/players/${playerId}`} className="hover:underline break-words">
          {name}
        </Link>
        {hasUserAccount && <VerifiedBadge />}
        {isAdminPlayer && <AdminBadge />}
      </div>

      {/* Row 2: Skill (editable) */}
      <div>
        <SkillEditor playerId={playerId} current={skillLevel} />
      </div>

      {/* Row 3: Action */}
      {sessionId ? (
        present ? (
          <button
            onClick={checkOut}
            disabled={loading}
            className="text-xs px-2.5 py-1 rounded-lg border border-red-200 bg-white text-red-500 font-medium hover:bg-red-50 transition-colors disabled:opacity-40"
          >
            {loading ? "…" : "Check Out"}
          </button>
        ) : (
          <button
            onClick={checkIn}
            disabled={loading}
            className="text-xs px-2.5 py-1 rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-600 transition-colors disabled:opacity-40"
          >
            {loading ? "…" : "Check In"}
          </button>
        )
      ) : (
        <div className="flex gap-2 text-xs text-gray-500">
          <span><span className="font-semibold text-gray-800">{wins}</span> W</span>
          <span><span className="font-semibold text-gray-800">{losses}</span> L</span>
        </div>
      )}
    </div>
  );
}
