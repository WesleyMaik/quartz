import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";

const COMMANDS = [
  "section",
  "subsection",
  "subsubsection",
  "paragraph",
  "chapter",
  "label",
  "ref",
  "eqref",
  "cite",
  "textbf",
  "textit",
  "emph",
  "texttt",
  "includegraphics",
  "input",
  "include",
  "usepackage",
  "documentclass",
  "begin",
  "end",
  "frac",
  "sqrt",
  "sum",
  "int",
  "alpha",
  "beta",
  "gamma",
  "lambda",
  "maketitle",
  "tableofcontents",
  "footnote",
  "caption",
  "centering",
  "item",
];

const ENVIRONMENTS = [
  "document",
  "equation",
  "align",
  "figure",
  "table",
  "tabular",
  "itemize",
  "enumerate",
  "abstract",
  "center",
];

const commandOptions: Completion[] = COMMANDS.map((name) => ({
  label: `\\${name}`,
  type: "keyword",
}));
const environmentOptions: Completion[] = ENVIRONMENTS.map((name) => ({
  label: name,
  type: "type",
}));

/** Static LaTeX command and environment completion. Project-aware sources come later (labels, citations). */
export function latexCompletions(context: CompletionContext): CompletionResult | null {
  const environment = context.matchBefore(/\\(?:begin|end)\{\w*/);
  if (environment !== null) {
    return {
      from: environment.from + environment.text.indexOf("{") + 1,
      options: environmentOptions,
    };
  }
  const command = context.matchBefore(/\\\w*/);
  if (command === null || (command.from === command.to && !context.explicit)) return null;
  return { from: command.from, options: commandOptions, validFor: /^\\\w*$/ };
}
