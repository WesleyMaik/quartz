# Task Backlog

Format: ID · task · depends on · size · done when. Tasks are small and independently verifiable. Spike task details are in the spike documents.

## Phase 0: Feasibility

| ID | Task | Depends | Size | Done when |
|---|---|---|---|---|
| T-0.1.1..12 | LaTeX spike steps ([latex-wasm.md](../technical-spikes/latex-wasm.md)) | none | L | Results file + verdict |
| T-0.2.1..10 | Typst spike steps ([typst-wasm.md](../technical-spikes/typst-wasm.md)) | none | M | Results file + verdict |
| T-0.3.1..5 | Archive spike steps ([qrtz-archive.md](../technical-spikes/qrtz-archive.md)) | none | M | Malicious corpus rejected; interop table |
| T-0.4.1..6 | Storage spike steps ([browser-storage.md](../technical-spikes/browser-storage.md)) | none | M | Benchmark table |
| T-0.5.1..8 | WebMCP spike steps ([webmcp-feasibility.md](../technical-spikes/webmcp-feasibility.md)) | none | M | Harness results |
| T-0.6.1..6 | Smooth UI spike steps ([smoothui-integration.md](../technical-spikes/smoothui-integration.md)) | none | S | Install log + verdict |
| T-0.7.1 | License inventory against the `MIT OR Apache-2.0` policy (OQ-1 decided) | T-0.1.1 | S | ADR-004 license table final; no copyleft in bundled category |
| T-0.7.2 | Go/no-go review, update ADRs and this backlog | all T-0.* | S | ADRs marked Accepted/Revised |

## Phase 1: Foundation

| ID | Task | Depends | Size | Done when |
|---|---|---|---|---|
| T-1.1.1 | Root `package.json` (`packageManager`, scripts), `pnpm-workspace.yaml` with catalog, pin versions via `pnpm view` | T-0.7.2 | S | `pnpm install` clean, lockfile committed |
| T-1.1.2 | `tsconfig.base.json` strict profile; per-package `tsconfig.json` | T-1.1.1 | S | `pnpm turbo typecheck` passes on empty packages |
| T-1.1.5 | Add `LICENSE-MIT`, `LICENSE-APACHE`, SPDX `MIT OR Apache-2.0` in every `package.json`; CI license allow-list check via `pnpm licenses list` | T-1.1.1 | S | CI fails on a test copyleft dependency |
| T-1.1.3 | Create 9 packages with `exports` to `src/index.ts` and dependency graph per monorepo.md | T-1.1.2 | S | Graph check script passes (no cycles, allowed edges only) |
| T-1.1.4 | `turbo.json` tasks | T-1.1.3 | S | `pnpm turbo typecheck test build` runs |
| T-1.2.1 | `apps/web` Vite + React 19 + React Router (2 routes) | T-1.1.3 | S | Dev server shows dashboard placeholder |
| T-1.2.2 | Composition root and service context skeleton | T-1.2.1 | S | Services injectable in tests |
| T-1.3.1 | `packages/ui`: Tailwind 4, shadcn init (Base style), tokens, light/dark theme | T-1.1.3 | S | Theme toggle works |
| T-1.3.2 | Add shadcn primitives (button, dialog, dropdown-menu, context-menu, resizable, command, tabs, tooltip, sonner, scroll-area, input, alert-dialog); HugeIcons setup; verify HugeIcons license | T-1.3.1 | S | Storybook-free demo route renders all |
| T-1.3.3 | Add MVP Smooth UI components; swap icons; CI check bans `@radix-ui/*` and `lucide-react` | T-1.3.1 | S | Strict typecheck passes |
| T-1.4.1 | Biome config with import restrictions per layer | T-1.1.3 | S | `pnpm biome check .` passes; violating import fails |
| T-1.4.2 | Vitest node + browser mode (Playwright provider) | T-1.1.3 | S | Sample tests run in 3 browsers |
| T-1.4.3 | `e2e` package with Playwright smoke | T-1.2.1 | S | Smoke passes in CI |
| T-1.4.4 | CI workflow (lint → typecheck → test → build → e2e) | T-1.4.1-3 | S | Green on main |
| T-1.4.5 | AGENTS.md: replace planned commands with real ones | T-1.4.4 | S | Commands verified |
| T-1.5.1 | vite-plugin-pwa app shell precache, update toast | T-1.2.1 | S | Offline reload shows shell |
| T-1.5.2 | CSP meta + host header templates (`_headers`) | T-1.2.1 | S | No CSP violations in smoke test |

