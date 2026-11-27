import { useEffect } from "react";
import { create } from "zustand";

export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";

/** Also read by the inline script in index.html, which applies the theme before the first paint. */
const STORAGE_KEY = "quartz:theme";
const SYSTEM_DARK = "(prefers-color-scheme: dark)";

const readPreference = (): ThemePreference => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
};

const resolve = (preference: ThemePreference): Theme => {
  if (preference !== "system") return preference;
  return window.matchMedia(SYSTEM_DARK).matches ? "dark" : "light";
};

const apply = (preference: ThemePreference): Theme => {
  const theme = resolve(preference);
  document.documentElement.classList.toggle("dark", theme === "dark");
  return theme;
};

interface ThemeStore {
  readonly theme: Theme;
  readonly preference: ThemePreference;
  readonly setPreference: (preference: ThemePreference) => void;
}

const useThemeStore = create<ThemeStore>((set) => ({
  theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
  preference: readPreference(),
  setPreference: (preference) => {
    try {
      if (preference === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Storage may be unavailable (private mode); the theme still applies for this session.
    }
    set({ preference, theme: apply(preference) });
  },
}));

export function useTheme(): ThemeStore & { toggle: () => void } {
  const store = useThemeStore();
  const toggle = () => store.setPreference(store.theme === "dark" ? "light" : "dark");
  return { ...store, toggle };
}

/** Follows the operating system while the preference is "system"; mount once at the app root. */
export function useSystemThemeSync(): void {
  useEffect(() => {
    const media = window.matchMedia(SYSTEM_DARK);
    const onChange = () => {
      const { preference } = useThemeStore.getState();
      if (preference === "system") useThemeStore.setState({ theme: apply(preference) });
    };
    media.addEventListener("change", onChange);
    onChange();
    return () => media.removeEventListener("change", onChange);
  }, []);
}
