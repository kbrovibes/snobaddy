"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import NavLink from "@/components/NavLink";

const AVATAR_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B',
  '#10B981', '#EF4444', '#6366F1', '#14B8A6',
];

function avatarColor(name: string): string {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter((n) => /^[a-zA-Z]/.test(n))
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

type Status = "absent" | "present" | "checked-out";

interface Props {
  playerId: string;
  name: string;
  isAdminPlayer: boolean;
  hasUserAccount: boolean;
  sessionId?: string;
  initialStatus?: Status;
  isAdmin?: boolean;
}

export default function PlayerCheckinCard({
  playerId,
  name,
  isAdminPlayer,
  hasUserAccount,
  sessionId,
  initialStatus = "absent",
  isAdmin = false,
}: Props) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const present = status === "present";

  async function checkIn() {
    if (!sessionId || loading) return;
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
    if (!sessionId || loading) return;
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

  const bg = avatarColor(name);
  const inits = initials(name);

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        borderRadius: 12,
        border: present ? '2px solid #34D399' : '1.5px solid #E7E5E4',
        boxShadow: present ? '0 2px 8px rgba(52,211,153,0.18)' : 'none',
        padding: 10,
        background: '#FFFFFF',
      }}
    >
      {/* Corner ribbon when present */}
      {present && (
        <>
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 0,
              height: 0,
              borderStyle: 'solid',
              borderWidth: '0 26px 26px 0',
              borderColor: 'transparent #34D399 transparent transparent',
            }}
          />
          <span
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              fontSize: 9,
              color: 'white',
              fontWeight: 700,
              lineHeight: 1,
              pointerEvents: 'none',
            }}
          >
            ✓
          </span>
        </>
      )}

      {/* Avatar + name — tapping opens player profile */}
      <NavLink href={`/players/${playerId}`} className="block active:opacity-70 transition-opacity">
        {/* Row 1: Avatar + admin shield */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span style={{ color: 'white', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>
              {inits}
            </span>
          </div>
          {isAdminPlayer && (
            <span style={{ fontSize: 12, lineHeight: 1 }} title="Admin">🛡️</span>
          )}
        </div>

        {/* Row 2: Player name */}
        <p
          className="truncate"
          style={{ fontSize: 13, fontWeight: 600, color: '#1C1917', marginBottom: 2, lineHeight: 1.3 }}
        >
          {name}
        </p>
      </NavLink>

      {/* Row 3: Check-in action (admin) or status (everyone) */}
      {isAdmin && sessionId ? (
        <div style={{ fontSize: 11, lineHeight: 1, marginTop: 2 }}>
          {loading ? (
            <span style={{ color: '#78716C' }}>…</span>
          ) : present ? (
            <button
              onClick={checkOut}
              className="text-red-600 hover:text-red-800 transition-colors font-medium"
              style={{ fontSize: 11, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              Check out
            </button>
          ) : (
            <button
              onClick={checkIn}
              className="text-sky-600 hover:text-sky-800 transition-colors font-medium"
              style={{ fontSize: 11, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              Check in
            </button>
          )}
        </div>
      ) : (
        <p style={{ fontSize: 11, color: present ? '#059669' : '#78716C', lineHeight: 1, marginTop: 2 }}>
          {present ? '✓ Present' : status === 'checked-out' ? 'Checked out' : ''}
        </p>
      )}
    </div>
  );
}
