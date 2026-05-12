"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadScoresButton({ sessionId }: { sessionId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClick() {
    if (!confirm("Finalize this session so you can upload scores? Players won't be able to check in after this.")) return;
    setLoading(true);
    const res = await fetch(`/api/sessions/${sessionId}/close`, { method: "POST" });
    if (res.ok) {
      router.refresh();
    } else {
      alert("Failed to finalize session");
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="w-full py-2.5 text-sm font-medium rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white disabled:opacity-50 transition-colors"
    >
      {loading ? "Finalizing…" : "📷  Upload Scores & Finalize"}
    </button>
  );
}
