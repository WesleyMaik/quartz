/**
 * The PDF.js viewer layer reads `globalThis.pdfjsLib` while it is being evaluated, so the core
 * library must be imported first. Import the viewer only from here to keep that order.
 */
import "./pdfjs";

export { EventBus, PDFLinkService, PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
