/**
 * Stub for `blake3-wasm/browser.js`. Its published browser build imports a file that is not in
 * the package, which breaks bundling. Siglum loads it with a dynamic import and falls back to
 * DJB2 hashing (change detection only, not security), so failing to load is the intended path.
 */
throw new Error("blake3-wasm is not bundled in Quartz.");
