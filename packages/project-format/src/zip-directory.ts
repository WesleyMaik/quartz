import { ArchiveFailure } from "./archive-failure";

/** One record of a ZIP central directory. Sizes are the declared ones and may lie. */
export interface ZipRecord {
  readonly name: string;
  readonly method: number;
  readonly crc32: number;
  readonly compressedSize: number;
  readonly size: number;
  readonly localHeaderOffset: number;
  readonly encrypted: boolean;
  /** Symlinks, devices and other entries that are neither a file nor a folder. */
  readonly special: boolean;
}

const END_SIGNATURE = 0x06054b50;
const ZIP64_END_SIGNATURE = 0x06064b50;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const RECORD_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const END_SIZE = 22;
const MAX_COMMENT_SIZE = 0xffff;
const SENTINEL_16 = 0xffff;
const SENTINEL_32 = 0xffffffff;
const ZIP64_EXTRA_ID = 1;
/** "Version made by" hosts whose external attributes carry a Unix file mode. */
const UNIX_HOSTS = new Set([3, 19]);
const FILE_TYPE_MASK = 0o170000;
const REGULAR_FILE = 0o100000;
const DIRECTORY = 0o040000;

/** Code page 437 for bytes 0x80-0xFF, the ZIP default for names that are not UTF-8. */
const CP437_HIGH =
  "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";

const corrupt = (): ArchiveFailure =>
  new ArchiveFailure("archive.invalid", "The file is not a valid ZIP archive.");

/** Many tools write UTF-8 names without setting the UTF-8 flag, so valid UTF-8 always wins. */
function decodeName(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return Array.from(bytes, (byte) =>
      byte < 0x80 ? String.fromCharCode(byte) : CP437_HIGH.charAt(byte - 0x80),
    ).join("");
  }
}

function readUint64(view: DataView, offset: number): number {
  const value = view.getBigUint64(offset, true);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw corrupt();
  return Number(value);
}

function findEnd(view: DataView): number {
  const lowest = Math.max(0, view.byteLength - END_SIZE - MAX_COMMENT_SIZE);
  for (let offset = view.byteLength - END_SIZE; offset >= lowest; offset--) {
    if (view.getUint32(offset, true) === END_SIGNATURE) return offset;
  }
  throw corrupt();
}

function locateDirectory(view: DataView): { count: number; offset: number } {
  const end = findEnd(view);
  const count = view.getUint16(end + 10, true);
  const offset = view.getUint32(end + 16, true);
  if (count !== SENTINEL_16 && offset !== SENTINEL_32) return { count, offset };
  const locator = end - 20;
  if (locator < 0 || view.getUint32(locator, true) !== ZIP64_LOCATOR_SIGNATURE) {
    return { count, offset };
  }
  const zip64End = readUint64(view, locator + 8);
  if (view.getUint32(zip64End, true) !== ZIP64_END_SIGNATURE) throw corrupt();
  return { count: readUint64(view, zip64End + 32), offset: readUint64(view, zip64End + 48) };
}

/** Replaces 32-bit sentinel values with the ones stored in the ZIP64 extra field, in spec order. */
function applyZip64(
  view: DataView,
  start: number,
  length: number,
  fields: { size: number; compressedSize: number; localHeaderOffset: number },
): void {
  let cursor = start;
  while (cursor + 4 <= start + length) {
    const id = view.getUint16(cursor, true);
    const fieldSize = view.getUint16(cursor + 2, true);
    if (id === ZIP64_EXTRA_ID) {
      let value = cursor + 4;
      for (const key of ["size", "compressedSize", "localHeaderOffset"] as const) {
        if (fields[key] !== SENTINEL_32) continue;
        fields[key] = readUint64(view, value);
        value += 8;
      }
      return;
    }
    cursor += 4 + fieldSize;
  }
}

const viewOf = (bytes: Uint8Array): DataView =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

/**
 * Lists the central directory without inflating anything. The entry count is checked before any
 * record is read. Out-of-range reads surface as `RangeError`, which callers treat as corruption.
 */
export function readZipDirectory(bytes: Uint8Array, maxEntries: number): ZipRecord[] {
  const view = viewOf(bytes);
  const directory = locateDirectory(view);
  if (directory.count > maxEntries) {
    throw new ArchiveFailure(
      "archive.too_many_entries",
      `The archive has ${directory.count} entries; the limit is ${maxEntries}.`,
    );
  }

  const records: ZipRecord[] = [];
  let cursor = directory.offset;
  for (let index = 0; index < directory.count; index++) {
    if (view.getUint32(cursor, true) !== RECORD_SIGNATURE) throw corrupt();
    const host = view.getUint8(cursor + 5);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const mode = view.getUint32(cursor + 38, true) >>> 16;
    const type = mode & FILE_TYPE_MASK;
    const fields = {
      compressedSize: view.getUint32(cursor + 20, true),
      size: view.getUint32(cursor + 24, true),
      localHeaderOffset: view.getUint32(cursor + 42, true),
    };
    const nameStart = cursor + 46;
    applyZip64(view, nameStart + nameLength, extraLength, fields);
    records.push({
      ...fields,
      name: decodeName(bytes.subarray(nameStart, nameStart + nameLength)),
      method: view.getUint16(cursor + 10, true),
      crc32: view.getUint32(cursor + 16, true),
      encrypted: (view.getUint16(cursor + 8, true) & 1) !== 0,
      special: UNIX_HOSTS.has(host) && type !== 0 && type !== REGULAR_FILE && type !== DIRECTORY,
    });
    cursor = nameStart + nameLength + extraLength + commentLength;
  }
  return records;
}

/** The stored (possibly compressed) bytes of a record. */
export function recordData(bytes: Uint8Array, record: ZipRecord): Uint8Array {
  const view = viewOf(bytes);
  const header = record.localHeaderOffset;
  if (view.getUint32(header, true) !== LOCAL_SIGNATURE) throw corrupt();
  const start = header + 30 + view.getUint16(header + 26, true) + view.getUint16(header + 28, true);
  if (start + record.compressedSize > bytes.length) throw corrupt();
  return bytes.subarray(start, start + record.compressedSize);
}
