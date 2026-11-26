# Compiler Architecture

Decision record: [ADR-004](../decisions/ADR-004-compiler-architecture.md). Contracts: [compiler-contracts.md](../specifications/compiler-contracts.md). Evidence: [latex-wasm spike](../technical-spikes/latex-wasm.md), [typst-wasm spike](../technical-spikes/typst-wasm.md).

## 1. Shape

```
CompileService (apps/web, main thread)
  ├─ CompileQueue (compiler-core)       per project: 1 running + 1 pending, latest wins
  ├─ EngineHost<latex> (compiler-core)  owns a Worker, restarts on crash, terminates to cancel
  │     └─ worker: compiler-latex/worker.ts → LaTeX adapter → engine WASM
  └─ EngineHost<typst>
        └─ worker: compiler-typst/worker.ts → Typst adapter → typst.ts web compiler WASM
```

The adapter runs **inside** the worker. The main thread only sees the `EngineWorkerApi` exposed through Comlink. This keeps the `CompilerAdapter` contract the same for both engines while each engine keeps its own internals (for example, LaTeX engines that already ship their own worker are wrapped: the Quartz worker becomes a thin forwarder or the adapter talks to the engine's worker directly; decided in Spike 1).

## 2. Engine recommendations (pending spikes)

| Engine | Recommendation | Status |
|---|---|---|
| Typst | `@myriaddreamin/typst.ts` compiler API + `@myriaddreamin/typst-ts-web-compiler` WASM, inside a Quartz worker; no `typst-ts-renderer` (PDF.js renders the PDF). | **[REC]**, needs Spike 2 for PDF output shape, diagnostics, fonts |
| LaTeX | **Siglum** (`@siglum/engine`, MIT, TL2026, pdfLaTeX + XeLaTeX, automatic BibTeX), self-hosted curated package set, CTAN proxy disabled. Challenger: Tectonic WASM build (`glyphtex-engine`, XeTeX only). Excluded by the `MIT OR Apache-2.0` policy: SwiftLaTeX and texlyre-busytex (AGPL-3.0 wrappers). | **[REC]**, confirmed or replaced by Spike 1 |

Full comparison and license analysis: [latex-wasm.md](../technical-spikes/latex-wasm.md).

## 3. Compilation input

The compile service builds a `CompilationProject` from a storage snapshot:

- `entry`: the root document path.
- `files`: text sources as UTF-8 strings, binaries as `Uint8Array`. Binaries are **transferred** (`Comlink.transfer`) to avoid copying; the snapshot is re-read from Dexie for each job so transfer is safe.
- `incremental hint`: the set of paths whose revision changed since the last job for this worker, so adapters that keep a virtual file system (both engines do) write only changed files.

Workers keep their own in-memory virtual FS between jobs (engine-specific: Emscripten MEMFS for TeX, `addSource`/`mapShadow` for Typst). The adapter syncs it from the incremental hint, and removes deleted paths.

## 4. Queue, staleness, cancellation

- Each job has `jobId` (monotonic) and `snapshotKey` (hash of `(path, revision)` pairs).
- New request while running: replace the pending slot; when the running job ends, start the pending one. Results of a job whose `snapshotKey` is older than the latest *published* result are discarded (stale protection).
- Cancel: Typst compiles are short and run to completion; the result is discarded if stale. LaTeX compiles can take seconds: cancel = `worker.terminate()` and lazy restart. **[ASSUMPTION]** restarting costs < 1.5 s when the WASM module and format files are in Cache Storage; reuse a compiled `WebAssembly.Module` (structured-cloneable) to skip recompilation. Measured in Spike 1.
- Timeouts: LaTeX 120 s, Typst 30 s by default; on timeout the worker is terminated and the job ends as `error` with code `compile.timeout`.

## 5. Status model

```
idle ─► initializing ─► queued ─► compiling ─► success
                           ▲            │  └──► error
                           └────────────┘  └──► cancelled
```

`initializing` covers fetching and instantiating WASM and format files, with progress (bytes) where the engine exposes it. `success` and `error` both keep `lastSuccessfulPdf`. The header shows the status; the preview shows "Stale, last successful build HH:MM" when the latest job failed.

## 6. Diagnostics

Each adapter normalizes engine output into `CompilerDiagnostic { severity, message, file?, line?, column?, source: "latex" | "typst", code? }`.

- Typst: the compiler returns structured diagnostics with spans; map spans to file/line/column. **[ASSUMPTION]** exact typst.ts diagnostics API confirmed in Spike 2.
- LaTeX: parse the `.log` with a Quartz-owned parser (patterns: `! ` errors, `l.<n>` line markers, `LaTeX Warning:`, `Package <x> Warning:`, `Overfull/Underfull \hbox`, file stack via parentheses). Existing open-source log parsers (for example the one in Overleaf, which is AGPL-3.0) may be studied for patterns but not copied: Quartz code is `MIT OR Apache-2.0`. **[ASSUMPTION]** a parser with ~90 % useful line attribution is achievable; validated against the Spike 1 corpus.

Diagnostics feed CodeMirror's `@codemirror/lint` via `setDiagnostics`, the problems panel, and the `get_diagnostics` agent tool.

## 7. Multi-pass LaTeX

The LaTeX adapter owns the run plan: `latex → (bibtex | biber) → latex → latex`, stopping early when the `.aux` hash is unchanged and no "Rerun" warning appears. Index (`makeindex`) only if `.idx` exists. Engines that already implement this (texlyre-busytex `rerun`, Siglum automatic BibTeX) are used as-is; otherwise the adapter does it.

## 8. Lazy loading and memory

- No engine code in the main bundle. `CompileService` does `await import("@qrtz/compiler-typst")` on first need.
- Only the engine of the active project is warm. Switching projects to the other engine keeps the previous worker alive for 10 minutes, then terminates it.
- **[FINDING]** Siglum documents roughly 512 MB RAM for its engine (docs/usage.md). Quartz shows a warning when `performance.memory`/`navigator.deviceMemory` (where available) suggests < 4 GB device memory.

## 9. Unsupported features (honest list, MVP)

| Feature | LaTeX | Typst |
|---|---|---|
| Shell escape (`minted`, `\write18`, gnuplot) | Not supported | n/a |
| LuaLaTeX | Not in MVP (no LuaTeX in shortlisted MIT engines) | n/a |
| Packages outside the static mirror | Not supported, unless the user uploads the `.sty`/`.cls` into the project | `@preview` packages need network on first use |
| System fonts | Not available; only fonts in TeX Live bundles or uploaded into the project (XeTeX `fontspec` with `Path=`) | Only bundled default fonts + project fonts |
| EPS/SVG figure conversion | Not supported (no external converters) | SVG is native in Typst |
| SyncTeX navigation | Deferred to Phase 6 | Deferred to Phase 6 |
