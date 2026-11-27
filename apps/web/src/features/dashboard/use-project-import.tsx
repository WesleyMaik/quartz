import type { Project } from "@qrtz/document-core";
import { toast } from "@qrtz/ui";
import { type ReactNode, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useServices } from "../../app/services";
import { useDescribeError } from "../../app/use-describe-error";
import type { ImportDraft } from "../../services/project-service";
import { MainDocumentDialog } from "./main-document-dialog";

export interface ProjectImport {
  /** Opens the file picker. */
  readonly pick: () => void;
  readonly busy: boolean;
  /** Hidden file input and the dialog; render once. */
  readonly elements: ReactNode;
}

export function useProjectImport(onImported: (project: Project) => void): ProjectImport {
  const { projects } = useServices();
  const intl = useIntl();
  const describeError = useDescribeError();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<ImportDraft | undefined>();

  const store = async (source: ImportDraft, entry: string) => {
    const main = source.candidates.find((candidate) => candidate.entry === entry);
    if (main === undefined) return;
    setBusy(true);
    const result = await projects.importProject(source, main);
    setBusy(false);
    if (!result.ok) {
      toast.error(describeError(result.error));
      return;
    }
    setDraft(undefined);
    const kept = source.contents.binaryFallbacks.length;
    if (kept > 0) {
      toast.warning(intl.formatMessage({ id: "import.binary_fallback" }, { count: kept }));
    }
    onImported(result.value);
  };

  const inspect = async (file: File) => {
    setBusy(true);
    const result = await projects.inspectArchive(file);
    setBusy(false);
    if (!result.ok) {
      toast.error(describeError(result.error));
      return;
    }
    const { suggested } = result.value;
    if (suggested === undefined) setDraft(result.value);
    else await store(result.value, suggested.entry);
  };

  return {
    pick: () => inputRef.current?.click(),
    busy,
    elements: (
      <>
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          aria-label={intl.formatMessage({ id: "import.input_label" })}
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Cleared so that picking the same file again triggers a new change event.
            event.target.value = "";
            if (file !== undefined) void inspect(file);
          }}
        />
        {draft === undefined ? null : (
          <MainDocumentDialog
            candidates={draft.candidates}
            busy={busy}
            onCancel={() => setDraft(undefined)}
            onConfirm={(entry) => void store(draft, entry)}
          />
        )}
      </>
    ),
  };
}
