"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

interface HeaderProps {
  userName: string;
  playerId: string | null;
}

export default function Header({ userName, playerId }: HeaderProps) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14 bg-white border-b border-gray-100">
      <div className="flex items-center gap-2">
        <span className="text-xl">🏸</span>
        <span className="font-bold text-gray-900 text-lg">snobaddy</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={signOut}
          className="text-xs text-gray-400 hover:text-red-400 transition-colors"
        >
          Sign out
        </button>
        {playerId ? (
          <Link
            href={`/players/${playerId}`}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-semibold"
            title={userName}
          >
            {initials}
          </Link>
        ) : (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-semibold">
            {initials}
          </div>
        )}
      </div>
    </header>
  );
}
