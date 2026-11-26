import { closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, foldGutter, foldKeymap, indentOnInput } from "@codemirror/language";
import { type Diagnostic, lintGutter, setDiagnostics } from "@codemirror/lint";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorState, type Extension } from "@codemirror/state";
import {
  crosshairCursor,
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view";
import { type EditorLanguage, languageExtension } from "./languages";
import { quartzTheme } from "./theme";

export interface EditorDiagnostic {
  readonly severity: "error" | "warning" | "info";
  readonly message: string;
  /** 1-based line. */
  readonly line: number;
  readonly column?: number;
}

export interface CreateEditorStateOptions {
  readonly doc: string;
  readonly language: EditorLanguage;
  readonly onDocChange: (doc: string) => void;
  readonly extraKeys?: Parameters<typeof keymap.of>[0];
}

const baseExtensions: Extension = [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  history(),
  foldGutter(),
  drawSelection(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  bracketMatching(),
  closeBrackets(),
  rectangularSelection(),
  crosshairCursor(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  lintGutter(),
  EditorView.lineWrapping,
  quartzTheme,
];

/** Builds an EditorState per open file. Each tab keeps its own state (undo history, selection). */
export function createEditorState(options: CreateEditorStateOptions): EditorState {
  return EditorState.create({
    doc: options.doc,
    extensions: [
      baseExtensions,
      languageExtension(options.language),
      keymap.of([
        ...(options.extraKeys ?? []),
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        indentWithTab,
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) options.onDocChange(update.state.doc.toString());
      }),
    ],
  });
}

/** Shows compiler diagnostics in the gutter and as underlines. Out-of-range lines are clamped. */
export function showDiagnostics(view: EditorView, diagnostics: readonly EditorDiagnostic[]): void {
  const doc = view.state.doc;
  const mapped: Diagnostic[] = diagnostics.map((diagnostic) => {
    const line = doc.line(Math.min(Math.max(diagnostic.line, 1), doc.lines));
    const from = Math.min(line.from + Math.max((diagnostic.column ?? 1) - 1, 0), line.to);
    return { from, to: line.to, severity: diagnostic.severity, message: diagnostic.message };
  });
  view.dispatch(setDiagnostics(view.state, mapped));
}

export function revealLine(view: EditorView, lineNumber: number): void {
  const line = view.state.doc.line(Math.min(Math.max(lineNumber, 1), view.state.doc.lines));
  view.dispatch({
    selection: { anchor: line.from },
    effects: EditorView.scrollIntoView(line.from, { y: "center" }),
  });
  view.focus();
}

export { EditorView };
