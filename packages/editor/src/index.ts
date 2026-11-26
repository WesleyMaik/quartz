export type { EditorState } from "@codemirror/state";
export {
  type CreateEditorStateOptions,
  createEditorState,
  type EditorDiagnostic,
  EditorView,
  revealLine,
  showDiagnostics,
} from "./create-editor";
export { type EditorLanguage, languageForPath } from "./languages";
