"use client";

import { useState, type ReactNode } from "react";

const INITIAL_LIMIT = 10;

export default function ActivityShowMore({
  children,
  totalCount,
}: {
  children: ReactNode[];
  totalCount: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const visible = expanded ? children : children.slice(0, INITIAL_LIMIT);
  const hiddenCount = totalCount - INITIAL_LIMIT;

  return (
    <div className="flex flex-col gap-3">
      {visible}
      {!expanded && hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="text-xs text-sky-600 dark:text-sky-400 hover:underline active:opacity-60 py-1"
        >
          Show {hiddenCount} more…
        </button>
      )}
    </div>
  );
}
