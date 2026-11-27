import { useIntl } from "react-intl";
import { useSettings } from "../../app/settings";
import { ToggleRow } from "./settings-row";

export function PdfSettings() {
  const settings = useSettings();
  const intl = useIntl();
  return (
    <div className="divide-y">
      <ToggleRow
        title={intl.formatMessage({ id: "settings.pdf_dark.title" })}
        description={intl.formatMessage({ id: "settings.pdf_dark.description" })}
        checked={settings.pdfDarkMode}
        onChange={(pdfDarkMode) => settings.update({ pdfDarkMode })}
      />
      <ToggleRow
        title={intl.formatMessage({ id: "settings.pdf_zoom.title" })}
        description={intl.formatMessage({ id: "settings.pdf_zoom.description" })}
        checked={settings.pdfZoomShortcuts}
        onChange={(pdfZoomShortcuts) => settings.update({ pdfZoomShortcuts })}
      />
    </div>
  );
}
