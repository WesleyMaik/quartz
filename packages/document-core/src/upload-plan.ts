import { basename, isWithin, type ProjectPath, parseProjectPath, pathIdentityKey } from "./paths";
import { err, ok, type QuartzError, quartzError, type Result } from "./result";

/** Guardrails for one upload: a folder drop must not flood the browser's storage by accident. */
export const MAX_UPLOAD_FILES = 500;
export const MAX_UPLOAD_FILE_BYTES = 100 * 1024 * 1024;
export const MAX_UPLOAD_TOTAL_BYTES = 300 * 1024 * 1024;

/** A file picked or dropped by the user; `relativePath` keeps its folders ("fonts/a.ttf"). */
export interface UploadCandidate {
  readonly relativePath: string;
  readonly size: number;
}

export type SkipReason = "system_file" | "invalid_path" | "too_large" | "duplicate";

/** True when any segment of `path` is clutter such as `.DS_Store` or `__MACOSX`. */
export const isSystemPath = (path: string): boolean =>
  path.split("/").some((segment) => SYSTEM_SEGMENT.test(segment));

export interface PlannedUpload {
  /** Index into the candidate list, so callers can find the matching `File`. */
  readonly index: number;
  readonly path: ProjectPath;
  readonly size: number;
}

export interface UploadPlan {
  readonly uploads: readonly PlannedUpload[];
  readonly skipped: readonly { readonly relativePath: string; readonly reason: SkipReason }[];
  readonly totalBytes: number;
  /** Top-level folders being added, for the confirmation message. */
  readonly folders: readonly string[];
}

/** Operating-system and VCS clutter that never belongs in a document project. */
const SYSTEM_SEGMENT = /^(?:\.DS_Store|Thumbs\.db|desktop\.ini|__MACOSX|\.git|\.svn|\.hg|\._.*)$/i;

/**
 * Validates an upload before anything is written: every target path goes through
 * `parseProjectPath`, clutter and oversized files are skipped, and the whole batch is refused when
 * it exceeds the file-count or total-size limit.
 */
export function planUpload(
  candidates: readonly UploadCandidate[],
  targetFolder: string,
  existing: readonly ProjectPath[],
): Result<UploadPlan, QuartzError> {
  const taken = new Set(existing.map(pathIdentityKey));
  const uploads: PlannedUpload[] = [];
  const skipped: { relativePath: string; reason: SkipReason }[] = [];
  const folders = new Set<string>();
  let totalBytes = 0;

  candidates.forEach((candidate, index) => {
    const relative = candidate.relativePath.replace(/^\/+/, "");
    const segments = relative.split("/");
    if (isSystemPath(relative)) {
      skipped.push({ relativePath: relative, reason: "system_file" });
      return;
    }
    const parsed = parseProjectPath(targetFolder === "" ? relative : `${targetFolder}/${relative}`);
    if (!parsed.ok) {
      skipped.push({ relativePath: relative, reason: "invalid_path" });
      return;
    }
    if (candidate.size > MAX_UPLOAD_FILE_BYTES) {
      skipped.push({ relativePath: relative, reason: "too_large" });
      return;
    }
    const key = pathIdentityKey(parsed.value);
    if (taken.has(key)) {
      skipped.push({ relativePath: relative, reason: "duplicate" });
      return;
    }
    taken.add(key);
    if (segments.length > 1 && segments[0] !== undefined) folders.add(segments[0]);
    uploads.push({ index, path: parsed.value, size: candidate.size });
    totalBytes += candidate.size;
  });

  if (uploads.length > MAX_UPLOAD_FILES) {
    return err(
      quartzError(
        "upload.limit_exceeded",
        `This upload has ${uploads.length} files; the limit is ${MAX_UPLOAD_FILES} per upload.`,
      ),
    );
  }
  if (totalBytes > MAX_UPLOAD_TOTAL_BYTES) {
    return err(
      quartzError(
        "upload.limit_exceeded",
        `This upload is larger than ${MAX_UPLOAD_TOTAL_BYTES / 1024 / 1024} MB.`,
      ),
    );
  }
  return ok({ uploads, skipped, totalBytes, folders: [...folders].sort() });
}

export interface PlannedMove {
  readonly from: ProjectPath;
  readonly to: ProjectPath;
}

/**
 * Moves for dragging `paths` into `targetFolder` ("" is the project root). Paths inside another
 * selected folder travel with it; items already there and folders dropped into themselves are left
 * out, so the result only holds moves that change something.
 */
export function planMove(paths: readonly ProjectPath[], targetFolder: string): PlannedMove[] {
  const unique = [...new Set(paths)];
  const roots = unique.filter(
    (path) => !unique.some((other) => other !== path && isWithin(path, other)),
  );
  const moves: PlannedMove[] = [];
  for (const from of roots) {
    if (targetFolder !== "" && isWithin(targetFolder as ProjectPath, from)) continue;
    const parent = from.includes("/") ? from.slice(0, from.lastIndexOf("/")) : "";
    if (parent === targetFolder) continue;
    const to = parseProjectPath(
      targetFolder === "" ? basename(from) : `${targetFolder}/${basename(from)}`,
    );
    if (to.ok) moves.push({ from, to: to.value });
  }
  return moves;
}
