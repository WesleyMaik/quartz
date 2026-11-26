import { Switch as BaseSwitch } from "@base-ui/react/switch";
import type { ComponentProps } from "react";
import { cn } from "../lib/utils";

export type SwitchProps = ComponentProps<typeof BaseSwitch.Root>;

/** Toggle switch built on Base UI; the thumb slides with a strong ease-out. */
export function Switch({ className, ...props }: SwitchProps) {
  return (
    <BaseSwitch.Root
      className={cn(
        "relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full bg-input p-0.5 transition-colors duration-200 ease-out data-[checked]:bg-primary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <BaseSwitch.Thumb className="size-3 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out data-[checked]:translate-x-3" />
    </BaseSwitch.Root>
  );
}
