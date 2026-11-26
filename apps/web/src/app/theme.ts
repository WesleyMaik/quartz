import { useCallback, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "quartz:theme";

const currentTheme = (): Theme =>
  document.documentElement.classList.contains("dark") ? "dark" : "light";

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const toggle = useCallback(() => {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage may be unavailable (private mode); the theme still applies for this session.
    }
    setTheme(next);
  }, []);
  return { theme, toggle };
}
