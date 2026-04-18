"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useNavigationLoader } from "@/components/NavigationLoader";

export default function DeleteFinalsButton({ eventId }: { eventId: string }) {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const { startLoading } = useNavigationLoader();

  async function handleDelete() {
    if (!confirm("Delete this Finals Event and all its data? This cannot be undone.")) return;
    setDeleting(true);
    const res = await fetch(`/api/finals/${eventId}`, { method: "DELETE" });
    if (res.ok) {
      startLoading();
      router.push("/?list=1");
    } else {
      const json = await res.json();
      alert(json.error ?? "Could not delete");
      setDeleting(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="w-full py-2.5 text-sm font-medium text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 rounded-xl transition-colors disabled:opacity-50"
    >
      {deleting ? "Deleting…" : "Delete Finals Event"}
    </button>
  );
}
