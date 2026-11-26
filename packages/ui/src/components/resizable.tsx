import type { ComponentProps } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { cn } from "../lib/utils";

export const ResizableGroup = ({ className, ...props }: ComponentProps<typeof Group>) => (
  <Group className={cn("h-full w-full", className)} {...props} />
);

export const ResizablePanel = Panel;

/** Transparent gutter between floating panels; a pill grip appears on hover and while dragging. */
export const ResizableHandle = ({ className, ...props }: ComponentProps<typeof Separator>) => (
  <Separator
    className={cn(
      "group relative flex w-2 items-center justify-center outline-none",
      "after:h-8 after:w-1 after:rounded-full after:bg-transparent after:transition-[background-color,height] after:duration-200 after:ease-out",
      "data-[separator=hover]:after:h-12 data-[separator=hover]:after:bg-primary/50",
      "data-[separator=active]:after:h-16 data-[separator=active]:after:bg-primary",
      "focus-visible:after:bg-ring",
      className,
    )}
    {...props}
  />
);
