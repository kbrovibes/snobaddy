"use client";

import { useEffect, useState } from "react";
import NavLink from "@/components/NavLink";
import type { SessionRow } from "@/lib/db/sessions";

const VISIBLE_PAST = 6;

const LS_KEY = "snobaddy:show-test-sessions";

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-light px-1 mb-1">{label}</p>
  );
}

export default function SessionListClient({
  sessions,
  isAdmin,
  seasonLockDate = null,
  activeSeasonId = null,
}: {
  sessions: SessionRow[];
  isAdmin: boolean;
  seasonLockDate?: string | null;
  activeSeasonId?: string | null;
}) {
  const [showTest, setShowTest] = useState(false);
  const [showAllPast, setShowAllPast] = useState(false);

  useEffect(() => {
    try { setShowTest(localStorage.getItem(LS_KEY) === "true"); } catch {}
  }, []);

  function toggleShowTest() {
    const next = !showTest;
    setShowTest(next);
    try { localStorage.setItem(LS_KEY, String(next)); } catch {}
  }

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const lockActive = !!seasonLockDate && seasonLockDate < todayStr;

  const real  = sessions.filter(s => !s.is_test_session);
  const tests = sessions.filter(s => s.is_test_session);

  const nextPending = [...real]
    .filter(s => s.status === "pending" && s.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const upcoming = nextPending ? [nextPending] : [];

  const past = real.filter(s => s.status !== "pending" || s.date < todayStr);

  function SessionRow({ s, isLocked = false, isCutoff = false }: { s: SessionRow; isLocked?: boolean; isCutoff?: boolean }) {
    return (
      <NavLink
        href={`/session/${s.id}`}
        className={`flex items-center justify-between px-4 py-3 border-b border-border-light last:border-0 hover:bg-surface-alt active:bg-sky-50 dark:active:bg-sky-500/10 transition-colors${isLocked ? " opacity-50" : ""}`}
      >
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-text">{formatDate(s.date)}</span>
            {isCutoff && (
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded-full tracking-wide">🔒 CUTOFF</span>
            )}
          </div>
          {isAdmin && s.is_test_session && (
            <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wide">Test Session</span>
          )}
          {s.status === "pending" && (
            <span className="text-xs text-muted-light">Opens at 6pm</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {s.status === "active" ? (
            <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-white bg-sky-700 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
              In Progress
            </span>
          ) : s.status === "pending" ? (
            <span className="text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 px-2 py-0.5 rounded-full">Upcoming</span>
          ) : s.match_count === 0 && s.tally_count === 0 ? (
            <span className="text-xs font-semibold uppercase tracking-wide text-red-400 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-full">No Data</span>
          ) : (
            <span className="text-xs font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 px-2 py-0.5 rounded-full">Finalized</span>
          )}
          <span className="text-muted-lighter text-sm">→</span>
        </div>
      </NavLink>
    );
  }

  function renderPast(items: SessionRow[]) {
    // In date-desc order, first item with date <= lockDate is the most recent counted session
    const cutoffIdx = lockActive ? items.findIndex(s => s.date <= seasonLockDate!) : -1;
    return items.map((s, i) => (
      <SessionRow
        key={s.id}
        s={s}
        isLocked={lockActive && s.date > (seasonLockDate ?? "")}
        isCutoff={i === cutoffIdx}
      />
    ));
  }

  return (
    <>
      {isAdmin && activeSeasonId && (
        <NavLink
          href={`/admin/seasons/${activeSeasonId}/newsletter`}
          className="flex items-center gap-3 px-4 py-3 mb-4 rounded-xl bg-surface shadow-sm hover:bg-surface-alt active:bg-sky-50 dark:active:bg-sky-500/10 transition-colors"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-stone-900 dark:bg-sky-600 text-white text-lg flex-shrink-0">
            📰
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-semibold text-heading">Season newsletter</span>
            <span className="text-xs text-muted-light">Stats, awards, and observations from this season</span>
          </div>
          <span className="text-muted-lighter text-sm">→</span>
        </NavLink>
      )}
      {upcoming.length === 0 && past.length === 0 && (!isAdmin || tests.length === 0) ? (
        <p className="text-sm text-muted-light text-center py-8">No sessions yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {upcoming.length > 0 && (
            <div>
              <SectionLabel label="Upcoming" />
              <div className="bg-surface rounded-xl shadow-sm overflow-hidden">
                {upcoming.map((s) => <SessionRow key={s.id} s={s} />)}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <SectionLabel label="Past Sessions" />
              <div className="bg-surface rounded-xl shadow-sm overflow-hidden">
                {renderPast(past.length > VISIBLE_PAST && !showAllPast ? past.slice(0, VISIBLE_PAST) : past)}
              </div>
              {past.length > VISIBLE_PAST && (
                <button
                  onClick={() => setShowAllPast(!showAllPast)}
                  className="w-full text-center text-sm text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 font-medium py-2 mt-1"
                >
                  {showAllPast ? "Show less" : `Show ${past.length - VISIBLE_PAST} older sessions`}
                </button>
              )}
            </div>
          )}

          {isAdmin && tests.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-1 mb-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-light">Test Sessions</p>
                <button
                  onClick={toggleShowTest}
                  className="relative inline-flex w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none"
                  style={{ background: showTest ? "#f97316" : "var(--muted-lighter)" }}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${showTest ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>
              {showTest && (
                <div className="bg-surface rounded-xl shadow-sm overflow-hidden">
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
