# Compiler Contracts

Package: `packages/compiler-core`. Architecture: [compiler-architecture.md](../architecture/compiler-architecture.md).

## 1. Input

```ts
interface CompilationProject {
  projectId: string;
  engine: "latex" | "typst";
  entry: string;                              // project path
  config: CompilerConfig;                     // from document-core
  files: CompilationFile[];                   // full set on first job, see `changed`
  changed?: { written: string[]; deleted: string[] }; // incremental hint
  snapshotKey: string;
}

type CompilationFile =
  | { path: string; kind: "text"; text: string }
  | { path: string; kind: "binary"; bytes: Uint8Array };   // transferred
```

## 2. Adapter (runs inside the worker)

```ts
interface CompilerAdapter<E extends Engine = Engine> {
  readonly engine: E;
  readonly capabilities: CompilerCapabilities;
  initialize(options: InitializeOptions, onProgress: (p: InitProgress) => void): Promise<void>;
  compile(project: CompilationProject, signal: CancellationToken): Promise<CompilationResult>;
  dispose(): Promise<void>;
}

interface CompilerCapabilities {
  variants: readonly string[];          // ["pdflatex", "xelatex"] | ["typst"]
  bibliography: readonly ("bibtex" | "biber")[];
  synctex: boolean;
  incremental: boolean;                 // keeps VFS between jobs
  cooperativeCancel: boolean;           // false → host must terminate worker
}

interface InitializeOptions {
  assetBaseUrl: string;                 // static mirror root, same origin
  fonts?: { url: string; sha256?: string }[];
  network: { typstPackages: boolean };
}

interface InitProgress { phase: "download" | "instantiate" | "format"; loadedBytes?: number; totalBytes?: number }
```

`CancellationToken` is a plain object checked between passes (worker side). True abort for synchronous WASM runs is worker termination by the host.

## 3. Result

```ts
interface CompilationResult {
  status: "success" | "error";          // "cancelled" is produced by the host, never the adapter
  pdf?: Uint8Array;                     // transferred back; present iff status === "success"
  synctex?: Uint8Array;                 // gz bytes if capability present (Phase 6)
  diagnostics: CompilerDiagnostic[];
  logs: CompilationLog[];
  passes: CompilationPass[];            // e.g. pdflatex, bibtex, pdflatex
  durationMs: number;
  fetchedBytes: number;                 // network bytes during this job (packages/bundles)
  missing?: MissingResource[];          // packages/fonts/files the engine could not find
}

interface CompilerDiagnostic {
  severity: "error" | "warning" | "info";
  message: string;
  file?: string;                        // project path when attributable
  range?: { startLine: number; startColumn?: number; endLine?: number; endColumn?: number }; // 1-based
  source: "latex" | "bibtex" | "biber" | "typst";
  code?: string;                        // e.g. "undefined-control-sequence", "overfull-hbox"
  hint?: string;
}

interface CompilationLog { pass: string; stream: "log" | "stdout" | "stderr"; text: string; truncated: boolean }
interface CompilationPass { tool: string; exitCode: number; durationMs: number }
type MissingResource = { kind: "package" | "font" | "file"; name: string };
```

`success` means a PDF was produced. LaTeX may produce a PDF with errors in nonstop mode; the adapter reports `success` with error diagnostics in that case and the UI shows "Built with errors".

## 4. Host (main thread)

```ts
interface EngineHost {
  readonly engine: Engine;
  state(): EngineHostState;             // "cold" | "starting" | "ready" | "busy" | "crashed"
  compile(project: CompilationProject): Promise<HostResult>;
  cancel(): Promise<void>;              // terminate if !cooperativeCancel
  dispose(): Promise<void>;
}
type HostResult = CompilationResult | { status: "cancelled"; durationMs: number } | { status: "error"; diagnostics: CompilerDiagnostic[]; logs: CompilationLog[]; durationMs: number; crash: true };
```

## 5. Queue

```ts
interface CompileQueue {
  request(projectId: string, reason: "manual" | "auto" | "agent"): Promise<HostResult>;
  // invariants:
  // - at most one running job per project and one pending; a new request replaces the pending one
  // - pending requests resolve with the result of the job that superseded them
  // - results with snapshotKey older than the last published result are dropped
}
```

## 6. Worker API (Comlink-exposed)

```ts
interface EngineWorkerApi {
  initialize(options: InitializeOptions, onProgress: ProxyMarked<(p: InitProgress) => void>): Promise<CompilerCapabilities>;
  compile(project: CompilationProject): Promise<CompilationResult>;
  dispose(): Promise<void>;
}
```

All values crossing the boundary are structured-cloneable; `Uint8Array` buffers are transferred both ways.

## 7. Compatibility matrix (planned, to be filled by Spikes 1 and 2)

| Capability | LaTeX: Siglum (selected) | LaTeX: Tectonic WASM port (challenger) | Typst (typst.ts) |
|---|---|---|---|
| Engines | pdfLaTeX, XeLaTeX [FACT] | XeTeX only [FACT] | Typst 0.14.2 (0.7.0) / 0.15.1 (0.8.0-rc4) [FACT] |
| LuaLaTeX | No [FACT] | No [FACT] | n/a |
| TeX Live | 2026 [FACT] | 2022/2023 bundles [FINDING] | n/a |
| Package source | Curated pre-bundled set, self-hosted; CTAN proxy disabled [FACT] | Curated `.ttb` bundle via HTTP range requests [FACT] | Universe via `packages.typst.org` [ASSUMPTION] |
| Fully static hosting | Yes, for the bundled set [FACT] | Yes, host must support range requests [FACT] | Yes, with local fonts [ASSUMPTION] |
| BibTeX | Yes, automatic [FACT] | Yes, built in, automatic reruns [FACT] | Native (Hayagriva, `.bib` supported) |
| Biber | No [FACT] | No (external CLI only) [FACT] | n/a |
| SyncTeX | Not found | Not found | Source mapping via compiler [ASSUMPTION] |
| Multi-file, nested dirs | `additionalFiles` [FACT] | `tectonic_add_file` API in a port [FINDING] | Yes (`addSource`/`mapShadow`) [FACT] |
| Worker | Own worker [FACT] | To verify | Quartz worker [REC] |
| Custom fonts | Via project files with `fontspec` [ASSUMPTION] | Same [ASSUMPTION] | Font loading APIs [FINDING] |
| Shell escape | No | No | n/a |
| npm package | `@siglum/engine` [FACT] | `glyphtex-engine` [FINDING] | Yes |
| Maintenance signal | Active releases Nov 2026, one maintainer [FINDING] | Core very active; ports tiny [FINDING] | Active, established project |
