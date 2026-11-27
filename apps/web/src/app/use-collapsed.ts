import { useCallback, useState } from "react";

const read = (key: string): boolean => {
  try {
    return localStorage.getItem(key) === "collapsed";
  } catch {
    return false;
  }
};

/** Collapsed state of a panel, remembered per `key`. */
export function useCollapsed(key: string): {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  toggle: () => void;
} {
  const [collapsed, setState] = useState(() => read(key));

  const setCollapsed = useCallback(
    (next: boolean) => {
      try {
        localStorage.setItem(key, next ? "collapsed" : "pinned");
      } catch {
        // Storage may be unavailable (private mode); the state still applies for this session.
      }
      setState(next);
    },
    [key],
  );
  const toggle = useCallback(() => setCollapsed(!collapsed), [collapsed, setCollapsed]);

  return { collapsed, setCollapsed, toggle };
}
