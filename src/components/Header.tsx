"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

interface HeaderProps {
  userName: string;
  playerId: string | null;
  isAdmin: boolean;
}

export default function Header({ userName, playerId, isAdmin }: HeaderProps) {
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
        <span className="font-bold text-gray-900 text-lg">Serve Snoqualmie Badminton</span>
      </Link>
      <div className="flex items-center gap-3">
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
