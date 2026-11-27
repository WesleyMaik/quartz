import { useCallback, useState } from "react";
import { clampSize, type SizeLimits } from "../lib/size";

const read = (key: string): number | undefined => {
  try {
    const stored = Number(localStorage.getItem(key) ?? Number.NaN);
    return Number.isFinite(stored) && stored > 0 ? stored : undefined;
  } catch {
    return undefined;
  }
};

const write = (key: string, size: number | undefined): void => {
  try {
    if (size === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, String(size));
  } catch {
    // Storage may be unavailable (private mode); the size still applies for this session.
  }
};

/**
 * Pixel size chosen by the user, remembered per `key`. Limits that depend on the available space
 * only affect the returned size, so a preference comes back when there is room again.
 */
export function useResizableSize(
  key: string,
  defaultSize: number,
  limits: SizeLimits,
): { size: number; resize: (size: number) => void; reset: () => void } {
  const [preferred, setPreferred] = useState(() => read(key));
  const { min, max } = limits;

  const resize = useCallback(
    (next: number) => {
      const size = clampSize(next, { min, max });
      write(key, size);
      setPreferred(size);
    },
    [key, min, max],
  );
  const reset = useCallback(() => {
    write(key, undefined);
    setPreferred(undefined);
  }, [key]);

  return { size: clampSize(preferred ?? defaultSize, limits), resize, reset };
}
