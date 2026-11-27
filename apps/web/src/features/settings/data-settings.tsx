import { readStorageStatus, requestPersistentStorage, type StorageStatus } from "@qrtz/storage";
import { Button, toast } from "@qrtz/ui";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { useServices } from "../../app/services";
import { useDescribeError } from "../../app/use-describe-error";
import { useFormat } from "../../app/use-format";
import { downloadBlob } from "../../lib/download";
import { SettingsRow } from "./settings-row";

export function DataSettings() {
  const { projects } = useServices();
  const intl = useIntl();
  const format = useFormat();
  const describeError = useDescribeError();
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
    else toast.error(describeError(result.error));
  };

  const persist = async () => {
    const granted = await requestPersistentStorage();
    setStorage(await readStorageStatus());
    if (!granted) toast.message(intl.formatMessage({ id: "settings.persistent.denied" }));
  };

  return (
    <div className="divide-y">
      <SettingsRow
        title={intl.formatMessage({ id: "settings.export_all.title" })}
        description={intl.formatMessage({ id: "settings.export_all.description" })}
      >
        <Button size="sm" onClick={() => void exportAll()} disabled={exporting}>
          {intl.formatMessage({
            id: exporting ? "settings.export_all.busy" : "settings.export_all.action",
          })}
        </Button>
      </SettingsRow>
      <SettingsRow
        title={intl.formatMessage({ id: "settings.persistent.title" })}
        description={intl.formatMessage({
          id:
            storage?.persisted === true
              ? "settings.persistent.granted"
              : "settings.persistent.not_granted",
        })}
      >
        {storage?.persisted === false ? (
          <Button variant="outline" size="sm" onClick={() => void persist()}>
            {intl.formatMessage({ id: "settings.persistent.request" })}
          </Button>
        ) : null}
      </SettingsRow>
      <SettingsRow
        title={intl.formatMessage({ id: "settings.usage.title" })}
        description={intl.formatMessage({ id: "settings.usage.description" })}
      >
        <span className="text-xs tabular-nums">
          {storage?.usageBytes === undefined ? "-" : format.bytes(storage.usageBytes)}
        </span>
      </SettingsRow>
    </div>
  );
}
