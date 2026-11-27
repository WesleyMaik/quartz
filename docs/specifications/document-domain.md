# Document Domain Specification

Package: `packages/document-core`. Framework-free; depends only on `zod`. Types below are normative shapes; implementation details may differ.

## 1. Identifiers

```ts
type Brand<T, B extends string> = T & { readonly __brand: B };
type ProjectId   = Brand<string, "ProjectId">;   // ULID
type FileId      = Brand<string, "FileId">;      // ULID
type ChangeSetId = Brand<string, "ChangeSetId">; // ULID
type ProjectPath = Brand<string, "ProjectPath">; // validated, normalized
```

Branded types are created only by parsers (`parseProjectPath`, `newProjectId`), so invalid values cannot reach services.

## 2. Paths

- POSIX separators, relative to the project root, NFC-normalized, no leading/trailing slash, rules in [project-archive.md §3](project-archive.md#3-import-validation).
- `parseProjectPath(input: string): Result<ProjectPath, PathError>` is the only constructor, used by UI, import, storage and agent tools (one implementation, DRY).
- Folders are implicit from file paths; empty folders are stored as `FileEntry` with `kind: "folder"`.
- References inside documents (`\input{sections/intro}`, `#include "sections/intro.typ"`, `\includegraphics{figures/a}`) are resolved relative to the referencing file for Typst and relative to the project root for LaTeX (TeX's working directory), matching the native tools.

## 3. Core model

```ts
type Engine = "latex" | "typst";

interface Project {
  id: ProjectId;
  title: string;
  engine: Engine;
  entry: ProjectPath;
  compiler: CompilerConfig;
  createdAt: string;        // ISO 8601
  updatedAt: string;
  metadata: ProjectMetadata; // language, description, keywords, x (unknown fields preserved)
}

type CompilerConfig =
  | { engine: "latex"; variant: "pdflatex" | "xelatex"; bibliography: "auto" | "bibtex" | "biber" | "none"; passes: "auto" | number }
  | { engine: "typst"; inputs: Record<string, string>; packagesNetwork: boolean };

type FileKind = "folder" | "source" | "bibliography" | "asset" | "font" | "data";

interface FileEntry {
  id: FileId;
  projectId: ProjectId;
  path: ProjectPath;
  kind: FileKind;
  mediaType?: string;
  size: number;
  revision: number;         // increments on every content write
  updatedAt: string;
}

type FileContent =
  | { kind: "text"; text: string }
  | { kind: "binary"; bytes: Blob };

type FileOperation =
  | { op: "create"; path: ProjectPath; content: FileContent }
  | { op: "write"; path: ProjectPath; content: FileContent; expectedRevision?: number }
  | { op: "edit"; path: ProjectPath; edits: TextEdit[]; expectedRevision?: number }
  | { op: "move"; from: ProjectPath; to: ProjectPath }
  | { op: "delete"; path: ProjectPath; expectedRevision?: number };

interface TextEdit { oldText: string; newText: string; replaceAll?: boolean } // oldText must match exactly once unless replaceAll
```

### File kind inference

| Extension | Kind |
|---|---|
| `.tex .sty .cls .typ .bst .bbx .cbx .def .ltx .dtx` | source |
| `.bib` | bibliography |
| `.png .jpg .jpeg .gif .webp .svg .pdf .eps` | asset |
| `.ttf .otf .woff .woff2` | font |
| `.csv .json .yaml .yml .toml .txt .dat` | data |
| other | asset (binary) or data (if valid UTF-8) |

## 4. Engine detection

Applied on import of anything without a valid manifest and when a project has no entry:

1. Candidate entries: `main.tex`, `main.typ`, then any `.tex` containing `\documentclass` at top level, then any `.typ` at the root.
2. LaTeX score: `\documentclass` (+10), `\begin{document}` (+10), `.tex` count.
3. Typst score: root `.typ` files, `#set`/`#show`/`#import` lines (+5 each, capped).
4. If both engines score, prefer the entry named `main.*`; otherwise ask the user with the detected candidates.
5. LaTeX variant: `fontspec`, `unicode-math`, `polyglossia` or `% !TEX program = xelatex` → `xelatex`; otherwise `pdflatex`. Bibliography: `\usepackage{biblatex}` with `backend=bibtex` → bibtex, `biblatex` otherwise → biber, `\bibliography{}` → bibtex.

## 5. Change sets and history

```ts
interface ChangeSet {
  id: ChangeSetId;
  projectId: ProjectId;
  origin: { type: "agent"; toolCallId: string; agentLabel?: string } | { type: "user" } | { type: "undo"; of: ChangeSetId };
  ops: FileOperation[];
  before: Record<ProjectPath, { revision: number; content?: FileContent } | null>; // null = did not exist
  status: "pending_review" | "applied" | "rejected" | "conflict" | "undone";
  createdAt: string;
  decidedAt?: string;
  summary: string;
}
```

- Revision history in the MVP = applied change sets (agent and undo) for 30 days or 200 per project.
- **[DEFERRED]** Snapshot-based document history for manual edits (Phase 6): periodic snapshots per file, compressed, with retention.

## 6. Compilation state (domain view)

```ts
type CompileStatus = "idle" | "initializing" | "queued" | "compiling" | "success" | "error" | "cancelled";
interface CompileState {
  status: CompileStatus;
  jobId?: number;
  lastResult?: CompilationSummary;     // diagnostics, duration, finishedAt
  lastSuccessfulPdf?: { bytes: Uint8Array; snapshotKey: string; finishedAt: string };
  stale: boolean;                       // true when sources changed since lastSuccessfulPdf
}
```

## 7. Scientific structure (extensible, mostly Phase 6)

Indexers are pure functions `(files) => Index`, run in a worker when needed:

```ts
interface DocumentIndex {
  outline: OutlineNode[];        // \section..., = Heading
  labels: LabelDef[];            // \label{x}, <x>
  references: LabelRef[];        // \ref, \eqref, \cref, @x
  citations: CitationRef[];      // \cite{k}, @k (Typst)
  equations: EquationNode[];     // environments and $...$ blocks
  figures: FigureNode[];
  tables: TableNode[];
}
interface BibEntry { key: string; type: string; fields: Record<string, string>; source: { path: ProjectPath; line: number } }
```

MVP uses `outline`, `labels` and `citations` for completion and the `get_document_outline` tool. Unused-reference detection, citation navigation and validation reuse the same index later. External integrations (Zotero, Crossref, OpenAlex) will produce `BibEntry` values and write `.bib` files through normal `FileOperation`s, so `document-core` needs no change to add them.

## 8. Templates

Templates are data (`{ engine, entry, files: Record<path, string> }`) in `document-core/templates`, versioned with the app. MVP: `latex-article`, `latex-empty`, `typst-article`, `typst-empty`.
