/** Counts estimated from source files, in the spirit of `texcount`. */
export interface DocumentStatistics {
  readonly wordsInText: number;
  readonly wordsInHeadings: number;
  /** Words of captions and footnotes. */
  readonly wordsOutsideText: number;
  readonly headings: number;
  readonly figures: number;
  readonly inlineMath: number;
  readonly displayMath: number;
}

export type MutableStatistics = { -readonly [Key in keyof DocumentStatistics]: number };

export const emptyStatistics = (): MutableStatistics => ({
  wordsInText: 0,
  wordsInHeadings: 0,
  wordsOutsideText: 0,
  headings: 0,
  figures: 0,
  inlineMath: 0,
  displayMath: 0,
});

/** Runs of letters and digits; inner apostrophes, hyphens, dots and commas do not split them. */
const WORD = /[\p{L}\p{M}\p{N}]+(?:['’\-.,][\p{L}\p{M}\p{N}]+)*/gu;

export const countWords = (text: string): number => text.match(WORD)?.length ?? 0;
