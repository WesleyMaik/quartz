import { useEffect } from "react";
import { useCollapsed } from "./use-collapsed";

/** Collapsed state of a sidebar, remembered per `key`, toggled with Ctrl/Cmd+B like most editors. */
export function useSidebar(key: string): ReturnType<typeof useCollapsed> {
  const state = useCollapsed(key);
  const { toggle } = state;

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

  return state;
}
