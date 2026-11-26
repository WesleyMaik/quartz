# ADR-003: Project Format (.qrtz)

Status: Accepted, confirm with Spike 3. Date: 2026-11-26.

## Context

Users need a portable, vendor-independent backup and exchange format that preserves sources byte-for-byte, works offline and can evolve.

## Decision

- `.qrtz` is a ZIP archive (PKZIP, Deflate or Stored, no encryption, ZIP64 allowed) with a fixed layout: an uncompressed `mimetype` first entry, a `manifest.json`, sources under `files/`, Quartz settings under `quartz/`, and optional build outputs under `artifacts/`. Specification: [qrtz-format.md](../specifications/qrtz-format.md).
- Library: **fflate** (MIT, zero dependencies, streaming zip/unzip, async workers). **[FACT]** https://github.com/101arrowz/fflate
- Integrity: SHA-256 per file via `crypto.subtle.digest`, recorded in the manifest.
- Versioning: `formatVersion` as `"major.minor"`. Readers accept the same major with any minor and preserve unknown fields; reject a higher major with a clear error.

## Changes from the initial proposal

| Proposal | Change | Reason |
|---|---|---|
| `metadata/` folder | Renamed `quartz/` | Makes it obvious which files are app-specific and safe to ignore by other tools. |
| No mimetype marker | Add first entry `mimetype` = `application/vnd.quartz.project+zip`, stored uncompressed | Same technique as EPUB/ODF: lets Quartz and other tools sniff the type from bytes, not from the extension (FR-PRJ-2). |
| Checksums only | Checksums plus a `manifestDigest` is **not** added | A digest of the manifest inside the manifest adds no security (anyone can recompute it); integrity covers accidental corruption, not tampering. Signatures are deferred. |
| `artifacts/compiled.pdf` | `artifacts/<entry-stem>.pdf`, optional, excluded by default | Explicit naming; keeps archives small. |

## Rejected alternatives

- **Plain directory export only:** not a single file, harder to share; still offered as "Export source ZIP" (without `quartz/`).
- **Tar/tar.gz:** worse native OS support on Windows/macOS for double-click inspection.
- **JSZip:** larger and slower than fflate, no streaming inflate with size enforcement.
- **SQLite file:** opaque to users, violates format-first.

## Consequences

- Any unzip tool opens a `.qrtz`; renaming it to `.zip` shows the original files under `files/`.
- Import must treat the archive as hostile (see [security.md](../architecture/security.md#t1-malicious-archive-path-traversal-absolute-paths-duplicates-bombs)).
