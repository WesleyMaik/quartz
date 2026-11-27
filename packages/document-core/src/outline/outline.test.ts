import { describe, expect, it } from "vitest";
import type { ProjectPath } from "../paths";
import {
  buildOutline,
  MAX_OUTLINE_FILE_VISITS,
  MAX_OUTLINE_HEADINGS,
  type OutlineNode,
} from "./index";

const path = (value: string) => value as ProjectPath;

const sourcesOf = (files: Record<string, string>) =>
  new Map(Object.entries(files).map(([name, text]) => [path(name), text]));

/** Indented titles, one per heading. */
const render = (nodes: readonly OutlineNode[], depth = 0): string[] =>
  nodes.flatMap((node) => [
    `${"  ".repeat(depth)}${node.title}`,
    ...render(node.children, depth + 1),
  ]);

const outline = (files: Record<string, string>, entry: string, active?: string) =>
  render(
    buildOutline(sourcesOf(files), path(entry), active === undefined ? undefined : path(active)),
  );

const latex = (body: string) => outline({ "main.tex": body }, "main.tex");
const typst = (body: string) => outline({ "main.typ": body }, "main.typ");

describe("LaTeX outline", () => {
  it("nests sectioning commands, including starred ones", () => {
    const body = [
      "\\section*{Introduction}",
      "\\section{Development}",
      "\\subsection{Task 1}",
      "\\subsubsection{Detail}",
      "\\subsection[short]{Task 2}",
      "\\section{Conclusion}",
    ].join("\n");
    expect(latex(body)).toEqual([
      "Introduction",
      "Development",
      "  Task 1",
      "    Detail",
      "  Task 2",
      "Conclusion",
    ]);
  });

  it("reports the file and line of each heading", () => {
    const [node] = buildOutline(
      sourcesOf({ "main.tex": "a\r\nb\r\n\\section{Title}" }),
      path("main.tex"),
    );
    expect([node?.file, node?.line]).toEqual(["main.tex", 3]);
  });

  it.each([
    ["% \\section{No}", []],
    ["50\\% done \\section{Yes}", ["Yes"]],
    ["line\\\\% \\section{No}", []],
    ["a \\\\section{No}", []],
    ["\\verb|\\section{No}|", []],
    ["\\begin{verbatim}\n\\section{No}\n\\end{verbatim}\n\\section{Yes}", ["Yes"]],
    ["\\begin{lstlisting}\\section{No}\\end{lstlisting}", []],
    ["\\iffalse\n\\section{No}\n\\fi\n\\section{Yes}", ["Yes"]],
    ["\\newcommand{\\task}[1]{\\subsection{#1}}", []],
    ["\\titleformat{\\section}{\\large}{}{0pt}{}", []],
    ["\\section{A}\n\\end{document}\n\\section{No}", ["A"]],
  ])("handles %j", (body, expected) => {
    expect(latex(body)).toEqual(expected);
  });

  it.each([
    ["Introdu\\c{c}\\~ao e m\\'etodo", "Introdução e método"],
    ["\\textbf{Bold} and \\emph{soft}", "Bold and soft"],
    ["A \\& B\\_c 100\\%", "A & B_c 100%"],
    ["Results\\label{sec:r}\\footnote{note {x}}", "Results"],
    ["\\texorpdfstring{$E=mc^2$}{Energy}", "Energy"],
    ["The $\\alpha$~case --- two\\\\lines", "The α case — two lines"],
    ["Multi\n  line", "Multi line"],
    ["", "(untitled)"],
  ])("shows %j as %j", (title, expected) => {
    expect(latex(`\\section{${title}}`)).toEqual([expected]);
  });

  it("lists Beamer frames under their section", () => {
    const body = [
      "\\section{Talk}",
      "\\begin{frame}<1->[fragile]{First}",
      "\\end{frame}",
      "\\begin{frame}",
      "\\frametitle{Second}",
      "\\end{frame}",
    ].join("\n");
    expect(latex(body)).toEqual(["Talk", "  First", "  Second"]);
  });

  it("follows included files in document order", () => {
    const files = {
      "main.tex": [
        "\\section{A}",
        "\\input{sections/b}",
        "\\include{c.tex}",
        "\\subimport{parts/}{d}",
        "\\input{missing}",
        "\\section{E}",
      ].join("\n"),
      "sections/b.tex": "\\subsection{B}",
      "c.tex": "\\section{C}",
      "parts/d.tex": "\\section{D}",
    };
    expect(outline(files, "main.tex")).toEqual(["A", "  B", "C", "D", "E"]);
  });

  it("resolves includes relative to the entry folder", () => {
    const files = { "paper/main.tex": "\\input{intro}", "paper/intro.tex": "\\section{In}" };
    expect(outline(files, "paper/main.tex")).toEqual(["In"]);
  });

  it("stops at include cycles", () => {
    const files = { "main.tex": "\\section{A}\\input{b}", "b.tex": "\\section{B}\\input{main}" };
    expect(outline(files, "main.tex")).toEqual(["A", "B"]);
  });

  it("ignores paths that leave the project", () => {
    expect(latex("\\input{../../secret}\\section{A}")).toEqual(["A"]);
  });
});

