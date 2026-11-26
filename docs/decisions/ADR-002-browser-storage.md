# ADR-002: Browser Storage

Status: Accepted, confirm with Spike 4. Date: 2026-11-26.

## Context

Projects must survive reloads without any server. Candidates: IndexedDB (raw, `idb`, Dexie), OPFS, File System Access API. Projects contain many small text files and some binary assets (images, PDFs, fonts) typically from KB to tens of MB.

## Decision

1. IndexedDB is the single source of truth for all project data, through **Dexie 4**.
2. OPFS is **not** used in the MVP.
3. Cache Storage is used only by the service worker for immutable engine/runtime assets.
4. File System Access API is a deferred, optional import/export feature.

## Reasons

- IndexedDB is available in every target browser, including workers, supports Blobs, and offers multi-store atomic transactions, which project operations (import, duplicate, change sets) require.
- Dexie gives schema versioning, compound indexes and cross-tab `liveQuery`; replicating those on `idb` is custom code to maintain.
- OPFS's advantages (synchronous access handles in workers, efficient large-file random access) matter for databases and huge files. Quartz reads whole files and rarely exceeds tens of MB per asset. Adding OPFS creates a second store that must stay transactionally consistent with IndexedDB metadata, which IndexedDB alone gives for free.
- Safari's OPFS and storage eviction behavior adds risk without a demonstrated benefit.

## Revisit when

- Spike 4 or field reports show IndexedDB Blob writes > 50 MB being slow or failing, or
- engines need a persistent file-system-like cache that Cache Storage cannot serve.

Then add an `OpfsBlobStore` behind the `FileRepository` interface for binary contents only, with IndexedDB still holding metadata and a reference.

## Consequences

- One storage library, one migration path.
- Quota is shared with Cache Storage for engine assets; the storage panel shows both.
- Users must export `.qrtz` for real backups; the UI must make that clear (FR-ST-2).
