# Storage Architecture

Decision record: [ADR-002](../decisions/ADR-002-browser-storage.md). Evidence plan: [browser-storage spike](../technical-spikes/browser-storage.md).

## 1. Decision summary

- **[REC]** IndexedDB is the single source of truth, accessed through Dexie 4.
- **[REC]** OPFS is not used in the MVP. It stays an optional future backend behind the same repository interfaces if Spike 4 shows a real need (very large binary assets).
- **[REC]** Cache Storage (service worker) holds only re-downloadable engine assets. It is not project data.
- **[REC]** File System Access API is an optional import/export enhancement, never storage of record.

## 2. Why Dexie over idb

| Need | Dexie 4 | idb |
|---|---|---|
| Schema versioning and upgrade functions | Built in (`db.version(n).stores().upgrade()`) | Manual in `onupgradeneeded` |
| Compound indexes, queries by `[projectId+path]` | Declarative | Manual |
| Reactive queries across components and tabs | `liveQuery` + `dexie-react-hooks` | Not provided; would need BroadcastChannel plumbing |
| Multi-table transactions | `db.transaction("rw", [a, b], ...)` | Yes |
| Size | larger (~30 KB gzip, [FINDING]) | ~1 KB |

The reactive cross-tab layer is the deciding factor: without it Quartz would build its own change notification system. **[FACT]** Dexie is Apache-2.0 (https://github.com/dexie/Dexie.js).

## 3. Schema (version 1)

```ts
// packages/storage/src/database.ts (illustrative)
db.version(1).stores({
  projects:       "id, updatedAt, title",
  files:          "id, projectId, [projectId+path], parentPath",
  fileContents:   "fileId",                    // { fileId, kind: "text", text } | { fileId, kind: "binary", blob }
  changeSets:     "id, projectId, status, createdAt",
  artifacts:      "id, projectId, kind",       // last good PDF (optional), synctex later
  workspaceState: "projectId",                 // open tabs, layout, cursor positions
  thumbnails:     "projectId",                 // added in version 2
  preferences:    "key",
  meta:           "key",                       // db-level info, migration markers
});
```

Design choices:

- **Thumbnails are derived data.** After a successful build, the first PDF page is rendered to a 240 px wide WebP (JPEG where WebP encoding is unavailable), usually a few kilobytes, one per project. It is replaced only when the sources changed, deleted with the project, never exported, and a project that has not been compiled shows an icon.
- **Metadata and contents are separate tables.** Listing a file tree never loads file bodies.
- **Text stored as strings, binaries as `Blob`.** Blobs in IndexedDB are supported in all target browsers and avoid base64 inflation.
- **`files.revision`** is a monotonically increasing integer per file, used for optimistic concurrency by agent tools (`expectedRevision`) and for compile staleness.
- **`projects.contentHash`** is not stored; the compile service computes a cheap snapshot key from `(fileId, revision)` pairs.
- **Paths are stored normalized** (see [document-domain.md](../specifications/document-domain.md#paths)) and `[projectId+path]` must be unique. **[ASSUMPTION]** Dexie's unique compound index syntax (`&[projectId+path]`) enforces this; verify in T-2.2.1. If it does not, the repository checks uniqueness inside the same `rw` transaction as the write.

## 4. Repositories (packages/storage)

```ts
interface ProjectRepository {
  list(): Promise<ProjectSummary[]>;
  get(id: ProjectId): Promise<Project | undefined>;
  create(project: NewProject, files: NewFile[]): Promise<Result<Project, StorageError>>;
  update(id: ProjectId, patch: ProjectPatch): Promise<Result<Project, StorageError>>;
  duplicate(id: ProjectId, title: string): Promise<Result<Project, StorageError>>;
  delete(id: ProjectId): Promise<Result<void, StorageError>>;
}

interface FileRepository {
  listTree(projectId: ProjectId): Promise<FileEntry[]>;
  read(projectId: ProjectId, path: ProjectPath): Promise<FileWithContent | undefined>;
  write(projectId: ProjectId, path: ProjectPath, content: FileContent, opts?: { expectedRevision?: number }): Promise<Result<FileEntry, StorageError>>;
  move(projectId: ProjectId, from: ProjectPath, to: ProjectPath): Promise<Result<void, StorageError>>;
  remove(projectId: ProjectId, path: ProjectPath): Promise<Result<void, StorageError>>;
  applyBatch(projectId: ProjectId, ops: FileOperation[]): Promise<Result<void, StorageError>>; // one transaction
  snapshot(projectId: ProjectId): Promise<ProjectSnapshot>;
}
```

`applyBatch` is the only way change sets, imports and duplication write multiple files, so they are atomic.

## 5. Autosave

1. CodeMirror update listener marks the tab dirty and schedules a flush 750 ms after the last change.
2. Flush also runs on `visibilitychange` to hidden, `pagehide`, tab switch and before compile.
3. Flush = one Dexie `rw` transaction: write `fileContents`, bump `files.revision` and `projects.updatedAt`.
4. On success the tab becomes clean; on failure the tab stays dirty, the header shows "Not saved" with the error, and the in-memory state is kept.
5. IndexedDB transactions are atomic, so a crash mid-flush leaves the previous content intact (NFR-5 accepts losing at most the last debounce window).

Recovery after reload: open tabs and cursor positions come from `workspaceState`; content comes from `fileContents` (always the last committed write). There is no separate "unsaved buffer" journal in the MVP. **[REC]** Add one only if users report data loss; the 750 ms window plus `pagehide` flush is the standard trade-off.

## 6. Quota and persistence

- On startup and after large writes: `navigator.storage.estimate()` → show usage/quota in settings and in the dashboard footer; warn at 80 %, block imports that would exceed 95 %.
- After the user creates or imports their first project: call `navigator.storage.persist()` once, from a user gesture where possible. Record the result; show `navigator.storage.persisted()` state in settings.
- **[FACT]** Browsers may deny persistence or grant it heuristically; Safari evicts script-writable storage for sites not used for 7 days unless installed as a web app (WebKit tracking prevention policy, https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/). The UI must say so and push ZIP export as backup.
- `QuotaExceededError` maps to `storage.quota_exceeded`; the write is rolled back and the user is offered: delete old artifacts, export and delete projects.
- Storage unavailable (private modes that disable IndexedDB, blocked storage): app opens in a "temporary session" mode with a persistent banner; export remains possible.

## 7. Project lifecycle and persistence impact

| Operation | Storage effect |
|---|---|
| Create | `projects` + `files` + `fileContents` in one transaction |
| Rename project | `projects.title`, `updatedAt` |
| Duplicate | new IDs for project and files, contents copied (Blobs are reference-copied by the browser where possible) |
| Delete | single transaction deleting from all tables by `projectId` |
| Import | validation fully in memory first, then `create` |
| Export | read-only snapshot |

## 8. File System Access API (optional, deferred beyond MVP)

**[FACT]** `showDirectoryPicker()` and writable file handles are available in Chromium browsers only; Firefox and Safari do not implement the directory picker (https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker). **[REC]** Phase 6+: "Open local folder" imports a directory, and "Export to folder" writes one. Continuous two-way sync is deferred because it creates two sources of truth and needs conflict handling. Fallback everywhere: `<input type="file" webkitdirectory>` for import and ZIP download for export.

## 9. Migrations

- Dexie version bumps with `upgrade()` functions; each upgrade has a fixture-based test.
- Before a destructive migration, the app writes an automatic ZIP backup of each project into memory and offers download if the upgrade fails.
