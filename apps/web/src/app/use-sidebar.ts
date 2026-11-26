import { useCallback, useEffect, useState } from "react";

const read = (key: string): boolean => {
  try {
    return localStorage.getItem(key) === "collapsed";
  } catch {
    return false;
  }
};

/**
 * Collapsed state of a sidebar, remembered per `key`, toggled with Ctrl/Cmd+B like most editors.
 * `onToggle` lets callers drive an imperative panel instead of only rendering from state.
 */
export function useSidebar(key: string): {
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  return { collapsed, setCollapsed, toggle };
}
