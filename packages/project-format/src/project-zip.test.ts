import { type ProjectPath, parseProjectPath } from "@qrtz/document-core";
import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { createProjectZip, type ProjectZipInput } from "./project-zip";

const path = (value: string): ProjectPath => {
  const result = parseProjectPath(value);
  if (!result.ok) throw new Error(`invalid test path ${value}`);
  return result.value;
};

/** Large and varied enough for fflate to deflate it in a worker. */
const largeText = Array.from({ length: 40_000 }, (_, i) => `line ${i} ção\r\n`).join("");
const image = Uint8Array.from({ length: 256 }, (_, i) => i);

const input: ProjectZipInput = {
  modifiedAt: new Date("2026-11-27T12:00:00.000Z"),
  folders: [path("figures"), path("empty")],
  files: [
    { path: path("main.tex"), content: { kind: "text", text: largeText } },
    { path: path("figures/plot.png"), content: { kind: "binary", bytes: new Blob([image]) } },
  ],
};

describe("createProjectZip", () => {
  it("stores the original files at the root without extra entries", async () => {
    const entries = unzipSync(await createProjectZip(input));
    expect(Object.keys(entries).sort()).toEqual([
      "empty/",
      "figures/",
      "figures/plot.png",
      "main.tex",
    ]);
    expect(new TextDecoder().decode(entries["main.tex"])).toBe(largeText);
    expect(entries["figures/plot.png"]).toEqual(image);
  });

  it("is byte-identical across exports of the same project", async () => {
    const reordered = { ...input, files: [...input.files].reverse() };
    expect(await createProjectZip(reordered)).toEqual(await createProjectZip(input));
  });

  it("creates a valid archive for a project without files", async () => {
    const empty = await createProjectZip({ ...input, files: [], folders: [] });
    expect(unzipSync(empty)).toEqual({});
  });
});
