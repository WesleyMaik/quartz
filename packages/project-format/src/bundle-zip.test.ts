import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { createBundleZip } from "./bundle-zip";

const entry = (name: string, byte: number) => ({ name, data: new Uint8Array([byte]) });

describe("createBundleZip", () => {
  it("keeps every project, numbering names that collide", async () => {
    const archive = await createBundleZip(
      [entry("Paper.zip", 1), entry("paper.zip", 2), entry("Paper.zip", 3)],
      new Date("2026-11-27T12:00:00.000Z"),
    );
    expect(unzipSync(archive)).toEqual({
      "Paper.zip": new Uint8Array([1]),
      "paper (2).zip": new Uint8Array([2]),
      "Paper (3).zip": new Uint8Array([3]),
    });
  });
});
