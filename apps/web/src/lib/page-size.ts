const MILLIMETRES_PER_POINT = 25.4 / 72;
/** Rounding differences between engines stay within this margin. */
const TOLERANCE_MM = 1.5;

const PAPERS: readonly (readonly [name: string, width: number, height: number])[] = [
  ["A3", 297, 420],
  ["A4", 210, 297],
  ["A5", 148, 210],
  ["Letter", 215.9, 279.4],
  ["Legal", 215.9, 355.6],
];

const matches = (a: number, b: number): boolean => Math.abs(a - b) <= TOLERANCE_MM;

export interface PageSize {
  /** For example "210 × 297 mm". */
  readonly dimensions: string;
  /** Standard paper name, when the page matches one. */
  readonly paper: string | undefined;
  readonly landscape: boolean;
}

/** Describes a page given in PDF points; the interface words the result. */
export function describePageSize(widthPoints: number, heightPoints: number): PageSize {
  const width = widthPoints * MILLIMETRES_PER_POINT;
  const height = heightPoints * MILLIMETRES_PER_POINT;
  const dimensions = `${Math.round(width)} × ${Math.round(height)} mm`;
  for (const [paper, short, long] of PAPERS) {
    if (matches(width, short) && matches(height, long)) {
      return { dimensions, paper, landscape: false };
    }
    if (matches(width, long) && matches(height, short)) {
      return { dimensions, paper, landscape: true };
    }
  }
  return { dimensions, paper: undefined, landscape: false };
}
