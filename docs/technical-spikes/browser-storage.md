# Spike 4: Browser Storage

Task IDs: T-0.4.x. Decision under test: [ADR-002](../decisions/ADR-002-browser-storage.md).

## Objective

Confirm that IndexedDB via Dexie meets performance and reliability needs for representative projects, and decide whether OPFS is needed at all.

## Hypothesis

IndexedDB with text as strings and binaries as Blobs handles a 500-file, 200 MB project with autosave writes < 20 ms (p95) and full-project snapshot reads < 500 ms, in Chromium, Firefox and Safari. OPFS brings no material benefit at that scale.

## Research findings

- **[FACT]** IndexedDB is available in windows and workers in all target browsers and stores Blobs (https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API).
- **[FACT]** OPFS provides `FileSystemSyncAccessHandle` only in dedicated workers; it is origin-scoped and shares quota and eviction with other storage (https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system).
- **[FACT]** `navigator.storage.estimate()`, `persist()`, `persisted()` are part of the Storage API (https://developer.mozilla.org/en-US/docs/Web/API/StorageManager). Grant behavior varies per browser.
- **[FACT]** Dexie 4 is Apache-2.0 with `liveQuery` (https://dexie.org).

## Risks

| Risk | Mitigation |
|---|---|
| Large Blob writes slow on some engine | Measure; fallback OPFS for blobs only (ADR-002 revisit condition) |
| Safari eviction after 7 days without interaction | Messaging, PWA install suggestion, export reminders |
| Quota errors mid-transaction | Test rollback behavior per browser |
| Multi-tab write races | Web Locks + revision checks; test |

## Validation steps

1. T-0.4.1 Generate fixtures: small (10 files, 1 MB), medium (150 files, 30 MB incl. 40 images), large (500 files, 200 MB incl. 60 MB PDF assets).
2. T-0.4.2 Benchmark in each browser: create project, autosave writes (1 KB edits) p50/p95, snapshot read, duplicate, delete, `liveQuery` notification latency across two tabs.
3. T-0.4.3 Same blob-heavy operations with an OPFS prototype (worker, sync access handles).
4. T-0.4.4 Quota: fill storage to failure in a test profile; verify `QuotaExceededError` surfaces and the transaction rolls back.
5. T-0.4.5 Crash safety: kill the tab during a batch write; verify no partial project.
6. T-0.4.6 Persistence: record `persist()` results in fresh profiles of each browser (installed and not installed PWA).

## Expected results

Table of timings in `results/browser-storage-results.md`; confirmation or revision of ADR-002.

## Go / no-go

- **Go (IndexedDB only)** if large fixture p95 autosave < 20 ms, snapshot < 500 ms on Chromium/Firefox and < 1 s on Safari, and quota rollback is clean.
- **Add OPFS for blobs** only if Blob operations miss targets by > 2x and OPFS meets them.
