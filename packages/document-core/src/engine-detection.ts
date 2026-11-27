import type { CompilerConfig, Engine } from "./model";

export interface DetectionInput {
  readonly path: string;
  readonly text: string;
}

export interface DetectionResult {
  readonly engine: Engine;
  readonly entry: string;
  readonly compiler: CompilerConfig;
}

const DOCUMENTCLASS = /^\s*\\documentclass/m;
const BEGIN_DOCUMENT = /\\begin\{document\}/;
const TYPST_DIRECTIVE = /^\s*#(set|show|import|let|include)\b/gm;
const XELATEX_HINT =
  /\\usepackage(\[[^\]]*\])?\{[^}]*\b(fontspec|unicode-math|polyglossia)\b[^}]*\}|%\s*!TEX\s+(TS-)?program\s*=\s*xelatex/i;

const isRoot = (path: string): boolean => !path.includes("/");

function latexScore(file: DetectionInput): number {
  let score = 0;
  if (DOCUMENTCLASS.test(file.text)) score += 10;
  if (BEGIN_DOCUMENT.test(file.text)) score += 10;
  if (file.path.endsWith("main.tex")) score += 3;
  return score;
}

function typstScore(file: DetectionInput): number {
  const directives = Math.min(file.text.match(TYPST_DIRECTIVE)?.length ?? 0, 4);
  let score = directives * 5;
  if (isRoot(file.path)) score += 2;
  if (file.path.endsWith("main.typ")) score += 3;
  return score;
}

interface ScoredEntry extends DetectionResult {
  readonly score: number;
}

/** Documents that look like a root, best first; ties keep the input order. */
function scoreEntries(files: readonly DetectionInput[]): ScoredEntry[] {
  const scored: ScoredEntry[] = [];
  for (const file of files) {
    const result = describeEntry(file);
    if (result === undefined) continue;
    const score = result.engine === "latex" ? latexScore(file) : typstScore(file);
    if (score >= 5) scored.push({ ...result, score });
  }
  return scored.sort((a, b) => b.score - a.score);
}

/** Compiler settings for using `file` as the entry; undefined unless it is LaTeX or Typst. */
function describeEntry(file: DetectionInput): DetectionResult | undefined {
  if (file.path.endsWith(".tex")) {
    const variant = XELATEX_HINT.test(file.text) ? "xelatex" : "pdflatex";
    return { engine: "latex", entry: file.path, compiler: { engine: "latex", variant } };
  }
  if (file.path.endsWith(".typ")) {
    return { engine: "typst", entry: file.path, compiler: { engine: "typst" } };
  }
  return undefined;
}

const withoutScore = ({ engine, entry, compiler }: DetectionResult): DetectionResult => ({
  engine,
  entry,
  compiler,
});

/**
 * Detects engine and entry point from file contents, never from an archive name.
 * Returns undefined when no candidate looks like a document root.
 */
export function detectEngine(files: readonly DetectionInput[]): DetectionResult | undefined {
  const best = scoreEntries(files)[0];
  return best === undefined ? undefined : withoutScore(best);
}

export interface EntryDetection {
  /** Possible main documents, most likely first. Empty when there is no LaTeX or Typst file. */
  readonly candidates: readonly DetectionResult[];
  /** The candidate that can be used without asking the user. */
  readonly suggested: DetectionResult | undefined;
}

const isMain = (entry: string): boolean => /(^|\/)main\.(tex|typ)$/.test(entry);
const depth = (entry: string): number => entry.split("/").length;

/**
 * Main-document candidates for an imported project. A single candidate, or a single `main.*` closest
 * to the root, is suggested; anything else is the user's choice. When no file looks like a root,
 * every LaTeX and Typst file is offered.
 */
export function findEntryCandidates(files: readonly DetectionInput[]): EntryDetection {
  const roots = scoreEntries(files).filter(
    // Typst has no document marker: below the root only `main.typ` counts as a candidate.
    (item) => item.engine === "latex" || isRoot(item.entry) || isMain(item.entry),
  );
  const candidates =
    roots.length > 0
      ? roots.map(withoutScore)
      : files.map(describeEntry).filter((item) => item !== undefined);
  if (candidates.length <= 1) return { candidates, suggested: candidates[0] };

  const mains = candidates.filter((item) => isMain(item.entry));
  const shallowest = Math.min(...mains.map((item) => depth(item.entry)));
  const preferred = mains.filter((item) => depth(item.entry) === shallowest);
  return { candidates, suggested: preferred.length === 1 ? preferred[0] : undefined };
}
