"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useNavigationLoader } from "@/components/NavigationLoader";

export default function CreateSessionButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { startLoading } = useNavigationLoader();

  async function handleCreate() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/sessions/create", { method: "POST" });
    if (res.ok) {
      const { id } = await res.json();
      startLoading();
      router.push(`/session/${id}`);
    } else {
      const body = await res.json();
      setError(body.error ?? "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleCreate}
        disabled={loading}
        className="px-5 py-2.5 text-sm font-semibold text-white bg-sky-600 rounded-xl disabled:opacity-50 hover:bg-sky-500 transition-colors"
      >
        {loading ? "Starting…" : "+ Start New Session"}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
