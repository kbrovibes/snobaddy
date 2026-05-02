"use client";

import { useState, useRef } from "react";

interface UbrHistoryPoint {
  session_date: string;
  rating_before: number;
  rating_after: number;
  rating_change: number;
}

const CHART_W = 300;
const CHART_H = 140;
const PAD_L = 40;
const PAD_R = 12;
const PAD_T = 16;
const PAD_B = 28;
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

function getTierName(rating: number): string {
  if (rating < 2500) return "Shuttle";
  if (rating < 3500) return "Bronze";
  if (rating < 4500) return "Silver";
  if (rating < 5500) return "Gold";
  if (rating < 6500) return "Platinum";
  return "Diamond";
}

export default function UbrChart({ history, currentRating }: { history: UbrHistoryPoint[]; currentRating: number }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (history.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-2xl font-bold tabular-nums" style={{ color: getTierColor(currentRating) }}>
          {Math.round(currentRating)}
        </p>
        <p className="text-xs text-muted-light mt-1">{getTierName(currentRating)} — no sessions rated yet</p>
      </div>
    );
  }

  // Build data points: [initial rating, ...after each session]
  const points = [
    { rating: history[0].rating_before, date: "", change: 0, label: "Start" },
    ...history.map((h, i) => ({
      rating: h.rating_after,
      date: h.session_date,
      change: h.rating_change,
      label: shortDate(h.session_date),
    })),
  ];

  const ratings = points.map((p) => p.rating);
  const minR = Math.floor((Math.min(...ratings) - 50) / 100) * 100;
  const maxR = Math.ceil((Math.max(...ratings) + 50) / 100) * 100;
  const range = maxR - minR || 100;

  function xPos(i: number) {
    if (points.length === 1) return PAD_L + PLOT_W / 2;
    return PAD_L + (i / (points.length - 1)) * PLOT_W;
  }

  function yPos(rating: number) {
    return PAD_T + PLOT_H - ((rating - minR) / range) * PLOT_H;
  }

  // SVG path
  const pathData = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xPos(i).toFixed(1)} ${yPos(p.rating).toFixed(1)}`)
    .join(" ");

  // Y-axis labels (3 ticks)
  const midR = Math.round((minR + maxR) / 2);
  const yTicks = [minR, midR, maxR];

  // X-axis labels: show all dates, but skip some if too crowded
  const maxLabels = Math.floor(PLOT_W / 28); // ~28px per label
  const step = Math.max(1, Math.ceil(points.length / maxLabels));
  const xLabels: { i: number; label: string }[] = [];
  for (let i = 0; i < points.length; i += step) {
    const label = i === 0 ? "Start" : shortDate(points[i].date);
    xLabels.push({ i, label });
  }
  // Always include the last point
  if (xLabels.length === 0 || xLabels[xLabels.length - 1].i !== points.length - 1) {
    xLabels.push({ i: points.length - 1, label: shortDate(points[points.length - 1].date) });
  }

  const lineColor = getTierColor(currentRating);
  const lastChange = history[history.length - 1]?.rating_change ?? 0;

  // Touch/hover handling
  function handleInteraction(clientX: number) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * CHART_W;
    // Find nearest point
    let nearest = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dist = Math.abs(relX - xPos(i));
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    }
    setActiveIdx(nearest);
  }

  const active = activeIdx !== null ? points[activeIdx] : null;

  return (
    <div>
      {/* Header: current rating or hovered value */}
      <div className="flex items-center justify-between mb-2" style={{ minHeight: 36 }}>
        {active ? (
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums" style={{ color: lineColor }}>
              {Math.round(active.rating)}
            </span>
            {active.change !== 0 && (
              <span className={`text-xs font-semibold ${active.change > 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                {active.change > 0 ? "+" : ""}{Math.round(active.change)}
              </span>
            )}
            <span className="text-xs text-muted-light">
              {activeIdx === 0 ? "Initial" : active.label}
            </span>
          </div>
        ) : (
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
        )}
        <span className="text-xs text-muted-light">{history.length} sessions</span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="w-full touch-none"
        style={{ maxHeight: 180 }}
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={(e) => handleInteraction(e.clientX)}
        onMouseLeave={() => setActiveIdx(null)}
        onTouchMove={(e) => {
          e.preventDefault();
          handleInteraction(e.touches[0].clientX);
        }}
        onTouchEnd={() => setActiveIdx(null)}
      >
        {/* Grid lines */}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD_L} y1={yPos(tick)} x2={CHART_W - PAD_R} y2={yPos(tick)}
              className="stroke-stone-200 dark:stroke-stone-700" strokeWidth={0.5} strokeDasharray="3,3"
            />
            <text x={PAD_L - 4} y={yPos(tick) + 3} textAnchor="end" fontSize={8} className="fill-stone-400 dark:fill-stone-500">
              {tick}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path
          d={`${pathData} L ${xPos(points.length - 1).toFixed(1)} ${yPos(minR).toFixed(1)} L ${xPos(0).toFixed(1)} ${yPos(minR).toFixed(1)} Z`}
          fill={lineColor}
          fillOpacity={0.08}
        />

        {/* Line */}
        <path d={pathData} fill="none" stroke={lineColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {/* Initial point marker (hollow circle) */}
        <circle cx={xPos(0)} cy={yPos(points[0].rating)} r={4} fill="none" stroke={lineColor} strokeWidth={1.5} />
        <circle cx={xPos(0)} cy={yPos(points[0].rating)} r={1.5} fill={lineColor} />

        {/* Session dots */}
        {points.slice(1).map((p, i) => (
          <circle
            key={i + 1}
            cx={xPos(i + 1)}
            cy={yPos(p.rating)}
            r={activeIdx === i + 1 ? 4.5 : 2.5}
            fill={lineColor}
            className="transition-[r] duration-100"
          />
        ))}

        {/* Active crosshair */}
        {activeIdx !== null && (
          <line
            x1={xPos(activeIdx)} y1={PAD_T} x2={xPos(activeIdx)} y2={PAD_T + PLOT_H}
            stroke={lineColor} strokeWidth={0.75} strokeDasharray="2,2" opacity={0.5}
          />
        )}

        {/* X-axis labels */}
        {xLabels.map(({ i, label }) => (
          <text
            key={i}
            x={xPos(i)}
            y={CHART_H - 6}
            textAnchor="middle"
            fontSize={7}
            className={activeIdx === i ? "fill-stone-600 dark:fill-stone-300" : "fill-stone-400 dark:fill-stone-500"}
            fontWeight={activeIdx === i ? 600 : 400}
          >
            {label}
          </text>
        ))}
      </svg>
    </div>
  );
}
