/**
 * Extra LaTeX packages served from the Quartz origin (see `fetch:assets`). Siglum asks for a
 * package when a document needs a file its runtime does not ship; this source answers from static
 * files instead of a CTAN proxy, so no request leaves the origin.
 */

/** Asset folder produced by `pnpm --filter @qrtz/web fetch:assets`; keep in sync with the script. */
export const LATEX_EXTRAS_ID = "extra-tl2025-final";

/**
 * Extras loaded before every compile rather than on request. `cm-super-maps` holds the cm-super font
 * maps the runtime only ships in a lazy bundle; without them pdfTeX cannot find `tcrm1000` (the
 * `\textbullet` of every itemize) and stops with "Font tcrm1000 at 600 not found".
 */
export const PRELOADED_EXTRAS: readonly string[] = ["cm-super-maps"];

/** Where TeX Live runtime files live inside the engine's virtual file system. */
const TEXMF_ROOT = "/texlive/texmf-dist/";

const PACKAGE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
/** texmf-relative runtime paths: known top-level trees, plain segments, no traversal. */
const RUNTIME_FILE = /^(?:tex|dvips|fonts|bibtex)(?:\/[A-Za-z0-9._+-]+)+$/;

export type ExtraPackageIndex = ReadonlyMap<string, readonly string[]>;

const isSafeFile = (path: string): boolean =>
  RUNTIME_FILE.test(path) &&
  !path.split("/").some((segment) => segment === "." || segment === "..");

/**
 * Validates the generated `index.json`. The file is served by Quartz, but it is still treated as
 * untrusted input: unknown shapes are rejected and unsafe entries are dropped.
 */
export function parseExtraIndex(raw: unknown): ExtraPackageIndex | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const packages = (raw as { packages?: unknown }).packages;
  if (typeof packages !== "object" || packages === null) return undefined;
  const index = new Map<string, readonly string[]>();
  for (const [name, entry] of Object.entries(packages)) {
    if (!PACKAGE_NAME.test(name) || typeof entry !== "object" || entry === null) continue;
    const files = (entry as { files?: unknown }).files;
    if (!Array.isArray(files)) continue;
    const safe = files.filter(
      (file): file is string => typeof file === "string" && isSafeFile(file),
    );
    if (safe.length > 0) index.set(name, safe);
  }
  return index;
}

export type FetchLike = (url: string) => Promise<Response>;

export class ExtraPackageSource {
  private index: Promise<ExtraPackageIndex> | undefined;
  private readonly loaded = new Map<string, Promise<Map<string, Uint8Array> | null>>();

  /** `baseUrl` is the extras folder, ending with a slash. */
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: FetchLike = (url) => fetch(url),
  ) {}

  /** Whether Quartz ships `name`; loads the index on first use. */
  async has(name: string): Promise<boolean> {
    return (await this.loadIndex()).has(name);
  }

  /** Files of `name` keyed by engine path, or null when the package is not shipped. */
  load(name: string): Promise<Map<string, Uint8Array> | null> {
    let pending = this.loaded.get(name);
    if (pending === undefined) {
      pending = this.fetchPackage(name);
      this.loaded.set(name, pending);
      // A failed download may succeed later (for example after going back online).
      pending.then(
        (files) => files === null && this.loaded.delete(name),
        () => this.loaded.delete(name),
      );
    }
    return pending;
  }

  private loadIndex(): Promise<ExtraPackageIndex> {
    this.index ??= this.fetchImpl(`${this.baseUrl}index.json`)
      .then((response) => (response.ok ? response.json() : undefined))
      .then((raw: unknown) => parseExtraIndex(raw) ?? new Map<string, readonly string[]>())
      .catch(() => {
        this.index = undefined;
        return new Map<string, readonly string[]>();
      });
    return this.index;
  }

  private async fetchPackage(name: string): Promise<Map<string, Uint8Array> | null> {
    const files = (await this.loadIndex()).get(name);
    if (files === undefined) return null;
    const entries = await Promise.all(
      files.map(async (file) => {
        const response = await this.fetchImpl(`${this.baseUrl}files/${file}`);
        if (!response.ok) throw new Error(`Missing ${file} of LaTeX package ${name}.`);
        return [`${TEXMF_ROOT}${file}`, new Uint8Array(await response.arrayBuffer())] as const;
      }),
    );
    return new Map(entries);
  }
}
