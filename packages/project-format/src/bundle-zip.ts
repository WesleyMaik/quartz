import { zip } from "fflate";

export interface BundleEntry {
  /** A file name without folders, such as the result of `projectArchiveName`. */
  readonly name: string;
  readonly data: Uint8Array;
}

/** Numbers repeated names, comparing them the way case-insensitive file systems do. */
function uniqueName(name: string, taken: Set<string>): string {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";
  let candidate = name;
  for (let copy = 2; taken.has(candidate.toLocaleLowerCase("en-US")); copy++) {
    candidate = `${stem} (${copy})${extension}`;
  }
  taken.add(candidate.toLocaleLowerCase("en-US"));
  return candidate;
}

/**
 * A ZIP that holds one archive per project, so each can be imported again on its own. Entries are
 * stored because they are already compressed.
 */
export function createBundleZip(
  entries: readonly BundleEntry[],
  modifiedAt: Date,
): Promise<Uint8Array<ArrayBuffer>> {
  const taken = new Set<string>();
  const files = Object.fromEntries(
    entries.map((entry) => [
      uniqueName(entry.name, taken),
      [entry.data, { level: 0 as const, mtime: modifiedAt }] as [
        Uint8Array,
        { level: 0; mtime: Date },
      ],
    ]),
  );
  return new Promise((resolve, reject) => {
    zip(files, (error, data) => {
      if (error === null) resolve(new Uint8Array(data));
      else reject(error);
    });
  });
}