## Phase 2: Domain, storage, .qrtz

| ID | Task | Depends | Size | Done when |
|---|---|---|---|---|
| T-2.1.1 | `parseProjectPath` + tests (full rule list) | T-1.1.3 | S | All path cases pass |
| T-2.1.2 | Domain types, branded IDs (ULID), `Result`, `QuartzError` | T-1.1.3 | S | Types exported, unit tests |
| T-2.1.3 | File kind inference, engine detection, templates | T-2.1.2 | S | Detection fixtures pass |
| T-2.1.4 | Change-set model + inverse-op computation (pure) | T-2.1.2 | M | Apply/inverse roundtrip tests |
| T-2.2.1 | Dexie schema v1, verify compound unique index | T-2.1.2 | S | Browser test |
| T-2.2.2 | ProjectRepository | T-2.2.1 | M | CRUD + duplicate + delete atomicity tests |
| T-2.2.3 | FileRepository incl. `applyBatch`, `snapshot`, revisions | T-2.2.1 | M | Atomicity + conflict tests |
| T-2.2.4 | Quota/persistence helpers + `QuotaExceededError` mapping | T-2.2.1 | S | Tests with stubs |
| T-2.3.1 | Manifest zod schema + JSON Schema output | T-2.1.2 | S | Schema tests, unknown fields preserved |
| T-2.3.2 | `.qrtz` writer (deterministic) | T-2.3.1 | M | Byte-identical double export |
| T-2.3.3 | Reader with streaming limits + validation pipeline | T-2.3.1, T-2.1.1 | M | Malicious corpus rejected with codes |
| T-2.3.4 | Generic ZIP, folder and single-file import | T-2.3.3, T-2.1.3 | S | Overleaf/GitHub ZIP fixtures import |
| T-2.3.5 | Source ZIP and PDF export | T-2.3.2 | S | Tests |
| T-2.4.1 | ProjectService + FileService | T-2.2.2-3 | M | Service tests with real IndexedDB |
| T-2.5.1 | Dashboard UI: list, create from template, rename, duplicate, delete | T-2.4.1, T-1.3.2 | M | e2e create/delete |
| T-2.5.2 | Import (drop zone, errors list) and export UI | T-2.3.4, T-2.5.1 | S | e2e roundtrip |
| T-2.5.3 | Storage notice, meter, persistence request | T-2.2.4 | S | UI test |

## Phase 3: Workspace, editor, preview

| ID | Task | Depends | Size | Done when |
|---|---|---|---|---|
| T-3.1.1 | Workspace layout: resizable/collapsible panels, persisted sizes | T-2.5.1 | S | Reload keeps layout |
| T-3.1.2 | Header with save/compile status placeholders | T-3.1.1 | S | |
| T-3.2.1 | Explorer tree, context menu, CRUD via FileService | T-3.1.1 | M | Component + e2e tests |
| T-3.2.2 | Drag-and-drop move and OS file upload | T-3.2.1 | S | Tests |
| T-3.3.1 | `packages/editor` base setup; LaTeX language (stex) + completion source API | T-1.1.3 | M | Editor renders, highlighting test |
| T-3.3.2 | Typst StreamLanguage tokenizer | T-3.3.1 | M | Tokenizer unit tests |
| T-3.3.3 | Tabs, per-file EditorState cache, autosave with flush triggers | T-3.3.1, T-2.4.1 | M | e2e: type, reload, content restored |
| T-3.3.4 | Search/replace, go to line, keyboard map | T-3.3.1 | S | |
| T-3.4.1 | Command registry + palette + shortcut binding | T-3.1.1 | S | Palette lists commands, shortcuts trigger |
| T-3.5.1 | PDF.js preview: viewer, toolbar, search, zoom, download, keep scroll on swap | T-3.1.1 | M | Fixture PDF integration test |
| T-3.6.1 | Web Locks single-editor tab + BroadcastChannel takeover | T-2.4.1 | S | Two-tab e2e |

## Phase 4a: Compiler core + Typst

