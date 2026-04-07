"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const INTERVAL_MS = 5000;
const STORAGE_KEY = "snobaddy_autorefresh";

export default function AutoRefreshToggle() {
  const router = useRouter();
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === "1";
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (enabled) {
      intervalRef.current = setInterval(() => router.refresh(), INTERVAL_MS);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, router]);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex items-center gap-1.5 text-xs text-gray-500"
      aria-label="Auto-refresh"
      title={enabled ? "Auto-refresh on" : "Auto-refresh off"}
    >
      <span className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${enabled ? "bg-green-500" : "bg-gray-300"}`}>
        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabled ? "translate-x-4" : "translate-x-0"}`} />
      </span>
      <span>Live</span>
    </button>
  );
}
