import { useCallback, useSyncExternalStore } from "react";

/** Tracks a CSS media query, for layouts that differ structurally rather than only in styles. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const list = matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => matchMedia(query).matches);
}

/** Below Tailwind's `md` breakpoint the workspace switches to tabs. */
export const MOBILE_QUERY = "(max-width: 767px)";
