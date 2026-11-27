import { Button, Icon } from "@qrtz/ui";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Download04Icon,
  File01Icon,
  MinusSignIcon,
  PlusSignIcon,
} from "@qrtz/ui/icons";
import { useEffect, useRef, useState } from "react";
import { downloadBlob } from "../../lib/download";
import { getDocument, type PDFDocumentLoadingTask } from "../../lib/pdfjs";
import { EventBus, PDFLinkService, PDFViewer } from "../../lib/pdfjs-viewer";

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;

export interface PdfPreviewProps {
  readonly bytes: Uint8Array | undefined;
  readonly fileName: string;
  /** Shown over the preview, for example "Showing last successful build". */
  readonly notice: string | undefined;
  readonly emptyMessage: string;
}

/**
 * PDF.js viewer with text layer (selection, search via Ctrl+F of the browser), zoom and page
 * navigation. Scripting and eval are disabled because compiled PDFs come from untrusted input.
 */
export function PdfPreview({ bytes, fileName, notice, emptyMessage }: PdfPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<PDFViewer | undefined>(undefined);
  /** PDF.js 6 releases a document through its loading task. */
  const taskRef = useRef<PDFDocumentLoadingTask | undefined>(undefined);
  const [page, setPage] = useState({ current: 0, total: 0 });
  const [scale, setScale] = useState<number | undefined>();

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    const eventBus = new EventBus();
    const linkService = new PDFLinkService({ eventBus, externalLinkTarget: 2 });
    const viewer = new PDFViewer({ container, eventBus, linkService, removePageBorders: true });
    linkService.setViewer(viewer);
    eventBus.on("pagechanging", (event: { pageNumber: number }) =>
      setPage((p) => ({ ...p, current: event.pageNumber })),
    );
    eventBus.on("scalechanging", (event: { scale: number }) => setScale(event.scale));
    eventBus.on("pagesinit", () => {
      setPage({ current: viewer.currentPageNumber, total: viewer.pagesCount });
    });
    viewerRef.current = viewer;
    return () => {
      viewerRef.current = undefined;
      void taskRef.current?.destroy();
      taskRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    const container = containerRef.current;
    if (viewer === undefined || container === null || bytes === undefined) return;
    let cancelled = false;
    // Copy: PDF.js transfers the buffer to its worker, and the caller keeps the original.
    // PDF.js 6 no longer evaluates code from PDFs; scripting stays off because no scripting manager is set.
    const task = getDocument({ data: bytes.slice(), enableXfa: false });
    void task.promise.then(
      (pdf) => {
        if (cancelled) {
          void task.destroy();
          return;
        }
        const previous = taskRef.current;
        const scrollTop = container.scrollTop;
        const keepScale = viewer.currentScaleValue || "page-width";
        const onInit = () => {
          viewer.currentScaleValue = keepScale;
          container.scrollTop = scrollTop;
          viewer.eventBus.off("pagesinit", onInit);
        };
        viewer.eventBus.on("pagesinit", onInit);
        viewer.setDocument(pdf);
        taskRef.current = task;
        void previous?.destroy();
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [bytes]);

  const zoom = (factor: number) => {
    const viewer = viewerRef.current;
    if (viewer === undefined) return;
    viewer.currentScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, viewer.currentScale * factor));
  };

  const go = (delta: number) => {
    const viewer = viewerRef.current;
    if (viewer === undefined || viewer.pagesCount === 0) return;
    viewer.currentPageNumber = Math.min(
      viewer.pagesCount,
      Math.max(1, viewer.currentPageNumber + delta),
    );
  };

  const download = () => {
    if (bytes === undefined) return;
    downloadBlob(new Blob([bytes.slice()], { type: "application/pdf" }), fileName);
  };

  return (
    <section className="flex h-full flex-col" aria-label="PDF preview">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3 text-xs">
        <span className="truncate font-medium text-sm">{fileName}</span>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={download} disabled={bytes === undefined}>
          <Icon icon={Download04Icon} size={14} /> Download
        </Button>
      </div>
      <div className="relative flex-1">
        <div ref={containerRef} className="quartz-pdf-container" data-testid="pdf-container">
          <div className="pdfViewer" />
        </div>
        {bytes === undefined ? (
          <div className="fade-in absolute inset-0 flex animate-in flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground duration-300">
            <span className="flex size-11 items-center justify-center rounded-xl border bg-card shadow-xs">
              <Icon icon={File01Icon} size={20} />
            </span>
            <p className="max-w-64">{emptyMessage}</p>
          </div>
        ) : null}
        {notice === undefined ? null : (
          <div className="fade-in slide-in-from-top-2 absolute top-3 left-1/2 -translate-x-1/2 animate-in rounded-full border border-warning/40 bg-popover/90 px-3 py-1 text-warning text-xs shadow-md backdrop-blur-sm duration-300">
            {notice}
          </div>
        )}
        {page.total === 0 ? null : (
          <div className="fade-in slide-in-from-bottom-3 absolute bottom-4 left-1/2 flex max-w-[calc(100%-1rem)] -translate-x-1/2 animate-in items-center gap-0.5 overflow-x-auto whitespace-nowrap rounded-full border bg-popover/90 p-1 text-xs shadow-lg backdrop-blur-md duration-300">
            <Button variant="ghost" size="icon" onClick={() => go(-1)} aria-label="Previous page">
              <Icon icon={ArrowLeft01Icon} size={14} />
            </Button>
            <span className="min-w-12 text-center tabular-nums" aria-live="polite">
              {page.current} / {page.total}
            </span>
            <Button variant="ghost" size="icon" onClick={() => go(1)} aria-label="Next page">
              <Icon icon={ArrowRight01Icon} size={14} />
            </Button>
            <div className="mx-1 h-4 w-px bg-border" />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => zoom(1 / 1.15)}
              aria-label="Zoom out"
            >
              <Icon icon={MinusSignIcon} size={14} />
            </Button>
            <span className="w-10 text-center tabular-nums">
              {scale === undefined ? "-" : `${Math.round(scale * 100)}%`}
            </span>
            <Button variant="ghost" size="icon" onClick={() => zoom(1.15)} aria-label="Zoom in">
              <Icon icon={PlusSignIcon} size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (viewerRef.current !== undefined)
                  viewerRef.current.currentScaleValue = "page-width";
              }}
            >
              Fit width
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
