"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function StartSessionButton({ sessionId }: { sessionId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function start() {
    setLoading(true);
    await fetch(`/api/sessions/${sessionId}/start`, { method: "POST" });
    router.refresh();
  }

  return (
    <button
      onClick={start}
      disabled={loading}
      className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl disabled:opacity-50 hover:bg-green-700 transition-colors"
    >
      {loading ? "Starting…" : "▶ Start Tonight's Session"}
    </button>
  );
}
