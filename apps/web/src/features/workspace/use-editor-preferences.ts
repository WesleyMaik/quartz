import type { EditorPreferences } from "@qrtz/editor";
import type { MessageId } from "@qrtz/messages";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { EDITOR_FONT_SIZES, useSettings } from "../../app/settings";

/** CodeMirror's built-in strings (search, folding, diagnostics) and their messages. */
const EDITOR_PHRASES: Readonly<Record<string, MessageId>> = {
  Find: "editor.search.find",
  Replace: "editor.search.replace_field",
  next: "editor.search.next",
  previous: "editor.search.previous",
  all: "editor.search.all",
  "match case": "editor.search.match_case",
  regexp: "editor.search.regexp",
  "by word": "editor.search.by_word",
  replace: "editor.search.replace",
  "replace all": "editor.search.replace_all",
  close: "editor.search.close",
  "current match": "editor.search.current_match",
  "replaced $ matches": "editor.search.replaced_matches",
  "replaced match on line $": "editor.search.replaced_on_line",
  "on line": "editor.search.on_line",
  "Go to line": "editor.go_to_line",
  go: "editor.go",
  "Fold line": "editor.fold.line",
  "Unfold line": "editor.fold.unfold_line",
  "Folded lines": "editor.fold.folded_lines",
  "Unfolded lines": "editor.fold.unfolded_lines",
  "folded code": "editor.fold.folded_code",
  unfold: "editor.fold.unfold",
  to: "editor.fold.to",
  Diagnostics: "editor.diagnostics",
  "No diagnostics": "editor.no_diagnostics",
  Completions: "editor.completions",
  "Control character": "editor.control_character",
};

export function useEditorPreferences(): EditorPreferences {
  const intl = useIntl();
  const phrases = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(EDITOR_PHRASES).map(([phrase, id]) => [phrase, intl.formatMessage({ id })]),
      ),
    [intl],
  );
  const fontSize = useSettings((settings) => EDITOR_FONT_SIZES[settings.editorFontSize]);
  const lineWrapping = useSettings((settings) => settings.lineWrapping);
  const spellCheck = useSettings((settings) => settings.spellCheck);
  return useMemo(
    () => ({ fontSize, lineWrapping, spellCheck, phrases }),
    [fontSize, lineWrapping, spellCheck, phrases],
  );
}
