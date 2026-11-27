import { useCallback, useState } from "react";

/**
 * Height of the parent of the element that receives `ref`, kept current as it resizes. Until the
 * first measurement it is unlimited.
 */
export function useParentHeight(): {
  ref: (element: HTMLElement | null) => (() => void) | undefined;
  height: number;
} {
  const [height, setHeight] = useState(Number.MAX_SAFE_INTEGER);
  const ref = useCallback((element: HTMLElement | null) => {
    const parent = element?.parentElement;
    if (parent === null || parent === undefined) return undefined;
    const observer = new ResizeObserver(() => {
      // A hidden parent reports zero, which says nothing about the available room.
      if (parent.clientHeight > 0) setHeight(parent.clientHeight);
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);
  return { ref, height };
}
