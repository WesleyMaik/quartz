import { SiglumCompiler } from "@siglum/engine";
import type { SiglumCompilerOptions } from "@siglum/engine/compiler";
import { type ExtraPackageSource, PRELOADED_EXTRAS } from "./extra-packages";

const LATEX_FILE_EXTENSIONS = [".sty", ".cls", ".def", ".cfg", ".tex", ".fd", ".clo"] as const;

/**
 * Siglum resolves files that a document needs but its runtime does not ship through its "CTAN"
 * loop: a preamble pre-scan (`batchFetchPackages`) and a retry on each missing file
 * (`lookupPackageForFile` + `fetchPackage`). Upstream answers those from a CTAN proxy (a server).
 *
 * This subclass keeps the loop but serves packages from Quartz's own extras folder; anything not
 * shipped there is reported as unavailable. File-to-package lookups use the runtime's static index,
 * so no request ever leaves the Quartz origin. Fetched files go into Siglum's file cache, which it
 * passes to the worker up front on later compiles.
 *
 * Coupled to `@siglum/engine` 0.2.2 internals (`ctanFetcher`); the version is pinned exactly and
 * must be re-checked on upgrade.
 */
export class OfflineSiglumCompiler extends SiglumCompiler {
  private readonly loadExtra: (name: string) => Promise<unknown>;

  constructor(
    options: Omit<SiglumCompilerOptions, "enableCtan" | "ctanProxyUrl"> & {
      readonly bundlesUrl: string;
    },
    extras: ExtraPackageSource,
  ) {
    super({ ...options, enableCtan: true });
    const fetcher = this.ctanFetcher;
    // Upstream builds the fetcher without `bundlesUrl`, so its indexes would be requested from the
    // proxy default (`http://localhost:8787/bundles`). Point it at the runtime Quartz serves.
    fetcher.bundlesUrl = options.bundlesUrl;
    const lookup = fetcher.lookupPackageForFile.bind(fetcher);

    const fetchPackage = async (name: string) => {
      const files = await extras.load(name).catch(() => null);
      if (files === null) return null;
      for (const [path, data] of files) fetcher.fileCache.set(path, data);
      return { files, dependencies: [] };
    };
    /** Maps a requested name such as `subcaption` to the package that ships it (`caption`). */
    const container = async (name: string): Promise<string> => {
      if (await extras.has(name)) return name;
      for (const extension of LATEX_FILE_EXTENSIONS) {
        const owner = await lookup(`${name}${extension}`);
        if (owner !== null && owner !== name) return owner;
      }
      return name;
    };

    this.loadExtra = fetchPackage;
    fetcher.fetchPackage = (name) => fetchPackage(name);
    fetcher.batchFetchPackages = async (names) => {
      const fetched: string[] = [];
      const failed: string[] = [];
      for (const name of new Set(names)) {
        const result = await fetchPackage(await container(name));
        (result === null ? failed : fetched).push(name);
      }
      return { fetched, failed, skipped: [] };
    };
    // Font packages are not part of the extras yet; fonts come from the runtime or the project.
    fetcher.resolveFontPackages = async (fontNames) => ({ packages: [], unresolved: fontNames });
  }

  /** Puts the always-needed extras into Siglum's file cache, which it mounts on every compile. */
  async preloadExtras(): Promise<void> {
    await Promise.all(PRELOADED_EXTRAS.map((name) => this.loadExtra(name)));
  }
}
