import { describe, expect, it } from "vitest";
import { projectArchiveName } from "./archive-name";

describe("projectArchiveName", () => {
  it("keeps readable titles, including non-ASCII ones", () => {
    expect(projectArchiveName("Dissertação v2")).toBe("Dissertação v2.zip");
  });

  it("replaces characters that file systems reject", () => {
    expect(projectArchiveName('a/b\\c: "d"?\u0000')).toBe("a b c d.zip");
  });

  it.each(["", "   ", "...", "///", "CON", "lpt1.notes"])("falls back for %j", (title) => {
    expect(projectArchiveName(title)).toBe("project.zip");
  });

  it.each([
    [99, 99],
    [100, 100],
    [101, 100],
  ])("limits a %i character title to %i", (length, expected) => {
    expect(projectArchiveName("a".repeat(length))).toBe(`${"a".repeat(expected)}.zip`);
  });
});
