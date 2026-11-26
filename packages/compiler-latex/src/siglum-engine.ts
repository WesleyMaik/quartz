import type {
  CompilationProject,
  CompileEngine,
  CompilerDiagnostic,
  HostResult,
  InitProgress,
} from "@qrtz/compiler-core";
import type { SiglumCompiler } from "@siglum/engine";
import siglumWorkerUrl from "@siglum/engine/worker?url";
import { parseLatexLog } from "./log-parser";
import { OfflineSiglumCompiler } from "./offline-siglum";

/** Runtime release served from the Quartz origin; produced by `pnpm --filter @qrtz/web fetch:assets`. */
export const SIGLUM_RELEASE_ID = "tl2026-0cc2592f50103429";

export type LatexVariant = "pdflatex" | "xelatex";

export interface SiglumEngineOptions {
  /** Absolute URL of the LaTeX asset folder, e.g. https://host/engines/latex/ */
  readonly assetBaseUrl: string;
  readonly onProgress?: (progress: InitProgress) => void;
}

const MAX_LOG_CHARS = 200_000;

/**
 * Siglum (BusyTeX, TeX Live 2026) behind Quartz's `CompileEngine` contract.
 * Siglum manages its own worker, so this adapter runs on the main thread and only forwards
 * project files. Packages come exclusively from the self-hosted runtime: CTAN proxy requests (a
 * server) are answered locally as unavailable, and Siglum's document cache is disabled.
 */
export class SiglumEngine implements CompileEngine {
  readonly engine = "latex" as const;
  private compiler: SiglumCompiler | undefined;
  private cancelCurrent: (() => void) | undefined;
  /** Engine messages (bundle loading, retries) shown with the TeX log. */
  private engineLog: string[] = [];

  constructor(private readonly options: SiglumEngineOptions) {}

  private create(): SiglumCompiler {
    const base = new URL(`${SIGLUM_RELEASE_ID}/`, this.options.assetBaseUrl).href.replace(
      /\/$/,
      "",
    );
    const report = this.options.onProgress;
    return new OfflineSiglumCompiler({
      bundlesUrl: base,
      wasmUrl: `${base}/wasm/busytex.wasm`,
      jsUrl: `${base}/wasm/busytex.js`,
      xzwasmUrl: `${base}/xzwasm.js`,
      workerUrl: siglumWorkerUrl,
      enableDocCache: false,
      onLog: (message: string) => {
        if (this.engineLog.length < 500) this.engineLog.push(message);
      },
      ...(report === undefined
        ? {}
        : {
            onProgress: (stage: string, detail: string) =>
              report({ phase: "download", message: detail || stage }),
          }),
    });
  }

  async compile(project: CompilationProject): Promise<HostResult> {
    const startedAt = performance.now();
    this.engineLog = [];
    if (this.compiler === undefined) {
      this.options.onProgress?.({ phase: "download", message: "Loading LaTeX engine" });
      this.compiler = this.create();
    }
    const compiler = this.compiler;
    await compiler.init();

    const entry = project.files.find((file) => file.path === project.entry);
    if (entry === undefined || entry.kind !== "text") {
      return this.failure(project, startedAt, `Main document ${project.entry} was not found.`);
    }
    const additionalFiles: Record<string, string | Uint8Array> = {};
    for (const file of project.files) {
      if (file.path === project.entry) continue;
      additionalFiles[file.path] = file.kind === "text" ? file.text : file.bytes;
    }
    const variant: LatexVariant = project.options?.variant === "xelatex" ? "xelatex" : "pdflatex";

    const run = compiler.compile(entry.text, {
      engine: variant,
      mainFile: project.entry,
      additionalFiles,
      useCache: false,
    });
    const outcome = await new Promise<Awaited<typeof run> | "cancelled">((resolve, reject) => {
      this.cancelCurrent = () => resolve("cancelled");
      run.then(resolve, reject);
    }).finally(() => {
      this.cancelCurrent = undefined;
    });
    const durationMs = performance.now() - startedAt;
    if (outcome === "cancelled")
      return { status: "cancelled", snapshotKey: project.snapshotKey, durationMs };

    const texLog = (outcome.log ?? "").slice(-MAX_LOG_CHARS);
    const engineLog = this.engineLog.join("\n");
    const log = engineLog === "" ? texLog : `${texLog}\n\n--- Engine ---\n${engineLog}`;
    const diagnostics = parseLatexLog(
      texLog,
      project.entry,
      new Set(project.files.map((f) => f.path)),
    );
    if (outcome.success) {
      return {
        status: "success",
        pdf: outcome.pdf,
        diagnostics,
        log,
        durationMs,
        snapshotKey: project.snapshotKey,
      };
    }
    const reported: CompilerDiagnostic[] = diagnostics.some((d) => d.severity === "error")
      ? diagnostics
      : [
          { severity: "error", message: outcome.error, file: project.entry, source: "latex" },
          ...diagnostics,
        ];
    return {
      status: "error",
      diagnostics: reported,
      log: log || outcome.error,
      durationMs,
      snapshotKey: project.snapshotKey,
    };
  }

  private failure(project: CompilationProject, startedAt: number, message: string): HostResult {
    return {
      status: "error",
      diagnostics: [{ severity: "error", message, source: "latex" }],
      log: message,
      durationMs: performance.now() - startedAt,
      snapshotKey: project.snapshotKey,
    };
  }

  /** TeX runs cannot be interrupted, so cancelling unloads the engine; it reloads on next compile. */
  cancel(): void {
    if (this.cancelCurrent === undefined) return;
    this.cancelCurrent();
    this.compiler?.unload();
    this.compiler = undefined;
  }

  dispose(): void {
    this.cancel();
    this.compiler?.unload();
    this.compiler = undefined;
  }
}
