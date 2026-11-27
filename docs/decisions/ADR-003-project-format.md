# ADR-003: Project Format (standard ZIP)

Status: Accepted. Date: 2026-11-27. Replaces the 2026-11-26 decision for a `.qrtz` container.

## Context

Users need a portable, vendor-independent backup and exchange format that preserves sources byte-for-byte and works offline.

## Decision

- A project is exported as a standard `.zip` containing its files at the archive root. Specification: [project-archive.md](../specifications/project-archive.md).
- No custom extension, `mimetype` marker, manifest or Quartz-specific entry.
- Library: **fflate** (MIT, zero dependencies, async workers). **[FACT]** https://github.com/101arrowz/fflate

## Changes from the previous decision

The `.qrtz` format (ZIP with `mimetype`, `manifest.json`, `files/`, `quartz/` and optional `artifacts/`) was dropped before any code shipped. A private extension and layout suggest lock-in and require Quartz, or manual restructuring, to reuse the project elsewhere.

## Rejected alternatives

- **`.qrtz` container:** see above.
- **Optional metadata file inside the ZIP:** would restore project settings on import, at the price of an app-specific file in every export. Revisit only if content detection proves insufficient.
- **JSZip:** larger and slower than fflate, no streaming inflate with size enforcement.

## Consequences

- Exports open directly in Overleaf, local toolchains and any unzip tool.
- Engine, main document and LaTeX variant are not stored; import detects them or asks.
- No per-file checksums beyond the CRC-32 that ZIP already records.
- Import must treat the archive as hostile (see [security.md](../architecture/security.md#t1-malicious-archive-path-traversal-absolute-paths-duplicates-bombs)).
