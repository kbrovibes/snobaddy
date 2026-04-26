"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

interface NavigationLoaderContextType {
  startLoading: () => void;
  stopLoading: () => void;
}

const NavigationLoaderContext = createContext<NavigationLoaderContextType>({
  startLoading: () => {},
  stopLoading: () => {},
});

export function useNavigationLoader() {
  return useContext(NavigationLoaderContext);
}

export default function NavigationLoader({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When the route changes, hide the overlay
  useEffect(() => {
    setLoading(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, [pathname, searchParams]);

  const startLoading = useCallback(() => {
    setLoading(true);
    // Safety timeout — hide after 8s in case route change detection fails (e.g. router.refresh)
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setLoading(false), 8000);
  }, []);

  const stopLoading = useCallback(() => {
    setLoading(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return (
    <NavigationLoaderContext.Provider value={{ startLoading, stopLoading }}>
      {children}
      {loading && (
        <div className="fixed inset-0 z-40 bg-overlay flex items-center justify-center pointer-events-auto">
          <div className="w-8 h-8 border-3 border-stone-300 dark:border-neutral-600 border-t-stone-700 dark:border-t-white rounded-full animate-spin" />
        </div>
      )}
    </NavigationLoaderContext.Provider>
  );
}
