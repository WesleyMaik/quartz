# Acceptance Criteria

Each criterion is testable. "Verified by" names the test level.

## Phase 1

| ID | Criterion | Verified by |
|---|---|---|
| AC-1.1 | `pnpm install && pnpm turbo typecheck test build` succeeds from a clean clone with only Node and Corepack/pnpm installed | CI |
| AC-1.2 | No npm/yarn/bun lockfiles exist; `packageManager` pinned | CI check |
| AC-1.3 | Importing React in `document-core` or `storage` fails lint | Biome rule test |
| AC-1.4 | Production build initial JS ≤ 400 KB gzip and contains no engine code | Build size check |
| AC-1.5 | No `@radix-ui/*` or `lucide-react` in the dependency tree | CI check |
| AC-1.6 | App shell loads offline after first visit | e2e |

## Phase 2

| ID | Criterion | Verified by |
|---|---|---|
| AC-2.1 | Create, rename, duplicate, delete projects; delete removes every record of that project | browser integration |
| AC-2.2 | After reload, projects, files and contents are identical | e2e |
| AC-2.3 | Exporting the same unchanged project twice yields a byte-identical ZIP | unit |
| AC-2.4 | ZIP export → delete → import restores identical file bytes and folders, and detects entry and engine | e2e |
| AC-2.5 | Every sample in the malicious archive corpus is rejected with its expected error code and nothing is written | integration |
| AC-2.6 | Generic ZIP (Overleaf-style with top-level folder) imports with correct engine and entry detected | integration |
| AC-2.7 | Storage meter shows usage; persistence state is displayed; warning appears at 80 % | component |
| AC-2.8 | Simulated `QuotaExceededError` leaves storage unchanged and shows the quota error UI | integration |

## Phase 3

| ID | Criterion | Verified by |
|---|---|---|
| AC-3.1 | Typing is never blocked: no long task > 50 ms during typing in a 5,000-line file | performance trace in e2e |
| AC-3.2 | Content typed within 1 s before closing the tab is present after reopening (autosave + pagehide flush) | e2e |
| AC-3.3 | Open tabs, active file, cursor and panel sizes restore after reload | e2e |
| AC-3.4 | Explorer CRUD and moves reflect in storage and in open tabs (renamed file tab follows) | e2e |
| AC-3.5 | Invalid file names are rejected inline with the same rules as import | component |
| AC-3.6 | PDF preview supports page navigation, zoom, search and text selection | integration |
| AC-3.7 | Second tab opening the same project is read-only until takeover | e2e |
| AC-3.8 | All workspace actions reachable from the command palette | component |

## Phase 4

| ID | Criterion | Verified by |
|---|---|---|
| AC-4.1 | Typst template compiles to a PDF shown in the preview, in Chromium, Firefox, Safari | e2e |
| AC-4.2 | Typst incremental compile of a 10-page document < 500 ms (warm, mid-range laptop) | benchmark |
| AC-4.3 | Typst compile makes no network request to any origin other than Quartz's, unless packages are enabled | e2e network assertion |
| AC-4.4 | A failing compile keeps the last successful PDF and shows the stale badge | e2e |
| AC-4.5 | Diagnostics appear in the editor gutter at the right file and line | e2e |
| AC-4.6 | Rapid edits produce at most one running + one pending job; stale results never replace newer ones | unit + e2e |
| AC-4.7 | LaTeX template (pdfLaTeX) compiles to PDF in all three browsers | e2e |
| AC-4.8 | Multi-file LaTeX (`\input`, nested folders, PNG and PDF figures, BibTeX) compiles | integration |
| AC-4.9 | LaTeX corpus pass rate ≥ the Spike 1 go threshold | nightly |
| AC-4.10 | Cancel during a LaTeX compile ends in `cancelled` within 1 s and the next compile works | integration |
| AC-4.11 | After warm-up, both engines compile the templates offline | e2e |
| AC-4.12 | Engine code is fetched only when a project of that engine is compiled | e2e network assertion |

## Phase 5

| ID | Criterion | Verified by |
|---|---|---|
| AC-5.1 | Without WebMCP, the app works and the agent panel explains how to enable it | e2e (Firefox) |
| AC-5.2 | With WebMCP (polyfill or native), all catalog tools are listed with generated schemas | integration |
| AC-5.3 | Invalid tool inputs are rejected with structured errors; no state change | unit |
| AC-5.4 | `edit_file` creates a pending change set; file unchanged until approval | e2e |
| AC-5.5 | `delete_path` always requires explicit approval, even in auto-apply mode | unit + e2e |
| AC-5.6 | Approving applies atomically; undo restores byte-identical content | e2e |
| AC-5.7 | A user edit after the agent read causes `conflict` instead of overwriting | integration |
| AC-5.8 | Every tool call appears in the activity timeline with real status and duration | component |
| AC-5.9 | Rate and size limits return `rate_limited` / `limit.*` errors | unit |
| AC-5.10 | Turning off "Expose tools" unregisters all tools (`getTools()` empty) | integration |
| AC-5.11 | At least one documented harness setup works against the deployed app (from Spike 5) | manual test script |
