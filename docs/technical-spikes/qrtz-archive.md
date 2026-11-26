# Spike 3: .qrtz Archive

Task IDs: T-0.3.x. Spec: [qrtz-format.md](../specifications/qrtz-format.md). Decision: [ADR-003](../decisions/ADR-003-project-format.md).

## Objective

Validate that fflate can write deterministic `.qrtz` archives and read untrusted ZIPs with limits enforced during inflation, in the browser, without blocking the main thread.

## Hypothesis

fflate's streaming `Unzip` with per-entry inflaters lets Quartz enforce real (not header-declared) size limits, and its async `zip` produces archives for a 200 MB project in < 5 s off the main thread.

## Research findings

- **[FACT]** fflate is MIT, dependency-free, supports sync, async (worker-based) and streaming ZIP/unzip, and Deflate/Stored (https://github.com/101arrowz/fflate).
- **[FINDING]** fflate does not support ZIP encryption; Quartz forbids encryption anyway.
- **[FINDING]** Header `originalSize` fields can lie; limits must be counted on inflated bytes.
- **[FACT]** `crypto.subtle.digest("SHA-256", ...)` is available in secure contexts and workers (https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest).

## Risks

| Risk | Mitigation |
|---|---|
| ZIP64 edge cases | Test archives > 4 GB not supported in MVP (limit 1 GB); test ZIP64 small archives from macOS/Windows tools |
| Archives created by OS tools with `__MACOSX/`, `.DS_Store`, `Thumbs.db` | Ignore list on generic ZIP import |
| Non-UTF-8 legacy names (CP437) | Decode as CP437 when bit 11 unset; validate after decoding |
| Memory for large archives | Stream entries; hash incrementally? `subtle.digest` is not incremental, so hash per entry (≤ 100 MB) |

## Validation steps

1. T-0.3.1 Writer prototype: deterministic order and timestamps; two exports of the same project are byte-identical.
2. T-0.3.2 Reader prototype with limits and `parseProjectPath`.
3. T-0.3.3 Malicious corpus: traversal (`../x`, `..\\x`, `/etc/x`, `C:/x`), duplicate names (NFC/NFD, case), symlink entries, 42.zip-style nested bomb, single-entry high-ratio bomb, oversize entry, 20,000 tiny entries, truncated archive, wrong checksum, manifest with future major.
4. T-0.3.4 Interop: open exported `.qrtz` (renamed `.zip`) with Windows Explorer, macOS Archive Utility, `unzip`; import ZIPs exported by Overleaf, GitHub "Download ZIP", and an OpenAI Prism export if available.
5. T-0.3.5 Performance: 200 MB project export/import time and main-thread long tasks.

## Expected results

Prototype code kept as the starting point of `packages/project-format`; malicious corpus kept as permanent test fixtures.

## Go / no-go

- **Go** if all malicious samples are rejected with the right codes, interop works with the three OS tools, and no main-thread task > 50 ms during 200 MB export/import.
- **No-go** → evaluate `@zip.js/zip.js` (BSD-3-Clause), which has streaming and Web Streams support.