| ID | Task | Depends | Size | Done when |
|---|---|---|---|---|
| T-4.1.1 | Contracts (compiler-contracts.md) | T-2.1.2 | S | Types + docs |
| T-4.1.2 | EngineHost (Comlink, restart, terminate, timeout) | T-4.1.1 | M | Worker integration tests with a fake engine |
| T-4.1.3 | CompileQueue (coalesce, stale discard) | T-4.1.1 | S | Unit tests |
| T-4.1.4 | CompileService + status store + snapshot builder | T-4.1.2-3, T-2.2.3 | M | Tests |
| T-4.2.1 | Typst adapter + worker, local fonts | T-4.1.2, Spike 2 | M | Hello PDF in 3 browsers |
| T-4.2.2 | Typst diagnostics mapping | T-4.2.1 | S | Fixture tests |
| T-4.2.3 | Typst packages (optional network, cached) | T-4.2.1 | S | Online then offline test |
| T-4.3.1 | Editor lint integration + problems panel + log panel | T-4.1.4, T-3.3.1 | S | Click diagnostic → jumps to line |
| T-4.3.2 | Auto compile (debounce), last good PDF, stale badge | T-4.1.4, T-3.5.1 | S | e2e failure keeps PDF |
| T-4.3.3 | Runtime caching of engine assets + offline readiness panel | T-1.5.1 | S | Offline compile e2e |

## Phase 4b: LaTeX

| ID | Task | Depends | Size | Done when |
|---|---|---|---|---|
| T-4.4.1 | Static mirror build/publish script for chosen engine, hashes manifest | Spike 1, OQ-2 | M | Mirror deploys to static host |
| T-4.4.2 | LaTeX adapter + worker wrapper | T-4.1.2, T-4.4.1 | M | Article PDF in 3 browsers |
| T-4.4.3 | Multi-pass runner + BibTeX; detect `biblatex` needing Biber and explain `backend=bibtex` | T-4.4.2 | M | Bibliography fixtures |
| T-4.4.4 | Log parser + golden tests | T-4.4.2 | M | ≥ 90 % attribution on fixture set |
| T-4.4.5 | Cancellation via termination, Module reuse | T-4.4.2 | S | Cancel test < 1.5 s restart |
| T-4.4.6 | Missing package diagnostics + "upload .sty" guidance | T-4.4.4 | S | |
| T-4.4.7 | THIRD_PARTY_NOTICES generation + source offer page for GPL engine assets | T-4.4.1 | S | Notices in build output |
| T-4.4.8 | LaTeX corpus nightly job | T-4.4.3 | S | Report generated |

## Phase 5: Agent bridge

| ID | Task | Depends | Size | Done when |
|---|---|---|---|---|
| T-5.1.1 | QuartzOperations port + implementation over services | T-2.4.1, T-4.1.4 | S | |
| T-5.1.2 | ToolRuntime: validation, policy, limits, rate limit, activity events | T-5.1.1 | M | Unit tests |
| T-5.1.3 | Read tools (get_project, list_files, read_files, search_files, get_pdf_info) | T-5.1.2 | S | Schema tests |
| T-5.1.4 | Outline/bibliography indexers (MVP subset) + tools | T-5.1.2 | M | Fixture tests |
| T-5.1.5 | ChangeSetService: stage, apply, reject, conflict, undo, retention | T-2.1.4, T-2.2.3 | M | Tests |
| T-5.1.6 | Write/destructive tools + get_change_set | T-5.1.5 | S | Tests |
| T-5.1.7 | Compile tools | T-5.1.2, T-4.1.4 | S | Tests |
| T-5.1.8 | set_agent_status | T-5.1.2 | S | |
| T-5.2.1 | WebMCP adapter: detection, register/abort, OT token injection, lock-aware | T-5.1.3 | S | Polyfill tests in 3 browsers |
| T-5.3.1 | Activity panel (ai-conversation, ai-tool-call, ai-loader, agent-avatar, ai-task-list) | T-5.1.2, T-1.3.3 | M | Component tests with real events |
| T-5.3.2 | Review queue (ai-approval, ai-diff) + full merge view + inline decorations | T-5.1.5, T-3.3.3 | M | e2e approve/reject/undo |
| T-5.3.3 | Connection card + "Connect your agent" guide | T-5.2.1 | S | Docs reviewed against Spike 5 |
| T-5.4.1 | e2e agent flow (polyfill) + optional native Chromium job | T-5.3.2 | S | Green |
