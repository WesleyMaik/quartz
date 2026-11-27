import type { FileContent, ProjectPath } from "@qrtz/document-core";
import { type AsyncZippable, zip } from "fflate";

export interface ArchiveFile {
  readonly path: ProjectPath;
  readonly content: FileContent;
}

export interface ProjectZipInput {
  readonly files: readonly ArchiveFile[];
  /** Folders are written as directory entries so that empty ones survive the export. */
  readonly folders: readonly ProjectPath[];
  /** Timestamp of every entry, which keeps repeated exports of one project byte-identical. */
  readonly modifiedAt: Date;
}

/** Formats that are already compressed; deflating them again costs time and saves almost nothing. */
const STORED_EXTENSIONS = /\.(png|jpe?g|gif|webp|avif|pdf|zip|gz|woff2?|mp4)$/i;
const DEFLATE_LEVEL = 6;

const bytesOf = async (content: FileContent): Promise<Uint8Array> =>
  content.kind === "text"
    ? new TextEncoder().encode(content.text)
    : new Uint8Array(await content.bytes.arrayBuffer());

/**
 * A standard ZIP of the project tree: original files at the archive root, byte for byte, with no
 * Quartz metadata. See docs/specifications/project-archive.md.
 */
export async function createProjectZip(input: ProjectZipInput): Promise<Uint8Array<ArrayBuffer>> {
  const mtime = input.modifiedAt;
  const entries: AsyncZippable = {};
  for (const folder of [...input.folders].sort()) {
    entries[`${folder}/`] = [new Uint8Array(0), { level: 0, mtime }];
  }
  for (const file of [...input.files].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    entries[file.path] = [
      await bytesOf(file.content),
      { level: STORED_EXTENSIONS.test(file.path) ? 0 : DEFLATE_LEVEL, mtime },
    ];
  }
  // fflate's asynchronous API deflates large entries in workers, keeping the main thread free.
  return new Promise((resolve, reject) => {
    zip(entries, (error, data) => {
      if (error === null) resolve(new Uint8Array(data));
      else reject(error);
    });
  });
}
