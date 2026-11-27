import { LOCALE_IDS, LOCALE_NAMES } from "@qrtz/messages";
import { useIntl } from "react-intl";
import { EDITOR_FONT_SIZES, type EditorFontSize, useSettings } from "../../app/settings";
import { type ThemePreference, useTheme } from "../../app/theme";
import { SelectRow, ToggleRow } from "./settings-row";

const THEMES: readonly ThemePreference[] = ["system", "light", "dark"];
const FONT_SIZES = Object.keys(EDITOR_FONT_SIZES) as EditorFontSize[];

export function EditorSettings() {
  const settings = useSettings();
  const { preference, setPreference } = useTheme();
  const intl = useIntl();
  const themes = THEMES.map((id) => ({
    id,
    label: intl.formatMessage({ id: `settings.theme.${id}` }),
  }));
  const languages = [
    { id: "system" as const, label: intl.formatMessage({ id: "settings.language.system" }) },
    ...LOCALE_IDS.map((id) => ({ id, label: LOCALE_NAMES[id] })),
  ];
  const fontSizes = FONT_SIZES.map((id) => ({
    id,
    label: intl.formatMessage({ id: `settings.font_size.${id}` }),
  }));
  return (
    <div className="divide-y">
      <SelectRow
        title={intl.formatMessage({ id: "settings.theme.title" })}
        description={intl.formatMessage({ id: "settings.theme.description" })}
        value={preference}
        options={themes}
        onChange={setPreference}
      />
      <SelectRow
        title={intl.formatMessage({ id: "settings.language.title" })}
        description={intl.formatMessage({ id: "settings.language.description" })}
        value={settings.language}
        options={languages}
        onChange={(language) => settings.update({ language })}
      />
      <SelectRow
        title={intl.formatMessage({ id: "settings.font_size.title" })}
        description={intl.formatMessage({ id: "settings.font_size.description" })}
        value={settings.editorFontSize}
        options={fontSizes}
        onChange={(editorFontSize) => settings.update({ editorFontSize })}
      />
      <ToggleRow
        title={intl.formatMessage({ id: "settings.auto_compile.title" })}
        description={intl.formatMessage({ id: "settings.auto_compile.description" })}
        checked={settings.autoCompile}
        onChange={(autoCompile) => settings.update({ autoCompile })}
      />
      <ToggleRow
        title={intl.formatMessage({ id: "settings.line_wrapping.title" })}
        description={intl.formatMessage({ id: "settings.line_wrapping.description" })}
        checked={settings.lineWrapping}
        onChange={(lineWrapping) => settings.update({ lineWrapping })}
      />
      <ToggleRow
        title={intl.formatMessage({ id: "settings.spell_check.title" })}
        description={intl.formatMessage({ id: "settings.spell_check.description" })}
        checked={settings.spellCheck}
        onChange={(spellCheck) => settings.update({ spellCheck })}
      />
    </div>
  );
}
