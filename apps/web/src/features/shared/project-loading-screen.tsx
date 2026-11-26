import { cn } from "@qrtz/ui";
import { useEffect, useState } from "react";

const LOGO_URL = `${import.meta.env.BASE_URL}quartz-logo-256x256.png`;

/** Progress approaches this value while loading; the last stretch only fills once ready. */
const PENDING_CEILING = 0.9;
/** Time constant (ms) of the approach curve: about 63% of the ceiling after this long. */
const APPROACH_MS = 650;
const FINISH_MS = 280;
const FADE_MS = 220;
/** Fast opens still show the fill briefly, so the screen reads as a transition, not a flash. */
const MIN_VISIBLE_MS = 650;

/**
 * Shared start time, so the route-level fallback and the workspace's own loader read as one
 * continuous fill instead of restarting when React swaps them.
 */
let loadStartedAt: number | undefined;

const pendingProgress = (): number => {
  loadStartedAt ??= performance.now();
  const elapsed = performance.now() - loadStartedAt;
  return PENDING_CEILING * (1 - Math.exp(-elapsed / APPROACH_MS));
};

/**
 * Full-screen loader shown while a project opens. The logo starts dim and a mask fills it from the
 * bottom up; the bar under it follows the same progress. Loading time is unknown, so progress
 * eases toward 90% and completes when `ready` turns true, then the screen fades out.
 */
export function ProjectLoadingScreen({
  ready = false,
  onFinished,
}: {
  readonly ready?: boolean;
  readonly onFinished?: () => void;
}) {
  const [progress, setProgress] = useState(pendingProgress);
  const [leaving, setLeaving] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const done = ready && minElapsed;

  useEffect(() => {
    const started = loadStartedAt ?? performance.now();
    const timer = setTimeout(
      () => setMinElapsed(true),
      Math.max(0, MIN_VISIBLE_MS - (performance.now() - started)),
    );
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (done) return;
    let frame = requestAnimationFrame(function tick() {
      setProgress(pendingProgress());
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [done]);

  useEffect(() => {
    if (!done) return;
    setProgress(1);
    loadStartedAt = undefined;
    const fade = setTimeout(() => setLeaving(true), FINISH_MS);
    const finished = setTimeout(() => onFinished?.(), FINISH_MS + FADE_MS);
    return () => {
      clearTimeout(fade);
      clearTimeout(finished);
    };
  }, [done, onFinished]);

  const percent = Math.round(progress * 100);
  // The final jump to 100% eases; per-frame updates while pending must not lag behind.
  const finishing = done ? `${FINISH_MS}ms` : "0ms";

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background transition-opacity ease-out",
        leaving && "opacity-0",
      )}
      style={{ transitionDuration: `${FADE_MS}ms` }}
      role="progressbar"
      aria-label="Opening project"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div className="relative size-16 select-none">
        {/* Glow lives behind the logo: a filter on the clipped image would be cut into a square. */}
        <div
          aria-hidden="true"
          className="absolute -inset-6 rounded-full bg-primary/30 blur-2xl transition-opacity ease-out"
          style={{ opacity: progress, transitionDuration: finishing }}
        />
        <img
          src={LOGO_URL}
          alt=""
          draggable={false}
          className="absolute inset-0 size-full object-contain opacity-20 grayscale"
        />
        <img
          src={LOGO_URL}
          alt=""
          draggable={false}
          className="absolute inset-0 size-full object-contain transition-[clip-path] ease-out"
          style={{
            clipPath: `inset(${100 - progress * 100}% 0 0 0)`,
            transitionDuration: finishing,
          }}
        />
      </div>
      <div className="h-1 w-60 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-linear-to-r from-violet-300 to-primary transition-[width] ease-out"
          style={{ width: `${percent}%`, transitionDuration: finishing }}
        />
      </div>
      <p className="text-muted-foreground text-xs">Opening project…</p>
    </div>
  );
}
