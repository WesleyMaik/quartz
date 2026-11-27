import type { EditorPreferences } from "@qrtz/editor";
import { useMemo } from "react";
import { EDITOR_FONT_SIZES, useSettings } from "../../app/settings";

export function useEditorPreferences(): EditorPreferences {
  const fontSize = useSettings((settings) => EDITOR_FONT_SIZES[settings.editorFontSize].pixels);
  const lineWrapping = useSettings((settings) => settings.lineWrapping);
  const spellCheck = useSettings((settings) => settings.spellCheck);
  return useMemo(
    () => ({ fontSize, lineWrapping, spellCheck }),
    [fontSize, lineWrapping, spellCheck],
  );
}
