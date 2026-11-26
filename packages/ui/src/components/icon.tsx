import { HugeiconsIcon } from "@hugeicons/react";
import type { ComponentProps } from "react";

export type IconProps = ComponentProps<typeof HugeiconsIcon>;

/** HugeIcons wrapper with Quartz defaults. Icons come from `@qrtz/ui/icons`. */
export const Icon = ({ size = 16, strokeWidth = 1.75, ...props }: IconProps) => (
  <HugeiconsIcon size={size} strokeWidth={strokeWidth} {...props} />
);
