import { describe, expect, it } from "vitest";
import { formatBytes, formatRelative } from "./format";

describe("formatBytes", () => {
  it.each([
    [0, "en", "0 B"],
    [1023, "en", "1023 B"],
    [1536, "en", "1.5 KB"],
    [1536, "pt-BR", "1,5 KB"],
    [10 * 1024 * 1024, "es", "10 MB"],
  ])("formats %d bytes in %s", (bytes, locale, expected) => {
    expect(formatBytes(bytes, locale)).toBe(expected);
  });
});

describe("formatRelative", () => {
  const now = Date.parse("2026-01-10T12:00:00Z");

  it.each([
    ["en", "yesterday"],
    ["pt-BR", "ontem"],
    ["ja", "昨日"],
  ])("speaks %s", (locale, expected) => {
    expect(formatRelative("2026-01-09T12:00:00Z", locale, now)).toBe(expected);
  });
});
