import type { ComponentProps } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { cn } from "../lib/utils";

export const ResizableGroup = ({ className, ...props }: ComponentProps<typeof Group>) => (
  <Group className={cn("h-full w-full", className)} {...props} />
);

export const ResizablePanel = Panel;

export const ResizableHandle = ({ className, ...props }: ComponentProps<typeof Separator>) => (
  <Separator
    className={cn(
      "relative w-px bg-border transition-colors after:absolute after:inset-y-0 after:-left-1 after:w-2 data-[separator=active]:bg-primary data-[separator=hover]:bg-primary/60",
      className,
    )}
    {...props}
  />
);
