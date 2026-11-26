import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";

export interface SheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Accessible name; rendered visually only when `header` is not given. */
  readonly title: string;
  readonly header?: ReactNode;
  readonly children?: ReactNode;
  readonly className?: string;
}

/** Bottom sheet built on Base UI Dialog, used for mobile drawers. */
export function Sheet({ open, onOpenChange, title, header, children, className }: SheetProps) {
  return (
    <BaseDialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ease-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <BaseDialog.Popup
          className={cn(
            "fixed inset-x-2 bottom-2 z-50 flex max-h-[70dvh] flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl outline-none transition-transform duration-[400ms] ease-drawer data-[ending-style]:translate-y-[calc(100%+1rem)] data-[starting-style]:translate-y-[calc(100%+1rem)] data-[ending-style]:duration-200",
            className,
          )}
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
          {header === undefined ? (
            <BaseDialog.Title className="px-4 pt-3 pb-2 font-semibold">{title}</BaseDialog.Title>
          ) : (
            <>
              <BaseDialog.Title className="sr-only">{title}</BaseDialog.Title>
              {header}
            </>
          )}
          <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
