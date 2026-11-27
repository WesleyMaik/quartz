import { describe, expect, it } from "vitest";
import { describePageSize } from "./page-size";

describe("describePageSize", () => {
  it.each([
    [595.28, 841.89, { paper: "A4", landscape: false, dimensions: "210 × 297 mm" }],
    [841.89, 595.28, { paper: "A4", landscape: true, dimensions: "297 × 210 mm" }],
    [612, 792, { paper: "Letter", landscape: false, dimensions: "216 × 279 mm" }],
    [200, 100, { paper: undefined, landscape: false, dimensions: "71 × 35 mm" }],
  ])("describes %d × %d points", (width, height, expected) => {
    expect(describePageSize(width, height)).toEqual(expected);
  });
});
