import { SiglumCompiler } from "@siglum/engine";
import type { SiglumCompilerOptions } from "@siglum/engine/compiler";

/**
 * Siglum resolves files that a document needs but its preamble scan missed (for example
 * `epstopdf-base.sty`, loaded indirectly by `graphicx`) only in its "CTAN" retry loop. That loop
 * first maps the missing file to a bundle of the self-hosted runtime, which is what Quartz needs,
 * and only falls back to a CTAN proxy (a server) for files no bundle ships.
 *
 * This subclass enables the loop but answers every proxy request locally with "not available", so
 * bundles still resolve and no request ever leaves the Quartz origin.
 *
 * Coupled to `@siglum/engine` 0.2.2 internals (`ctanFetcher`, `_handleCtanFetchRequest`); the
 * version is pinned exactly and must be re-checked on upgrade.
 */
export class OfflineSiglumCompiler extends SiglumCompiler {
  constructor(options: Omit<SiglumCompilerOptions, "enableCtan" | "ctanProxyUrl">) {
    super({ ...options, enableCtan: true });
    const fetcher = this.ctanFetcher;
    fetcher.lookupPackageForFile = async () => null;
    fetcher.fetchPackage = async () => null;
    fetcher.resolveFontPackages = async (fontNames) => ({ packages: [], unresolved: fontNames });
    fetcher.batchFetchPackages = async (packageNames) => ({
      fetched: [],
      failed: packageNames,
      skipped: [],
    });
  }

  override async _handleCtanFetchRequest(message: unknown): Promise<void> {
    const record =
      typeof message === "object" && message !== null ? (message as Record<string, unknown>) : {};
    this.worker.postMessage({
      type: "ctan-fetch-response",
      requestId: record.requestId,
      packageName: record.packageName,
      success: false,
      error: "Package is not included in the Quartz LaTeX distribution.",
    });
  }
}
