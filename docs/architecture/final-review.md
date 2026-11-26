# Final Architectural Review

A deliberate challenge of this plan. Answers reference the evidence tags in [docs/README.md](../README.md).

## 1. Can Quartz genuinely operate without any backend?

Yes, with two honest qualifications. (a) It needs a **static host** that serves large engine assets (a curated LaTeX package set, target < 500 MB, fetched lazily), which costs bandwidth but runs no code. (b) Typst Universe packages come from a **third-party static registry** when the user allows it. Neither is a Quartz backend. The places where "no backend" would break are explicitly rejected: Siglum's CTAN proxy, SwiftLaTeX's on-demand server, a local MCP companion, any chat relay.

## 2. Which features work entirely offline?

After the app shell and needed assets are cached: project management, editing, autosave, import/export, Typst compilation with bundled fonts and already-cached packages, LaTeX compilation for packages already downloaded (or pre-downloaded core bundle), PDF preview, agent tools (if the agent itself works offline, e.g. a local model in the user's harness). Not offline: first use of an engine, new LaTeX packages not yet cached, new Typst packages, future Crossref/OpenAlex lookups.

## 3. Which browser APIs require special permissions or experimental support?

| API | Status |
|---|---|
| WebMCP (`document.modelContext`) | Experimental: Chrome/Edge origin trial or flag; no Firefox/Safari [FACT] |
| `navigator.storage.persist()` | Permission-like; may be denied or heuristic; Safari limited [FACT] |
| File System Access directory picker | Chromium only; per-use user permission [FACT] |
| `SharedArrayBuffer` | Requires cross-origin isolation headers (not required by the plan) [FACT] |
| Web Locks, BroadcastChannel, module workers, IndexedDB, Cache Storage | Baseline in all targets [FACT] |

## 4. Is IndexedDB sufficient for the initial storage implementation?

Yes, pending Spike 4 numbers. Project sizes in scientific writing (KB-scale text, MB-scale figures) are well within IndexedDB's comfort zone, and it is the only store offering atomic multi-store transactions everywhere.

## 5. Is OPFS necessary, or should it remain optional?

Not necessary for the MVP. It stays a possible future backend for large binary contents behind `FileRepository`, triggered only by measured need (ADR-002). Using it now would create two sources of truth.

## 6. Is `.qrtz` suitable long term?

Yes. ZIP + JSON + original files remains readable with standard tools indefinitely; the manifest is versioned with forward-compatible minor versions and preserved unknown fields. The main long-term risk is not the container but semantic drift of settings, which is limited by keeping settings optional and documented.

## 7. Most viable LaTeX engine for a browser-native app?

**Siglum**, pending Spike 1 confirmation: MIT, browser-first API and worker, TL2026, pdfLaTeX and XeLaTeX, automatic BibTeX, and a curated pre-bundled package set that can be self-hosted statically (with its CTAN proxy disabled). Tectonic is the healthiest core project and its range-request bundles fit static hosting, but it has no official browser build and is XeTeX-only with older bundles, so a third-party WASM port of it is the challenger. texlyre-busytex is the most capable (LuaLaTeX, Biber, SyncTeX) but its AGPL wrapper conflicts with the license decision. SwiftLaTeX is not viable. The adapter contract stays engine-agnostic so the choice is reversible. Details: [latex-wasm.md](../technical-spikes/latex-wasm.md#engine-selection-2026-11-26-revised).

## 8. Which Typst integration balances stability and performance?

typst.ts compiler-only (no renderer) in a Quartz worker, on the stable 0.7.x line first, moving to 0.8.x (Typst 0.15) once final. It is the most established browser Typst integration, Apache-2.0. Its documentation gaps (PDF call shape, diagnostics, fonts) are the reason for Spike 2.

## 9. Are both engines legally compatible with the intended distribution model?

Quartz is decided as open source, `MIT OR Apache-2.0`. Typst: yes, permissive (Apache-2.0). LaTeX: yes, **with rules**. Engine binaries are GPL in every option, so Quartz publishes the corresponding source for the WASM engines it serves and runs them as separate worker programs, which keeps Quartz's own code permissive. AGPL wrappers (SwiftLaTeX, texlyre-busytex) are excluded because they would be bundled with Quartz code; the AGPL Biber build is acceptable only as a separate worker with a source offer. See [ADR-004](../decisions/ADR-004-compiler-architecture.md#license-decision).

## 10. How should WebMCP expose tools without a server?

By registering tools with `document.modelContext.registerTool()` from the page itself; the browser (or an automation layer the user runs) mediates calls. Quartz never opens a port or endpoint. The adapter is a thin layer over a transport-independent ToolRuntime.

## 11. How can external agents modify documents safely?

Staged change sets by default, explicit approval for deletion, optimistic concurrency with revisions, size/rate limits, project-scoped paths, no code-execution tools, full activity log and undo. Auto-apply is opt-in and still undoable.

## 12. Real limitations of an AI chat panel without an AI runtime

Quartz cannot see the agent's messages, reasoning or token usage, and cannot send prompts to it through WebMCP. A chat panel would either be empty or fake. The plan replaces it with an activity and review panel fed by real tool calls, plus optional agent self-reported status. A true chat requires the agent to live in the browser's own UI or a separate extension channel, both outside Quartz.

## 13. How should Smooth UI be integrated into the shared UI package?

Through the shadcn CLI with the `@smoothui` registry into `packages/ui/src/smoothui`, on Base UI primitives (matching Smooth UI's default), icons swapped to HugeIcons, consumed only by the lazily loaded agent panel. Only 7 components in the MVP; reasoning, context meter, prompt input and suggestions are excluded because Quartz has no truthful data for them.

## 14. Is the monorepo unnecessarily complex for the initial release?

It is at the upper limit. Reductions already applied: `pdf-viewer` folded into the app, services kept in the app, no config packages, source-consumed packages with no build step. Remaining packages each have a distinct reason (pure domain, security-critical archive code, storage, editor, contracts, two license/asset-heavy engines, agent bridge, UI). If friction appears, the first merge candidates are `compiler-core` into a single `compiler` package with `latex`/`typst` subpath entries (keeping license notices per entry), and `editor` into the app. A single-package app would also work for an MVP, but the engine and archive boundaries pay off early in testing and licensing.

## 15. What is explicitly excluded from the MVP?

Embedded chat and prompt composer, model integrations, real-time collaboration, cloud sync, OPFS, File System Access sync, SyncTeX navigation, full manual-edit history, LuaLaTeX, shell escape, offline Typst packages not yet cached, Zotero/Crossref/OpenAlex, WYSIWYG, HTML/DOCX export, mobile editing.

## Overengineering check: things this plan deliberately did not add

- No plugin system for engines (two adapters behind one interface is enough).
- No event bus or CQRS layer; services + Dexie liveQuery.
- No LLM provider abstraction, no API-key storage.
- No custom design system beyond shadcn + Smooth UI.
- No server-side rendering or edge functions.
- No `use-webmcp-tool` dependency; a 40-line adapter suffices.

## Corrections to the original brief

1. Use `document.modelContext`, not `navigator.modelContext` (spec moved).
2. Prefer Base UI over Radix because Smooth UI defaults to it.
3. Replace `apply_patch` (unified diff) with exact-match `edit_file`.
4. Merge overlapping tools (`read_file`/`read_multiple_files`, `get_project`/`get_project_metadata`).
5. Drop the `pdf-viewer` package for now; drop vinext.
6. Rename `.qrtz` `metadata/` to `quartz/` and add a `mimetype` first entry.
7. Treat "AI chat" as an activity panel; exclude `ai-reasoning`, `ai-context-meter`, `ai-prompt-input`, `ai-suggestions` from the MVP.
8. SwiftLaTeX is not a candidate; the 2026 landscape has better-maintained TeX Live 2026 engines.
9. Prism shuts down on 2027-01-01, before any MVP can ship: position Quartz as the post-export destination and test Prism exports in Spike 3.
10. Package scope `@qrtz/*` to avoid the existing "Quartz" static-site generator namespace.
