"use client";

import { useRouter } from "next/navigation";
import { useNavigationLoader } from "@/components/NavigationLoader";

export default function BackButton() {
  const router = useRouter();
  const { startLoading } = useNavigationLoader();
  return (
    <button
      onClick={() => { startLoading(); router.back(); }}
      className="text-sm text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 active:opacity-60 transition-opacity"
    >
      ‹ Back
    </button>
  );
}
