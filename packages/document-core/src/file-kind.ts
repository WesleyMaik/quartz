import type { FileKind } from "./model";
import { extension, type ProjectPath } from "./paths";

const SOURCE = new Set(["tex", "sty", "cls", "typ", "bst", "bbx", "cbx", "def", "ltx", "dtx"]);
const ASSET = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "pdf", "eps"]);
const FONT = new Set(["ttf", "otf", "woff", "woff2"]);
const DATA = new Set(["csv", "json", "yaml", "yml", "toml", "txt", "dat", "md"]);

export function inferFileKind(path: ProjectPath): Exclude<FileKind, "folder"> {
  const ext = extension(path);
  if (SOURCE.has(ext)) return "source";
  if (ext === "bib") return "bibliography";
  if (ASSET.has(ext)) return "asset";
  if (FONT.has(ext)) return "font";
  if (DATA.has(ext)) return "data";
  return "asset";
}

/** Kinds whose content is stored and edited as UTF-8 text. */
export const isTextKind = (kind: FileKind): boolean =>
  kind === "source" || kind === "bibliography" || kind === "data";
