import type { UploadSource } from "../../services/file-service";

/** Drag payload type for moving entries inside the explorer, kept apart from OS file drops. */
export const QUARTZ_PATHS_TYPE = "application/x-quartz-paths";

/** Stops walking huge trees early; `planUpload` enforces the real limit with a clear message. */
const MAX_WALKED_FILES = 2000;

const readFile = (entry: FileSystemFileEntry): Promise<File> =>
  new Promise((resolve, reject) => entry.file(resolve, reject));

/** `readEntries` returns at most ~100 entries per call, so it is called until it returns none. */
async function readAll(directory: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const reader = directory.createReader();
  const entries: FileSystemEntry[] = [];
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    );
    if (batch.length === 0) return entries;
    entries.push(...batch);
  }
}

async function walk(entry: FileSystemEntry, prefix: string, out: UploadSource[]): Promise<void> {
  if (out.length >= MAX_WALKED_FILES) return;
  const relativePath = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
  if (entry.isFile) {
    out.push({ file: await readFile(entry as FileSystemFileEntry), relativePath });
    return;
  }
  if (entry.isDirectory) {
    for (const child of await readAll(entry as FileSystemDirectoryEntry)) {
      await walk(child, relativePath, out);
    }
  }
}

/** Files dropped from the operating system, with folder structure preserved. */
export async function readDroppedFiles(
  transfer: DataTransfer,
): Promise<{ sources: UploadSource[]; hasFolders: boolean }> {
  // Entries must be captured synchronously: the DataTransfer is emptied after the event returns.
  const entries = [...transfer.items]
    .filter((item) => item.kind === "file")
    .map((item) => item.webkitGetAsEntry())
    .filter((entry): entry is FileSystemEntry => entry !== null);
  if (entries.length === 0) {
    const sources = [...transfer.files].map((file) => ({ file, relativePath: file.name }));
    return { sources, hasFolders: false };
  }
  const sources: UploadSource[] = [];
  for (const entry of entries) await walk(entry, "", sources);
  return { sources, hasFolders: entries.some((entry) => entry.isDirectory) };
}

/** Files from an `<input type="file">`; folder pickers fill `webkitRelativePath`. */
export const sourcesFromInput = (files: FileList | null): UploadSource[] =>
  [...(files ?? [])].map((file) => ({
    file,
    relativePath: file.webkitRelativePath === "" ? file.name : file.webkitRelativePath,
  }));

export const isOsFileDrag = (transfer: DataTransfer): boolean =>
  transfer.types.includes("Files") && !transfer.types.includes(QUARTZ_PATHS_TYPE);
