import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";
import { cn } from "../lib/utils";

const KEYBOARD_STEP = 16;

export interface ResizeSeparatorProps {
  readonly label: string;
  /**
   * Edge of the resized element that the separator sits on. "right" resizes a width and grows to
   * the right; "top" resizes a height and grows upwards.
   */
  readonly edge: "right" | "top";
  /** Current size in pixels. */
  readonly value: number;
  readonly min: number;
  readonly max: number;
  /** Receives unclamped sizes; the owner applies the limits. */
  readonly onResize: (size: number) => void;
  /** Double click restores the default size. */
  readonly onReset: () => void;
  readonly onDraggingChange?: (dragging: boolean) => void;
  readonly className?: string;
}

/**
 * Drag handle for an element with a pixel size, for layouts that percentage-based panel groups do
 * not fit. Works with pointer, touch and keyboard (arrows, Home, End).
 */
export function ResizeSeparator({
  label,
  edge,
  value,
  min,
  max,
  onResize,
  onReset,
  onDraggingChange,
  className,
}: ResizeSeparatorProps) {
  const start = useRef<{ position: number; size: number } | undefined>(undefined);
  const [dragging, setDragging] = useState(false);
  const horizontal = edge === "right";

  const setDrag = (next: boolean) => {
    setDragging(next);
    onDraggingChange?.(next);
  };
  const positionOf = (event: PointerEvent) => (horizontal ? event.clientX : -event.clientY);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    // Prevents text selection while dragging.
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = { position: positionOf(event), size: value };
    setDrag(true);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (start.current === undefined) return;
    onResize(start.current.size + positionOf(event) - start.current.position);
  };

  const stop = () => {
    if (start.current === undefined) return;
    start.current = undefined;
    setDrag(false);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const sizes: Readonly<Record<string, number>> = {
      [horizontal ? "ArrowRight" : "ArrowUp"]: value + KEYBOARD_STEP,
      [horizontal ? "ArrowLeft" : "ArrowDown"]: value - KEYBOARD_STEP,
      Home: min,
      End: max,
    };
    const next = sizes[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onResize(next);
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: an <hr> cannot be an interactive window splitter.
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={horizontal ? "vertical" : "horizontal"}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      data-dragging={dragging || undefined}
      className={cn(
        "group/resize relative flex shrink-0 touch-none select-none items-center justify-center outline-none",
        "after:rounded-full after:bg-transparent after:transition-[background-color] after:duration-200 after:ease-out",
        "hover:after:bg-primary/50 focus-visible:after:bg-ring data-[dragging]:after:bg-primary",
        horizontal
          ? "w-2 cursor-col-resize after:h-12 after:w-1"
          : "h-2 cursor-row-resize after:h-1 after:w-12",
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onKeyDown={onKeyDown}
      onDoubleClick={onReset}
    />
  );
}
