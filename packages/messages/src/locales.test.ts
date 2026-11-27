import { describe, expect, it } from "vitest";
import { resolveLocale } from "./locales";

describe("resolveLocale", () => {
  it("returns an explicit preference regardless of the browser", () => {
    expect(resolveLocale("ja", ["pt-BR"])).toBe("ja");
  });

  it.each([
    [["en-GB"], "en"],
    [["pt"], "pt-BR"],
    [["pt-PT"], "pt-BR"],
    [["es-419"], "es"],
    [["ja-JP"], "ja"],
    [["zh"], "zh-CN"],
    [["zh-SG"], "zh-CN"],
    [["zh-Hans-HK"], "zh-CN"],
    [["zh-TW"], "zh-TW"],
    [["zh-HK"], "zh-TW"],
    [["zh-MO"], "zh-TW"],
    [["zh-Hant"], "zh-TW"],
    [["fr-FR", "es-ES"], "es"],
    [["fr-FR"], "en"],
    [[], "en"],
  ])("resolves %j to %s", (languages, expected) => {
    expect(resolveLocale("system", languages)).toBe(expected);
  });
});
