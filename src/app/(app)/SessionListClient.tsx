"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SessionRow } from "@/lib/db/sessions";

const LS_KEY = "snobaddy:show-test-sessions";

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 px-1 mb-1">{label}</p>
  );
}

export default function SessionListClient({
  sessions,
  isAdmin,
}: {
  sessions: SessionRow[];
  isAdmin: boolean;
}) {
  const [showTest, setShowTest] = useState(false);

  useEffect(() => {
    try { setShowTest(localStorage.getItem(LS_KEY) === "true"); } catch {}
  }, []);

  function toggleShowTest() {
    const next = !showTest;
    setShowTest(next);
    try { localStorage.setItem(LS_KEY, String(next)); } catch {}
  }

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

  const real    = sessions.filter(s => !s.is_test_session);
  const tests   = sessions.filter(s => s.is_test_session);

  // Only the single nearest future pending session goes in Upcoming
  const nextPending = [...real]
    .filter(s => s.status === "pending" && s.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const upcoming = nextPending ? [nextPending] : [];

  // Past = completed/active + any pending sessions with a past date
  const past = real.filter(s => s.status !== "pending" || s.date < todayStr);
  // already ordered date desc from the DB

  function SessionRow({ s }: { s: SessionRow }) {
    return (
      <Link
        href={`/session/${s.id}`}
        className="flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
      >
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">{formatDate(s.date)}</span>
            {isAdmin && s.is_test_session && (
              <span className="text-xs font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">TEST</span>
            )}
          </div>
          {s.status === "pending" && (
            <span className="text-xs text-gray-400">Opens at 6pm</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {s.status === "active" ? (
            <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Active</span>
          ) : s.status === "pending" ? (
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Upcoming</span>
          ) : (
            <span className="text-xs text-gray-400">Closed</span>
          )}
          <span className="text-gray-300 text-sm">→</span>
        </div>
      </Link>
    );
  }

  return (
    <>
      {upcoming.length === 0 && past.length === 0 && (!isAdmin || tests.length === 0) ? (
        <p className="text-sm text-gray-400 text-center py-8">No sessions yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {upcoming.length > 0 && (
            <div>
              <SectionLabel label="Upcoming" />
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                {upcoming.map((s) => <SessionRow key={s.id} s={s} />)}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <SectionLabel label="Past Sessions" />
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                {past.map((s) => <SessionRow key={s.id} s={s} />)}
              </div>
            </div>
          )}

          {isAdmin && tests.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-1 mb-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Test Sessions</p>
                <button
                  onClick={toggleShowTest}
                  className="relative inline-flex w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none"
                  style={{ background: showTest ? "#f97316" : "#e5e7eb" }}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${showTest ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>
              {showTest && (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  {tests.map((s) => <SessionRow key={s.id} s={s} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
