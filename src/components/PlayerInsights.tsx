"use client";

import { buildNameMap, shortName } from "@/lib/display-name";

// ── Types ────────────────────────────────────────────────────────────────────

interface PartnerStat {
  name: string;
  wins: number;
  losses: number;
}

interface StreakData {
  currentWinStreak: number;
  bestWinStreak: number;
  currentWinStreakStart: string | null;
  bestWinStreakRange: string | null;
  sessionsAttended: number;
  totalSessions: number;
  careerMatches: number;
  careerWins: number;
  careerLosses: number;
}

interface SessionDay {
  date: string;
  wins: number;
  losses: number;
  attended: boolean;
}

// ── Color helpers ────────────────────────────────────────────────────────────

const AVATAR_COLORS = ["#3B82F6", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981", "#EF4444", "#6366F1", "#14B8A6"];

function avatarColor(name: string) {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

function heatColor(winPct: number): string {
  if (winPct >= 0.8) return "#15803d";
  if (winPct >= 0.65) return "#22c55e";
  if (winPct >= 0.5) return "#86efac";
  return "#fca5a5";
}

function shortDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── 1. Partner Chemistry ─────────────────────────────────────────────────────

function PartnerChemistry({ partners }: { partners: PartnerStat[] }) {
  if (partners.length === 0) return null;

  const nameMap = buildNameMap(partners.map((p) => p.name));
  const sorted = [...partners]
    .filter((p) => p.wins + p.losses >= 2)
    .sort((a, b) => {
      const aPct = a.wins / (a.wins + a.losses);
      const bPct = b.wins / (b.wins + b.losses);
      if (bPct !== aPct) return bPct - aPct;
      return (b.wins + b.losses) - (a.wins + a.losses);
    })
    .slice(0, 5);

  if (sorted.length === 0) return null;

  return (
    <div className="bg-surface rounded-xl shadow-sm dark:shadow-none dark:ring-1 dark:ring-border px-4 py-3">
      <h2 className="text-sm font-semibold text-text-light uppercase tracking-wide mb-3">
        Partner Chemistry
      </h2>
      <div className="flex flex-col">
        {sorted.map((p) => {
          const total = p.wins + p.losses;
          const pct = Math.round((p.wins / total) * 100);
          const display = shortName(p.name, nameMap);
          return (
            <div key={p.name} className="flex items-center gap-2.5 py-2 border-b border-border-light last:border-0">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                style={{ background: avatarColor(p.name) }}
              >
                {p.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-heading truncate">{display}</p>
                <div className="h-1 bg-stone-100 dark:bg-stone-800 rounded-full mt-1 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: pct >= 65 ? "#22c55e" : pct >= 50 ? "#0ea5e9" : "#f97316",
                    }}
                  />
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold tabular-nums" style={{
                  color: pct >= 65 ? "#16a34a" : pct >= 50 ? "#0ea5e9" : "#f97316",
                }}>
                  {pct}%
                </p>
                <p className="text-[10px] text-muted-lighter">{p.wins}W {p.losses}L</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 2. Streaks & Milestones ──────────────────────────────────────────────────

function StreaksCard({ data }: { data: StreakData }) {
  const attendPct = data.totalSessions > 0
    ? Math.round((data.sessionsAttended / data.totalSessions) * 100)
    : 0;

  return (
    <div className="bg-surface rounded-xl shadow-sm dark:shadow-none dark:ring-1 dark:ring-border px-4 py-3">
      <h2 className="text-sm font-semibold text-text-light uppercase tracking-wide mb-3">
        Streaks &amp; Milestones
      </h2>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-surface-alt rounded-lg px-3 py-2.5 text-center">
          <p className="text-xl font-extrabold text-green-600 dark:text-green-400 leading-none">{data.currentWinStreak}</p>
          <p className="text-[10px] font-semibold text-muted-light mt-1">Current Win Streak</p>
          {data.currentWinStreakStart && (
            <p className="text-[9px] text-muted-lighter">since {shortDate(data.currentWinStreakStart)}</p>
          )}
        </div>
        <div className="bg-surface-alt rounded-lg px-3 py-2.5 text-center">
          <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400 leading-none">{data.bestWinStreak}</p>
          <p className="text-[10px] font-semibold text-muted-light mt-1">Best Win Streak</p>
          {data.bestWinStreakRange && (
            <p className="text-[9px] text-muted-lighter">{data.bestWinStreakRange}</p>
          )}
        </div>
        <div className="bg-surface-alt rounded-lg px-3 py-2.5 text-center">
          <p className="text-xl font-extrabold text-sky-600 dark:text-sky-400 leading-none">{data.sessionsAttended}</p>
          <p className="text-[10px] font-semibold text-muted-light mt-1">Sessions Attended</p>
          <p className="text-[9px] text-muted-lighter">{attendPct}% of {data.totalSessions}</p>
        </div>
        <div className="bg-surface-alt rounded-lg px-3 py-2.5 text-center">
          <p className="text-xl font-extrabold text-purple-600 dark:text-purple-400 leading-none">{data.careerMatches}</p>
          <p className="text-[10px] font-semibold text-muted-light mt-1">Career Matches</p>
          <p className="text-[9px] text-muted-lighter">{data.careerWins}W {data.careerLosses}L</p>
        </div>
      </div>
    </div>
  );
}

// ── 3. Attendance + Session Heatmap ──────────────────────────────────────────

function AttendanceHeatmap({ sessions }: { sessions: SessionDay[] }) {
  if (sessions.length === 0) return null;

  const attended = sessions.filter((s) => s.attended).length;
  const total = sessions.length;
  const pct = Math.round((attended / total) * 100);

  // Current attendance streak (from most recent)
  let streak = 0;
  for (let i = sessions.length - 1; i >= 0; i--) {
    if (sessions[i].attended) streak++;
    else break;
  }

  return (
    <div className="bg-surface rounded-xl shadow-sm dark:shadow-none dark:ring-1 dark:ring-border px-4 py-3">
      <h2 className="text-sm font-semibold text-text-light uppercase tracking-wide mb-3">
        Attendance
      </h2>

      {/* Stats row */}
      <div className="flex items-center gap-4 mb-3">
        <div>
          <span className="text-lg font-extrabold text-heading">{attended}</span>
          <span className="text-xs text-muted-light"> / {total}</span>
        </div>
        <span className="text-xs text-muted-light">{pct}% attendance</span>
        {streak > 1 && (
          <span className="text-xs font-semibold text-green-600 dark:text-green-400">{streak} session streak</span>
        )}
      </div>

      {/* Heatmap grid */}
      <div className="flex flex-wrap gap-[3px]">
        {sessions.map((s, i) => {
          const total = s.wins + s.losses;
          const winPct = total > 0 ? s.wins / total : 0;
          const bg = !s.attended
            ? "var(--border)"
            : total === 0
            ? "#bfdbfe"
            : heatColor(winPct);

          return (
            <div
              key={i}
              className="rounded-[3px]"
              title={`${shortDate(s.date)}: ${s.attended ? `${s.wins}W ${s.losses}L` : "absent"}`}
              style={{
                width: 14,
                height: 14,
                background: bg,
              }}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-2">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--border)" }} />
          <span className="text-[9px] text-muted-lighter">Absent</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "#fca5a5" }} />
          <span className="text-[9px] text-muted-lighter">&lt;50%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "#86efac" }} />
          <span className="text-[9px] text-muted-lighter">50-65%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "#22c55e" }} />
          <span className="text-[9px] text-muted-lighter">65-80%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "#15803d" }} />
          <span className="text-[9px] text-muted-lighter">&gt;80%</span>
        </div>
      </div>
    </div>
  );
}

// ── Exported composite ───────────────────────────────────────────────────────

export { PartnerChemistry, StreaksCard, AttendanceHeatmap };
export type { PartnerStat, StreakData, SessionDay };
