import { ContextMenu as BaseContextMenu } from "@base-ui/react/context-menu";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import type { ReactElement, ReactNode } from "react";
import { Tick02Icon } from "../icons";
import { cn } from "../lib/utils";
import { Icon } from "./icon";

export interface MenuAction {
  readonly id: string;
  readonly label: string;
  readonly onSelect: () => void;
  readonly destructive?: boolean;
  readonly disabled?: boolean;
  /** Marks the current choice in a menu that picks one value. */
  readonly selected?: boolean;
}

const popupClass =
  "min-w-44 origin-[var(--transform-origin)] rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg outline-none transition-[scale,opacity] duration-150 ease-out data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0";
const itemClass =
  "flex cursor-default select-none items-center rounded-md px-2.5 py-1.5 text-[13px] outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-muted";

function Items({ actions }: { readonly actions: readonly MenuAction[] }) {
  return actions.map((action) => (
    <BaseMenu.Item
      key={action.id}
      className={cn(
        itemClass,
        action.destructive === true && "text-destructive data-[highlighted]:bg-destructive/10",
      )}
      onClick={action.onSelect}
      disabled={action.disabled ?? false}
      aria-current={action.selected === true ? "true" : undefined}
    >
      {action.label}
      {action.selected === true ? (
        <Icon icon={Tick02Icon} size={14} className="ml-auto pl-3 box-content" />
      ) : null}
    </BaseMenu.Item>
  ));
}

/** Dropdown menu opened by `trigger` (a single element rendered by Base UI). */
export function DropdownMenu({
  trigger,
  actions,
  align = "end",
}: {
  readonly trigger: ReactElement;
  readonly actions: readonly MenuAction[];
  readonly align?: "start" | "center" | "end";
}) {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger render={trigger} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner sideOffset={4} align={align} className="z-50">
          <BaseMenu.Popup className={popupClass}>
            <Items actions={actions} />
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}

/** Right-click menu around `children`. */
export function ContextMenu({
  children,
  actions,
}: {
  readonly children: ReactNode;
  readonly actions: readonly MenuAction[];
}) {
  return (
    <BaseContextMenu.Root>
      <BaseContextMenu.Trigger className="contents">{children}</BaseContextMenu.Trigger>
      <BaseContextMenu.Portal>
        <BaseContextMenu.Positioner className="z-50">
          <BaseContextMenu.Popup className={popupClass}>
            {actions.map((action) => (
              <BaseContextMenu.Item
                key={action.id}
                className={cn(
                  itemClass,
                  action.destructive === true &&
                    "text-destructive data-[highlighted]:bg-destructive/10",
                )}
                onClick={action.onSelect}
                disabled={action.disabled ?? false}
              >
                {action.label}
              </BaseContextMenu.Item>
            ))}
          </BaseContextMenu.Popup>
        </BaseContextMenu.Positioner>
      </BaseContextMenu.Portal>
    </BaseContextMenu.Root>
  );
}
