"use client";

import { useRouter, usePathname } from "next/navigation";
import { useNavigationLoader } from "@/components/NavigationLoader";

export default function IncludeTestToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const pathname = usePathname();

  const { startLoading } = useNavigationLoader();

  function toggle() {
    startLoading();
    router.replace(!enabled ? `${pathname}?test=1` : pathname);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex items-center gap-2 text-xs text-text-light"
      aria-label="Include test sessions"
    >
      <span className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${enabled ? "bg-sky-500" : "bg-stone-300 dark:bg-neutral-600"}`}>
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-surface shadow ring-0 transition duration-200 ease-in-out ${enabled ? "translate-x-4" : "translate-x-0"}`}
        />
      </span>
      <span>Test sessions</span>
    </button>
  );
}
