import { ContextMenu as BaseContextMenu } from "@base-ui/react/context-menu";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import type { ReactElement, ReactNode } from "react";
import { cn } from "../lib/utils";

export interface MenuAction {
  readonly id: string;
  readonly label: string;
  readonly onSelect: () => void;
  readonly destructive?: boolean;
  readonly disabled?: boolean;
}

const popupClass =
  "min-w-44 rounded-md border bg-background p-1 shadow-lg outline-none transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0";
const itemClass =
  "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-[13px] outline-none data-[highlighted]:bg-muted data-[disabled]:opacity-50";

function Items({ actions }: { readonly actions: readonly MenuAction[] }) {
  return actions.map((action) => (
    <BaseMenu.Item
      key={action.id}
      className={cn(itemClass, action.destructive === true && "text-destructive")}
      onClick={action.onSelect}
      disabled={action.disabled ?? false}
    >
      {action.label}
    </BaseMenu.Item>
  ));
}

/** Dropdown menu opened by `trigger` (a single element rendered by Base UI). */
export function DropdownMenu({
  trigger,
  actions,
}: {
  readonly trigger: ReactElement;
  readonly actions: readonly MenuAction[];
}) {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger render={trigger} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner sideOffset={4} align="end" className="z-50">
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
                className={cn(itemClass, action.destructive === true && "text-destructive")}
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
