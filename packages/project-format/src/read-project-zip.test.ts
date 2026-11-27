import { type ProjectPath, parseProjectPath } from "@qrtz/document-core";
import { strToU8, type Zippable, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { createProjectZip } from "./project-zip";
import { ARCHIVE_LIMITS, type ArchiveLimits, readProjectZip } from "./read-project-zip";

const path = (value: string): ProjectPath => {
  const result = parseProjectPath(value);
  if (!result.ok) throw new Error(`invalid test path ${value}`);
  return result.value;
};

const zip = (entries: Zippable) => zipSync(entries);
const limits = (patch: Partial<ArchiveLimits>): ArchiveLimits => ({ ...ARCHIVE_LIMITS, ...patch });

function read(archive: Uint8Array, custom?: ArchiveLimits) {
  const result = readProjectZip(archive, custom);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

const codeOf = (archive: Uint8Array, custom?: ArchiveLimits): string => {
  const result = readProjectZip(archive, custom);
  return result.ok ? "ok" : result.error.code;
};

const pathsOf = (archive: Uint8Array) => read(archive).files.map((file) => file.path);

/** Offset of the first central directory record. */
function directoryOffset(archive: Uint8Array): number {
  const view = new DataView(archive.buffer);
  return view.getUint32(archive.length - 22 + 16, true);
}

describe("readProjectZip", () => {
  it("restores an exported project byte for byte, including empty folders", async () => {
    const text = "\ufeff% ção\r\n\\documentclass{article}\n";
    const image = Uint8Array.from({ length: 300 }, (_, i) => i % 256);
    const archive = await createProjectZip({
      modifiedAt: new Date("2026-11-27T12:00:00.000Z"),
      folders: [path("empty")],
      files: [
        { path: path("main.tex"), content: { kind: "text", text } },
        { path: path("figures/plot.png"), content: { kind: "binary", bytes: new Blob([image]) } },
      ],
    });
    const contents = read(archive);
    expect(contents.folders).toEqual(["empty"]);
    expect(contents.files.map((file) => file.path)).toEqual(["figures/plot.png", "main.tex"]);
    const [plot, main] = contents.files;
    expect(main?.content).toEqual({ kind: "text", text });
    if (plot?.content.kind !== "binary") throw new Error("expected binary content");
    expect(new Uint8Array(await plot.content.bytes.arrayBuffer())).toEqual(image);
  });

  it("strips a single wrapper folder", () => {
    const archive = zip({ "repo-main": { "main.typ": strToU8("= A"), docs: {} } });
    const contents = read(archive);
    expect(contents.files.map((file) => file.path)).toEqual(["main.typ"]);
    expect(contents.folders).toEqual(["docs"]);
  });

  it("keeps folders when there is more than one root", () => {
    const archive = zip({ "a/main.typ": strToU8("= A"), "refs.bib": strToU8("") });
    expect(pathsOf(archive)).toEqual(["a/main.typ", "refs.bib"]);
  });

  it("ignores operating system clutter", () => {
    const archive = zip({
      "paper/main.typ": strToU8("= A"),
      "paper/.DS_Store": strToU8("x"),
      "paper/Thumbs.db": strToU8("x"),
      "__MACOSX/paper/._main.typ": strToU8("x"),
    });
    expect(pathsOf(archive)).toEqual(["main.typ"]);
  });

  it("keeps text that is not valid UTF-8 as untouched binary", () => {
    const contents = read(zip({ "latin1.tex": new Uint8Array([0x63, 0xe7, 0x61]) }));
    expect(contents.binaryFallbacks).toEqual(["latin1.tex"]);
    expect(contents.files[0]?.content.kind).toBe("binary");
  });

  it.each(["../evil.tex", "a/../../evil.tex", "/etc/passwd", "C:/evil.tex", "a\\b.tex", "con.tex"])(
    "rejects the unsafe path %j",
    (name) => {
      expect(codeOf(zip({ [name]: strToU8("x") }))).toBe("archive.invalid_path");
    },
  );

  it.each([
    ["case only", { "Main.tex": strToU8("a"), "main.tex": strToU8("b") }],
    ["unicode normalization", { "\u00e9.tex": strToU8("a"), "e\u0301.tex": strToU8("b") }],
    ["file and folder", { a: strToU8("a"), "a/b.tex": strToU8("b") }],
    ["folder spelling", { "Fig/a.tex": strToU8("a"), "fig/b.tex": strToU8("b") }],
  ])("rejects duplicates: %s", (_name, entries) => {
    expect(codeOf(zip({ ...entries, "root.txt": strToU8("") }))).toBe("archive.duplicate_entry");
  });

  it("rejects symbolic links", () => {
    const archive = zip({ link: [strToU8("/etc/passwd"), { os: 3, attrs: 0o120777 << 16 }] });
    expect(codeOf(archive)).toBe("archive.unsupported_entry");
  });

  it("accepts regular Unix files", () => {
    const archive = zip({ "a.tex": [strToU8("a"), { os: 3, attrs: 0o100644 << 16 }] });
    expect(codeOf(archive)).toBe("ok");
  });

  it("rejects encrypted entries", () => {
    const archive = zip({ "a.tex": strToU8("a") });
    const flags = directoryOffset(archive) + 8;
    archive[flags] = (archive[flags] ?? 0) | 1;
    expect(codeOf(archive)).toBe("archive.unsupported_entry");
  });

  it("rejects a checksum mismatch", () => {
    const archive = zip({ "a.tex": [strToU8("abc"), { level: 0 }] });
    archive[30 + "a.tex".length] = 0x7a;
    expect(codeOf(archive)).toBe("archive.invalid");
  });

  it("rejects a declared size that lies", () => {
    const archive = zip({ "a.tex": strToU8("a".repeat(100)) });
    new DataView(archive.buffer).setUint32(directoryOffset(archive) + 24, 5, true);
    expect(codeOf(archive)).toBe("archive.invalid");
  });

  it.each([
    ["plain text", strToU8("not a zip at all, definitely not a zip")],
    ["empty input", new Uint8Array(0)],
    ["truncated archive", zip({ "a.tex": strToU8("abc") }).slice(0, 20)],
  ])("rejects %s", (_name, archive) => {
    expect(codeOf(archive)).toBe("archive.invalid");
  });

  it.each([
    [1, "ok"],
    [2, "ok"],
    [3, "archive.too_many_entries"],
  ])("limits the entry count: %i of 2", (count, expected) => {
    const entries = Object.fromEntries(
      Array.from({ length: count }, (_, i) => [`${i}.tex`, strToU8("x")]),
    );
    expect(codeOf(zip(entries), limits({ entries: 2 }))).toBe(expected);
  });

  describe.each([0, 6])("size limits at compression level %i", (level) => {
    const file = (size: number): [Uint8Array, { level: 0 | 6 }] => [
      new Uint8Array(size),
      { level: level as 0 | 6 },
    ];

    it.each([
      [99, "ok"],
      [100, "ok"],
      [101, "archive.too_large"],
    ])("limits one entry: %i of 100 bytes", (size, expected) => {
      expect(codeOf(zip({ "a.bin": file(size) }), limits({ entryBytes: 100 }))).toBe(expected);
    });

    it.each([
      [49, "ok"],
      [50, "ok"],
      [51, "archive.too_large"],
    ])("limits the total: 50 + %i of 100 bytes", (size, expected) => {
      const archive = zip({ "a.bin": file(50), "b.bin": file(size) });
      expect(codeOf(archive, limits({ totalBytes: 100 }))).toBe(expected);
    });
  });

  it.each([
    [-1, "archive.too_large"],
    [0, "ok"],
    [1, "ok"],
  ])("limits the archive size: limit %i bytes from its size", (delta, expected) => {
    const archive = zip({ "a.tex": strToU8("a") });
    expect(codeOf(archive, limits({ archiveBytes: archive.length + delta }))).toBe(expected);
  });

  it("refuses entries that expand beyond the ratio limit", () => {
    const archive = zip({ "zeros.bin": new Uint8Array(4 * 1024 * 1024) });
    expect(codeOf(archive)).toBe("archive.bomb_suspected");
  });

  it("allows a high ratio below the size floor", () => {
    expect(codeOf(zip({ "zeros.bin": new Uint8Array(ARCHIVE_LIMITS.ratioFloorBytes) }))).toBe("ok");
  });

  it("decodes legacy CP437 names", () => {
    const archive = zip({ "cafX.tex": strToU8("a") });
    // 0x82 is "é" in code page 437 and invalid on its own in UTF-8.
    archive[directoryOffset(archive) + 46 + 3] = 0x82;
    expect(pathsOf(archive)).toEqual(["café.tex"]);
  });

  it("reads ZIP64 end records", () => {
    const base = zip({ "a.tex": strToU8("a") });
    const directory = directoryOffset(base);
    const endStart = base.length - 22;
    const zip64 = new Uint8Array(56 + 20);
    const view = new DataView(zip64.buffer);
    view.setUint32(0, 0x06064b50, true);
    view.setBigUint64(32, 1n, true);
    view.setBigUint64(48, BigInt(directory), true);
    view.setUint32(56, 0x07064b50, true);
    view.setBigUint64(64, BigInt(endStart), true);
    const end = base.slice(endStart);
    const endView = new DataView(end.buffer);
    endView.setUint16(10, 0xffff, true);
    endView.setUint32(16, 0xffffffff, true);
    const archive = new Uint8Array([...base.slice(0, endStart), ...zip64, ...end]);
    expect(pathsOf(archive)).toEqual(["a.tex"]);
  });

  it("reads ZIP64 sizes from the extra field", () => {
    const sizes = new Uint8Array(16);
    new DataView(sizes.buffer).setBigUint64(0, 3n, true);
    new DataView(sizes.buffer).setBigUint64(8, 3n, true);
    const archive = zip({ "a.tex": [strToU8("abc"), { level: 0, extra: { 1: sizes } }] });
    const record = directoryOffset(archive);
    const view = new DataView(archive.buffer);
    view.setUint32(record + 20, 0xffffffff, true);
    view.setUint32(record + 24, 0xffffffff, true);
    expect(read(archive).files[0]?.content).toEqual({ kind: "text", text: "abc" });
  });
});
