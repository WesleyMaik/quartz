import { z } from "zod";
import { create } from "zustand";
import { LOCALE_PREFERENCES } from "./locale";

const STORAGE_KEY = "quartz:settings";

export const EDITOR_FONT_SIZES = {
  small: { label: "Small", pixels: 12 },
  normal: { label: "Normal", pixels: 13.5 },
  large: { label: "Large", pixels: 15.5 },
  "x-large": { label: "Extra large", pixels: 18 },
} as const;

export type EditorFontSize = keyof typeof EDITOR_FONT_SIZES;

/** Every field falls back to its default on its own, so one bad value does not reset the rest. */
const settingsSchema = z.object({
  language: z.enum(LOCALE_PREFERENCES).catch("system"),
  editorFontSize: z.enum(["small", "normal", "large", "x-large"]).catch("normal"),
  autoCompile: z.boolean().catch(true),
  lineWrapping: z.boolean().catch(true),
  spellCheck: z.boolean().catch(false),
  pdfDarkMode: z.boolean().catch(false),
  pdfZoomShortcuts: z.boolean().catch(true),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({});

/** Reads stored preferences, which may be missing, outdated or edited by hand. */
export function parseSettings(raw: string | null): Settings {
  try {
    const result = settingsSchema.safeParse(JSON.parse(raw ?? "{}"));
    return result.success ? result.data : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

const load = (): Settings => {
  try {
    return parseSettings(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_SETTINGS;
  }
};

interface SettingsStore extends Settings {
  readonly update: (patch: Partial<Settings>) => void;
}

/** User preferences of this browser. UI state only: project data lives in IndexedDB. */
export const useSettings = create<SettingsStore>((set, get) => ({
  ...load(),
  update: (patch) => {
    set(patch);
    try {
      // The schema keeps only preference fields, leaving the store's functions out.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsSchema.parse(get())));
    } catch {
      // Storage may be unavailable (private mode); the change still applies for this session.
    }
  },
}));
