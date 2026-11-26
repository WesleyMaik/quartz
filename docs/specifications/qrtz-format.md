# .qrtz Project Format, Version 1.0

Normative specification. Keywords MUST, SHOULD, MAY per RFC 2119. Decision: [ADR-003](../decisions/ADR-003-project-format.md).

## 1. Container

- A `.qrtz` file MUST be a ZIP archive (APPNOTE 6.3.x) using only Stored (0) or Deflate (8) methods, without encryption. ZIP64 MAY be used.
- The first entry MUST be `mimetype`, Stored, with content exactly `application/vnd.quartz.project+zip` (ASCII, no newline).
- Entry names MUST be UTF-8 (general purpose bit 11 set).
- Writers SHOULD produce deterministic output: entries sorted (mimetype first, then `manifest.json`, then lexicographic by path), DOS timestamps fixed to the project's `updatedAt`.
- Recommended media type `application/vnd.quartz.project+zip`; extension `.qrtz`.

## 2. Layout

```
research-project.qrtz
├── mimetype                       # required, first, stored
├── manifest.json                  # required
├── files/                         # required: the project tree, byte-for-byte
│   ├── main.tex
│   ├── references.bib
│   ├── sections/introduction.tex
│   └── figures/diagram.png
├── quartz/                        # optional: Quartz-specific settings
│   ├── project-settings.json
│   └── workspace.json             # open tabs, layout (never required to open the project)
└── artifacts/                     # optional, excluded by default
    └── main.pdf
```

- Every file under `files/` MUST be listed in the manifest and vice versa.
- Files under `quartz/` and `artifacts/` MUST be listed in `manifest.extras` with checksums.
- Readers MUST ignore unknown top-level entries that are not listed (with a warning) rather than fail, except entries whose paths are invalid (§7), which fail the import.
- Compiler binaries, caches, TeX bundles, `.aux`/`.log` intermediates MUST NOT be included.

## 3. manifest.json

```jsonc
{
  "$schema": "https://<quartz-static-host>/schemas/qrtz-manifest-1.json",
  "formatVersion": "1.0",
  "generator": { "name": "Quartz", "version": "0.1.0" },
  "project": {
    "id": "01JD7Y8K3V9Q4W2M5N6P7R8S9T",          // ULID
    "title": "Research Project",
    "createdAt": "2026-11-26T12:00:00.000Z",
    "updatedAt": "2026-11-26T14:30:00.000Z",
    "engine": "latex",                            // "latex" | "typst"
    "entry": "main.tex",                          // relative to files/
    "compiler": {
      "latex": { "variant": "pdflatex", "bibliography": "bibtex", "passes": "auto" }
      // or "typst": { "inputs": { "key": "value" }, "packagesNetwork": false }
    },
    "language": "en",                             // BCP 47, optional
    "description": "",                            // optional
    "keywords": []                                // optional
  },
  "files": [
    {
      "path": "main.tex",
      "size": 2048,
      "sha256": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      "mediaType": "text/x-tex",
      "kind": "source"                            // "source" | "bibliography" | "asset" | "font" | "data"
    }
  ],
  "extras": [
    { "path": "quartz/project-settings.json", "size": 120, "sha256": "..." }
  ],
  "x": {}                                          // namespace for unknown/extension fields
}
```

### Field rules

