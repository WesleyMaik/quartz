import type { ProjectTemplate } from "./model";

const LATEX_MAIN = String.raw`\documentclass[11pt]{article}
\usepackage[utf8]{inputenc}
\usepackage{amsmath}
\usepackage{graphicx}

\title{A Quartz Article}
\author{Your Name}
\date{\today}

\begin{document}
\maketitle

\begin{abstract}
This document was created in Quartz, a local-first writing workspace.
\end{abstract}

\input{sections/introduction}

\section{Method}
Euler's identity is a good test of math rendering:
\begin{equation}
  e^{i\pi} + 1 = 0
  \label{eq:euler}
\end{equation}
Equation~\eqref{eq:euler} is referenced here.

\end{document}
`;

const LATEX_INTRO = String.raw`\section{Introduction}
Edit this file in Quartz and compile to see the PDF update.
`;

const TYPST_MAIN = `#set document(title: "A Quartz Article")
#set page(paper: "a4", margin: 2.5cm, numbering: "1")
#set text(size: 11pt)
#set heading(numbering: "1.")
#set math.equation(numbering: "(1)")

#align(center)[
  #text(18pt, weight: "bold")[A Quartz Article]

  Your Name
]

#include "sections/introduction.typ"

= Method
Euler's identity is a good test of math rendering:
$ e^(i pi) + 1 = 0 $ <euler>

As shown in @euler, the equation renders inline with references.
`;

const TYPST_INTRO = `= Introduction
Edit this file in Quartz and the preview recompiles as you type.
`;

export const PROJECT_TEMPLATES: readonly ProjectTemplate[] = [
  {
    id: "typst-article",
    label: "Typst article",
    engine: "typst",
    compiler: { engine: "typst" },
    entry: "main.typ",
    files: { "main.typ": TYPST_MAIN, "sections/introduction.typ": TYPST_INTRO },
  },
  {
    id: "latex-article",
    label: "LaTeX article",
    engine: "latex",
    compiler: { engine: "latex", variant: "pdflatex" },
    entry: "main.tex",
    files: { "main.tex": LATEX_MAIN, "sections/introduction.tex": LATEX_INTRO },
  },
  {
    id: "typst-empty",
    label: "Empty Typst",
    engine: "typst",
    compiler: { engine: "typst" },
    entry: "main.typ",
    files: { "main.typ": "= Untitled\n" },
  },
  {
    id: "latex-empty",
    label: "Empty LaTeX",
    engine: "latex",
    compiler: { engine: "latex", variant: "pdflatex" },
    entry: "main.tex",
    files: {
      "main.tex": "\\documentclass{article}\n\\begin{document}\nHello, Quartz.\n\\end{document}\n",
    },
  },
];

export const findTemplate = (id: string): ProjectTemplate | undefined =>
  PROJECT_TEMPLATES.find((template) => template.id === id);
