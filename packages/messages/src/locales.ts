export const LOCALE_IDS = ["en", "pt-BR", "es", "zh-CN", "zh-TW", "ja"] as const;

export type Locale = (typeof LOCALE_IDS)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Each language named in itself, so it can be found whatever the interface language is. */
export const LOCALE_NAMES: Readonly<Record<Locale, string>> = {
  en: "English",
  "pt-BR": "Português",
  es: "Español",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  ja: "日本語",
};

/** Regions that write Chinese in traditional characters when the tag names no script. */
const TRADITIONAL_REGIONS: ReadonlySet<string> = new Set(["tw", "hk", "mo"]);

const matchLocale = (tag: string): Locale | undefined => {
  const [language, ...subtags] = tag.toLowerCase().split("-");
  switch (language) {
    case "en":
      return "en";
    case "pt":
      return "pt-BR";
    case "es":
      return "es";
    case "ja":
      return "ja";
    case "zh": {
      if (subtags.includes("hans")) return "zh-CN";
      const traditional =
        subtags.includes("hant") || subtags.some((subtag) => TRADITIONAL_REGIONS.has(subtag));
      return traditional ? "zh-TW" : "zh-CN";
    }
    default:
      return undefined;
  }
};

/**
 * The locale to show: the user's choice, or for "system" the first browser language Quartz
 * supports, falling back to English.
 */
export function resolveLocale(
  preference: Locale | "system",
  browserLanguages: readonly string[],
): Locale {
  if (preference !== "system") return preference;
  for (const tag of browserLanguages) {
    const locale = matchLocale(tag);
    if (locale !== undefined) return locale;
  }
  return DEFAULT_LOCALE;
}
