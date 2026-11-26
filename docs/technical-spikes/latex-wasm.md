# Spike 1: LaTeX in WebAssembly

Task IDs: T-0.1.x. Highest-risk spike; it can change the MVP scope.

## Objective

Select a browser-only LaTeX engine that compiles realistic multi-file scientific projects from a fully static host, inside a worker, with acceptable speed and a license compatible with Quartz's `MIT OR Apache-2.0` policy (permissive wrapper; GPL/AGPL engines only as separate worker programs; see [ADR-004](../decisions/ADR-004-compiler-architecture.md#license-decision)).

## Hypothesis

**Siglum**, self-hosted without its CTAN proxy (only its pre-bundled package set, served as static files), can compile ≥ 85 % of the corpus (see [testing-strategy.md §6](../architecture/testing-strategy.md#6-compatibility-corpus)) with pdfLaTeX/XeLaTeX + BibTeX, warm compile < 6 s for a 10-page article, first-use download < 60 MB, and a total hosted footprint < 500 MB. The challenger is a **Tectonic WASM build** (`glyphtex-engine`) with a curated Tectonic bundle.

## Engine selection (2026-11-26, revised)

Candidates requested for comparison: Tectonic, Siglum, texlyre-busytex. Full-TeX-Live mirrors (multi-GB) are rejected as the default hosting model.

**Correction to the earlier plan:** the 3.5 GB figure was LibrePaper's *full* TeX Live mirror stored on the host; users would download only the packages their document uses (core bundle 18.3 MB). The real problem is hosting and maintaining multi-GB assets, so the selection now prefers a **curated package set** of a few hundred MB.

| Criterion | Tectonic (via third-party WASM) | Siglum | texlyre-busytex |
|---|---|---|---|
| License | MIT [FACT]; `glyphtex-engine` crates MIT, the glyphtex app is GPL-3.0 [FINDING] | MIT [FACT] | AGPL-3.0 [FACT], **incompatible with the bundled-code rule** |
| Official browser support | **No**; WASM issue #166 open since 2018; C deps (HarfBuzz, ICU, FreeType, Graphite2) are the blocker [FACT] | Yes, browser-first [FACT] | Yes, browser-first [FACT] |
| Browser build used | `glyphtex-engine` (4 stars, active) or `nl5887/tectonic-wasm` (1 star, 3 commits) [FINDING] | `@siglum/engine` (npm) [FACT] | `texlyre-busytex` (npm) [FACT] |
| Engines | XeTeX only (+ xdvipdfmx); no pdfTeX, no LuaTeX [FACT] | pdfLaTeX, XeLaTeX [FACT] | pdfLaTeX, XeLaTeX, LuaLaTeX [FACT] |
| TeX Live vintage | Bundle spec TL2023; default bundle `tlextras-2022` [FINDING] | TL2026, June 2026 LaTeX format [FACT] | TL2026 [FACT] |
| Package hosting model | One `.ttb` bundle file read with HTTP range requests: **static-friendly**, but the host must support 206 responses and large single files; curated bundles can be built with the repo's bundle tooling [FACT] | Pre-bundled common packages (amsmath, tikz, biblatex, ...) as static files; long tail **only** via a CTAN proxy, which is a server; without the proxy, bundled packages still work [FACT] | Data packages of 90-400 MB + ~32 MB WASM; on-demand needs a TeX Live server [FACT] |
| Hosted footprint | 2.6 GB for the old full bundle [FINDING]; curated bundle size depends on our selection | ~195 MB bundles in v0.1 (TL2025); TL2026 size not published, to measure [FINDING] | 90-400 MB data + 32 MB WASM [FACT] |
| First-use download | ~12 MB engine (glyphtex) + files read on demand [FINDING] | ~16 MB initial in v0.1 [FINDING] | ≥ 32 MB WASM + at least one data package [FACT] |
| BibTeX / Biber | BibTeX built in, automatic reruns; Biber external CLI only, not in browser builds [FACT] | BibTeX automatic; no Biber [FACT] | BibTeX8 + Biber WASM [FACT] |
| SyncTeX | Not documented [FINDING] | Not documented [FINDING] | Yes [FACT] |
| Offline after first use | Yes (glyphtex claims cache once, then offline) [FINDING] | Yes, for cached engine + document dependencies [FACT] | Not documented |
| SharedArrayBuffer | Not needed [FINDING] | Optional fast path [FACT] | Not documented |
| Project health | Core Tectonic: 5.3k stars, release 0.17.0 on 2026-07-27, active [FACT]; browser builds: tiny projects | 5 stars, one maintainer, frequent releases (v0.2.2, Nov 2026) [FINDING] | 37 stars, releases through Oct 2026 [FINDING] |

### Verdict

1. **texlyre-busytex: excluded.** It is technically the most complete (LuaLaTeX, Biber, SyncTeX), but its AGPL JavaScript wrapper would be bundled into Quartz, which breaks the `MIT OR Apache-2.0` decision. Its long-tail packages also need a server.
2. **Tectonic: not the primary choice.** The core project is the healthiest of the three and its range-request bundle model fits static hosting very well. But (a) it has no official browser build, so Quartz would depend on a tiny third-party WASM port of a C/C++ codebase; (b) it is XeTeX only, so pdfLaTeX documents (the majority of journal templates and Overleaf/Prism exports) run under a different engine, with known differences (`inputenc`/font encodings, `microtype` features, pdfTeX primitives); (c) its bundles lag TeX Live by 3-4 years. **It stays as the challenger in this spike.** If the glyphtex port proves solid, it is the most static-friendly fallback.
3. **Siglum: recommended primary.** MIT, browser-first with a documented JS API and worker, current TL2026, pdfLaTeX **and** XeLaTeX, automatic BibTeX, offline caching, and a pre-bundled package set that can be self-hosted as static files. Quartz runs it **without** `ctanProxyUrl`, so there is no server; packages outside the bundled set produce a "missing package" diagnostic and the user can upload the `.sty`/`.cls` into the project. Main risks: bus factor of one maintainer, TL2026 bundle size not yet published, Safari support not documented, no Biber, no SyncTeX.

Mitigation for Siglum's bus factor: it is MIT and built on BusyTeX, so Quartz can fork it and rebuild bundles if the project stops; pin a release ID and vendor its runtime archive.

Consequences for the MVP: **no Biber** with either Siglum or Tectonic. `biblatex` documents must use `backend=bibtex`; Quartz detects `biblatex` without that option and explains the limitation. Biber as a separate worker program is a Phase 6 item.

## Research findings (2026-11-26)

| Candidate | License | Engines | TeX Live | Packages | Bib | SyncTeX | Activity | Source |
|---|---|---|---|---|---|---|---|---|
| SwiftLaTeX | AGPL-3.0 [FACT] | pdfTeX, XeTeX | ~2020 [FINDING] | CTAN on demand or texlive.swiftlatex.com mirror; self-hostable Texlive-Ondemand server (a dynamic service) | not documented | not documented | Last release 2022-02-20 [FACT] | https://github.com/SwiftLaTeX/SwiftLaTeX |
| texlyre-busytex | AGPL-3.0 [FACT] | pdfTeX, XeTeX, LuaHBTeX | 2026 [FACT] | Preloaded data packages (90-400 MB) + optional remote TeX Live endpoint; assets self-hostable | BibTeX8, Biber (WASM), makeindex | Yes [FACT] | Releases through Oct 2026 [FINDING] | https://github.com/TeXlyre/texlyre-busytex |
| Siglum | MIT [FACT] | pdfLaTeX, XeLaTeX | 2026 [FACT] | Common packages pre-bundled, long tail fetched via CTAN proxy (needs a server; omit `ctanProxyUrl` to disable) | BibTeX auto; no Biber [FACT] | Not found | v0.2.2 Nov 2026 [FINDING] | https://github.com/SiglumProject/siglum |
| LibrePaper wasm-latex | MIT code; GPL engines; AGPL Biber [FACT] | pdfTeX, XeTeX, dvipdfm; no LuaTeX | 2026 (texlive-20260301) [FACT] | Content-addressed per-package tar bundles, static mirror with CORS; core bundle 18.3 MB; full 3.49 GB / 5,479 bundles [FACT] | BibTeX, BibTeX8, Biber 2.22 [FACT] | XeTeX yes [FACT] | Releases Sep-Nov 2026; single maintainer, low adoption [FINDING] | https://github.com/LibrePaper/wasm-latex |
| BusyTeX (upstream) | MIT for scripts; binaries other [FINDING] | xetex, pdftex, luahbtex | ISO 2026 referenced | Bundled Emscripten data packages | bibtex8 | not found | Build tags through 2025-2026 | https://github.com/busytex/busytex |
| Tectonic (native) + `glyphtex-engine` (WASM port) | MIT [FACT]; port crates MIT [FINDING] | XeTeX only [FACT] | TL2022/2023 bundles [FINDING] | `.ttb` bundle via HTTP range requests, self-hostable [FACT] | BibTeX built in; Biber external CLI only [FACT] | not found | Tectonic 0.17.0, 2026-07-27 [FACT]; port small but active [FINDING] | https://github.com/tectonic-typesetting/tectonic, https://github.com/kanakkholwal/glyphtex |

Other notes:
- **[FINDING]** LibrePaper's worker fetches bundles with synchronous XHR (allowed in workers), so the engine blocks its worker while downloading; acceptable because the worker is dedicated.
- **[FINDING]** Siglum documents ~512 MB RAM and an optional `SharedArrayBuffer` fast path needing COOP/COEP.
- **[FINDING]** texlyre-busytex states XeTeX/LuaTeX fonts are limited to those in `texlive-full` and only when its TeX Live server is used.
- **[FACT]** No candidate supports shell escape running native programs.
- Alternative explicitly not pursued: LaTeX-to-Typst conversion (for example "Scissor LaTeX") produces approximate output and is not LaTeX compilation.

## Integration results (2026-11-26, Chromium only)

Siglum `@siglum/engine` 0.2.2 is integrated in `packages/compiler-latex` and verified in the app (Chromium, Windows). Safari is **pending** (no macOS available); Firefox not yet tested.

- **[FACT]** Runtime release `tl2026-0cc2592f50103429`: 216.6 MB compressed archive, **302.5 MB** extracted on the host, 125 files. Checksum verified against the release `SHA256SUMS` by `pnpm --filter @qrtz/web fetch:assets`.
- **[FACT]** The LaTeX article template (pdfLaTeX, `amsmath`, `graphicx`, `\input`, `\eqref`) compiles in about 1.2 to 1.6 s warm; the first build downloads 13 bundles (about 31 MB decompressed).
- **[FACT]** Errors are attributed to the right file and line (`sections/introduction.tex:2` for an undefined macro) by the Quartz log parser; a failed build keeps the last PDF.
- **[FACT]** All npm dependencies of the wrapper are MIT (`@siglum/engine`, `@siglum/filesystem`, `xzwasm`, `blake3-wasm`, `fflate`).

Integration quirks that any host must respect:

1. `*.data.gz` bundles must be served **without** `Content-Encoding: gzip`. Otherwise the browser decompresses them and Siglum decompresses again, corrupting the TeX format (`Could not undump ... pdflatex.fmt`). The Vite dev/preview server strips the header in `apps/web/vite.config.ts`; production hosts need the same rule.
2. Siglum maps missing files to bundles (for example `epstopdf-base.sty`, loaded indirectly by `graphicx`) only in its CTAN retry loop. `OfflineSiglumCompiler` enables that loop and answers every proxy request locally as unavailable, so no request leaves the Quartz origin. This couples Quartz to 0.2.2 internals; re-check on upgrade.
3. `blake3-wasm`'s browser build is broken for bundlers; it is aliased to a stub and Siglum falls back to DJB2 hashing (change detection only).
4. Siglum caches bundles in OPFS and Cache Storage (`siglum-files`, `bundle-cache`, `siglum-wasm-*`). These are re-downloadable caches, not project data, consistent with ADR-002.
5. Siglum exposes `syncTexData` in compile results, which makes Phase 6 source/PDF navigation feasible.

## Technical risks

| Risk | Impact | Mitigation |
|---|---|---|
| AGPL/GPL code leaking into the permissive bundle (wrapper glue importing engine JS, AGPL Biber) | Would force Quartz under copyleft | Wrapper must be MIT; Biber and engines only in their own workers as separate assets; CI license check; source-offer page |
| Package coverage gaps in the curated (pre-bundled) set | Documents fail with "File x.sty not found" | Measure gaps on the corpus; extend the curated set by rebuilding bundles (Siglum is MIT, built on BusyTeX); clear `missing` diagnostics; allow project-local `.sty`/`.cls` |
| Hosted footprint and per-file host limits | Deployment friction | Target < 500 MB; check host per-file limits (some static hosts cap files at 25 MB; Tectonic's single `.ttb` needs range-request support and large-file hosting such as R2/S3) |
| Single-maintainer dependency (Siglum, glyphtex port) | Abandonment | MIT, so fork-able; vendor the runtime archive and build scripts; pin release IDs; Tectonic port as challenger |
| No Biber in Siglum or Tectonic browser builds | `biblatex` with default backend fails | Detect and explain; recommend `backend=bibtex`; Biber worker deferred to Phase 6 |
| pdfLaTeX documents compiled by XeTeX (Tectonic only) | Layout or encoding differences | Corpus comparison against native pdfLaTeX output |
| CSP `'unsafe-eval'` needed by Emscripten glue | Weakens CSP | Test under strict CSP; patch glue if needed |
| Memory on low-end devices | Tab crash | Measure; warning UI; terminate idle workers |

## Validation steps

0. T-0.1.0 Measure Siglum's TL2026 runtime footprint from its `runtime.json` (per-file sizes and SHA-256) and list the pre-bundled packages; build a curated Tectonic bundle with the same package list and record its size.
1. T-0.1.1 License inventory: record the license of every runtime artifact (wrapper, engines, formats, bundles) for Siglum and the Tectonic port; classify each as "bundled" (must be permissive) or "separate program" (GPL/AGPL allowed with source offer); confirm the Emscripten glue JS of GPL engines is loaded only inside the engine worker and never imported by Quartz code.
2. T-0.1.2 Isolated harness: a plain Vite page (no monorepo) per candidate, assets served from a local static server with production-like headers (no COOP/COEP first). Siglum runs with `ctanProxyUrl` omitted and bundles self-hosted; no request may reach `packages.siglum.org` or any other origin.
3. T-0.1.3 Hello world: `\documentclass{article}` → PDF in a module worker; record cold init time, bytes downloaded, warm compile time.
4. T-0.1.4 Multi-file: `main.tex` with `\input{sections/a}`, nested `\include`, `\includegraphics{figures/x.png}` and `.pdf` figure, relative paths.
5. T-0.1.5 Bibliography: BibTeX with `natbib`; `biblatex` with `backend=bibtex`; confirm the failure message for `biblatex` with the default Biber backend.
6. T-0.1.6 Corpus: 20 projects; record pass/fail, missing packages, time, bytes.
7. T-0.1.7 Diagnostics: capture logs for 10 deliberately broken documents; prototype the log parser; measure line attribution accuracy.
8. T-0.1.8 Cancellation: terminate mid-compile and restart; measure restart cost with cached assets and with a transferred `WebAssembly.Module`.
9. T-0.1.9 Offline: after warm-up, disable network and compile the same documents.
10. T-0.1.10 Strict CSP: run with `script-src 'self' 'wasm-unsafe-eval'`.
11. T-0.1.11 SyncTeX: confirm `.synctex.gz` output (for Phase 6 planning only).
12. T-0.1.12 Browsers: repeat 3-5 on Firefox and Safari.

## Expected results

A filled comparison sheet in `docs/technical-spikes/results/latex-wasm-results.md` and a recommendation updating ADR-004.

## Go / no-go

- **Go** with a candidate if: corpus pass ≥ 85 % (pdfLaTeX+XeLaTeX), warm compile ≤ 6 s for the 10-page article on a mid-range laptop, first-use download ≤ 60 MB for the article template, works offline after warm-up, works in Chromium + Firefox + Safari, runs from fully static self-hosted assets with a total footprint < 500 MB, and the T-0.1.1 inventory shows no copyleft code in the bundled category.
- Siglum is chosen if it passes; the Tectonic port replaces it only if Siglum fails a criterion that the port meets.
- **Conditional go** (LaTeX marked "beta" in MVP) if pass rate 60-85 % or Safari fails.
- **No-go** for both → apply ADR-004 fallback order.
