/** Large enough to stay sharp in a dashboard card, small enough to weigh a few kilobytes. */
const THUMBNAIL_WIDTH = 240;
/** Caps unusually tall pages. */
const MAX_HEIGHT_RATIO = 2;
/** Rendering larger and scaling down keeps small text smooth. */
const SUPERSAMPLING = 2;
const QUALITY = 0.7;

const createCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const encode = (canvas: HTMLCanvasElement, type: string): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));

/** Renders the first page of a PDF into a small WebP image, or JPEG where WebP is unavailable. */
export async function renderThumbnail(pdf: Uint8Array): Promise<Blob> {
  // Loaded on demand: PDF.js stays out of the dashboard bundle.
  const { getDocument } = await import("../lib/pdfjs");
  // Copy: PDF.js transfers the buffer to its worker, and the preview keeps using the original.
  const task = getDocument({ data: pdf.slice(), enableXfa: false });
  try {
    const page = await (await task.promise).getPage(1);
    const natural = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({
      scale: (THUMBNAIL_WIDTH * SUPERSAMPLING) / natural.width,
    });
    const source = createCanvas(
      Math.round(viewport.width),
      Math.round(Math.min(viewport.height, viewport.width * MAX_HEIGHT_RATIO)),
    );
    // The print intent does not wait for animation frames, which background tabs never deliver.
    await page.render({ canvas: source, viewport, intent: "print" }).promise;

    const target = createCanvas(THUMBNAIL_WIDTH, Math.round(source.height / SUPERSAMPLING));
    const context = target.getContext("2d");
    if (context === null) throw new Error("Canvas 2D context is unavailable.");
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, target.width, target.height);

    const webp = await encode(target, "image/webp");
    const image = webp?.type === "image/webp" ? webp : await encode(target, "image/jpeg");
    if (image === null) throw new Error("Could not encode the thumbnail.");
    return image;
  } finally {
    await task.destroy();
  }
}
