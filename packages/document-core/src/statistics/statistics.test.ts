import { describe, expect, it } from "vitest";
import type { ProjectPath } from "../paths";
import { documentStatistics, totalWords } from "./index";

const statistics = (files: Record<string, string>, entry: string) =>
  documentStatistics(
    new Map(Object.entries(files).map(([name, text]) => [name as ProjectPath, text])),
    entry as ProjectPath,
  );

const latex = (body: string) => statistics({ "main.tex": body }, "main.tex");
const typst = (body: string) => statistics({ "main.typ": body }, "main.typ");

const none = {
  wordsInText: 0,
  wordsInHeadings: 0,
  wordsOutsideText: 0,
  headings: 0,
  figures: 0,
  inlineMath: 0,
  displayMath: 0,
};

describe("LaTeX statistics", () => {
  it("separates text, headings, captions, figures and formulas", () => {
    const body = [
      "\\documentclass{article}",
      "\\usepackage[utf8]{inputenc}",
      "\\newcommand{\\x}[1]{ignored words #1}",
      "\\title{My Paper}",
      "\\author{Someone Else}",
      "\\begin{document}",
      "\\maketitle",
      "\\section{Introduction}\\label{sec:intro}",
      "One two \\textbf{three} four~\\cite{key}, see \\ref{sec:intro}. % not counted",
      "Inline $a + b$ and \\(c\\).",
      "\\[ x = 1 \\]",
      "\\begin{align*} y &= 2 \\end{align*}",
      "\\begin{figure}[h]\\includegraphics[width=2cm]{plot}",
      "\\caption{A small plot}\\end{figure}",
      "Note\\footnote{Extra detail}.",
      "\\end{document}",
      "Trailing words",
    ].join("\n");
    expect(latex(body)).toEqual({
      wordsInText: 8,
      wordsInHeadings: 3,
      wordsOutsideText: 5,
      headings: 1,
      figures: 1,
      inlineMath: 2,
      displayMath: 2,
    });
  });

  it.each([
    ["", 0],
    ["m\\'etodo e introdu\\c{c}\\~ao", 3],
    ["don't well-known 3.14 e.g. x", 5],
    ["price 5\\$ and 10\\$", 4],
    ["\\begin{tabular}{lcr} a & b \\end{tabular}", 2],
    ["\\begin{verbatim}\nhidden words\n\\end{verbatim}", 0],
    ["\\href{https://example.com/a}{the site}", 2],
  ])("counts the words of %j", (body, words) => {
    expect(latex(body).wordsInText).toBe(words);
  });

  it("counts included files once", () => {
    const files = {
      "main.tex": "one \\input{part} \\input{part}",
      "part.tex": "two three",
      "unused.tex": "four",
    };
    expect(statistics(files, "main.tex").wordsInText).toBe(3);
  });

  it("is empty when the entry is missing", () => {
    expect(statistics({}, "main.tex")).toEqual(none);
  });
});

describe("Typst statistics", () => {
  it("separates text, headings, captions, figures and formulas", () => {
    const body = [
      '#set document(title: "Hidden title")',
      "#let author = [Hidden]",
      "= My Heading <intro>",
      'One two #text(18pt, weight: "bold")[three] see @intro. // not counted',
      "Inline $a + b$ here.",
      "$ x = 1 $",
      '#figure(image("plot.png"), caption: [A small plot])',
      "Note#footnote[Extra detail].",
      "#heading(level: 2)[Second]",
    ].join("\n");
    expect(typst(body)).toEqual({
      wordsInText: 7,
      wordsInHeadings: 3,
      wordsOutsideText: 5,
      headings: 2,
      figures: 1,
      inlineMath: 1,
      displayMath: 1,
    });
  });

  it("skips multi-line statements", () => {
    expect(typst("#show heading: it => {\n  hidden words\n}\nvisible").wordsInText).toBe(1);
  });

  it("sums every word bucket", () => {
    expect(totalWords(typst("= A\nb c #footnote[d]"))).toBe(4);
  });
});
