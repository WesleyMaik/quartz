/// <reference lib="webworker" />
import { createTypstCompiler, type TypstCompiler } from "@myriaddreamin/typst.ts/compiler";
import { loadFonts } from "@myriaddreamin/typst.ts/options.init";
import wasmUrl from "@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm?url";
import type {
  CompilationProject,
  CompilationResult,
  CompilerDiagnostic,
  EngineWorkerApi,
  InitializeOptions,
  InitProgress,
} from "@qrtz/compiler-core";
import * as Comlink from "comlink";
import { isTypstDiagnosticMessage, normalizeTypstDiagnostic } from "./diagnostics";
import { TYPST_TEXT_FONTS } from "./fonts";

let compiler: TypstCompiler | undefined;
/** Paths currently mapped into the compiler, with a fingerprint to skip unchanged files. */
const mapped = new Map<string, string>();

const fingerprint = (file: CompilationProject["files"][number]): string =>
  file.kind === "text" ? `t:${file.text.length}:${file.text}` : `b:${file.bytes.byteLength}`;

function syncFiles(instance: TypstCompiler, project: CompilationProject): void {
  const present = new Set<string>();
  for (const file of project.files) {
    const path = `/${file.path}`;
    present.add(path);
    const key = fingerprint(file);
    if (mapped.get(path) === key && file.kind === "text") continue;
    if (file.kind === "text") instance.addSource(path, file.text);
    else instance.mapShadow(path, file.bytes);
    mapped.set(path, key);
  }
  for (const path of mapped.keys()) {
    if (!present.has(path)) {
      instance.unmapShadow(path);
      mapped.delete(path);
    }
  }
}

const api: EngineWorkerApi = {
  async initialize(options: InitializeOptions, onProgress: (progress: InitProgress) => void) {
    if (compiler !== undefined) return;
    onProgress({ phase: "download", message: "Loading Typst compiler" });
    const fontBase = new URL("fonts/", options.assetBaseUrl).href;
    const instance = createTypstCompiler();
    await instance.init({
      getModule: () => wasmUrl,
      beforeBuild: [
        loadFonts(
          TYPST_TEXT_FONTS.map((name) => `${fontBase}${name}`),
          { assets: false },
        ),
      ],
    });
    compiler = instance;
    onProgress({ phase: "ready", message: "Typst ready" });
  },

  async compile(project: CompilationProject): Promise<CompilationResult> {
    if (compiler === undefined) throw new Error("Typst compiler is not initialized.");
    const startedAt = performance.now();
    syncFiles(compiler, project);
    const result = await compiler.compile({
      mainFilePath: `/${project.entry}`,
      format: 1, // CompileFormatEnum.pdf
      diagnostics: "full",
      inputs: { ...project.options },
    });
    const diagnostics: CompilerDiagnostic[] = (result.diagnostics ?? []).flatMap((raw: unknown) =>
      isTypstDiagnosticMessage(raw) ? [normalizeTypstDiagnostic(raw)] : [],
    );
    const pdf = result.result;
    const durationMs = performance.now() - startedAt;
    const log = diagnostics
      .map(
        (d) => `${d.file ?? ""}:${d.line ?? "?"}:${d.column ?? "?"}: ${d.severity}: ${d.message}`,
      )
      .join("\n");
    if (pdf === undefined || pdf.byteLength === 0) {
      return { status: "error", diagnostics, log, durationMs };
    }
    return Comlink.transfer({ status: "success", pdf, diagnostics, log, durationMs }, [pdf.buffer]);
  },
};

Comlink.expose(api);
