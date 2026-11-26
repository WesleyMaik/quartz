import type { HTMLAttributes } from "react";
import { cn } from "../lib/utils";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-medium text-[11px] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
