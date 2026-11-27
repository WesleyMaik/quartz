import { LOCALES, type LocalePreference } from "../../app/locale";
import { EDITOR_FONT_SIZES, type EditorFontSize, useSettings } from "../../app/settings";
import { type ThemePreference, useTheme } from "../../app/theme";
import { SelectRow, ToggleRow } from "./settings-row";

const THEMES: readonly { readonly id: ThemePreference; readonly label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

const LANGUAGES: readonly { readonly id: LocalePreference; readonly label: string }[] = [
  { id: "system", label: "System default" },
  ...LOCALES,
];

const FONT_SIZES = (Object.keys(EDITOR_FONT_SIZES) as EditorFontSize[]).map((id) => ({
  id,
  label: EDITOR_FONT_SIZES[id].label,
}));

export function EditorSettings() {
  const settings = useSettings();
  const { preference, setPreference } = useTheme();
  return (
    <div className="divide-y">
      <SelectRow
        title="Interface theme"
        description="Color scheme of the interface."
        value={preference}
        options={THEMES}
        onChange={setPreference}
      />
      <SelectRow
        title="Language"
        description="Only English is available for now. More languages are planned."
        value={settings.language}
        options={LANGUAGES}
        onChange={(language) => settings.update({ language })}
      />
      <SelectRow
        title="Font size"
        description="Size of the text in the editor."
        value={settings.editorFontSize}
        options={FONT_SIZES}
        onChange={(editorFontSize) => settings.update({ editorFontSize })}
      />
      <ToggleRow
        title="Automatic compilation"
        description="Compile while you type."
        checked={settings.autoCompile}
        onChange={(autoCompile) => settings.update({ autoCompile })}
      />
      <ToggleRow
        title="Line wrapping"
        description="Wrap long lines instead of scrolling sideways."
        checked={settings.lineWrapping}
        onChange={(lineWrapping) => settings.update({ lineWrapping })}
      />
      <ToggleRow
        title="Spell check"
        description="Underline mistakes with your browser's spell checker and personal dictionary."
        checked={settings.spellCheck}
        onChange={(spellCheck) => settings.update({ spellCheck })}
      />
    </div>
  );
}
