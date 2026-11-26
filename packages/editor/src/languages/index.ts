import { autocompletion } from "@codemirror/autocomplete";
import { StreamLanguage } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import type { Extension } from "@codemirror/state";
import { latexCompletions } from "./latex/completions";
import { typstMode } from "./typst/typst-mode";

export type EditorLanguage = "latex" | "typst" | "bibtex" | "plain";

const latexLanguage = StreamLanguage.define(stex);
const typstLanguage = StreamLanguage.define(typstMode);

/** Language extension bundle for a file. */
export function languageExtension(language: EditorLanguage): Extension {
  switch (language) {
    case "latex":
      return [latexLanguage, autocompletion({ override: [latexCompletions] })];
    case "typst":
      return [typstLanguage, autocompletion()];
    case "bibtex":
    case "plain":
      return [];
  }
}

export function languageForPath(path: string): EditorLanguage {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  if (ext === "tex" || ext === "sty" || ext === "cls" || ext === "ltx") return "latex";
  if (ext === "typ") return "typst";
  if (ext === "bib") return "bibtex";
  return "plain";
}
