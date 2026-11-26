import { useCallback, useState } from "react";

export type DashboardView = "list" | "grid";

const STORAGE_KEY = "quartz:dashboard-view";

const readView = (): DashboardView => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
};

/** Remembers the project listing layout between visits. */
export function useDashboardView(): {
  view: DashboardView;
  setView: (view: DashboardView) => void;
} {
  const [view, setState] = useState<DashboardView>(readView);
  const setView = useCallback((next: DashboardView) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage may be unavailable (private mode); the layout still applies for this session.
    }
    setState(next);
  }, []);
  return { view, setView };
}
