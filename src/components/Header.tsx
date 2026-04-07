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
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14 bg-white border-b border-stone-100">
      <Link href="/" className="flex items-center gap-2">
        <span className="text-xl">🏸</span>
        <div className="flex flex-col leading-tight">
          <span className="font-bold text-stone-900 text-xl">Serve Snoqualmie</span>
          <span className="font-black text-stone-900 text-xs tracking-[0.2em] uppercase">Badminton</span>
        </div>
      </Link>
      <div className="flex items-center gap-3">
        <button
          onClick={signOut}
          className="text-xs text-sky-600 hover:text-sky-800 transition-colors font-medium"
        >
          Logout
        </button>
        {isGodMode && (
          <Link href="/admin/control-panel" title="Control Panel" className="text-stone-400 hover:text-stone-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
        )}
        {playerId ? (
          <Link
            href={`/players/${playerId}`}
            className={`flex items-center justify-center w-8 h-8 rounded-full ${isAdmin ? "bg-red-600" : "bg-sky-600"} text-white text-sm font-semibold`}
            title={userName}
          >
            {initials}
          </Link>
        ) : (
          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${isAdmin ? "bg-red-600" : "bg-sky-600"} text-white text-sm font-semibold`}>
            {initials}
          </div>
        )}
      </div>
    </header>
  );
}