| Field | Rule |
|---|---|
| `formatVersion` | `"<major>.<minor>"`. Readers MUST reject a major they do not know and MUST accept any minor of a known major. |
| `project.id` | ULID. On import, if a project with the same ID exists, the user chooses "Replace" or "Import as copy" (new ID). |
| `project.engine` | Required. If absent or invalid in a ZIP without manifest, detection applies (see [document-domain.md](document-domain.md#engine-detection)). |
| `project.entry` | MUST reference a `files[]` path with kind `source`. |
| `files[].path` | Valid project path (§7), relative to `files/`, no trailing slash. Empty folders are recorded in `folders: string[]` (optional). |
| `files[].sha256` | Lowercase hex SHA-256 of the exact stored bytes. |
| `mediaType` | Optional, informative; never used for security decisions. |
| Unknown fields | Readers MUST preserve unknown fields at any level when re-exporting the same project (round-trip). New optional fields in minor versions; vendor fields under `x`. |

The JSON Schema is generated from the zod schema in `packages/project-format` and published as a static file with the app.

## 4. quartz/project-settings.json

```json
{ "editor": { "tabSize": 2, "wordWrap": true }, "autoCompile": { "enabled": true, "debounceMs": 2500 }, "agent": { "writePolicy": "staged" } }
```

Optional; defaults apply when missing. Readers ignore unknown keys.

## 5. Export variants

| Export | Contents |
|---|---|
| `.qrtz` (default) | mimetype, manifest, `files/`, `quartz/` |
| `.qrtz` with build | + `artifacts/<entry-stem>.pdf` |
| Source ZIP | only the contents of `files/` at the ZIP root, no Quartz metadata (for Overleaf, local TeX, Typst CLI) |
| PDF | last successful PDF |

## 6. Import sources

| Input | Handling |
|---|---|
| `.qrtz` or any ZIP whose first entry is the Quartz `mimetype` | Full validation including checksums |
| Generic ZIP (Overleaf/Prism export, GitHub download) | Strip a single common top-level folder if present; detect engine and entry; no checksums to verify |
| Single `.tex` / `.typ` / `.bib` file | Create a project with that file as entry (for `.bib`, ask for engine) |
| Folder (`<input webkitdirectory>` or File System Access) | Same as generic ZIP |

Detection uses content (§ engine detection), never the file extension of the archive alone.

## 7. Import validation

Runs fully in memory (or streaming) before any storage write. Order:

1. **Container**: size ≤ 1 GB compressed; valid central directory; ≤ 10,000 entries.
2. **Paths** (`parseProjectPath`): reject absolute (`/x`, `C:\x`, `\\server`), `..` segments, empty segments, `.` segments, backslashes, NUL/control characters (U+0000-U+001F, U+007F), trailing dots/spaces in segments, Windows reserved names (`CON`, `PRN`, `AUX`, `NUL`, `COM1`-`COM9`, `LPT1`-`LPT9`), length > 1024 bytes, depth > 32. Normalize to NFC.
3. **Duplicates**: reject two entries equal after NFC + case folding.
4. **Symlinks / special entries**: reject entries whose external attributes mark a symlink or device.
5. **Sizes while inflating**: per entry ≤ 100 MB, cumulative ≤ 1 GB, stop inflating when exceeded; reject ratio > 200:1 for entries larger than 1 MB.
6. **Manifest**: parse with zod; `formatVersion` major supported; required fields present.
7. **Inventory**: set of `files/` entries equals `manifest.files` paths.
8. **Checksums**: every SHA-256 matches; mismatch → error listing files (user may choose "Import anyway, marking files as unverified" for recovery of a damaged backup).
9. **Content sanity**: text-kind files must decode as UTF-8 (else stored as binary with a warning); nothing is executed or rendered as HTML.

Errors are reported as a list with codes: `archive.too_large`, `archive.too_many_entries`, `archive.invalid_path`, `archive.duplicate_entry`, `archive.bomb_suspected`, `archive.manifest_invalid`, `archive.version_unsupported`, `archive.inventory_mismatch`, `archive.checksum_mismatch`.

## 8. Migrations

- `packages/project-format/src/migrations/` holds `migrate_1_x_to_2_0` style pure functions over the parsed manifest.
- Importers migrate to the current version in memory; the stored project always uses the current internal model.
- Exporters always write the current version.

## 9. Long-term suitability

ZIP + JSON + original files is readable without Quartz forever; the manifest is a convenience, the files are the truth. This is the main reason the format is suitable long term.
