import { applyAccents, maskLatex, readGroup } from "../outline/latex";
import { countWords, type MutableStatistics } from "./types";

const DISPLAY_ENVIRONMENTS =
  /\\begin\{(equation|align|alignat|flalign|gather|multline|eqnarray|displaymath)(\*?)\}[\s\S]*?\\end\{\1\2\}/g;
const DISPLAY_DELIMITED = /(?<!\\)\\\[[\s\S]*?\\\]|(?<!\\)\$\$[\s\S]*?\$\$/g;
const INLINE_MATH =
  /(?<!\\)\$(?:\\[\s\S]|[^$\\])+\$|(?<!\\)\\\([\s\S]*?\\\)|\\begin\{math\}[\s\S]*?\\end\{math\}/g;
const FIGURE = /\\begin\{(?:figure\*?|wrapfigure|sidewaysfigure\*?)\}/g;

/** Commands followed by this many brace groups that never reach the text as words. */
const SILENT_COMMANDS: Readonly<Record<string, number>> = {
  label: 1,
  ref: 1,
  eqref: 1,
  pageref: 1,
  autoref: 1,
  cref: 1,
  Cref: 1,
  cite: 1,
  citep: 1,
  citet: 1,
  autocite: 1,
  parencite: 1,
  textcite: 1,
  nocite: 1,
  input: 1,
  include: 1,
  subfile: 1,
  import: 2,
  subimport: 2,
  usepackage: 1,
  documentclass: 1,
  includegraphics: 1,
  bibliography: 1,
  bibliographystyle: 1,
  addbibresource: 1,
  url: 1,
  href: 1,
  color: 1,
  textcolor: 1,
  begin: 1,
  end: 1,
  vspace: 1,
  hspace: 1,
  setlength: 2,
  setcounter: 2,
  pagestyle: 1,
  thispagestyle: 1,
  newcommand: 2,
  renewcommand: 2,
  providecommand: 2,
  newenvironment: 3,
  author: 1,
  date: 1,
};

/** Environments whose first brace group is layout, such as the column spec of a table. */
const ENVIRONMENTS_WITH_ARGUMENT = /^(tabular\*?|tabularx|array|longtable|minipage|multicols)$/;

type Bucket = "wordsInHeadings" | "wordsOutsideText" | "silent";

const BUCKETS: Readonly<Record<string, Bucket>> = {
  part: "wordsInHeadings",
  chapter: "wordsInHeadings",
  section: "wordsInHeadings",
  subsection: "wordsInHeadings",
  subsubsection: "wordsInHeadings",
  paragraph: "wordsInHeadings",
  subparagraph: "wordsInHeadings",
  frametitle: "wordsInHeadings",
  title: "wordsInHeadings",
  caption: "wordsOutsideText",
  footnote: "wordsOutsideText",
  marginpar: "wordsOutsideText",
};

const COMMAND = /\\([a-zA-Z@]+)\*?/g;

/**
 * Removes every command and its non-textual arguments, moving the words of headings, captions and
 * footnotes into their own counters. Returns the remaining running text.
 */
function strip(source: string, counts: MutableStatistics): string {
  let text = "";
  let copied = 0;
  COMMAND.lastIndex = 0;
  const commands = [...source.matchAll(COMMAND)];
  for (const match of commands) {
    if (match.index < copied) continue;
    const name = match[1] as string;
    let end = match.index + match[0].length;
    const skipOptions = () => {
      for (let option = readGroup(source, end, "[", /[ \t]/); option !== undefined; ) {
        end = option.end;
        option = readGroup(source, end, "[", /[ \t]/);
      }
    };
    const bucket = BUCKETS[name];
    if (bucket !== undefined) {
      skipOptions();
      const group = readGroup(source, end, "{");
      if (group !== undefined) {
        counts[bucket as "wordsInHeadings"] += countWords(strip(group.content, counts));
        if (bucket === "wordsInHeadings" && name !== "title") counts.headings++;
        end = group.end;
      }
    } else if (Object.hasOwn(SILENT_COMMANDS, name)) {
      skipOptions();
      let remaining = SILENT_COMMANDS[name] as number;
      let environment = "";
      while (remaining-- > 0) {
        const group = readGroup(source, end, "{");
        if (group === undefined) break;
        environment = group.content;
        end = group.end;
        skipOptions();
      }
      if (name === "begin" && ENVIRONMENTS_WITH_ARGUMENT.test(environment)) {
        end = readGroup(source, end, "{")?.end ?? end;
      }
    } else {
      skipOptions();
    }
    text += `${source.slice(copied, match.index)} `;
    copied = end;
  }
  return text + source.slice(copied);
}

/** Adds the counts of one LaTeX source to `counts`. */
export function countLatex(source: string, counts: MutableStatistics): void {
  let body = maskLatex(source.replace(/\r\n?/g, "\n"));
  const begin = body.indexOf("\\begin{document}");
  if (begin !== -1) {
    // Only the title of a preamble is part of the document's words.
    const title = /\\title(?![a-zA-Z])/.exec(body.slice(0, begin));
    if (title !== null) {
      const group = readGroup(body, title.index + title[0].length, "{");
      if (group !== undefined) strip(`\\title{${group.content}}`, counts);
    }
    const end = body.indexOf("\\end{document}", begin);
    body = body.slice(begin, end === -1 ? undefined : end);
  }

  const take = (pattern: RegExp, key: "displayMath" | "inlineMath") => {
    body = body.replace(pattern, () => {
      counts[key]++;
      return " ";
    });
  };
  take(DISPLAY_ENVIRONMENTS, "displayMath");
  take(DISPLAY_DELIMITED, "displayMath");
  take(INLINE_MATH, "inlineMath");
  counts.figures += body.match(FIGURE)?.length ?? 0;

  // Accents first, so that "m\'etodo" stays one word.
  const text = strip(applyAccents(body.replace(/\\\\/g, " ")), counts);
  counts.wordsInText += countWords(text.replace(/\\./g, " "));
}
