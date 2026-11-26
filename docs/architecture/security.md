# Security and Threat Model

## 1. Assets

1. User documents and assets (confidential research, unpublished work).
2. Integrity of documents (no silent modification).
3. Availability of the workspace (no lockout through resource exhaustion).
4. The user's browser session on the Quartz origin.

## 2. Trust boundaries

| Boundary | Untrusted side |
|---|---|
| Archive import | `.qrtz`/ZIP files from anywhere |
| Project content | `.tex`, `.typ`, `.bib`, images, fonts, PDFs inside projects (may come from collaborators or the internet) |
| Compiler output | PDF bytes and logs produced from untrusted input |
| Agent tool calls | Arguments from an external agent that may be confused or prompt-injected |
| Static assets | Engine WASM and TeX bundles fetched from the static host / CDN |
| Optional network | Typst packages from `packages.typst.org` |

Out of scope: a compromised browser or OS, malicious browser extensions with host permissions (they can read any page), physical access.

## 3. Threats and mitigations

### T1 Malicious archive (path traversal, absolute paths, duplicates, bombs)
- Every entry name goes through `parseProjectPath` (see [qrtz-format.md](../specifications/qrtz-format.md#7-import-validation)): reject `..`, leading `/`, drive letters, backslashes (normalized then re-checked), NUL and control characters, Windows reserved names, paths > 1024 bytes or > 32 segments.
- Duplicate entries after Unicode NFC + case-fold comparison are rejected (case-insensitive file systems on export).
- Limits enforced **while inflating** (streaming), not from headers: per-entry 100 MB, total 1 GB, entry count 10,000, per-entry ratio > 200:1 for entries > 1 MB rejected.
- Nothing is written to storage until the whole archive validates.

### T2 Script execution from project content
- Quartz never evaluates project files. No `eval`, `new Function`, `innerHTML` with project content.
- SVG and HTML files are shown only as source text or rendered as `<img src=blob:>` (SVG in `<img>` cannot run scripts).
- CSP (static, via `<meta>` or host headers): `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; img-src 'self' blob: data:; connect-src 'self' <static-asset-host> https://packages.typst.org; object-src 'none'; frame-src 'none'; base-uri 'none'`. `'unsafe-eval'` is not allowed. **[ASSUMPTION]** engines run under `'wasm-unsafe-eval'` only; verify in Spikes 1 and 2 (some Emscripten builds use `eval`).

### T3 Malicious PDF
- PDF.js configured with `isEvalSupported: false`, `enableScripting: false` (no pdf.js scripting sandbox), annotations rendered without enabling JavaScript actions, external links open with `rel="noopener noreferrer"` after a confirmation showing the URL.
- Keep `pdfjs-dist` updated (CVE-2024-4367 showed arbitrary JS execution in old versions when `isEvalSupported` was true).

### T4 TeX/Typst resource exhaustion
- Engines run in workers with timeouts (LaTeX 120 s, Typst 30 s) and are terminated on timeout.
- TeX infinite loops are bounded by the timeout; memory growth is bounded by WASM memory maximum where the build sets one.
- No shell escape: `\write18` disabled; any engine "shell handler" mechanism is not registered.
- TeX file reads are confined to the engine's virtual FS (project files + bundles); `\input{/etc/passwd}` has nothing to read.

### T5 Agent misuse or prompt injection
- See [agent-bridge.md §4](agent-bridge.md#4-safety-model): staged writes, mandatory approval for deletes, revision checks, rate limits, size limits, project scoping, no code execution tools.
- Tool descriptions state that file contents are untrusted data.
- Tools are only registered in the tab holding the project's edit lock, and can be disabled globally.

### T6 Supply chain
- Engine assets are pinned by version and verified: the build records SHA-256 of each WASM/bundle; the worker verifies hashes of downloaded assets (or uses content-addressed URLs, as LibrePaper's `bundles/b/<sha256>/` layout does).
- Self-host all runtime assets on the Quartz static origin; do not load engines from third-party CDNs at runtime (also required for offline caching and CSP).
- `pnpm` `onlyBuiltDependencies` allow-list; lockfile committed; Renovate/Dependabot for updates.

### T7 Storage isolation and loss
- IndexedDB is per-origin. Host Quartz on a dedicated origin (not a shared `github.io` user path where other apps share the origin).
- Data loss from eviction or "clear site data" is mitigated by persistence request, warnings and export, not by any server.

### T8 External resource loading
- LaTeX: no network from TeX itself; bundles come only from the configured static mirror.
- Typst: `@preview` package fetching only after the user enables it per project; fetched package archives are validated like imports (size, paths).
- Images referenced by URL in documents are not fetched (neither engine fetches URLs by design).

## 4. Security checklist for PRs

- [ ] New input boundary validated with zod or `parseProjectPath`.
- [ ] No `innerHTML`/`dangerouslySetInnerHTML` with non-constant content.
- [ ] No new network destination without updating CSP `connect-src` and this document.
- [ ] Agent tool changes reviewed against the policy table.
- [ ] Limits have tests at, below and above the boundary.
