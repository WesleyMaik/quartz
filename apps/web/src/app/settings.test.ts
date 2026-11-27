import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, parseSettings } from "./settings";

describe("parseSettings", () => {
  it.each([null, "", "not json", "null", "[]", "42"])("uses defaults for %j", (raw) => {
    expect(parseSettings(raw)).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid values and replaces invalid ones one by one", () => {
    const raw = JSON.stringify({
      editorFontSize: "large",
      autoCompile: "yes",
      pdfDarkMode: true,
      language: "xx",
      unknown: 1,
    });
    expect(parseSettings(raw)).toEqual({
      ...DEFAULT_SETTINGS,
      editorFontSize: "large",
      pdfDarkMode: true,
    });
  });
});
