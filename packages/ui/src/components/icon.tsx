import { HugeiconsIcon } from "@hugeicons/react";
import type { ComponentProps } from "react";
import { cn } from "../lib/utils";

export type IconProps = ComponentProps<typeof HugeiconsIcon>;

/**
 * HugeIcons wrapper with Quartz defaults. Icons come from `@qrtz/ui/icons`. They never shrink, so
 * a long label next to one cannot squeeze it.
 */
export const Icon = ({ size = 16, strokeWidth = 1.75, className, ...props }: IconProps) => (
  <HugeiconsIcon
    size={size}
    strokeWidth={strokeWidth}
    className={cn("shrink-0", className)}
    {...props}
  />
);
