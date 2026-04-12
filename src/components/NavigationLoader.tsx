"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

interface NavigationLoaderContextType {
  startLoading: () => void;
}

const NavigationLoaderContext = createContext<NavigationLoaderContextType>({
  startLoading: () => {},
});

export function useNavigationLoader() {
  return useContext(NavigationLoaderContext);
}

export default function NavigationLoader({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // When the route changes, hide the overlay
  useEffect(() => {
    setLoading(false);
  }, [pathname, searchParams]);

  const startLoading = useCallback(() => {
    setLoading(true);
  }, []);

  return (
    <NavigationLoaderContext.Provider value={{ startLoading }}>
      {children}
      {loading && (
        <div className="fixed inset-0 z-40 bg-stone-50/60 flex items-center justify-center pointer-events-auto">
          <div className="w-8 h-8 border-3 border-stone-300 border-t-stone-700 rounded-full animate-spin" />
        </div>
      )}
    </NavigationLoaderContext.Provider>
  );
}
