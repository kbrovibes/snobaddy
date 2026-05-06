"use client";

import { useEffect, useRef } from "react";

interface SessionStat {
  date: string;
  wins: number;
  losses: number;
  win_pct: number;
  absent?: boolean;
  isOpen?: boolean;
}

const BAR_W = 28;
const GAP = 6;
const CHART_H = 100;
const LABEL_H = 20;
const TOTAL_H = CHART_H + LABEL_H;
const COMPRESSED_W = 16;

function shortDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
}

type DisplayItem =
  | { type: "session"; stat: SessionStat }
  | { type: "gap"; count: number; firstDate: string; lastDate: string };

function compressData(data: SessionStat[]): DisplayItem[] {
  const items: DisplayItem[] = [];
  let i = 0;
  while (i < data.length) {
    if (data[i].absent && !data[i].isOpen) {
      let j = i;
      while (j < data.length && data[j].absent && !data[j].isOpen) j++;
      const count = j - i;
      if (count >= 2) {
        items.push({ type: "gap", count, firstDate: data[i].date, lastDate: data[j - 1].date });
      } else {
        items.push({ type: "session", stat: data[i] });
      }
      i = j;
    } else {
      items.push({ type: "session", stat: data[i] });
      i++;
    }
  }
  return items;
}

export default function SessionStatsChart({ data }: { data: SessionStat[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [data]);

  if (data.length === 0) {
    return <p className="text-sm text-muted-light">No match data yet.</p>;
  }

  const hasOpenSession = data.some((s) => s.isOpen);
  const maxMatches = Math.max(...data.map((s) => s.wins + s.losses), 1);
  const items = compressData(data);

  let totalW = 0;
  for (const item of items) {
    if (totalW > 0) totalW += GAP;
    totalW += item.type === "gap" ? COMPRESSED_W : BAR_W;
  }

  return (
    <div ref={scrollRef} className="overflow-x-auto">
      <div className="flex gap-3 mb-2">
        <span className="flex items-center gap-1 text-xs text-text-light">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-400" />
          Wins
        </span>
        <span className="flex items-center gap-1 text-xs text-text-light">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-300" />
          Losses
        </span>
        {hasOpenSession && (
          <span className="flex items-center gap-1 text-xs text-sky-400">
            * In progress
          </span>
        )}
      </div>
      <svg width={totalW} height={TOTAL_H} className="block">
        {/* 50% reference line */}
        <line
          x1={0} y1={CHART_H / 2}
          x2={totalW} y2={CHART_H / 2}
          stroke="var(--muted-lighter)" strokeDasharray="3 2"
        />

        {(() => {
          let x = 0;
          return items.map((item, i) => {
            const curX = x;
            x += (item.type === "gap" ? COMPRESSED_W : BAR_W) + GAP;

            if (item.type === "gap") {
              return (
                <g key={`gap-${item.firstDate}`}>
                  <title>{shortDate(item.firstDate)} – {shortDate(item.lastDate)}: {item.count} sessions missed</title>
                  <text x={curX + COMPRESSED_W / 2} y={CHART_H - 6} textAnchor="middle" fontSize={10} fill="var(--muted-lighter)">
                    ···
                  </text>
                  <text x={curX + COMPRESSED_W / 2} y={CHART_H + 14} textAnchor="middle" fontSize={8} fill="#d1d5db">
                    ×{item.count}
                  </text>
                </g>
              );
            }

            const s = item.stat;

            if (s.absent) {
              return (
                <g key={s.date}>
                  <title>{shortDate(s.date)}: {s.isOpen ? "In progress" : "Did not play"}</title>
                  <rect x={curX} y={CHART_H - 4} width={BAR_W} height={4} rx={1} fill={s.isOpen ? "#93c5fd" : "var(--muted-lighter)"} />
                  <text x={curX + BAR_W / 2} y={CHART_H + 14} textAnchor="middle" fontSize={9} fill={s.isOpen ? "#93c5fd" : "#d1d5db"}>
                    {shortDate(s.date)}{s.isOpen ? "*" : ""}
                  </text>
                </g>
              );
            }

            const winH = Math.round((s.wins / maxMatches) * CHART_H);
            const lossH = Math.round((s.losses / maxMatches) * CHART_H);
            const totalBarH = winH + lossH;

            const winY = CHART_H - totalBarH;
            const lossY = CHART_H - lossH;

            return (
              <g key={s.date}>
                <title>{shortDate(s.date)}{s.isOpen ? "*" : ""}: {s.wins}W {s.losses}L{s.isOpen ? " (in progress)" : ""}</title>

                {winH > 0 && (
                  <rect x={curX} y={winY} width={BAR_W} height={winH} rx={2} fill="#4ade80" opacity={0.9} />
                )}
                {winH >= 14 && (
                  <text x={curX + BAR_W / 2} y={winY + 11} textAnchor="middle" fontSize={9} fill="white" fontWeight="600">
                    {s.wins}
                  </text>
                )}

                {lossH > 0 && (
                  <rect x={curX} y={lossY} width={BAR_W} height={lossH} rx={2} fill="#f87171" opacity={0.85} />
                )}
                {lossH >= 14 && (
                  <text x={curX + BAR_W / 2} y={lossY + 11} textAnchor="middle" fontSize={9} fill="white" fontWeight="600">
                    {s.losses}
                  </text>
                )}

                <text x={curX + BAR_W / 2} y={CHART_H + 14} textAnchor="middle" fontSize={9} fill={s.isOpen ? "#60a5fa" : "#9ca3af"}>
                  {shortDate(s.date)}{s.isOpen ? "*" : ""}
                </text>
              </g>
            );
          });
        })()}
      </svg>
    </div>
  );
}
