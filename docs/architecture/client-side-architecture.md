# Client-Side Architecture

## 1. Zero-backend contract

**[REC]** Quartz is a set of static files. Allowed network traffic:

| Traffic | When | Required? |
|---|---|---|
| App shell (HTML, JS, CSS, fonts for UI) | First visit, updates | Yes, then cached by the service worker |
| Engine assets (Typst WASM, LaTeX WASM, TeX format files, TeX bundles, document fonts) | First use of each engine and each package | Yes for that engine, then cached |
| Typst Universe packages (`packages.typst.org`) | When a document imports `@preview/...` and the user allowed it | Optional |
| Future integrations (Crossref, OpenAlex, Zotero local API) | User-initiated only | Optional, deferred |

Forbidden: any Quartz-operated dynamic endpoint, analytics, error reporting services, remote compilation, remote storage.

Static host requirements: HTTPS; ability to set `Cache-Control` and CORS headers; optionally `Cross-Origin-Opener-Policy`/`Cross-Origin-Embedder-Policy` (see §6). Cloudflare Pages, Netlify and most CDNs meet this; GitHub Pages cannot set headers.

## 2. Composition root

`apps/web/src/app/bootstrap.ts` creates singletons in this order and passes them down by React context:

1. `QuartzDatabase` (Dexie) and repositories.
2. Services: `ProjectService`, `FileService`, `CompileService`, `ChangeSetService`, `ActivityLog`.
3. `QuartzOperations` adapter (implements the agent-bridge port with those services).
4. `AgentBridge.start(operations)` registers WebMCP tools if `document.modelContext` exists.

Services are plain TypeScript classes with constructor injection. React consumes them through hooks (`useProjectService()`), and reads data with Dexie `useLiveQuery`.

## 3. State management

| State kind | Owner | Mechanism |
|---|---|---|
| Persistent domain data (projects, files, contents, change sets) | IndexedDB | Dexie + `useLiveQuery` (reactive across components and tabs) |
| Editor document state | CodeMirror `EditorState` per open file | Kept in memory, flushed to `FileService` by autosave |
| Compile state per project | `CompileService` | Observable store (tiny event emitter) exposed via `useSyncExternalStore` |
| Workspace UI (open tabs, panel sizes, active file) | Zustand store, persisted to `workspaceState` table | Debounced persistence |
| Agent activity | `ActivityLog` (in memory, last 500 events) + persisted change sets | `useSyncExternalStore` |

No global Redux-style store: each state has one owner. **[REC]** This avoids a second source of truth for domain data.

## 4. Routing

React Router 7 in library mode with two routes: `/` (dashboard) and `/p/:projectId` (workspace). Hash routing is not needed when the host supports SPA fallback; provide `_redirects`/`404.html` fallback in the build for hosts that do not.

## 5. Workers

| Worker | Created | Lifetime | RPC |
|---|---|---|---|
| Typst compiler | First Typst compile | Until idle 10 min or project closed | Comlink |
| LaTeX compiler | First LaTeX compile | Until idle 10 min; terminated to cancel | Comlink (or engine's own worker protocol wrapped by the adapter) |
| PDF.js | First preview | App lifetime | pdf.js built-in |
| Archive (fflate) | On import/export of archives > 5 MB | Per operation | fflate async API uses its own workers |

Engine code is loaded with dynamic `import()` from `CompileService`, so the initial bundle contains no engine code (NFR-1).

## 6. Cross-origin isolation

**[FINDING]** Siglum states its faster path uses `SharedArrayBuffer`, which requires `COOP: same-origin` and `COEP: require-corp`, and that it also works without them (https://github.com/SiglumProject/siglum, docs/usage.md). Typst.ts does not require it.

**[REC]** Do not require cross-origin isolation in the MVP. It complicates loading cross-origin resources (Typst packages, future integrations) and some hosts cannot set headers. Measure the performance difference in Spike 1; if it is large, enable `COEP: credentialless` (Chromium/Firefox) as a progressive enhancement.

## 7. Offline and PWA

- `vite-plugin-pwa` (Workbox) precaches the app shell.
- Runtime caching (Cache Storage, `CacheFirst`, immutable URLs with content hashes) for engine WASM, TeX bundles, fonts and Typst packages.
- An "Offline readiness" panel shows which engines and packages are cached and lets the user pre-download the LaTeX core bundle and Typst fonts.
- Updates: new service worker waits; the user gets an "Update available, reload" toast. Never reload automatically while there are unsaved edits.

Cache Storage holds only re-downloadable assets; it is never a source of truth for user data, so it does not compete with IndexedDB.

## 8. Multi-tab behavior

- Dexie liveQuery propagates changes across tabs.
- A Web Lock `quartz:project:<id>` is held by the tab that has the project open for editing. A second tab opening the same project gets a banner: "Open in another tab. Take over editing?" Taking over sends a `BroadcastChannel` message asking the first tab to flush and switch to read-only.
- WebMCP tools are registered per tab; only the tab holding the lock exposes write tools (read tools are fine in both).

## 9. Error handling conventions

- Services return `Result<T, QuartzError>` for expected failures (validation, quota, not found, conflict) and throw only for programmer errors.
- `QuartzError` is a discriminated union with `code` (e.g. `"storage.quota_exceeded"`, `"path.invalid"`, `"archive.checksum_mismatch"`), a user-facing message key and optional details.
- The UI maps codes to toasts or inline errors; agent tools map them to structured tool errors.
