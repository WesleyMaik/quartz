import type { CompileEngine } from "@qrtz/compiler-core";
import { SiglumEngine, type SiglumEngineOptions } from "./siglum-engine";

/** Creates the LaTeX engine. Siglum's worker and WASM load on first compile. */
export const createLatexEngine = (options: SiglumEngineOptions): CompileEngine =>
  new SiglumEngine(options);

export { LATEX_EXTRAS_ID } from "./extra-packages";
export { parseLatexLog } from "./log-parser";
export { SIGLUM_RELEASE_ID, type SiglumEngineOptions } from "./siglum-engine";
