/** Inflating and validating an archive is CPU bound, so it happens off the main thread. */
import { quartzError } from "@qrtz/document-core";
import { readProjectZip } from "@qrtz/project-format";

self.onmessage = async (event: MessageEvent<Blob>) => {
  try {
    self.postMessage(readProjectZip(new Uint8Array(await event.data.arrayBuffer())));
  } catch {
    self.postMessage({
      ok: false,
      error: quartzError("archive.invalid", "The file could not be read."),
    });
  }
};
