# Spike 2: Typst in WebAssembly

Task IDs: T-0.2.x.

## Objective

Confirm the minimal typst.ts package set and API to compile multi-file Typst projects to PDF inside a Quartz-owned worker with local fonts, structured diagnostics and acceptable memory.

## Hypothesis

`@myriaddreamin/typst.ts` (compiler API) + `@myriaddreamin/typst-ts-web-compiler` (WASM), without the renderer, compile to PDF in a module worker with fonts served from the Quartz origin, with incremental recompiles < 500 ms for a 10-page document.

## Research findings (2026-11-26)

- **[FACT]** typst.ts is Apache-2.0. Latest stable v0.7.0 (Typst 0.14.2); pre-release v0.8.0-rc4 bumps Typst to 0.15.1 and adds a "unified compiler interface", PDF standards support and `evict_cache` for the web compiler. https://github.com/Myriad-Dreamin/typst.ts/releases
- **[FACT]** Packages: `@myriaddreamin/typst.ts` (core wrapper, `$typst` snippet and `createTypstCompiler`), `@myriaddreamin/typst-ts-web-compiler` (compiler WASM), `@myriaddreamin/typst-ts-renderer` (renderer WASM, needed for SVG/canvas rendering), framework bindings (`typst.react`, etc.). https://github.com/Myriad-Dreamin/typst.ts
- **[FACT]** Low-level API: `createTypstCompiler()`, `cc.init({ getModule: () => wasmUrl })`, `addSource(path, text)`, `mapShadow(path, bytes)`, `unmapShadow(path)`, `resetShadow()`, `compile({ mainFilePath, ... })`. https://myriad-dreamin.github.io/typst.ts/cookery/guide/compiler/bindings.html
- **[FINDING]** The documented default compile `format` is `vector`; PDF output for the web compiler is shown through `$typst.pdf(...)` in the snippet API; exact low-level PDF call and return shape not documented. Diagnostics format not documented. Worker usage not documented. Font APIs (`loadFonts`, `preloadFontAssets`, `disableDefaultFontAssets`, `set_fonts`, on-demand fonts) exist by name.
- **[FINDING]** By default the browser bundle fetches font assets from the network (GitHub/CDN). Quartz must disable default font assets and load fonts from its own origin.
- **[FINDING]** `@preview` package fetching APIs exist by name (`withPackageRegistry`, `fetchPackageRegistry`); offline package behavior is not documented.
- **[FINDING]** Alternative `typst-wasm` (posted 2026-07-17 on the Typst forum, with a Vite plugin and `@typst-wasm/fonts`): API `addFonts`, `addSource`, `compile({ main, format })`. License and Typst version not confirmed. Keep as fallback. https://forum.typst.app/t/typst-wasm-compile-typst-in-browsers-node-and-serverless-runtimes/9399
- **[FACT]** Upstream Typst 0.15.0 (2026-06-15) and 0.15.1 (2026-07-17). https://typst.app/docs/changelog/0.15.1/

## Technical risks

| Risk | Mitigation |
|---|---|
| Undocumented PDF/diagnostics APIs change between rc releases | Read `packages/typst.ts/src` (snippet and compiler sources) during the spike; wrap in adapter; pin exact versions |
| Font fetching to third-party hosts | `disableDefaultFontAssets` + local font list; CSP blocks other origins, which proves it |
| Typst version drift (0.14 vs 0.15 syntax) | Store `typstVersion` used by project in settings; show it in UI |
| WASM size impact on first Typst use | Lazy load; precache optional |
| Memory growth across many recompiles | Measure 200 recompiles; use `evict_cache` (0.8) or periodic worker recycle |

## Validation steps

1. T-0.2.1 Read source of the compiler entry to confirm PDF output API, diagnostics shape, font and package hooks; write findings.
2. T-0.2.2 Worker harness: module worker importing `@myriaddreamin/typst.ts/compiler`, WASM URL via Vite `?url`, Comlink API matching `EngineWorkerApi`.
3. T-0.2.3 Fonts: bundle Libertinus Serif, New Computer Modern, DejaVu Sans Mono (license files included); confirm zero non-origin requests.
4. T-0.2.4 Multi-file: `main.typ` with `#include "chapters/a.typ"`, `#image("figures/x.png")`, `#bibliography("refs.bib")`, nested folders, relative paths from included files.
5. T-0.2.5 Monorepo check: worker inside a source-consumed workspace package builds and runs in Vite dev and production.
6. T-0.2.6 Diagnostics: 10 broken documents → map spans to file/line/column.
7. T-0.2.7 Performance: cold init, first compile, incremental edit compile (10-page and 100-page docs); memory after 200 recompiles.
8. T-0.2.8 Packages: `#import "@preview/<pkg>"` with network allowed, then offline from cache.
9. T-0.2.9 Compare v0.7.0 vs v0.8.0-rc4 and, if time allows, `typst-wasm`.
10. T-0.2.10 Browsers: Chromium, Firefox, Safari.

## Expected results

Exact package list and versions, adapter sketch, measured numbers in `results/typst-wasm-results.md`.

## Go / no-go

- **Go** if: PDF produced in a worker in all three browsers; fonts fully local; diagnostics include file and line; incremental compile < 500 ms (10 pages); no memory growth > 2x after 200 recompiles (or recycle strategy works).
- **No-go** → evaluate `typst-wasm`; if also failing, consider building a minimal Quartz WASM wrapper over the `typst` crate (larger effort, re-plan Phase 4).
