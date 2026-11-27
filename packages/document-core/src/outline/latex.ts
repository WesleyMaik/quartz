import { blank, directoryOf, joinPath, type OutlineItem, type OutlineScanner } from "./types";

const HEADING_LEVELS: Readonly<Record<string, number>> = {
  part: 0,
  chapter: 1,
  section: 2,
  subsection: 3,
  subsubsection: 4,
  paragraph: 5,
  subparagraph: 6,
  // Beamer slides sit below every sectioning command.
  frametitle: 7,
};

const COMMAND =
  /\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph|frametitle|begin|end|input|include|subfile|import|subimport)(?![a-zA-Z@])\*?/g;
const VERBATIM_BEGIN = /\\begin\{(verbatim\*?|Verbatim\*?|lstlisting|minted|comment|alltt)\}/;
/** An unescaped `%`: preceded by an even number of backslashes. */
const COMMENT = /(?<!\\)(?:\\\\)*%/;
const INLINE_VERBATIM = /\\(?:verb\*?|lstinline)([^a-zA-Z*\s{[])[^\n]*?\1/g;

/** Blanks comments, verbatim material and `\iffalse` blocks, none of which produce headings. */
export function maskLatex(source: string): string {
  let verbatimEnd: string | undefined;
  const lines = source.split("\n").map((original) => {
    let line = original;
    let prefix = "";
    if (verbatimEnd !== undefined) {
      const end = line.indexOf(verbatimEnd);
      if (end === -1) return "";
      prefix = " ".repeat(end + verbatimEnd.length);
      line = line.slice(end + verbatimEnd.length);
      verbatimEnd = undefined;
    }
    line = line.replace(INLINE_VERBATIM, blank);
    const comment = COMMENT.exec(line);
    if (comment !== null) line = line.slice(0, comment.index + comment[0].length - 1);
    const begin = VERBATIM_BEGIN.exec(line);
    if (begin !== null) {
      const closing = `\\end{${begin[1]}}`;
      const end = line.indexOf(closing, begin.index);
      if (end === -1) {
        verbatimEnd = closing;
        line = line.slice(0, begin.index);
      } else {
        line =
          line.slice(0, begin.index) +
          " ".repeat(end + closing.length - begin.index) +
          line.slice(end + closing.length);
      }
    }
    return prefix + line;
  });
  return lines.join("\n").replace(/\\iffalse(?![a-zA-Z])[\s\S]*?\\fi(?![a-zA-Z])/g, blank);
}

interface Group {
  readonly content: string;
  readonly end: number;
}

/** Reads a balanced `{...}` or `[...]` group that starts at the next non-space character. */
export function readGroup(
  text: string,
  from: number,
  open: "{" | "[",
  gap: RegExp = /\s/,
): Group | undefined {
  let start = from;
  while (gap.test(text.charAt(start))) start++;
  if (text.charAt(start) !== open) return undefined;
  let braces = 0;
  for (let index = start + 1; index < text.length; index++) {
    const char = text.charAt(index);
    if (char === "\\") {
      index++;
    } else if (char === "{") {
      braces++;
    } else if (char === "}") {
      if (braces === 0) {
        return open === "{" ? { content: text.slice(start + 1, index), end: index + 1 } : undefined;
      }
      braces--;
    } else if (char === "]" && open === "[" && braces === 0) {
      return { content: text.slice(start + 1, index), end: index + 1 };
    }
  }
  return undefined;
}

const COMBINING_MARKS: Readonly<Record<string, string>> = {
  "'": "́",
  "`": "̀",
  "^": "̂",
  '"': "̈",
  "~": "̃",
  "=": "̄",
  ".": "̇",
  c: "̧",
  v: "̌",
  u: "̆",
  H: "̋",
  r: "̊",
  k: "̨",
};

const SYMBOLS: Readonly<Record<string, string>> = {
  LaTeX: "LaTeX",
  TeX: "TeX",
  ldots: "…",
  dots: "…",
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  epsilon: "ε",
  theta: "θ",
  lambda: "λ",
  mu: "μ",
  pi: "π",
  sigma: "σ",
  phi: "φ",
  omega: "ω",
  Delta: "Δ",
  Sigma: "Σ",
  Omega: "Ω",
};

/** Commands whose argument never appears in a title. */
const DROPPED = /\\(?:label|footnote|index|thanks|vspace|hspace)\*?(?![a-zA-Z])/;
/** Stand-in for escaped characters while braces and commands are removed. */
const ESCAPE_BASE = 0xe000;

function removeCommands(title: string): string {
  let result = title;
  for (let match = DROPPED.exec(result); match !== null; match = DROPPED.exec(result)) {
    const group = readGroup(result, match.index + match[0].length, "{");
    const end = group?.end ?? match.index + match[0].length;
    result = result.slice(0, match.index) + result.slice(end);
  }
  const pdfString = "\\texorpdfstring";
  for (let at = result.indexOf(pdfString); at !== -1; at = result.indexOf(pdfString)) {
    const typeset = readGroup(result, at + pdfString.length, "{");
    const plain = typeset === undefined ? undefined : readGroup(result, typeset.end, "{");
    const end = plain?.end ?? at + pdfString.length;
    result = result.slice(0, at) + (plain?.content ?? "") + result.slice(end);
  }
  return result;
}

/** Replaces accent commands such as `\c{c}` and `\'e` with combining characters. */
export const applyAccents = (source: string): string =>
  source.replace(
    /\\(?:(['`^"~=.])\s*|([cvuHrk])(?:\s+|(?=\{)))(?:\{\s*\\?([a-zA-Z])\s*\}|\\?([a-zA-Z]))/g,
    (_, symbol: string | undefined, letter: string | undefined, braced, bare) =>
      `${braced ?? bare}${COMBINING_MARKS[symbol ?? letter ?? ""] ?? ""}`,
  );

/** Turns the LaTeX source of a heading into the text a reader would see. */
function plainTitle(source: string): string {
  return applyAccents(removeCommands(source))
    .replace(/\\\\/g, " ")
    .replace(/\\([&%$#_{}])/g, (_, char: string) =>
      String.fromCharCode(ESCAPE_BASE + char.charCodeAt(0)),
    )
    .replace(/\\([a-zA-Z@]+)\*?/g, (_, name: string) => SYMBOLS[name] ?? "")
    .replace(/\\[,;: !]|~/g, " ")
    .replace(/[{}$\\]/g, "")
    .replace(/---/g, "—")
    .replace(/--/g, "–")
    .replace(/[-]/g, (char) => String.fromCharCode(char.charCodeAt(0) - ESCAPE_BASE))
    .replace(/\s+/g, " ")
    .trim()
    .normalize("NFC");
}

function includeTargets(
  name: string,
  directories: readonly string[],
): { readonly kind: "include"; readonly targets: readonly string[] } {
  const names = /\.tex$/i.test(name) ? [name] : [`${name}.tex`, name];
  const targets = directories.flatMap((directory) =>
    names.flatMap((candidate) => joinPath(directory, candidate) ?? []),
  );
  return { kind: "include", targets };
}

/** Sectioning commands, Beamer frames and file inclusions of one LaTeX source. */
export const scanLatex: OutlineScanner = (source, { path, rootDirectory }) => {
  const text = maskLatex(source.replace(/\r\n?/g, "\n"));
  const directory = directoryOf(path);
  const items: OutlineItem[] = [];
  let line = 1;
  let counted = 0;
  const lineAt = (index: number): number => {
    for (; counted < index; counted++) if (text.charAt(counted) === "\n") line++;
    return line;
  };
  const addHeading = (level: number, title: string, index: number) => {
    // `#1` marks the body of a command definition, not a heading of the document.
    if (/(?<!\\)#\d/.test(title)) return;
    items.push({
      kind: "heading",
      level,
      title: plainTitle(title) || "(untitled)",
      line: lineAt(index),
    });
  };

  for (const match of text.matchAll(COMMAND)) {
    // `\\section` is a line break followed by the word "section".
    let backslashes = 0;
    while (text.charAt(match.index - 1 - backslashes) === "\\") backslashes++;
    if (backslashes % 2 === 1) continue;

    const command = match[1] as string;
    const after = match.index + match[0].length;
    const level = HEADING_LEVELS[command];
    if (level !== undefined) {
      const short = readGroup(text, after, "[");
      const title = readGroup(text, short?.end ?? after, "{");
      if (title !== undefined) addHeading(level, title.content, match.index);
      continue;
    }

    const first = readGroup(text, after, "{");
    if (first === undefined) continue;
    const argument = first.content.trim();
    if (command === "begin") {
      if (argument !== "frame") continue;
      const overlay = /^[ \t]*<[^>\n]*>/.exec(text.slice(first.end, first.end + 80));
      const start = first.end + (overlay?.[0].length ?? 0);
      const options = readGroup(text, start, "[", /[ \t]/);
      const title = readGroup(text, options?.end ?? start, "{", /[ \t]/);
      if (title !== undefined) addHeading(7, title.content, match.index);
    } else if (command === "end") {
      if (argument === "document") break;
    } else if (command === "import" || command === "subimport") {
      const file = readGroup(text, first.end, "{");
      if (file === undefined) continue;
      const base = command === "subimport" ? [directory, rootDirectory] : [rootDirectory];
      items.push(includeTargets(`${argument}/${file.content.trim()}`, base));
    } else {
      items.push(includeTargets(argument, [rootDirectory, directory]));
    }
  }
  return items;
};
