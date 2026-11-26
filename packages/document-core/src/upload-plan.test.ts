import { describe, expect, it } from "vitest";
import { type ProjectPath, parseProjectPath } from "./paths";
import {
  MAX_UPLOAD_FILE_BYTES,
  MAX_UPLOAD_FILES,
  MAX_UPLOAD_TOTAL_BYTES,
  planMove,
  planUpload,
} from "./upload-plan";

const path = (value: string): ProjectPath => {
  const result = parseProjectPath(value);
  if (!result.ok) throw new Error(`invalid test path ${value}`);
  return result.value;
};

describe("planUpload", () => {
  it("places folder contents under the target folder", () => {
    const result = planUpload(
      [
        { relativePath: "fonts/Poppins.ttf", size: 10 },
        { relativePath: "fonts/bold/Poppins-Bold.ttf", size: 20 },
      ],
      "assets",
      [],
    );
    expect(result.ok && result.value.uploads.map((u) => u.path)).toEqual([
      "assets/fonts/Poppins.ttf",
      "assets/fonts/bold/Poppins-Bold.ttf",
    ]);
    expect(result.ok && result.value.totalBytes).toBe(30);
    expect(result.ok && result.value.folders).toEqual(["fonts"]);
  });

  it("uploads loose files into the project root", () => {
    const result = planUpload([{ relativePath: "a.tex", size: 1 }], "", []);
    expect(result.ok && result.value.uploads).toEqual([{ index: 0, path: "a.tex", size: 1 }]);
    expect(result.ok && result.value.folders).toEqual([]);
  });

  it("skips system clutter, invalid names, oversized files and duplicates", () => {
    const result = planUpload(
      [
        { relativePath: "fonts/.DS_Store", size: 1 },
        { relativePath: "fonts/__MACOSX/x.ttf", size: 1 },
        { relativePath: ".git/config", size: 1 },
        { relativePath: "fonts/con.ttf", size: 1 },
        { relativePath: "fonts/huge.ttf", size: MAX_UPLOAD_FILE_BYTES + 1 },
        { relativePath: "fonts/edge.ttf", size: MAX_UPLOAD_FILE_BYTES },
        { relativePath: "main.tex", size: 1 },
        { relativePath: "fonts/A.ttf", size: 1 },
        { relativePath: "fonts/a.ttf", size: 1 },
      ],
      "",
      [path("MAIN.tex")],
    );
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.uploads.map((u) => u.path)).toEqual(["fonts/edge.ttf", "fonts/A.ttf"]);
    expect(result.value.skipped.map((s) => s.reason)).toEqual([
      "system_file",
      "system_file",
      "system_file",
      "invalid_path",
      "too_large",
      "duplicate",
      "duplicate",
    ]);
  });

  it("accepts exactly the file-count limit and refuses one more", () => {
    const files = (count: number) =>
      Array.from({ length: count }, (_, i) => ({ relativePath: `f/${i}.txt`, size: 1 }));
    expect(planUpload(files(MAX_UPLOAD_FILES), "", []).ok).toBe(true);
    const over = planUpload(files(MAX_UPLOAD_FILES + 1), "", []);
    expect(!over.ok && over.error.code).toBe("upload.limit_exceeded");
  });

  it("accepts exactly the total-size limit and refuses more", () => {
    const chunk = MAX_UPLOAD_FILE_BYTES;
    const count = MAX_UPLOAD_TOTAL_BYTES / chunk;
    const atLimit = Array.from({ length: count }, (_, i) => ({
      relativePath: `${i}.bin`,
      size: chunk,
    }));
    expect(planUpload(atLimit, "", []).ok).toBe(true);
    const over = planUpload([...atLimit, { relativePath: "extra.bin", size: 1 }], "", []);
    expect(!over.ok && over.error.code).toBe("upload.limit_exceeded");
  });
});

describe("planMove", () => {
  it("moves files and folders into the target folder", () => {
    expect(planMove([path("a.ttf"), path("docs")], "fonts")).toEqual([
      { from: "a.ttf", to: "fonts/a.ttf" },
      { from: "docs", to: "fonts/docs" },
    ]);
  });

  it("moves to the project root", () => {
    expect(planMove([path("fonts/a.ttf")], "")).toEqual([{ from: "fonts/a.ttf", to: "a.ttf" }]);
  });

  it("skips items already in the target and folders dropped into themselves", () => {
    expect(planMove([path("fonts/a.ttf"), path("fonts"), path("x/y")], "fonts")).toEqual([
      { from: "x/y", to: "fonts/y" },
    ]);
    expect(planMove([path("fonts")], "fonts/sub")).toEqual([]);
  });

  it("moves a selected folder once, with the selected files inside it", () => {
    expect(planMove([path("a"), path("a/b.tex"), path("a")], "z")).toEqual([
      { from: "a", to: "z/a" },
    ]);
  });
});
