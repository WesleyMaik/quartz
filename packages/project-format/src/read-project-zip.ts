import {
  err,
  type FileContent,
  inferFileKind,
  isSystemPath,
  isTextKind,
  type NewFile,
  ok,
  type ProjectPath,
  parseProjectPath,
  pathIdentityKey,
  type QuartzError,
  quartzError,
  type Result,
  userMessageForPathError,
} from "@qrtz/document-core";
import { Inflate } from "fflate";
import { ArchiveFailure } from "./archive-failure";
import { readZipDirectory, recordData, type ZipRecord } from "./zip-directory";

export interface ArchiveLimits {
  readonly archiveBytes: number;
  readonly entries: number;
  readonly entryBytes: number;
  readonly totalBytes: number;
  /** Highest accepted inflated-to-compressed ratio for entries above `ratioFloorBytes`. */
  readonly ratio: number;
  readonly ratioFloorBytes: number;
}

const MEGABYTE = 1024 * 1024;

/** See docs/specifications/project-archive.md §3. */
export const ARCHIVE_LIMITS: ArchiveLimits = {
  archiveBytes: 1024 * MEGABYTE,
  entries: 10_000,
  entryBytes: 100 * MEGABYTE,
  totalBytes: 1024 * MEGABYTE,
  ratio: 200,
  ratioFloorBytes: MEGABYTE,
};

export interface ProjectArchiveContents {
  readonly files: readonly NewFile[];
  /** Folders that have their own entry in the archive, including empty ones. */
  readonly folders: readonly ProjectPath[];
  /** Text files that are not valid UTF-8 and were therefore kept as binary, untouched. */
  readonly binaryFallbacks: readonly ProjectPath[];
}

