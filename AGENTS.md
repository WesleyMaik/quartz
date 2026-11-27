# AGENTS.md

Repository instructions for humans and AI coding agents working on Quartz. Read this file completely before changing code. Planning documents live in [docs/](docs/README.md).

## Project purpose

Quartz is a browser-only, local-first scientific writing workspace for LaTeX and Typst. It edits, stores, compiles and previews documents entirely on the user's device and exposes project operations to the user's own AI agent through WebMCP. Status: planning complete, implementation starts at Phase 0/1 of [docs/roadmap/implementation-plan.md](docs/roadmap/implementation-plan.md).

## Non-negotiable constraints

1. **No backend.** Never add servers, API routes, serverless functions, SSR, remote storage, auth services, telemetry, or a local companion/MCP server. The build output is static files.
2. **No AI runtime.** Never add model SDKs, model gateways, API-key handling or simulated AI responses. Agent UI shows only data Quartz actually observes.
3. **Main thread stays free.** Compilation, archive processing of large files and heavy indexing run in workers.
4. **Original files are sacred.** Never rewrite, reformat or normalize user source files except through an explicit user or approved agent operation.
5. **pnpm only.** Never use npm, npx, yarn or bun. Use `pnpm install`, `pnpm add <dep> --filter <pkg>`, `pnpm add -D`, `pnpm exec`, `pnpm dlx`.
6. **Untrusted input.** Imported archives, project files, compiler output and agent tool arguments are untrusted. Validate at the boundary.
7. **License: `MIT OR Apache-2.0`.** Bundled dependencies must be permissive (MIT, BSD, ISC, Apache-2.0, 0BSD, Zlib). Never import GPL/LGPL/AGPL code into the app or worker bundles; GPL/AGPL engines (TeX, Biber) are loaded only as separate assets in their own workers, with source published. See [ADR-004](docs/decisions/ADR-004-compiler-architecture.md#license-decision).

## Architecture boundaries

```
apps/web               composition root, React features, application services
packages/ui            shadcn/ui (Base UI) + Smooth UI components, theme; React only, no domain imports
packages/document-core pure domain: models, paths, detection, templates; depends only on zod
packages/messages      interface translations (ICU JSON catalogs); no dependencies, no React
packages/project-format standard ZIP import/export; depends on document-core, fflate
packages/storage       Dexie database and repositories; depends on document-core
packages/editor        CodeMirror 6 setup and language extensions; no React
packages/compiler-core compiler contracts, EngineHost, queue; no React
packages/compiler-latex LaTeX adapter + worker; license boundary for TeX assets
packages/compiler-typst Typst adapter + worker
packages/agent-bridge  tool catalog, ToolRuntime, policies, WebMCP adapter; depends on document-core and its own ports
e2e                    Playwright tests
```

Rules:

- Only `apps/web` and `packages/ui` may import React.
- `agent-bridge` never imports `storage` or compilers; it uses the `QuartzOperations` port.
- Engine packages are loaded only via dynamic `import()` from the compile service.
- No circular dependencies. Allowed edges are listed in [docs/architecture/monorepo.md](docs/architecture/monorepo.md).
- Business logic lives in services and packages, never in React components.
- Only `apps/web` imports `@qrtz/messages`. Domain packages report errors as `QuartzError` keys and values, never as translated text.
- One owner per state: Dexie for domain data, Zustand only for UI state.

## Naming conventions

| Item                   | Convention                                                            | Example                 |
| ---------------------- | --------------------------------------------------------------------- | ----------------------- |
| Directories and files  | kebab-case                                                            | `compile-queue.ts`      |
| React components       | PascalCase                                                            | `FileExplorer`          |
| Types, interfaces      | PascalCase, no `I` prefix                                             | `CompilationResult`     |
| Variables, functions   | camelCase                                                             | `parseProjectPath`      |
| Module-level constants | SCREAMING_SNAKE_CASE for true constants, camelCase for config objects | `MAX_ARCHIVE_ENTRIES`   |
| Error codes            | dotted lowercase                                                      | `archive.export_failed` |
| WebMCP tool names      | snake_case                                                            | `read_files`            |
| Packages               | `@qrtz/<name>`                                                        | `@qrtz/document-core`   |

## Code quality rules

- TypeScript strict with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`.
- Never use `any`. Use `unknown` plus zod validation for dynamic data, generics and discriminated unions for variants.
- Expected failures return `Result<T, QuartzError>`; throw only for programmer errors.
- Paths are created only through `parseProjectPath` (branded `ProjectPath`).
- Prefer composition and small functions; no inheritance hierarchies for adapters.
- TSDoc on public package exports and on non-obvious decisions. No comments restating code.
- No new dependency without checking it is not already covered by an existing one; record the reason in the PR. Licenses must be compatible with the project license (see [ADR-004](docs/decisions/ADR-004-compiler-architecture.md)).
- Formatting and lint: Biome. Do not add ESLint or Prettier.

## UI rules

- Interface text goes through react-intl with an id in every catalog of `packages/messages`; never hard-code user-facing strings. See [ADR-007](docs/decisions/ADR-007-internationalization.md).
- Primitives come from `packages/ui` (shadcn on Base UI). Do not add Radix packages or another primitive library.
- Smooth UI components are installed with `pnpm dlx shadcn@latest add @smoothui/<name> -c packages/ui` and then adapted (HugeIcons instead of lucide).
- Icons: HugeIcons only.
- Never feed Smooth UI agent components with simulated data in production code.
- Accessibility: keyboard operable, visible focus, labels on icon buttons, respect `prefers-reduced-motion`.

## Testing requirements

- Unit tests (Vitest) for every pure function with branching logic, every schema and every limit (at, below and above the boundary).
- Browser-mode tests for anything touching IndexedDB, workers, Comlink or engines. Do not claim persistence works based on `fake-indexeddb` alone.
- Regression test for every fixed bug where practical.
- E2E (Playwright) for user workflows listed in [docs/architecture/testing-strategy.md](docs/architecture/testing-strategy.md).
- A change is done when lint, typecheck and relevant tests pass. Report which checks ran.

## Security requirements

- Follow the checklist in [docs/architecture/security.md](docs/architecture/security.md#4-security-checklist-for-prs).
- No `eval`, `new Function`, or `innerHTML`/`dangerouslySetInnerHTML` with non-constant content.
- New network destinations require updating the CSP and the security document.
- Agent write tools must stage change sets; delete always requires explicit user approval.
- PDF.js: `isEvalSupported: false`, scripting disabled.

## Commit rules

- Commit after every successful implementation step (lint, typecheck and relevant tests passing).
- Use Conventional Commits with a scope: `<type>(<scope>): <subject>`, for example `feat(storage): add dexie repositories`.
- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `build`, `chore`, `ci`, `perf`, `style`.
- Scope is the package or area: `document-core`, `messages`, `storage`, `editor`, `ui`, `web`, `project-format`, `compiler-core`, `compiler-typst`, `compiler-latex`, `agent-bridge`, `repo`, `docs`.
- Subject: short, clear, imperative, lowercase, English, no trailing period. No body.
- Group files of the same scope into the same commit; keep each commit cohesive and split by scope.
- Never commit secrets, build output or downloaded engine assets.

## Commands (verified)

```
pnpm install
pnpm --filter @qrtz/web fetch:assets   # one-time: Typst fonts + Siglum TeX Live runtime + extra LaTeX packages (~218 MB download, checksum-verified)
pnpm dev                               # http://localhost:5173
pnpm lint                              # biome check .
pnpm format                            # biome check --write .
pnpm typecheck
pnpm test
pnpm build
```

Runtime assets live in `apps/web/public/engines/` (gitignored). Playwright E2E is planned and not set up yet.

## Important technical decisions

| Topic         | Decision                                                                          | Record                                                     |
| ------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Stack         | React 19 + Vite SPA, Turborepo, pnpm, Tailwind 4; no Next.js/vinext               | [ADR-001](docs/decisions/ADR-001-frontend-stack.md)        |
| Storage       | IndexedDB via Dexie is the only source of truth; no OPFS in MVP                   | [ADR-002](docs/decisions/ADR-002-browser-storage.md)       |
| Format        | Standard `.zip` of the source tree, no app-specific entries                       | [ADR-003](docs/decisions/ADR-003-project-format.md)        |
| Compilers     | Adapters in dedicated workers; typst.ts for Typst; LaTeX engine chosen in Spike 1 | [ADR-004](docs/decisions/ADR-004-compiler-architecture.md) |
| Agents        | WebMCP via `document.modelContext`; staged change sets; activity panel, not chat  | [ADR-005](docs/decisions/ADR-005-agent-integration.md)     |
| UI primitives | shadcn/ui on Base UI + Smooth UI                                                  | [ADR-006](docs/decisions/ADR-006-ui-primitives.md)         |
| Languages     | react-intl with catalogs in `@qrtz/messages`; UI text is localized, English first | [ADR-007](docs/decisions/ADR-007-internationalization.md)  |

When an implementation choice conflicts with these documents, stop and update the relevant ADR first, explaining why.
