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
  | "storage.failed";

export interface QuartzError {
  readonly code: QuartzErrorCode;
  readonly message: string;
}

export const quartzError = (code: QuartzErrorCode, message: string): QuartzError => ({
  code,
  message,
});
