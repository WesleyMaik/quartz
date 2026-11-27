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

## 2. Import sources

| Input | Status | Handling |
|---|---|---|
| ZIP (Quartz, Overleaf or Prism export, GitHub download) | Implemented | Ignore operating-system and VCS clutter (`__MACOSX/`, `.DS_Store`, `Thumbs.db`, `.git/`), strip a single common top-level folder, keep folder entries, detect engine and entry ([engine detection](document-domain.md#4-engine-detection)) |
| Single `.tex` / `.typ` / `.bib` file | Planned | Create a project with that file as entry (for `.bib`, ask for engine) |
| Folder (`<input webkitdirectory>` or File System Access) | Planned | Same as ZIP |

Detection uses content, never the file name of the archive. The project title comes from the file name. When several documents qualify as the entry, the user chooses; an archive without a UTF-8 `.tex` or `.typ` file is refused.

## 3. Import validation

`readProjectZip` runs in a worker and validates everything in memory before any storage write. Order:

1. **Container**: size ≤ 1 GB compressed; valid central directory (ZIP64 supported); ≤ 10,000 entries.
2. **Paths** (`parseProjectPath`): reject absolute (`/x`, `C:\x`, `\\server`), `..` segments, empty segments, `.` segments, backslashes, NUL/control characters (U+0000-U+001F, U+007F), trailing dots/spaces in segments, Windows reserved names (`CON`, `PRN`, `AUX`, `NUL`, `COM1`-`COM9`, `LPT1`-`LPT9`), length > 1024 bytes, depth > 32. Normalize to NFC. Names that are not UTF-8 are decoded as CP437 first.
3. **Entry types**: reject symlinks and special files, encrypted entries and methods other than Stored and Deflate.
4. **Duplicates**: reject entries equal after NFC + case folding, folders spelled two ways, and a path used as both file and folder.
5. **Sizes while inflating**: per entry ≤ 100 MB, cumulative ≤ 1 GB, stop inflating when exceeded; reject ratio > 200:1 for entries larger than 1 MB. Inflated size and CRC-32 must match the directory.
6. **Content sanity**: text-kind files must decode as UTF-8, keeping any byte order mark (else stored unchanged as binary with a warning); nothing is executed or rendered as HTML.

The first violation refuses the whole archive, with a message naming the entry and one of these codes: `archive.invalid`, `archive.too_large`, `archive.too_many_entries`, `archive.invalid_path`, `archive.duplicate_entry`, `archive.unsupported_entry`, `archive.bomb_suspected`, `archive.no_document`.
