"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const THRESHOLD = 72;   // px of pull needed to trigger
const MAX_PULL  = 96;   // px cap on visual stretch

export default function PullToRefresh() {
  const router = useRouter();
  const startYRef  = useRef<number | null>(null);
  const startXRef  = useRef<number | null>(null);
  const [pull, setPull]       = useState(0);   // 0–MAX_PULL
  const [refreshing, setRefreshing] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);
  }, []);

  useEffect(() => {
    if (!isStandalone) return;

    function onTouchStart(e: TouchEvent) {
      if (window.scrollY > 0) return;           // only at top of page
      startYRef.current = e.touches[0].clientY;
      startXRef.current = e.touches[0].clientX;
    }

    function onTouchMove(e: TouchEvent) {
      if (startYRef.current === null) return;
      const dy = e.touches[0].clientY - startYRef.current;
      const dx = e.touches[0].clientX - startXRef.current!;
      // ignore if more horizontal than vertical
      if (Math.abs(dx) > Math.abs(dy)) { startYRef.current = null; return; }
      if (dy <= 0) return;
      e.preventDefault();
      setPull(Math.min(dy * 0.5, MAX_PULL));    // dampen + cap
    }

    function onTouchEnd() {
      if (pull >= THRESHOLD && !refreshing) {
        setRefreshing(true);
        setPull(0);
        router.refresh();
        setTimeout(() => setRefreshing(false), 1000);
      } else {
        setPull(0);
      }
      startYRef.current = null;
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove",  onTouchMove,  { passive: false });
    document.addEventListener("touchend",   onTouchEnd,   { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove",  onTouchMove);
      document.removeEventListener("touchend",   onTouchEnd);
    };
  }, [isStandalone, pull, refreshing, router]);

  if (!isStandalone) return null;

  const progress = Math.min(pull / THRESHOLD, 1);
  const triggered = pull >= THRESHOLD;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pointer-events-none overflow-hidden"
      style={{ height: refreshing ? 40 : pull > 0 ? pull : 0, transition: pull === 0 ? "height 0.2s ease" : "none" }}
    >
      <div
        className="flex items-center justify-center w-8 h-8 rounded-full bg-white shadow-md"
        style={{ opacity: refreshing ? 1 : progress, transform: `scale(${0.5 + progress * 0.5})` }}
      >
        <svg
          className={`w-4 h-4 ${refreshing ? "animate-spin text-sky-500" : triggered ? "text-sky-500" : "text-stone-400"}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
        >
          {refreshing ? (
            <path strokeLinecap="round" d="M12 3a9 9 0 1 0 9 9" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0 1 15-3.87M20 15a9 9 0 0 1-15 3.87" />
          )}
        </svg>
      </div>
    </div>
  );
}
