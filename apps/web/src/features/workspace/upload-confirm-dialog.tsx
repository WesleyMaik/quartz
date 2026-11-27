import { MAX_UPLOAD_FILE_BYTES, type SkipReason, type UploadPlan } from "@qrtz/document-core";
import { Button, Dialog, Icon } from "@qrtz/ui";
import { Alert02Icon, File01Icon, Folder01Icon } from "@qrtz/ui/icons";
import { useIntl } from "react-intl";
import { useFormat } from "../../app/use-format";

const PREVIEW_COUNT = 6;
/** Above this, the dialog reminds that everything is stored in this browser. */
const LARGE_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Confirms a folder or multi-item upload before any file is written. */
export function UploadConfirmDialog({
  plan,
  folder,
  onConfirm,
  onCancel,
}: {
  readonly plan: UploadPlan | undefined;
  readonly folder: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  const intl = useIntl();
  const format = useFormat();
  const skippedByReason = new Map<SkipReason, number>();
  for (const item of plan?.skipped ?? []) {
    skippedByReason.set(item.reason, (skippedByReason.get(item.reason) ?? 0) + 1);
  }
  const count = plan?.uploads.length ?? 0;

  return (
    <Dialog
      open={plan !== undefined}
      onOpenChange={(open) => !open && onCancel()}
      title={intl.formatMessage({ id: "upload.title" }, { count })}
      description={intl.formatMessage(
        { id: folder === "" ? "upload.description_root" : "upload.description_folder" },
        { size: format.bytes(plan?.totalBytes ?? 0), folder },
      )}
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>
            {intl.formatMessage({ id: "common.cancel" })}
          </Button>
          <Button onClick={onConfirm} disabled={count === 0}>
            {intl.formatMessage({ id: "upload.confirm" })}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {plan === undefined || plan.folders.length === 0 ? null : (
          <div className="flex flex-wrap gap-1.5">
            {plan.folders.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 font-medium text-secondary-foreground text-xs"
              >
                <Icon icon={Folder01Icon} size={13} /> {name}
              </span>
            ))}
          </div>
        )}
        <ul className="max-h-40 space-y-0.5 overflow-auto rounded-lg border bg-muted/40 p-2 text-xs">
          {plan?.uploads.slice(0, PREVIEW_COUNT).map((upload) => (
            <li key={upload.path} className="flex items-center gap-2 text-muted-foreground">
              <Icon icon={File01Icon} size={13} className="shrink-0" />
              <span className="truncate">{upload.path}</span>
              <span className="ml-auto shrink-0 tabular-nums">{format.bytes(upload.size)}</span>
            </li>
          ))}
          {count > PREVIEW_COUNT ? (
            <li className="pt-1 text-muted-foreground">
              {intl.formatMessage({ id: "upload.more" }, { count: count - PREVIEW_COUNT })}
            </li>
          ) : null}
        </ul>
        {skippedByReason.size === 0 ? null : (
          <p className="flex items-start gap-2 text-muted-foreground text-xs">
            <Icon icon={Alert02Icon} size={14} className="mt-px shrink-0 text-warning" />
            <span>
              {intl.formatMessage(
                { id: "upload.skipped" },
                {
                  items: intl.formatList(
                    [...skippedByReason].map(([reason, total]) =>
                      intl.formatMessage(
                        { id: `upload.skip.${reason}` },
                        { count: total, limit: format.bytes(MAX_UPLOAD_FILE_BYTES) },
                      ),
                    ),
                    { type: "unit" },
                  ),
                },
              )}
            </span>
          </p>
        )}
        {(plan?.totalBytes ?? 0) > LARGE_UPLOAD_BYTES ? (
          <p className="text-warning text-xs">
            {intl.formatMessage({ id: "upload.large_warning" })}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
