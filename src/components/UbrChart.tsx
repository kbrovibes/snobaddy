"use client";

interface UbrHistoryPoint {
  session_date: string;
  rating_before: number;
  rating_after: number;
  rating_change: number;
}

const CHART_W = 300;
const CHART_H = 120;
const PAD_L = 40;
const PAD_R = 8;
const PAD_T = 12;
const PAD_B = 24;
const PLOT_W = CHART_W - PAD_L - PAD_R;
const PLOT_H = CHART_H - PAD_T - PAD_B;

function shortDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
}

function getTierColor(rating: number): string {
  if (rating < 2500) return "#a8a29e"; // Shuttle
  if (rating < 3500) return "#d97706"; // Bronze
  if (rating < 4500) return "#6b7280"; // Silver
  if (rating < 5500) return "#eab308"; // Gold
  if (rating < 6500) return "#8b5cf6"; // Platinum
  return "#3b82f6";                     // Diamond
}

export default function UbrChart({ history, currentRating }: { history: UbrHistoryPoint[]; currentRating: number }) {
  if (history.length === 0) {
    return <p className="text-sm text-muted-light">No UBR history yet.</p>;
  }

  // Build data points: [initial rating, ...after each session]
  const points = [
    { rating: history[0].rating_before, date: "" },
    ...history.map((h) => ({ rating: h.rating_after, date: h.session_date })),
  ];

  const ratings = points.map((p) => p.rating);
  const minR = Math.floor((Math.min(...ratings) - 50) / 100) * 100;
  const maxR = Math.ceil((Math.max(...ratings) + 50) / 100) * 100;
  const range = maxR - minR || 100;

  function x(i: number) {
    return PAD_L + (i / (points.length - 1)) * PLOT_W;
  }

  function y(rating: number) {
    return PAD_T + PLOT_H - ((rating - minR) / range) * PLOT_H;
  }

  // Build SVG path
  const pathData = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.rating).toFixed(1)}`)
    .join(" ");

  // Y-axis labels (3 ticks)
  const midR = Math.round((minR + maxR) / 2);
  const yTicks = [minR, midR, maxR];

  // X-axis labels (show first, middle, last dates)
  const xLabels: { i: number; label: string }[] = [];
  const datedPoints = points.filter((p) => p.date);
  if (datedPoints.length > 0) {
    xLabels.push({ i: 1, label: shortDate(datedPoints[0].date) });
    if (datedPoints.length > 2) {
      const midIdx = Math.floor(datedPoints.length / 2);
      xLabels.push({ i: midIdx + 1, label: shortDate(datedPoints[midIdx].date) });
    }
    xLabels.push({ i: points.length - 1, label: shortDate(datedPoints[datedPoints.length - 1].date) });
  }

  const lineColor = getTierColor(currentRating);

  // Determine last change for trend
  const lastChange = history[history.length - 1]?.rating_change ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums" style={{ color: lineColor }}>
            {Math.round(currentRating)}
          </span>
          {lastChange !== 0 && (
            <span className={`text-xs font-semibold ${lastChange > 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
              {lastChange > 0 ? "+" : ""}{Math.round(lastChange)}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-light">{history.length} sessions rated</span>
      </div>

      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="w-full"
        style={{ maxHeight: 160 }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD_L} y1={y(tick)} x2={CHART_W - PAD_R} y2={y(tick)}
              stroke="var(--border)" strokeWidth={0.5} strokeDasharray="3,3"
            />
            <text x={PAD_L - 4} y={y(tick) + 3} textAnchor="end" fontSize={8} fill="var(--muted-lt)">
              {tick}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path
          d={`${pathData} L ${x(points.length - 1).toFixed(1)} ${y(minR).toFixed(1)} L ${x(0).toFixed(1)} ${y(minR).toFixed(1)} Z`}
          fill={lineColor}
          fillOpacity={0.08}
        />

        {/* Line */}
        <path d={pathData} fill="none" stroke={lineColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.rating)} r={i === points.length - 1 ? 3.5 : 2} fill={lineColor} />
        ))}

        {/* X-axis labels */}
        {xLabels.map(({ i, label }) => (
          <text key={i} x={x(i)} y={CHART_H - 4} textAnchor="middle" fontSize={7} fill="var(--muted-lt)">
            {label}
          </text>
        ))}
      </svg>
    </div>
  );
}
