"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

interface HeaderProps {
  userName: string;
  playerId: string | null;
  isAdmin: boolean;
  isGodMode?: boolean;
}

export default function Header({ userName, playerId, isAdmin, isGodMode }: HeaderProps) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const initials = userName
    .split(" ")
    .filter((n) => /^[a-zA-Z]/.test(n))
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14 bg-white border-b border-gray-100">
      <Link href="/" className="flex items-center gap-2">
        <span className="text-xl">🏸</span>
        <div className="flex flex-col leading-tight">
          <span className="font-bold text-gray-900 text-xl">Serve Snoqualmie</span>
          <span className="font-black text-gray-900 text-xs tracking-[0.2em] uppercase">Badminton</span>
        </div>
      </Link>
      <div className="flex items-center gap-3">
        {isGodMode && (
          <Link href="/admin/control-panel" className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded hover:bg-purple-100 transition-colors">
            ⚙ Panel
          </Link>
        )}
        <button
          onClick={signOut}
          className="text-xs text-blue-600 hover:text-blue-800 transition-colors font-medium"
        >
          Logout
        </button>
        {playerId ? (
          <Link
            href={`/players/${playerId}`}
            className={`flex items-center justify-center w-8 h-8 rounded-full ${isAdmin ? "bg-red-600" : "bg-blue-600"} text-white text-sm font-semibold`}
            title={userName}
          >
            {initials}
          </Link>
        ) : (
          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${isAdmin ? "bg-red-600" : "bg-blue-600"} text-white text-sm font-semibold`}>
            {initials}
          </div>
        )}
      </div>
    </header>
  );
}
