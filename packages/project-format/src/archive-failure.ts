import type { QuartzErrorCode } from "@qrtz/document-core";

export type ArchiveErrorCode = Extract<QuartzErrorCode, `archive.${string}`>;

/** Internal control flow of the reader; converted to a `Result` at the package boundary. */
export class ArchiveFailure extends Error {
  constructor(
    readonly code: ArchiveErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ArchiveFailure";
  }
}