describe("Typst outline", () => {
  it("nests headings by the number of equals signs", () => {
    const body = "= Intro\n== Task <t1>\n=== *Deep* _dive_\n= End\n#heading(level: 2)[Extra]";
    expect(typst(body)).toEqual(["Intro", "  Task", "    Deep dive", "End", "  Extra"]);
  });

  it.each([
    ["// = No", []],
    ["/* \n= No\n*/\n= Yes", ["Yes"]],
    ["```\n= No\n```\n= Yes", ["Yes"]],
    ['#let glob = "src/*.rs"\n= Yes', ["Yes"]],
    ["See https://typst.app\n= Yes // note", ["Yes"]],
    ["a = b\n=No space", []],
    ["= snake_case and #smallcaps[Caps]", ["snake_case and Caps"]],
  ])("handles %j", (body, expected) => {
    expect(typst(body)).toEqual(expected);
  });

  it("follows includes relative to the including file", () => {
    const files = {
      "main.typ": '= A\n#include "sections/b.typ"',
      "sections/b.typ": '== B\n#include "c.typ"\n#include "/root.typ"',
      "sections/c.typ": "== C",
      "root.typ": "= R",
    };
    expect(outline(files, "main.typ")).toEqual(["A", "  B", "  C", "R"]);
  });
});

describe("buildOutline", () => {
  const files = {
    "main.tex": "\\section{Main}\\input{part}",
    "part.tex": "\\subsection{Part}",
    "notes.tex": "\\section{Notes}",
    "refs.bib": "",
  };

  it.each(["part.tex", "refs.bib", "gone.tex"])("keeps the document outline for %s", (active) => {
    expect(outline(files, "main.tex", active)).toEqual(["Main", "  Part"]);
  });

  it("outlines a source that the document does not include", () => {
    expect(outline(files, "main.tex", "notes.tex")).toEqual(["Notes"]);
  });

  it.each([-1, 0, 1])("limits the number of headings (limit %i)", (delta) => {
    const count = MAX_OUTLINE_HEADINGS + delta;
    expect(latex("\\section{A}\n".repeat(count))).toHaveLength(
      Math.min(count, MAX_OUTLINE_HEADINGS),
    );
  });

  it("limits repeated file visits", () => {
    const found = outline(
      { "main.tex": "\\input{a}".repeat(MAX_OUTLINE_FILE_VISITS + 5), "a.tex": "\\section{A}" },
      "main.tex",
    );
    expect(found).toHaveLength(MAX_OUTLINE_FILE_VISITS - 1);
  });
});
