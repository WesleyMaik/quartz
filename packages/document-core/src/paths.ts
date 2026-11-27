import type { Brand } from "./ids";
import { err, ok, type Result } from "./result";

/** Normalized, validated POSIX path relative to the project root. Created only by `parseProjectPath`. */
export type ProjectPath = Brand<string, "ProjectPath">;

export type PathErrorReason =
  | "empty"
  | "absolute"
  | "backslash"
  | "control_character"
  | "dot_segment"
  | "empty_segment"
  | "trailing_dot_or_space"
  | "reserved_name"
  | "too_long"
  | "too_deep";

export interface PathError {
  readonly code: "path.invalid";
  readonly reason: PathErrorReason;
  readonly input: string;
}

export const MAX_PATH_BYTES = 1024;
export const MAX_PATH_DEPTH = 32;

// biome-ignore lint/suspicious/noControlCharactersInRegex: the rule exists to reject control characters.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const WINDOWS_DRIVE = /^[a-zA-Z]:/;
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

const fail = (reason: PathErrorReason, input: string): Result<never, PathError> =>
  err({ code: "path.invalid", reason, input });

/**
 * The single validator for every path entering Quartz: UI input, archive entries, agent tools.
 * Rules: docs/specifications/project-archive.md §3.
 */
export function parseProjectPath(input: string): Result<ProjectPath, PathError> {
  if (input.length === 0) return fail("empty", input);
  if (input.includes("\\")) return fail("backslash", input);
  if (CONTROL_CHARACTERS.test(input)) return fail("control_character", input);
  if (input.startsWith("/") || WINDOWS_DRIVE.test(input)) return fail("absolute", input);

  const normalized = input.normalize("NFC");
  if (new TextEncoder().encode(normalized).length > MAX_PATH_BYTES) return fail("too_long", input);

  const segments = normalized.split("/");
  if (segments.length > MAX_PATH_DEPTH) return fail("too_deep", input);

  for (const segment of segments) {
    if (segment.length === 0) return fail("empty_segment", input);
    if (segment === "." || segment === "..") return fail("dot_segment", input);
    if (segment.endsWith(".") || segment.endsWith(" ")) return fail("trailing_dot_or_space", input);
    if (RESERVED_NAMES.test(segment)) return fail("reserved_name", input);
  }

  return ok(normalized as ProjectPath);
}

/** Key for duplicate detection on case-insensitive file systems. */
export const pathIdentityKey = (path: ProjectPath): string => path.toLocaleLowerCase("en-US");

export const basename = (path: ProjectPath): string => path.slice(path.lastIndexOf("/") + 1);

export const dirname = (path: ProjectPath): string => {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
};

export const extension = (path: ProjectPath): string => {
  const name = basename(path);
  const index = name.lastIndexOf(".");
  return index <= 0 ? "" : name.slice(index + 1).toLowerCase();
};

/** True when `path` is `folder` itself or lies inside it. */
export const isWithin = (path: ProjectPath, folder: ProjectPath): boolean =>
  path === folder || path.startsWith(`${folder}/`);

export const userMessageForPathError = (error: PathError): string => {
  switch (error.reason) {
    case "empty":
      return "Name cannot be empty.";
    case "absolute":
      return "Paths must be relative to the project.";
    case "backslash":
      return "Use / to separate folders.";
    case "control_character":
      return "Name contains invalid characters.";
    case "dot_segment":
      return "'.' and '..' are not allowed.";
    case "empty_segment":
      return "Path contains an empty folder name.";
    case "trailing_dot_or_space":
      return "Names cannot end with a dot or a space.";
    case "reserved_name":
      return "This name is reserved on some systems.";
    case "too_long":
      return "Path is too long.";
    case "too_deep":
      return "Folders are nested too deeply.";
  }
};
