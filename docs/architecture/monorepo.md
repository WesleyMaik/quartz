# Monorepo Architecture

## 1. Final structure

```
quartz/
├── apps/
│   └── web/                     # Vite + React SPA, composition root, services, features
│       ├── public/              # static assets incl. fonts, OT meta handled in index.html
│       └── src/
│           ├── app/             # router, providers, layout shell
│           ├── services/        # ProjectService, FileService, CompileService, ChangeSetService
│           ├── features/
│           │   ├── dashboard/
│           │   ├── explorer/
│           │   ├── editor/      # React wrapper around @qrtz/editor
│           │   ├── preview/     # PDF.js viewer (extract to a package only if reused)
│           │   ├── agent/       # activity timeline, review queue
│           │   └── settings/
│           └── stores/          # small Zustand stores for UI-only state
├── packages/
│   ├── ui/                      # shadcn (Base UI) + Smooth UI components, tokens, theme
│   ├── document-core/           # pure domain: models, paths, engine detection, zod schemas
│   ├── messages/                # interface translations: locales and ICU catalogs
│   ├── project-format/          # standard ZIP export and import
│   ├── storage/                 # Dexie database, repositories, quota helpers
│   ├── editor/                  # CodeMirror 6 setup, language extensions (latex/, typst/)
│   ├── compiler-core/           # contracts, worker host, queue, diagnostics normalization
│   ├── compiler-latex/          # LaTeX engine adapter + worker entry (license boundary)
│   ├── compiler-typst/          # Typst engine adapter + worker entry
│   └── agent-bridge/            # tool catalog, policies, WebMCP adapter
├── e2e/                         # Playwright tests (a workspace package, not under apps/)
├── docs/
├── AGENTS.md
├── biome.json
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── turbo.json
└── tsconfig.base.json
```

## 2. Changes from the initial proposal and why

| Change | Reason |
|---|---|
| `pdf-viewer` package folded into `apps/web/src/features/preview` | **[REC]** It has one consumer, and most of its code is React glue around `pdfjs-dist`'s own viewer layer. A package would add build and API surface with no second consumer (YAGNI). Extract when a second consumer appears. |
| Application services live in `apps/web/src/services`, not in a package | **[REC]** They are the composition of storage + compilers + change sets. Agent bridge and UI both depend on them through a port (`QuartzOperations`) defined in `agent-bridge`, so a package is not needed for decoupling. |
| `compiler-latex` stays a separate package | **[REC]** It is the license boundary (GPL engine binaries, possibly third-party wrappers) and carries heavy assets; isolating it makes license notices, lazy loading and replacement of the engine contained. |
| `compiler-core` kept separate from `document-core` | Worker host, queue and Comlink are infrastructure, not domain. |
| `e2e/` workspace added | Playwright needs its own dependencies and config, independent of the app. |
| No `config`/`tsconfig` packages | Root `tsconfig.base.json` and root `biome.json` are enough; a config package is justified only when publishing packages. |
| Package scope `@qrtz/*` | Avoids collision with existing "Quartz" packages on npm (see OQ-7). Packages are private, so the scope is internal anyway. |
| vinext rejected | See [ADR-001](../decisions/ADR-001-frontend-stack.md). |

Package count: 9 packages + 1 app + e2e. **[REC]** If this still feels heavy during Phase 1, merge `compiler-core` into `document-core`'s sibling only after the first adapter exists; do not merge `compiler-latex`.

## 3. Package rules

- Internal packages are **source-consumed** ("just-in-time" packages): `package.json` `exports` point to `./src/*.ts`, there is no build step per package, Vite compiles them for the app and Vitest runs them directly. Each package has `typecheck` (`tsc --noEmit`) and `test` scripts. Reason: no build orchestration overhead, instant HMR across packages. Constraint: workers inside packages use `new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })`, which Vite resolves for workspace source. **[ASSUMPTION]** validated in Spike 2 (T-0.2.5).
- Dependencies between packages use `"@qrtz/document-core": "workspace:*"`.
- Every package declares all imports as dependencies; pnpm's strict `node_modules` layout makes undeclared imports fail.
- No circular dependencies. Allowed graph:

