"use client";

import { useState, useRef, useEffect } from "react";
import NavLink from "@/components/NavLink";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { useNavigationLoader } from "@/components/NavigationLoader";
import { useTheme } from "@/components/ThemeProvider";

interface HeaderProps {
  userName: string;
  playerId: string | null;
  isAdmin: boolean;
  isGodMode?: boolean;
}

export default function Header({ userName, playerId, isAdmin, isGodMode }: HeaderProps) {
  const router = useRouter();
  const { startLoading } = useNavigationLoader();
  const { theme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  async function signOut() {
    setMenuOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
    startLoading();
    router.push("/login");
  }

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const initials = userName
    .split(" ")
    .filter((n) => /^[a-zA-Z]/.test(n))
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center px-4 h-14 bg-surface dark:bg-background">
      {/* Centered logo */}
      <NavLink href="/?list=1" className="flex flex-col items-center leading-tight">
        <span className="font-bold text-heading text-2xl tracking-tight">Serve Sports</span>
        <span className="font-black text-heading text-[13px] tracking-[0.25em] uppercase -mt-0.5">Badminton</span>
      </NavLink>

      {/* Avatar + dropdown — positioned absolute right */}
      <div className="absolute right-4" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className={`flex items-center justify-center w-8 h-8 rounded-full ${isAdmin ? "bg-red-600" : "bg-sky-600"} text-white text-sm font-semibold`}
          title={userName}
        >
          {initials}
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-2 w-44 bg-surface dark:bg-[#1A1A1A] border border-border-light dark:border-border rounded-xl shadow-lg dark:shadow-none dark:ring-1 dark:ring-border overflow-hidden">
            {playerId && (
              <NavLink
                href={`/players/${playerId}`}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-text hover:bg-surface-alt transition-colors"
              >
                <span className="text-base">👤</span>
                Profile
              </NavLink>
            )}
            {isGodMode && (
              <NavLink
                href="/admin/control-panel"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-text hover:bg-surface-alt transition-colors"
              >
                <span className="text-base">⚙️</span>
                Control Panel
              </NavLink>
            )}
            <button
              onClick={() => {
                const next = theme === "dark" ? "light" : "dark";
                setTheme(next);
              }}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-text hover:bg-surface-alt transition-colors"
            >
              <span className="text-base">{theme === "dark" ? "☀️" : "🌙"}</span>
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </button>
            <button
              onClick={signOut}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-500 dark:text-red-400 hover:bg-surface-alt transition-colors"
            >
              <span className="text-base">🚪</span>
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
