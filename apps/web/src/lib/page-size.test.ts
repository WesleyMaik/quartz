import { describe, expect, it } from "vitest";
import { formatPageSize } from "./page-size";

describe("formatPageSize", () => {
  it.each([
    [595.28, 841.89, "A4 (210 × 297 mm)"],
    [841.89, 595.28, "A4 landscape (297 × 210 mm)"],
    [612, 792, "Letter (216 × 279 mm)"],
    [200, 100, "71 × 35 mm"],
  ])("describes %d × %d points", (width, height, expected) => {
    expect(formatPageSize(width, height)).toBe(expected);
  });
});
