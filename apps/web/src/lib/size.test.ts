import { describe, expect, it } from "vitest";
import { clampSize } from "./size";

describe("clampSize", () => {
  const limits = { min: 100, max: 200 };

  it.each([
    [99, 100],
    [100, 100],
    [101, 101],
    [199, 199],
    [200, 200],
    [201, 200],
    [150.6, 151],
  ])("clamps %d to %d", (size, expected) => {
    expect(clampSize(size, limits)).toBe(expected);
  });

  it("prefers the minimum when there is not enough room", () => {
    expect(clampSize(150, { min: 100, max: 40 })).toBe(100);
  });
});
