export interface SizeLimits {
  readonly min: number;
  readonly max: number;
}

/**
 * Rounds `size` into the limits. When the available space makes `max` smaller than `min`, the
 * minimum wins so the element stays usable.
 */
export const clampSize = (size: number, { min, max }: SizeLimits): number =>
  Math.round(Math.max(min, Math.min(size, max)));
