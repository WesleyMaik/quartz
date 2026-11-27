import { readStorageStatus, requestPersistentStorage, type StorageStatus } from "@qrtz/storage";
import { Button, toast } from "@qrtz/ui";
import { useEffect, useState } from "react";
import { useServices } from "../../app/services";
import { downloadBlob } from "../../lib/download";
import { formatBytes } from "../../lib/format";
import { SettingsRow } from "./settings-row";

export function DataSettings() {
  const { projects } = useServices();
  const [exporting, setExporting] = useState(false);
  const [storage, setStorage] = useState<StorageStatus | undefined>();

  useEffect(() => {
    void readStorageStatus().then(setStorage);
  }, []);

  const exportAll = async () => {
    setExporting(true);
    const result = await projects.exportAll();
    setExporting(false);
    if (result.ok) downloadBlob(result.value.blob, result.value.fileName);
    else toast.error(result.error.message);
  };

  const persist = async () => {
    const granted = await requestPersistentStorage();
    setStorage(await readStorageStatus());
    if (!granted) toast.message("The browser did not grant persistent storage.");
  };

  return (
    <div className="divide-y">
      <SettingsRow
        title="Export all projects"
        description="One ZIP with a separate ZIP for each project, ready to import again."
      >
        <Button size="sm" onClick={() => void exportAll()} disabled={exporting}>
          {exporting ? "Exporting…" : "Download ZIP"}
        </Button>
      </SettingsRow>
      <SettingsRow
        title="Persistent storage"
        description={
          storage?.persisted === true
            ? "Granted: the browser will not clear your projects on its own."
            : "The browser may clear projects when space runs low."
        }
      >
        {storage?.persisted === false ? (
          <Button variant="outline" size="sm" onClick={() => void persist()}>
            Request
          </Button>
        ) : null}
      </SettingsRow>
      <SettingsRow
        title="Storage used"
        description="Projects stay in this browser. Clearing site data deletes them."
      >
        <span className="text-xs tabular-nums">
          {storage?.usageBytes === undefined ? "-" : formatBytes(storage.usageBytes)}
        </span>
      </SettingsRow>
    </div>
  );
}
