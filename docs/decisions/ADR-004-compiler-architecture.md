# ADR-004: Compiler Architecture and Engines

Status: Architecture accepted; license decided (Quartz is `MIT OR Apache-2.0`); **LaTeX engine choice pending Spike 1**. Date: 2026-11-26.

## Context

Both engines must run fully in the browser, off the main thread, behind a common contract, lazily loaded, with diagnostics and safe cancellation. License compatibility with Quartz's (undecided) license is a gate.

## Decision

1. One `CompilerAdapter` contract in `compiler-core`; adapters run inside dedicated module workers; the main thread talks to an `EngineHost` through Comlink. See [compiler-contracts.md](../specifications/compiler-contracts.md).
2. Per-project queue with one running and one pending job; stale results are discarded by snapshot key.
3. Cancellation by worker termination for LaTeX, by result discarding for Typst.
4. PDF.js renders the output of both engines (no Typst canvas/SVG renderer in the MVP), so preview, search, download and future SyncTeX share one viewer.
5. **Typst:** `@myriaddreamin/typst.ts` (compiler entry `@myriaddreamin/typst.ts/compiler`) + `@myriaddreamin/typst-ts-web-compiler`. Start on the stable 0.7.0 line (Typst 0.14.2) and move to 0.8.0 (Typst 0.15.x) when it leaves release candidate, if Spike 2 shows no regressions. **[FACT]** Apache-2.0; v0.7.0 is the latest stable, v0.8.0-rc4 bundles Typst 0.15.1 (https://github.com/Myriad-Dreamin/typst.ts/releases).
6. **LaTeX: Siglum (`@siglum/engine`, MIT, TL2026, pdfLaTeX + XeLaTeX, BibTeX) is the recommended engine**, self-hosted with its pre-bundled package set and **without** its CTAN proxy. Challenger in Spike 1: a Tectonic WASM build (`glyphtex-engine`, XeTeX only) with a curated `.ttb` bundle. Excluded: texlyre-busytex and SwiftLaTeX (AGPL wrappers that would be bundled with Quartz code). Full multi-GB TeX Live mirrors are rejected as the default hosting model; the target is a curated package set < 500 MB. Comparison: [latex-wasm.md](../technical-spikes/latex-wasm.md#engine-selection-2026-11-26-revised).

## License decision

Decided 2026-11-26: Quartz's own code is open source under **`MIT OR Apache-2.0`** (dual license, user's choice of either; `LICENSE-MIT` and `LICENSE-APACHE` at the root, SPDX `MIT OR Apache-2.0` in every `package.json`).

Rules that follow:

1. **Bundled code** (anything imported into the app or a Quartz worker's JS bundle) must be under a permissive license compatible with both MIT and Apache-2.0: MIT, BSD, ISC, Apache-2.0, 0BSD, Zlib. MPL-2.0 is allowed file-level only after review. GPL, LGPL and AGPL code must not be bundled.
2. **Separate programs** under GPL/AGPL (TeX engine WASM binaries, the AGPL Biber WASM build) are allowed when they are (a) shipped as separate static assets, (b) loaded into their own worker and (c) communicate only through messages. Quartz publishes their exact corresponding source (or a pinned link to the source revision and build scripts) on a "Third-party software" page and in `THIRD_PARTY_NOTICES.md`.
3. **AGPL-specific obligation**: if the AGPL Biber build is used, the source-offer link must be reachable from the UI for users interacting with it over the network (the static host serves it), satisfying AGPL §13 conservatively.
4. **Wrappers**: the JavaScript that drives an engine is bundled code, so it must be permissive (rule 1). This excludes SwiftLaTeX and texlyre-busytex, and keeps Siglum (MIT), Tectonic ports with MIT crates, and LibrePaper wasm-latex (MIT code) eligible.
5. **Fonts and TeX Live data**: redistributable under their own licenses (OFL, GUST, LPPL, public domain); license files ship with the assets.
6. A license check (`pnpm licenses list` in CI) fails the build if a bundled dependency has a non-allowed license.

This is an engineering policy, not legal advice; a review by someone qualified is still recommended before the first public release.

## License analysis

| Component | License | Distribution impact |
|---|---|---|
| typst.ts | Apache-2.0 [FACT] | Permissive; include NOTICE/attribution. |
| Typst compiler (bundled in the WASM) | Apache-2.0 [FACT] (https://github.com/typst/typst) | Permissive. |
| Default Typst fonts (Libertinus, New Computer Modern, DejaVu) | OFL-1.1 / GUST font license / Bitstream Vera-style **[FINDING]** | Redistributable with license files. |
| SwiftLaTeX | AGPL-3.0 [FACT] (LICENSE file) | Linking its JS wrapper into Quartz makes the combined app AGPL-covered; serving it over a network triggers source-offer obligations. Also frozen at TeX Live 2020 and no release since 2022-02-20. Rejected regardless of license. |
| texlyre-busytex | AGPL-3.0 [FACT] (derived from MIT BusyTeX) | Same AGPL consequence for the wrapper. Technically the most complete (LuaLaTeX, Biber, SyncTeX). Usable only if Quartz is AGPL-compatible. |
| Siglum | MIT [FACT] (LICENSE) | Wrapper permissive. Engine binaries GPL (see below). **Selected.** |
| Tectonic | MIT [FACT]; derived TeX code under other open licenses | Permissive. Browser builds are third-party (`glyphtex-engine` crates MIT; the glyphtex app is GPL-3.0 and must not be bundled). Challenger. |
| LibrePaper wasm-latex | MIT for repo code [FACT]; release metadata lists engines as `GPL-2.0-only` and XeTeX `GPL-2.0-only AND LicenseRef-XeTeX`; vendored Biber build is AGPL-3.0 | Wrapper permissive; engines GPL; the Biber worker is AGPL. Biber runs in its own worker as a separate program, which supports the "aggregate, separate program" reading; allowed under rule 2 of the license decision, with a source offer. |
| BusyTeX (upstream) | README says MIT for scripts only, not binaries; no LICENSE file found **[FINDING]** | Use as a build source only. |
| TeX Live packages | Mixed free licenses (LPPL, GPL, public domain, OFL) | Redistributable; keep per-package license metadata available. |

Key point: **every** TeX engine (pdfTeX, XeTeX, LuaTeX) is GPL. Distributing those WASM binaries requires offering their corresponding source. Running them as separate worker programs that communicate by messages is the standard argument for not extending the GPL to Quartz's own permissively licensed code (rule 2 below).

## Consequences

- `compiler-latex` holds all license notices for LaTeX assets and a `THIRD_PARTY_NOTICES.md` generated at build.
- The static host serves a curated LaTeX package set (target < 500 MB), not a full TeX Live mirror (OQ-2).
- MVP has no Biber and no LuaLaTeX; `biblatex` needs `backend=bibtex`.
- If Spike 1 fails for Siglum and the Tectonic port, fallback options in order: (a) LibrePaper wasm-latex with a curated subset of its content-addressed bundles (MIT code; its Biber is AGPL and would run only as a separate worker); (b) a Quartz-owned MIT/Apache wrapper over upstream BusyTeX builds; (c) ship Typst-first and mark LaTeX experimental; (d) last resort, revisit the license decision to allow texlyre-busytex (would require relicensing Quartz under AGPL-3.0).
