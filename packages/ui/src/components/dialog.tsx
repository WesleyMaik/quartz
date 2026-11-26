import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";

export interface DialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description?: string;
  readonly children?: ReactNode;
  readonly footer?: ReactNode;
  readonly className?: string;
}

/** Modal dialog built on Base UI. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: DialogProps) {
  return (
    <BaseDialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity duration-200 ease-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <BaseDialog.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover p-6 text-popover-foreground shadow-xl outline-none transition-[scale,opacity] duration-200 ease-out data-[ending-style]:scale-[0.96] data-[ending-style]:opacity-0 data-[ending-style]:duration-150 data-[starting-style]:scale-[0.96] data-[starting-style]:opacity-0",
            className,
          )}
        >
          <BaseDialog.Title className="font-semibold text-base tracking-tight">
            {title}
          </BaseDialog.Title>
          {description === undefined ? null : (
            <BaseDialog.Description className="mt-1 text-muted-foreground">
              {description}
            </BaseDialog.Description>
          )}
          {children === undefined ? null : <div className="mt-4">{children}</div>}
          {footer === undefined ? null : (
            <div className="mt-6 flex justify-end gap-2">{footer}</div>
          )}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
