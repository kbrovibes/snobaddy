"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Session", icon: "🏸", adminOnly: false, godModeOnly: false },
  { href: "/admin", label: "Admin", icon: "👥", adminOnly: true, godModeOnly: false },
  { href: "/leaderboard", label: "Leaderboard", icon: "🏆", adminOnly: false, godModeOnly: false },
  { href: "/admin/control-panel", label: "Control Panel", icon: "⚙️", adminOnly: false, godModeOnly: true },
];

export default function BottomNav({ isAdmin, isGodMode }: { isAdmin: boolean; isGodMode: boolean }) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter(
    (item) => (!item.adminOnly || isAdmin) && (!item.godModeOnly || isGodMode)
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex bg-white border-t border-gray-100">
      {visibleItems.map(({ href, label, icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-xs font-medium transition-colors ${
              active ? "text-blue-600" : "text-gray-400"
            }`}
          >
            <span className="text-xl leading-none">{icon}</span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
