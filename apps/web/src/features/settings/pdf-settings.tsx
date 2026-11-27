import { useSettings } from "../../app/settings";
import { ToggleRow } from "./settings-row";

export function PdfSettings() {
  const settings = useSettings();
  return (
    <div className="divide-y">
      <ToggleRow
        title="Dark PDF pages"
        description="Invert page colors in the preview. The downloaded PDF does not change."
        checked={settings.pdfDarkMode}
        onChange={(pdfDarkMode) => settings.update({ pdfDarkMode })}
      />
      <ToggleRow
        title="PDF zoom shortcuts"
        description="In a project, Ctrl/Cmd with +, - or 0 zooms the preview instead of the browser."
        checked={settings.pdfZoomShortcuts}
        onChange={(pdfZoomShortcuts) => settings.update({ pdfZoomShortcuts })}
      />
    </div>
  );
}
