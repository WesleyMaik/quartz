import { describe, expect, it } from "vitest";
import { MAX_PATH_BYTES, type PathErrorReason, parseProjectPath } from "./paths";

const reasonOf = (input: string): PathErrorReason | "ok" => {
  const result = parseProjectPath(input);
  return result.ok ? "ok" : result.error.reason;
};

describe("parseProjectPath", () => {
  it.each([
    ["main.tex"],
    ["sections/introduction.tex"],
    ["figures/sub dir/plot 1.png"],
    [".latexmkrc"],
  ])("accepts %s", (input) => {
    expect(reasonOf(input)).toBe("ok");
  });

  it.each<[string, PathErrorReason]>([
    ["", "empty"],
    ["/etc/passwd", "absolute"],
    ["C:/x.tex", "absolute"],
    ["a\\b.tex", "backslash"],
    ["..\\x", "backslash"],
    ["../x.tex", "dot_segment"],
    ["a/../../x", "dot_segment"],
    ["./a.tex", "dot_segment"],
    ["a//b", "empty_segment"],
    ["a/", "empty_segment"],
    ["a\u0000b", "control_character"],
    ["bad\nname", "control_character"],
    ["name.", "trailing_dot_or_space"],
    ["name ", "trailing_dot_or_space"],
    ["CON", "reserved_name"],
    ["dir/lpt1.txt", "reserved_name"],
    [Array.from({ length: 33 }, () => "d").join("/"), "too_deep"],
    ["a".repeat(MAX_PATH_BYTES + 1), "too_long"],
  ])("rejects %j as %s", (input, reason) => {
    expect(reasonOf(input)).toBe(reason);
  });

  it("normalizes to NFC so visually equal names collide", () => {
    const decomposed = parseProjectPath("cafe\u0301.tex");
    const composed = parseProjectPath("caf\u00e9.tex");
    expect(decomposed.ok && composed.ok && decomposed.value === composed.value).toBe(true);
  });
});
