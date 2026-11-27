# Project Archive (standard ZIP)

Normative specification. Keywords MUST, SHOULD, MAY per RFC 2119. Decision: [ADR-003](../decisions/ADR-003-project-format.md).

A Quartz project travels as an ordinary ZIP of its source tree. There is no custom extension, manifest or app-specific entry, so Overleaf, a local TeX installation, the Typst CLI and any unzip tool read it directly.

## 1. Export (implemented in `@qrtz/project-format`)

- The file name is `<project title>.zip`, with characters that file systems reject replaced and `project.zip` as the fallback.
- Entries are the project files at the archive root, byte for byte. Folders are directory entries, so empty folders survive.
- Only Stored (0) and Deflate (8) are used, without encryption. Already compressed formats are stored.
- Writers MUST produce deterministic output: folders first, then files, each in path order, with every timestamp set to the project's `updatedAt`.
- Compiler binaries, caches, TeX bundles, intermediates, thumbnails and Quartz settings MUST NOT be included.
- The compiled PDF is downloaded separately from the preview.

The archive does not carry the project title (beyond the file name), engine, main document or LaTeX variant. Import detects them from the content.

## 2. Import sources (planned)

| Input | Handling |
|---|---|
| ZIP (Quartz, Overleaf or Prism export, GitHub download) | Strip a single common top-level folder if present; ignore `__MACOSX/`, `.DS_Store` and `Thumbs.db`; detect engine and entry ([engine detection](document-domain.md#engine-detection)) |
| Single `.tex` / `.typ` / `.bib` file | Create a project with that file as entry (for `.bib`, ask for engine) |
| Folder (`<input webkitdirectory>` or File System Access) | Same as ZIP |

Detection uses content, never the file extension of the archive alone. When several documents qualify as the entry, the user chooses.

## 3. Import validation

Runs fully in memory (or streaming) before any storage write. Order:

1. **Container**: size ≤ 1 GB compressed; valid central directory; ≤ 10,000 entries.
2. **Paths** (`parseProjectPath`): reject absolute (`/x`, `C:\x`, `\\server`), `..` segments, empty segments, `.` segments, backslashes, NUL/control characters (U+0000-U+001F, U+007F), trailing dots/spaces in segments, Windows reserved names (`CON`, `PRN`, `AUX`, `NUL`, `COM1`-`COM9`, `LPT1`-`LPT9`), length > 1024 bytes, depth > 32. Normalize to NFC.
3. **Duplicates**: reject two entries equal after NFC + case folding.
4. **Symlinks / special entries**: reject entries whose external attributes mark a symlink or device.
5. **Sizes while inflating**: per entry ≤ 100 MB, cumulative ≤ 1 GB, stop inflating when exceeded; reject ratio > 200:1 for entries larger than 1 MB.
6. **Content sanity**: text-kind files must decode as UTF-8 (else stored as binary with a warning); nothing is executed or rendered as HTML.

Errors are reported as a list with codes: `archive.too_large`, `archive.too_many_entries`, `archive.invalid_path`, `archive.duplicate_entry`, `archive.bomb_suspected`.
