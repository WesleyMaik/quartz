import english from "./catalogs/en.json";
import type { Locale } from "./locales";

export * from "./locales";

/** Identifier of one interface message. English is the source catalog. */
export type MessageId = keyof typeof english;

/** A complete catalog: every locale translates every message. */
export type Messages = Readonly<Record<MessageId, string>>;

export const englishMessages: Messages = english;

/** Each translation is its own chunk, so only the active language is downloaded. */
const loaders: Readonly<Record<Locale, () => Promise<Messages>>> = {
  en: async () => englishMessages,
  "pt-BR": async () => (await import("./catalogs/pt-BR.json")).default,
  es: async () => (await import("./catalogs/es.json")).default,
  "zh-CN": async () => (await import("./catalogs/zh-CN.json")).default,
  "zh-TW": async () => (await import("./catalogs/zh-TW.json")).default,
  ja: async () => (await import("./catalogs/ja.json")).default,
};

export const loadMessages = (locale: Locale): Promise<Messages> => loaders[locale]();
