/** Contracts shared by every engine. Spec: docs/specifications/compiler-contracts.md. */

export type EngineId = "latex" | "typst";

export type CompilationFile =
  | { readonly path: string; readonly kind: "text"; readonly text: string }
  | { readonly path: string; readonly kind: "binary"; readonly bytes: Uint8Array };

export interface CompilationProject {
  readonly projectId: string;
  readonly entry: string;
  readonly files: readonly CompilationFile[];
  /** Identifies the exact file revisions in this snapshot; used for stale-result protection. */
  readonly snapshotKey: string;
  readonly options?: Readonly<Record<string, string>>;
}

export interface CompilerDiagnostic {
  readonly severity: "error" | "warning" | "info";
  readonly message: string;
  readonly file?: string;
  /** 1-based. */
  readonly line?: number;
  /** 1-based. */
  readonly column?: number;
  readonly source: string;
}

export interface CompilationResult {
  readonly status: "success" | "error";
  readonly pdf?: Uint8Array;
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly log: string;
  readonly durationMs: number;
}

export interface InitProgress {
  readonly phase: "download" | "instantiate" | "ready";
  readonly message: string;
}

export interface InitializeOptions {
  /** Absolute URL prefix of the engine's static assets on the Quartz origin. */
  readonly assetBaseUrl: string;
}

/** API exposed by every engine worker through Comlink. */
export interface EngineWorkerApi {
  initialize(
    options: InitializeOptions,
    onProgress: (progress: InitProgress) => void,
  ): Promise<void>;
  compile(project: CompilationProject): Promise<CompilationResult>;
}

export type CompileStatus =
  | "idle"
  | "initializing"
  | "queued"
  | "compiling"
  | "success"
  | "error"
  | "cancelled";

/**
 * What the app needs from any engine. `EngineHost` implements it for Quartz-owned workers;
 * adapters around engines that manage their own worker (Siglum) implement it directly.
 */
export interface CompileEngine {
  readonly engine: EngineId;
  compile(project: CompilationProject): Promise<HostResult>;
  /** Stops the running compile; the next compile restarts the engine if needed. */
  cancel(): void;
  dispose(): void;
}

export type HostResult =
  | (CompilationResult & { readonly snapshotKey: string })
  | { readonly status: "cancelled"; readonly snapshotKey: string; readonly durationMs: number };
