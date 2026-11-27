import type { PathErrorReason } from "./paths";

/** Success or expected failure. Services return this instead of throwing for domain errors. */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** Domain error codes, dotted lowercase. See docs/architecture/client-side-architecture.md §9. */
export type QuartzErrorCode =
  | "path.invalid"
  | "path.not_found"
  | "path.exists"
  | "project.not_found"
  | "revision.conflict"
  | "storage.quota_exceeded"
  | "storage.unavailable"
  | "storage.failed"
  | "upload.limit_exceeded"
  | "archive.export_failed"
  | "archive.invalid"
  | "archive.too_large"
  | "archive.too_many_entries"
  | "archive.invalid_path"
  | "archive.duplicate_entry"
  | "archive.unsupported_entry"
  | "archive.bomb_suspected"
  | "archive.no_document";

/**
 * Which user-facing sentence describes an error: the code itself, or a narrower case of it. The
 * interface translates this key; `message` stays English for logs and non-UI callers.
 */
export type QuartzErrorKey =
  | QuartzErrorCode
  | `path.${PathErrorReason}`
  | "path.title_empty"
  | "path.move_into_itself"
  | "path.target_exists"
  | "project.unknown_template"
  | "project.nothing_to_export"
  | "upload.too_many_files"
  | "upload.too_large"
  | "archive.damaged_entry"
  | "archive.unreadable"
  | "archive.entry_too_large"
  | "archive.project_too_large"
  | "archive.unsafe_path"
  | "archive.link_entry"
  | "archive.encrypted"
  | "archive.compression";

export interface QuartzErrorDetail {
  /** Defaults to the code. */
  readonly key?: QuartzErrorKey;
  /** Arguments of the translated sentence. */
  readonly values?: Readonly<Record<string, string | number>>;
}

export interface QuartzError {
  readonly code: QuartzErrorCode;
  readonly message: string;
  readonly key: QuartzErrorKey;
  readonly values?: Readonly<Record<string, string | number>>;
}

export const quartzError = (
  code: QuartzErrorCode,
  message: string,
  { key = code, values }: QuartzErrorDetail = {},
): QuartzError => ({ code, message, key, ...(values === undefined ? {} : { values }) });
