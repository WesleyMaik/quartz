import type { DetectionResult } from "@qrtz/document-core";
import { Button, cn, Dialog } from "@qrtz/ui";
import { useState } from "react";
import { useIntl } from "react-intl";

/** Asks which document an imported project compiles, when the archive does not make it obvious. */
export function MainDocumentDialog({
  candidates,
  busy,
  onCancel,
  onConfirm,
}: {
  readonly candidates: readonly DetectionResult[];
  readonly busy: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: (entry: string) => void;
}) {
  const [selected, setSelected] = useState(candidates[0]?.entry ?? "");
  const intl = useIntl();
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onCancel()}
      title={intl.formatMessage({ id: "main_document.title" })}
      description={intl.formatMessage({ id: "main_document.description" })}
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>
            {intl.formatMessage({ id: "common.cancel" })}
          </Button>
          <Button onClick={() => onConfirm(selected)} disabled={busy}>
            {intl.formatMessage({ id: "dashboard.import" })}
          </Button>
        </>
      }
    >
      <fieldset className="flex max-h-72 flex-col gap-1.5 overflow-auto p-1">
        <legend className="sr-only">{intl.formatMessage({ id: "main_document.legend" })}</legend>
        {candidates.map((candidate) => (
          <label
            key={candidate.entry}
            className={cn(
              "pressable flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 hover:bg-muted/50 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/30",
              candidate.entry === selected &&
                "border-primary bg-accent text-accent-foreground hover:bg-accent",
            )}
          >
            <input
              type="radio"
              name="main-document"
              value={candidate.entry}
              checked={candidate.entry === selected}
              onChange={() => setSelected(candidate.entry)}
              className="sr-only"
            />
            <span className="min-w-0 flex-1 truncate font-medium">{candidate.entry}</span>
            <span className="shrink-0 text-muted-foreground text-xs">
              {candidate.engine === "latex" ? "LaTeX" : "Typst"}
            </span>
          </label>
        ))}
      </fieldset>
    </Dialog>
  );
}
