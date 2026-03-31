"use client";

interface SessionStat {
  date: string;
  wins: number;
  losses: number;
  win_pct: number;
}

const BAR_W = 28;
const GAP = 6;
const CHART_H = 96;
const LABEL_H = 20;
const TOTAL_H = CHART_H + LABEL_H;

function shortDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
}

export default function WinPctChart({ data }: { data: SessionStat[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-400">No match data yet.</p>;
  }

  const totalW = data.length * (BAR_W + GAP) - GAP;

  return (
    <div className="overflow-x-auto">
      <svg width={totalW} height={TOTAL_H} className="block">
        {/* 50% reference line */}
        <line
          x1={0} y1={CHART_H / 2}
          x2={totalW} y2={CHART_H / 2}
          stroke="#e5e7eb" strokeDasharray="3 2"
        />

        {data.map((s, i) => {
          const x = i * (BAR_W + GAP);
          const barH = Math.max(2, Math.round((s.win_pct / 100) * CHART_H));
          const y = CHART_H - barH;
          const color = s.win_pct >= 50 ? "#3b82f6" : "#f87171";

          return (
            <g key={s.date}>
              <title>{shortDate(s.date)}: {s.wins}W {s.losses}L ({s.win_pct}%)</title>
              <rect x={x} y={y} width={BAR_W} height={barH} rx={3} fill={color} opacity={0.85} />
              {barH >= 14 && (
                <text
                  x={x + BAR_W / 2} y={y + 11}
                  textAnchor="middle" fontSize={9} fill="white" fontWeight="600"
                >
                  {s.win_pct}%
                </text>
              )}
              <text
                x={x + BAR_W / 2} y={CHART_H + 14}
                textAnchor="middle" fontSize={9} fill="#9ca3af"
              >
                {shortDate(s.date)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
