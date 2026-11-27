# Testing Strategy

## 1. Tools

| Level | Tool | Runs where |
|---|---|---|
| Unit | Vitest (Node environment) | `document-core`, `project-format`, `agent-bridge` catalog/policy, log parser |
| Integration (browser APIs) | Vitest browser mode with the Playwright provider (Chromium, Firefox, WebKit) | `storage` (real IndexedDB), worker hosts, engine adapters, Comlink |
| Component | Vitest browser mode + Testing Library | `ui` components with logic, editor extensions |
| End-to-end | Playwright Test | `e2e/` against `vite preview` build |
| Compatibility corpus | Playwright script, nightly | LaTeX and Typst sample projects |

**[REC]** `fake-indexeddb` only for fast unit tests of pure repository logic; any test that claims "persistence works" runs in a real browser.

Not used: Jest (overlaps Vitest), Cypress (overlaps Playwright), ESLint/Prettier (overlap Biome).

## 2. Unit test inventory

| Subject | Key cases |
|---|---|
| `parseProjectPath` | `..`, `./a`, `a//b`, `/abs`, `C:\x`, `a\b`, NUL, NFC vs NFD duplicates, reserved names (`CON`), 1024-byte limit |
| Domain models | engine detection from content (`\documentclass`, `#set`, `#import`), entry-point resolution, file kind inference |
| Archive writer | deterministic output for same input (sorted entries, fixed timestamps), byte-identical contents, empty folders |
| Archive reader | traversal, duplicates, bomb (ratio and absolute), oversize entry, single top-level folder |
| Migrations | v1 fixture → current |
| Compiler normalization | LaTeX log fixtures → diagnostics (golden files); Typst diagnostic fixtures |
| Compile queue | coalescing, stale discard, cancellation, timeout |
| Tool schemas | each tool: valid input, each invalid field, output matches output schema |
| Policy | each tool class × each mode → expected decision |
| Change sets | apply, conflict on revision mismatch, inverse ops restore exact bytes |

## 3. Integration tests

- IndexedDB: create/read/update/delete projects; `applyBatch` atomicity (inject failure mid-batch → nothing written); quota error mapping (simulate by stubbing `put` to throw `QuotaExceededError`); Dexie upgrade from v1 fixtures.
- Recovery: write, close the page context, reopen, verify content and workspace state.
- Import/export roundtrip: export → import → byte-identical file contents and folders.
- Worker communication: Comlink round-trip, transferables (source buffer detached after transfer), worker crash → host restarts and reports `error`.
- Compiler init/output: Typst `hello.typ` → PDF starts with `%PDF-`; LaTeX `article.tex` → PDF; multi-file with `\input` and figures; BibTeX run.
- PDF viewer: load bytes, page count, search finds known text.
- WebMCP: with the polyfill (`@w3c/webmcp-polyfill`) in all browsers: tools registered, `getTools()` lists them, `executeTool()` returns schema-valid output, abort unregisters. Native WebMCP in Chromium with `--enable-features` / flag where available.

## 4. End-to-end workflow (Playwright, Chromium primary, Firefox and WebKit secondary)

1. Open Quartz (fresh profile).
2. Create LaTeX project from template.
3. Create `sections/intro.tex`, `sections/method.tex`, `\input` them from `main.tex`.
4. Edit text in the editor.
5. Compile (keyboard shortcut).
6. Assert PDF preview shows the edited text (PDF.js text layer).
7. Reload the page.
8. Assert project, files and open tabs are restored.
9. Export the ZIP (capture download).
10. Delete the project (confirm dialog).
11. Import the captured ZIP.
12. Assert all files and folders are restored (compare against the pre-export snapshot).
13. Create a Typst project from template.
14. Compile and assert preview text.
15. Agent tools: via `page.evaluate` using `document.modelContext.getTools()`/`executeTool()` (polyfill or native): `list_files`, `read_files`, `edit_file` → change set pending → approve in UI → file updated → `compile_project` → `get_diagnostics`; `delete_path` requires approval; undo restores.

Native WebMCP E2E is a separate, optional Chromium job (flag or origin-trial token), because availability changes over time. The polyfill job validates Quartz's side of the contract in all browsers.

## 5. Browser compatibility matrix (planned)

| Capability | Chromium | Firefox | Safari |
|---|---|---|---|
| Core app (editor, IndexedDB, workers, PDF.js) | Required | Required | Required |
| Module workers | Yes | Yes | Yes |
| `navigator.storage.persist()` | Yes | Yes (prompt) | Partial (installed web apps) **[FINDING]** |
| Cache Storage / service worker | Yes | Yes | Yes |
| File System Access directory picker | Yes | No | No |
| WebMCP | Origin trial / flag | No | No |

Quartz claims support only for what this matrix and the CI jobs verify.

## 6. Compatibility corpus

`e2e/corpus/latex/*` and `e2e/corpus/typst/*`: at least 20 LaTeX projects (article, beamer, thesis with `biblatex`+`biber`, `tikz`, `pgfplots`, `siunitx`, `amsmath`, IEEE/ACM/Springer templates, XeLaTeX with `fontspec`) and 10 Typst projects (templates, math, figures, bibliography, `@preview` package). Nightly job records pass/fail, compile time and downloaded bytes into a Markdown report under `docs/technical-spikes/results/`.

## 7. CI gates

`pnpm biome check .` → `pnpm turbo typecheck test` → `pnpm turbo build` → Playwright E2E (Chromium on every PR; Firefox/WebKit on main and nightly).
