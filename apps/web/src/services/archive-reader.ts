import { err, type QuartzError, quartzError, type Result } from "@qrtz/document-core";
import { ARCHIVE_LIMITS, type ProjectArchiveContents } from "@qrtz/project-format";

export type ArchiveReader = (file: Blob) => Promise<Result<ProjectArchiveContents, QuartzError>>;

/** Reads one archive in a short-lived worker, which also frees its memory afterwards. */
export const readArchiveInWorker: ArchiveReader = (file) => {
  // Checked before the worker loads the whole file into memory.
  if (file.size > ARCHIVE_LIMITS.archiveBytes) {
    return Promise.resolve(err(quartzError("archive.too_large", "The archive is too large.")));
  }
  return new Promise((resolve) => {
    const worker = new Worker(new URL("./read-zip.worker.ts", import.meta.url), { type: "module" });
    const finish = (result: Result<ProjectArchiveContents, QuartzError>) => {
      worker.terminate();
      resolve(result);
    };
    worker.onmessage = (event: MessageEvent<Result<ProjectArchiveContents, QuartzError>>) =>
      finish(event.data);
    worker.onerror = () =>
      finish(err(quartzError("archive.invalid", "The archive could not be processed.")));
    worker.postMessage(file);
  });
};
