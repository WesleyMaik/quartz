import type { InputHTMLAttributes, Ref } from "react";
import { cn } from "../lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>;
}

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "h-8 w-full rounded-md border border-input bg-background px-2.5 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:border-ring aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}
