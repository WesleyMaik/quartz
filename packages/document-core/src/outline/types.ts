/** One item found while scanning a source file, in document order. */
export type OutlineItem =
  | {
      readonly kind: "heading";
      /** Smaller numbers are higher in the hierarchy; only the relative order matters. */
      readonly level: number;
      readonly title: string;
      readonly line: number;
    }
  | {
      readonly kind: "include";
      /** Paths to try, relative to the project root, most likely first. */
      readonly targets: readonly string[];
    };

export interface SourceLocation {
  readonly path: string;
  /** Folder of the document being compiled ("" is the project root). */
  readonly rootDirectory: string;
}

export type OutlineScanner = (text: string, location: SourceLocation) => OutlineItem[];

/** Resolves `.` and `..` segments; undefined when the path leaves the project. */
export function joinPath(directory: string, relative: string): string | undefined {
  const segments: string[] = [];
  for (const segment of `${directory}/${relative}`.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment !== "..") segments.push(segment);
    else if (segments.pop() === undefined) return undefined;
  }
  return segments.join("/");
}

export const directoryOf = (path: string): string =>
  path.slice(0, Math.max(0, path.lastIndexOf("/")));

/** Replaces everything but line breaks with spaces, so line numbers stay correct. */
export const blank = (text: string): string => text.replace(/[^\n]/g, " ");
