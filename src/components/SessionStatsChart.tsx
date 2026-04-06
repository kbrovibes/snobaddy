"use client";

interface SessionStat {
  date: string;
  wins: number;
  losses: number;
  win_pct: number;
}

const BAR_W = 28;
const GAP = 6;
const CHART_H = 100;
const LABEL_H = 20;
const TOTAL_H = CHART_H + LABEL_H;

function shortDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
}

export default function SessionStatsChart({ data }: { data: SessionStat[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-400">No match data yet.</p>;
  }

  const maxMatches = Math.max(...data.map((s) => s.wins + s.losses), 1);
  const totalW = data.length * (BAR_W + GAP) - GAP;

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-3 mb-2">
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-400" />
          Wins
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-300" />
          Losses
        </span>
      </div>
      <svg width={totalW} height={TOTAL_H} className="block">
        {/* 50% reference line */}
        <line
          x1={0} y1={CHART_H / 2}
          x2={totalW} y2={CHART_H / 2}
          stroke="#e5e7eb" strokeDasharray="3 2"
        />

        {data.map((s, i) => {
          const x = i * (BAR_W + GAP);
          const winH = Math.round((s.wins / maxMatches) * CHART_H);
          const lossH = Math.round((s.losses / maxMatches) * CHART_H);
          const totalBarH = winH + lossH;

          const winY = CHART_H - totalBarH;
          const lossY = CHART_H - lossH;

          return (
            <g key={s.date}>
              <title>{shortDate(s.date)}: {s.wins}W {s.losses}L</title>

              {/* Wins (green, top portion) */}
              {winH > 0 && (
                <rect x={x} y={winY} width={BAR_W} height={winH} rx={2} fill="#4ade80" opacity={0.9} />
              )}
              {winH >= 14 && (
                <text x={x + BAR_W / 2} y={winY + 11} textAnchor="middle" fontSize={9} fill="white" fontWeight="600">
                  {s.wins}
                </text>
              )}

              {/* Losses (red, bottom portion) */}
              {lossH > 0 && (
                <rect x={x} y={lossY} width={BAR_W} height={lossH} rx={2} fill="#f87171" opacity={0.85} />
              )}
              {lossH >= 14 && (
                <text x={x + BAR_W / 2} y={lossY + 11} textAnchor="middle" fontSize={9} fill="white" fontWeight="600">
                  {s.losses}
                </text>
              )}

              {/* Date label */}
              <text x={x + BAR_W / 2} y={CHART_H + 14} textAnchor="middle" fontSize={9} fill="#9ca3af">
                {shortDate(s.date)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
