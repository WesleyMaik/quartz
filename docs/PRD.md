# Quartz: Product Requirements Document

Status: Draft v1 (2026-11-26). Owner: project owner. See [README.md](README.md) for the evidence legend.

## 1. Context

**[FACT]** OpenAI Prism, a cloud LaTeX workspace launched on 2026-01-27 with an integrated model, is being retired. OpenAI's notice states Prism shuts down on 2027-01-01, and OpenAI publishes a Prism-to-Codex migration guide. Sources: https://help.openai.com/en/articles/20001615-prism-to-codex-migration-guide, https://openai.com/index/introducing-prism/.

**[REC]** Quartz cannot ship a usable MVP before 2027-01-01 (five weeks from this plan). The realistic product goal is "the place Prism users land after exporting", so a conventional ZIP/LaTeX import path (already in scope) is the Prism migration path. No Prism-specific importer is planned unless a spike shows the export needs special handling.

## 2. Product statement

Quartz is a browser-only, local-first scientific writing workspace for LaTeX and Typst. It edits, stores, compiles and previews documents entirely on the user's device and exposes its project operations as WebMCP tools so the user's own AI agent can read, edit, review and compile documents in the open Quartz tab.

Quartz ships no model, no model gateway, no API-key management, no account and no backend.

## 3. Principles (normative)

1. Browser-native: editing, storage, compilation and rendering run client-side.
2. Local-first: projects live in the browser's origin storage. The user can export them at any time.
3. Agent-agnostic: any harness that can invoke WebMCP tools can work with Quartz.
4. Format-first: original `.tex`, `.typ`, `.bib` and asset files are never rewritten or hidden.
5. Multi-engine: LaTeX and Typst sit behind one compiler contract.
6. Privacy-first: no telemetry, no mandatory network calls for documents.
7. Extensible without overengineering: new engines and tools plug into existing contracts.
8. Offline-capable after the app shell and the engine assets the user needs have been cached.

## 4. Users and jobs

| Persona | Job to be done |
|---|---|
| Researcher / PhD student | Write a paper or thesis in LaTeX with multiple files, figures and a bibliography, and preview the PDF quickly. |
| Typst adopter | Write Typst documents with fast incremental preview. |
| Agent-driven writer | Ask their own agent (Claude Code, Codex, Gemini in Chrome, others) to restructure sections, fix compile errors or review prose, and review every change before it lands. |
| Prism migrant | Bring an exported LaTeX project into a tool that does not depend on a vendor service. |

## 5. Scope

### 5.1 MVP (Phases 0 to 5)

| Area | In MVP |
|---|---|
| Projects | Create (LaTeX or Typst template), rename, duplicate, delete, recent projects list. |
| Files | Nested folders, create, rename, move, delete, upload assets (images, PDFs, fonts, `.bib`). |
| Editor | CodeMirror 6, tabs, syntax highlighting for LaTeX and Typst, search/replace, diagnostics from the compiler, basic completion (commands, labels, citation keys). |
| Persistence | IndexedDB autosave, recovery after reload, save status, quota display, persistence request. |
| Portability | Export a standard source ZIP, import ZIP, import single `.tex`/`.typ`, export PDF. |
| Compilation | Typst in a worker; LaTeX (pdfLaTeX and XeLaTeX via Siglum, BibTeX; no Biber in MVP, so `biblatex` requires `backend=bibtex`) in a worker; manual and debounced auto compile; logs; diagnostics; last good PDF kept. |
| Preview | PDF.js viewer: pages, zoom, page navigation, search, text selection, download. |
| Agent | WebMCP tools for inspect, read, write (staged), compile, diagnostics; review queue with diff and approve/reject; activity timeline; undo of applied change sets. |
| UI | Desktop-first resizable layout, command palette, light/dark theme, keyboard shortcuts. |
| Offline | Installable PWA; app shell and used engine assets cached. |

### 5.2 Explicitly excluded from MVP

