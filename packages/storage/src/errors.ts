import { type QuartzError, quartzError } from "@qrtz/document-core";

/** Maps IndexedDB/Dexie failures to domain errors with user-facing messages. */
export function toStorageError(cause: unknown): QuartzError {
  const name = cause instanceof Error ? cause.name : "";
  const inner =
    cause instanceof Error && "inner" in cause && cause.inner instanceof Error
      ? cause.inner.name
      : "";
  if (name === "QuotaExceededError" || inner === "QuotaExceededError") {
    return quartzError(
      "storage.quota_exceeded",
      "Browser storage is full. Export and delete projects to free space.",
    );
  }
  if (name === "ConstraintError" || inner === "ConstraintError") {
    return quartzError("path.exists", "A file with this path already exists.");
  }
  if (name === "MissingAPIError" || name === "DatabaseClosedError") {
    return quartzError("storage.unavailable", "Browser storage is unavailable in this session.");
  }
  const message = cause instanceof Error ? cause.message : String(cause);
  return quartzError("storage.failed", `Storage operation failed: ${message}`);
}
