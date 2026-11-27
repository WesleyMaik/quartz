import { Compartment, type Extension, Prec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

/** Editor options the user can change while files are open. */
export interface EditorPreferences {
  /** Font size in CSS pixels. */
  readonly fontSize: number;
  readonly lineWrapping: boolean;
  /** The browser's own spell checker, including its personal dictionary. */
  readonly spellCheck: boolean;
}

const compartment = new Compartment();

const extensionsFor = (preferences: EditorPreferences): Extension => [
  preferences.lineWrapping ? EditorView.lineWrapping : [],
  EditorView.contentAttributes.of({ spellcheck: String(preferences.spellCheck) }),
  // Above the base theme, which sets the default size.
  Prec.high(EditorView.theme({ "&": { fontSize: `${preferences.fontSize}px` } })),
];

export const preferencesExtension = (preferences: EditorPreferences): Extension =>
  compartment.of(extensionsFor(preferences));

/** Applies preferences to the state currently shown by `view`, keeping text and history. */
export function applyEditorPreferences(view: EditorView, preferences: EditorPreferences): void {
  view.dispatch({ effects: compartment.reconfigure(extensionsFor(preferences)) });
}
