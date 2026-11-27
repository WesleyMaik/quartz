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

/** Describes a page given in PDF points, for example "A4 (210 × 297 mm)". */
export function formatPageSize(widthPoints: number, heightPoints: number): string {
  const width = widthPoints * MILLIMETRES_PER_POINT;
  const height = heightPoints * MILLIMETRES_PER_POINT;
  const dimensions = `${Math.round(width)} × ${Math.round(height)} mm`;
  for (const [name, short, long] of PAPERS) {
    if (matches(width, short) && matches(height, long)) return `${name} (${dimensions})`;
    if (matches(width, long) && matches(height, short)) {
      return `${name} landscape (${dimensions})`;
    }
  }
  return dimensions;
}