**[DEFERRED]** Embedded chat with an AI model; prompt composer that "sends" to an agent; real-time collaboration; cloud sync; Zotero/Crossref/OpenAlex; SyncTeX source/PDF navigation; full revision history UI (only agent change-set undo in MVP); LuaLaTeX; shell-escape; custom TeX package upload beyond files in the project; Typst `@preview` packages offline; mobile layout beyond read-only usability; File System Access API directory sync; OPFS storage; WYSIWYG editing; additional export formats (HTML, DOCX).

## 6. Functional requirements

IDs are referenced by [roadmap/acceptance-criteria.md](roadmap/acceptance-criteria.md).

- **FR-PRJ-1** Create a project from a template (`latex-article`, `typst-article`, `empty-latex`, `empty-typst`).
- **FR-PRJ-2** Detect engine and entry point on import from content and metadata, not from the file name (see [document-domain.md](specifications/document-domain.md#engine-detection)).
- **FR-PRJ-3** Duplicate a project, producing a new project ID and copied files.
- **FR-PRJ-4** Delete a project after confirmation; deletion removes all its records in one transaction.
- **FR-FS-1** Files and folders use normalized POSIX relative paths validated by one shared function.
- **FR-ED-1** Unsaved indicator per tab; autosave after 750 ms idle and on blur/visibility change.
- **FR-ST-1** Show storage usage and whether persistent storage is granted; warn at 80 % of quota.
- **FR-ST-2** Explain in the UI that clearing site data deletes projects, and offer ZIP export.
- **FR-CMP-1** Compile on demand (Ctrl/Cmd+S or Ctrl/Cmd+Enter) and optionally on idle (default 1 s debounce for Typst, 2.5 s for LaTeX, configurable).
- **FR-CMP-2** A failed compile never replaces the last successful PDF; the preview shows a stale badge.
- **FR-CMP-3** Diagnostics map to file and line when the engine reports them.
- **FR-AG-1** When WebMCP is available, Quartz registers its tools; when not, the agent panel explains how to enable it and the rest of the app is unaffected.
- **FR-AG-2** Agent write operations create change sets; delete operations always require explicit user approval.
- **FR-AG-3** Every agent tool call appears in the activity timeline with its real status, arguments summary and result summary.
- **FR-IO-1** ZIP import validates paths and sizes before writing anything to storage.

## 7. Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-1 | App shell first load (cold, broadband) | < 2.5 s to interactive, < 400 KB gzip initial JS, no engine code in the initial bundle |
| NFR-2 | Editor input latency | No main-thread task > 50 ms during typing or compiling |
| NFR-3 | Typst incremental compile (10-page doc) | < 500 ms after warm-up ([ASSUMPTION], measured in Spike 2) |
| NFR-4 | LaTeX compile (10-page article, warm, packages cached) | < 6 s ([ASSUMPTION], measured in Spike 1) |
| NFR-5 | Autosave durability | No data loss beyond the last 1 s of typing on tab close |
| NFR-6 | Import safety | Rejects path traversal, bombs and oversize archives with explicit errors |
| NFR-7 | Browsers | Latest two versions of Chrome/Edge, Firefox, Safari for the core app; WebMCP only where the browser supports it |
| NFR-8 | Accessibility | WCAG 2.2 AA for app chrome; full keyboard operation |
| NFR-9 | Privacy | Zero requests to Quartz-operated dynamic endpoints; only static assets and optional user-initiated fetches |

## 8. Success metrics (local, non-telemetry)

Quartz has no telemetry, so success is measured through test suites and opt-in user feedback: the E2E workflow in [testing-strategy.md](architecture/testing-strategy.md) passes on all three browser engines, and the compatibility corpus (Spike 1) compiles at the target rate.

## 9. Dependencies on decisions

- **Decided: Quartz is open source under `MIT OR Apache-2.0`.** Bundled code must be permissive; GPL/AGPL engines run only as separate worker programs with published source. See [ADR-004](decisions/ADR-004-compiler-architecture.md#license-decision).
- **[OPEN] OQ-2 Static asset hosting for TeX Live bundles** (gigabytes in total, lazy-loaded).