/** Input is fed to the inflater in small slices so limits stop a bomb early. */
const INFLATE_SLICE = 16 * 1024;
const STORED = 0;
const DEFLATED = 8;

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, byte) => {
  let value = byte;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Returns the entry's bytes in a fresh buffer, enforcing limits on what is actually produced. */
function extract(
  archive: Uint8Array,
  record: ZipRecord,
  remainingBytes: number,
  limits: ArchiveLimits,
): Uint8Array<ArrayBuffer> {
  const check = (produced: number) => {
    if (produced > limits.entryBytes) {
      throw new ArchiveFailure("archive.too_large", `${record.name} is too large.`, {
        key: "archive.entry_too_large",
        values: { name: record.name },
      });
    }
    if (produced > remainingBytes) {
      throw new ArchiveFailure("archive.too_large", "The uncompressed project is too large.", {
        key: "archive.project_too_large",
      });
    }
    if (produced > limits.ratioFloorBytes && produced > record.compressedSize * limits.ratio) {
      throw new ArchiveFailure(
        "archive.bomb_suspected",
        `${record.name} expands suspiciously far; the archive was refused.`,
        { values: { name: record.name } },
      );
    }
  };

  const data = recordData(archive, record);
  let output: Uint8Array<ArrayBuffer>;
  if (record.method === STORED) {
    check(data.length);
    output = new Uint8Array(data);
  } else {
    const chunks: Uint8Array[] = [];
    let produced = 0;
    const inflater = new Inflate((chunk) => {
      produced += chunk.length;
      check(produced);
      chunks.push(chunk);
    });
    for (let offset = 0; offset < data.length || offset === 0; offset += INFLATE_SLICE) {
      const end = offset + INFLATE_SLICE;
      inflater.push(data.subarray(offset, end), end >= data.length);
    }
    output = new Uint8Array(produced);
    let position = 0;
    for (const chunk of chunks) {
      output.set(chunk, position);
      position += chunk.length;
    }
  }

  if (output.length !== record.size || crc32(output) !== record.crc32) {
    throw new ArchiveFailure("archive.invalid", `${record.name} is damaged.`, {
      key: "archive.damaged_entry",
      values: { name: record.name },
    });
  }
  return output;
}

interface Entry {
  readonly record: ZipRecord;
  readonly path: ProjectPath;
  readonly folder: boolean;
}

/** Validates every name before anything is inflated; operating-system clutter is dropped. */
function validEntries(records: readonly ZipRecord[]): Entry[] {
  const entries: Entry[] = [];
  for (const record of records) {
    const folder = record.name.endsWith("/");
    const name = folder ? record.name.slice(0, -1) : record.name;
    if (isSystemPath(name)) continue;
    const path = parseProjectPath(name);
    if (!path.ok) {
      throw new ArchiveFailure(
        "archive.invalid_path",
        `Unsafe path "${record.name}": ${userMessageForPathError(path.error)}`,
        {
          key: "archive.unsafe_path",
          values: { path: record.name, pathReason: path.error.reason },
        },
      );
    }
    if (record.special) {
      throw new ArchiveFailure(
        "archive.unsupported_entry",
        `${record.name} is a link or special file.`,
        { key: "archive.link_entry", values: { name: record.name } },
      );
    }
    if (record.encrypted) {
      throw new ArchiveFailure(
        "archive.unsupported_entry",
        "Encrypted archives are not supported.",
        { key: "archive.encrypted" },
      );
    }
    if (!folder && record.method !== STORED && record.method !== DEFLATED) {
      throw new ArchiveFailure(
        "archive.unsupported_entry",
        `${record.name} uses an unsupported compression method.`,
        { key: "archive.compression", values: { name: record.name } },
      );
    }
    entries.push({ record, path: path.value, folder });
  }
  return entries;
}

/** Downloads such as GitHub's wrap the project in one folder; that wrapper is not part of it. */
function stripWrapperFolder(entries: readonly Entry[]): readonly Entry[] {
  const [first] = entries;
  if (first === undefined) return entries;
  const root = first.path.split("/", 1)[0] as string;
  const wrapped = entries.every(
    (entry) => entry.path.startsWith(`${root}/`) || (entry.folder && entry.path === root),
  );
  if (!wrapped) return entries;
  return entries
    .filter((entry) => entry.path !== root)
    .map((entry) => ({ ...entry, path: entry.path.slice(root.length + 1) as ProjectPath }));
}

/**
 * Rejects names that collide on a case-insensitive file system: repeated entries, folders spelled
 * two ways, and a path used both as a file and as a folder.
 */
function rejectDuplicates(entries: readonly Entry[]): void {
  const seen = new Map<string, { readonly path: string; readonly folder: boolean }>();
  const explicit = new Set<string>();
  const claim = (path: string, folder: boolean) => {
    const key = pathIdentityKey(path as ProjectPath);
    const previous = seen.get(key);
    if (previous !== undefined && (previous.path !== path || !previous.folder || !folder)) {
      throw new ArchiveFailure("archive.duplicate_entry", `"${path}" appears more than once.`, {
        values: { path },
      });
    }
    seen.set(key, { path, folder });
  };
  for (const entry of entries) {
    if (explicit.has(entry.path)) {
      throw new ArchiveFailure(
        "archive.duplicate_entry",
        `"${entry.path}" appears more than once.`,
        { values: { path: entry.path } },
      );
    }
    explicit.add(entry.path);
    const segments = entry.path.split("/");
    for (let depth = 1; depth < segments.length; depth++) {
      claim(segments.slice(0, depth).join("/"), true);
    }
    claim(entry.path, entry.folder);
  }
}

function toContent(path: ProjectPath, bytes: Uint8Array<ArrayBuffer>): FileContent | undefined {
  if (!isTextKind(inferFileKind(path))) return { kind: "binary", bytes: new Blob([bytes]) };
  try {
    // `ignoreBOM` keeps a byte order mark in the text, so exporting writes the same bytes back.
    const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
    return { kind: "text", text: decoder.decode(bytes) };
  } catch {
    return undefined;
  }
}

function read(archive: Uint8Array, limits: ArchiveLimits): ProjectArchiveContents {
  if (archive.length > limits.archiveBytes) {
    throw new ArchiveFailure("archive.too_large", "The archive is too large.");
  }
  const entries = stripWrapperFolder(validEntries(readZipDirectory(archive, limits.entries)));
  rejectDuplicates(entries);

  const files: NewFile[] = [];
  const folders: ProjectPath[] = [];
  const binaryFallbacks: ProjectPath[] = [];
  let remaining = limits.totalBytes;
  for (const { record, path, folder } of entries) {
    if (folder) {
      folders.push(path);
      continue;
    }
    const bytes = extract(archive, record, remaining, limits);
    remaining -= bytes.length;
    const content = toContent(path, bytes);
    if (content === undefined) binaryFallbacks.push(path);
    files.push({ path, content: content ?? { kind: "binary", bytes: new Blob([bytes]) } });
  }
  return { files, folders, binaryFallbacks };
}

/**
 * Reads an untrusted ZIP into project files without writing anything. Synchronous and CPU bound:
 * run it in a worker.
 */
export function readProjectZip(
  archive: Uint8Array,
  limits: ArchiveLimits = ARCHIVE_LIMITS,
): Result<ProjectArchiveContents, QuartzError> {
  try {
    return ok(read(archive, limits));
  } catch (cause) {
    if (cause instanceof ArchiveFailure)
      return err(quartzError(cause.code, cause.message, cause.detail));
    // Out-of-range reads and inflate errors mean the archive is damaged.
    return err(quartzError("archive.invalid", "The file is not a valid ZIP archive."));
  }
}