```
document-core  ◄── project-format, storage, compiler-core, agent-bridge, editor
compiler-core  ◄── compiler-latex, compiler-typst
ui             (no internal deps)
messages       (no internal deps)
apps/web       ──► everything
```

## 4. pnpm

- Root `package.json`: `"packageManager": "pnpm@<exact 10.x or newer>"` pinned at T-1.1.1; `"engines": { "node": ">=22" }` (Node is only a dev tool).
- `pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
  - e2e
catalog:            # single source for shared versions
  react: ^19.2.0
  react-dom: ^19.2.0
  typescript: <pinned at T-1.1.1>
  vitest: <pinned>
  zod: ^4.0.0
onlyBuiltDependencies: []   # explicit allow-list for postinstall scripts
```

- Use `catalog:` protocol for shared versions so all packages stay aligned.
- Commands: `pnpm install`, `pnpm add <dep> --filter @qrtz/<pkg>`, `pnpm add -D`, `pnpm exec`, `pnpm dlx`. Never npm, npx, yarn or bun. Do not use the common `"preinstall": "npx only-allow pnpm"` guard (it relies on npx); enforce pnpm through the `packageManager` field (Corepack), `engine-strict=true` in `.npmrc`, and a CI check that fails if `package-lock.json`, `yarn.lock` or `bun.lock*` exist.

## 5. Turborepo

`turbo.json` tasks:

| Task | dependsOn | outputs | cache |
|---|---|---|---|
| `typecheck` | `^typecheck` | none | yes |
| `lint` | none (Biome runs at root once, see below) | none | yes |
| `test` | none | `coverage/**` | yes |
| `build` | `^build` | `dist/**` (app only) | yes |
| `dev` | none | | no, persistent |
| `e2e` | `@qrtz/web#build` | `playwright-report/**` | no |

Biome is fast enough to run once at the root (`pnpm biome check .`); a per-package Turbo lint task adds no value.

## 6. Versions

**[REC]** Pin exact versions in T-1.1.1 with `pnpm view <pkg> version` on the day of scaffolding. Targets known at planning time:

| Dependency | Target | License | Note |
|---|---|---|---|
| react, react-dom | 19.2.x | MIT | |
| typescript | latest stable (6.x if released and supported by tooling, else 5.9) | Apache-2.0 | strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| vite | latest stable major (8.x if stable) | MIT | `@vitejs/plugin-react` |
| tailwindcss + @tailwindcss/vite | 4.x | MIT | |
| turbo | 2.x | MIT | |
| @biomejs/biome | 2.x | MIT/Apache-2.0 | |
| vitest + @vitest/browser | latest | MIT | browser mode with Playwright provider |
| @playwright/test | latest | Apache-2.0 | |
| dexie (+ dexie-react-hooks) | 4.x | Apache-2.0 | |
| fflate | 0.8.x | MIT | |
| zod | 4.x | MIT | `z.toJSONSchema()` for WebMCP schemas |
| comlink | 4.x | Apache-2.0 | |
| codemirror 6 packages | latest | MIT | |
| pdfjs-dist | latest stable major (5.x/6.x) | Apache-2.0 | **[FINDING]** 6.2.x seen on unpkg |
| @myriaddreamin/typst.ts + typst-ts-web-compiler | 0.7.0 stable or 0.8.0 once final | Apache-2.0 | see Spike 2 |
| motion | 12.x | MIT | Smooth UI requirement |
| @hugeicons/react + @hugeicons/core-free-icons | latest | verify license in T-1.3.2 | |
| zustand | 5.x | MIT | UI state only |
| react-router | 7.x (library/SPA mode) | MIT | two routes; no framework mode |
| vite-plugin-pwa | latest | MIT | Workbox precache + runtime cache |
