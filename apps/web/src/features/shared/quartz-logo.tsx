import { cn } from "@qrtz/ui";

/** Respects the configured base path, so the logo also loads under sub-path hosting. */
const LOGO_URL = `${import.meta.env.BASE_URL}quartz-logo-256x256.png`;

/** Quartz crystal logo. Decorative by default: pair it with visible text or an accessible label. */
export function QuartzLogo({
  size = 24,
  className,
}: {
  readonly size?: number;
  readonly className?: string;
}) {
  return (
    <img
      src={LOGO_URL}
      alt=""
      width={size}
      height={size}
      draggable={false}
      className={cn("shrink-0 select-none object-contain", className)}
    />
  );
}
