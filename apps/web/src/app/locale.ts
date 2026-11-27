/**
 * Interface languages. Only English text exists today; adding a locale here is the first step of the
 * internationalization plan in docs/roadmap/implementation-plan.md.
 */
export const LOCALES = [{ id: "en", label: "English" }] as const;

export const LOCALE_PREFERENCES = ["system", "en"] as const;

export type LocalePreference = (typeof LOCALE_PREFERENCES)[number];
