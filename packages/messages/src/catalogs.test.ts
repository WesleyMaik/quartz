import { type MessageFormatElement, parse, TYPE } from "@formatjs/icu-messageformat-parser";
import { describe, expect, it } from "vitest";
import { englishMessages, LOCALE_IDS, loadMessages } from "./index";

/** Argument names a message needs, including those nested in plural and select branches. */
const argumentsOf = (elements: readonly MessageFormatElement[]): string[] =>
  elements.flatMap((element) => {
    if (element.type === TYPE.literal || element.type === TYPE.pound) return [];
    if (element.type === TYPE.tag) {
      return [`<${element.value}>`, ...argumentsOf(element.children)];
    }
    if (element.type === TYPE.plural || element.type === TYPE.select) {
      const branches = Object.values(element.options).flatMap((option) =>
        argumentsOf(option.value),
      );
      return [element.value, ...branches];
    }
    return [element.value];
  });

const signature = (message: string): string[] => [...new Set(argumentsOf(parse(message)))].sort();

describe.each(LOCALE_IDS)("%s catalog", (locale) => {
  it("translates every English message and nothing else", async () => {
    const messages = await loadMessages(locale);
    expect(Object.keys(messages).sort()).toEqual(Object.keys(englishMessages).sort());
  });

  it("has valid, non-empty messages with the same arguments as English", async () => {
    const messages: Readonly<Record<string, string>> = await loadMessages(locale);
    for (const [id, english] of Object.entries(englishMessages)) {
      const translated = messages[id] ?? "";
      expect(translated.trim(), id).not.toBe("");
      expect(signature(translated), id).toEqual(signature(english));
    }
  });
});
