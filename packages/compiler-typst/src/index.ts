import { EngineHost, type InitProgress } from "@qrtz/compiler-core";

export interface TypstEngineOptions {
  /** Absolute URL of the Typst asset folder on the Quartz origin (contains `fonts/`). */
  readonly assetBaseUrl: string;
  readonly onProgress?: (progress: InitProgress) => void;
}

/** Creates the Typst engine host. The worker and WASM load on first compile. */
export function createTypstEngine(options: TypstEngineOptions): EngineHost {
  return new EngineHost({
    engine: "typst",
    createWorker: () =>
      new Worker(new URL("./typst.worker.ts", import.meta.url), { type: "module", name: "typst" }),
    initialize: { assetBaseUrl: options.assetBaseUrl },
    timeoutMs: 30_000,
    ...(options.onProgress === undefined ? {} : { onProgress: options.onProgress }),
  });
}

export { TYPST_FONTS_SOURCE, TYPST_TEXT_FONTS } from "./fonts";
