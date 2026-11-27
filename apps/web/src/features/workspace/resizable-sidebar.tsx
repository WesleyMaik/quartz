import { cn, ResizeSeparator } from "@qrtz/ui";
import { type ReactNode, useState } from "react";
import { useIntl } from "react-intl";
import { useResizableSize } from "../../app/use-resizable-size";
import { useWindowWidth } from "../../app/use-window-width";

const DEFAULT_WIDTH = 232;
const MIN_WIDTH = 180;
const MAX_WIDTH = 480;
/** The sidebar never takes more than this share of the window from the editor and preview. */
const MAX_WINDOW_SHARE = 0.35;
/** Width of the gutter that holds the separator. */
const GUTTER_WIDTH = 8;

/** Collapsible desktop sidebar whose width the user can drag. */
export function ResizableSidebar({
  collapsed,
  children,
}: {
  readonly collapsed: boolean;
  readonly children: ReactNode;
}) {
  const intl = useIntl();
  const windowWidth = useWindowWidth();
  const limits = {
    min: MIN_WIDTH,
    max: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(windowWidth * MAX_WINDOW_SHARE))),
  };
  const { size, resize, reset } = useResizableSize(
    "quartz:workspace-sidebar-width",
    DEFAULT_WIDTH,
    limits,
  );
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className={cn(
        "flex shrink-0 overflow-hidden",
        // The collapse animation would make the width lag behind the pointer.
        !dragging && "transition-[width] duration-300 ease-out",
      )}
      style={{ width: collapsed ? GUTTER_WIDTH : size + GUTTER_WIDTH }}
      inert={collapsed}
    >
      <div
        className={cn(
          "h-full shrink-0 transition-[opacity,translate] duration-300 ease-out",
          collapsed && "-translate-x-6 opacity-0",
        )}
        style={{ width: size }}
      >
        {children}
      </div>
      {collapsed ? null : (
        <ResizeSeparator
          label={intl.formatMessage({ id: "sidebar.resize" })}
          edge="right"
          value={size}
          min={limits.min}
          max={limits.max}
          onResize={resize}
          onReset={reset}
          onDraggingChange={setDragging}
        />
      )}
    </div>
  );
}
