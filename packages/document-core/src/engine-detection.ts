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

/**
 * Detects engine and entry point from file contents, never from an archive name.
 * Returns undefined when no candidate looks like a document root.
 */
export function detectEngine(files: readonly DetectionInput[]): DetectionResult | undefined {
  let best: { file: DetectionInput; engine: Engine; score: number } | undefined;

  for (const file of files) {
    const candidate = file.path.endsWith(".tex")
      ? { engine: "latex" as const, score: latexScore(file) }
      : file.path.endsWith(".typ")
        ? { engine: "typst" as const, score: typstScore(file) }
        : undefined;
    if (candidate === undefined || candidate.score < 5) continue;
    if (best === undefined || candidate.score > best.score) best = { file, ...candidate };
  }

  if (best === undefined) return undefined;
  const compiler: CompilerConfig =
    best.engine === "latex"
      ? { engine: "latex", variant: XELATEX_HINT.test(best.file.text) ? "xelatex" : "pdflatex" }
      : { engine: "typst" };
  return { engine: best.engine, entry: best.file.path, compiler };
}
