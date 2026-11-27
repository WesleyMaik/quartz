/** The only entry point to PDF.js, so the worker is always configured before a document loads. */
import { GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export { getDocument, type PDFDocumentLoadingTask } from "pdfjs-dist";
