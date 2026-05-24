"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type IconProps = { className?: string };

function RacketIcon({ className }: IconProps) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="8.5" r="5.5" />
      <line x1="12" y1="3" x2="12" y2="14" />
      <line x1="6.5" y1="8.5" x2="17.5" y2="8.5" />
      <path d="M11 14 L9 22" />
    </svg>
  );
}

function PlayersIcon({ className }: IconProps) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="9" cy="7" r="3" />
      <path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1" />
      <circle cx="17" cy="6.5" r="2.5" />
      <path d="M21 21v-.5a4.5 4.5 0 0 0-2.5-4.1" />
    </svg>
  );
}

function LeaderboardIcon({ className }: IconProps) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {/* Podium: 2nd (left, medium), 1st (center, tallest), 3rd (right, shortest) */}
      <rect x="2.5" y="14" width="5" height="7" rx="1" />
      <rect x="9.5" y="9" width="5" height="12" rx="1" />
      <rect x="16.5" y="16" width="5" height="5" rx="1" />
    </svg>
  );
}

function CalendarIcon({ className }: IconProps) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2.5" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <circle cx="8" cy="14.5" r="0.85" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14.5" r="0.85" fill="currentColor" stroke="none" />
      <circle cx="16" cy="14.5" r="0.85" fill="currentColor" stroke="none" />
      <circle cx="8" cy="18.5" r="0.85" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18.5" r="0.85" fill="currentColor" stroke="none" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "/", label: "Session", Icon: RacketIcon, adminOnly: false, godModeOnly: false },
  { href: "/players", label: "Players", Icon: PlayersIcon, adminOnly: false, godModeOnly: false },
  { href: "/leaderboard", label: "Leaderboard", Icon: LeaderboardIcon, adminOnly: true, godModeOnly: false },
  { href: "/admin/seasons", label: "Seasons", Icon: CalendarIcon, adminOnly: true, godModeOnly: false },
];

export default function BottomNav({ isAdmin, isGodMode }: { isAdmin: boolean; isGodMode: boolean }) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter(
    (item) => (!item.adminOnly || isAdmin) && (!item.godModeOnly || isGodMode)
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex bg-surface border-t border-border-light">
      {visibleItems.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-xs font-medium transition-colors active:bg-surface-alt ${
              active ? "text-sky-600 dark:text-sky-400" : "text-stone-400 dark:text-muted-light"
            }`}
          >
            <Icon />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
