import { documentStatistics, type Project, totalWords } from "@qrtz/document-core";
import { useMemo } from "react";
import { formatBytes, formatTime } from "../../lib/format";
import { formatPageSize } from "../../lib/page-size";
import type { CompileState } from "../../services/compile-service";
import { useSources } from "../workspace/use-sources";

/** What PDF.js reports about the document on screen. */
export interface PdfDetails {
  readonly pages: number;
  /** Size of the first page, in PDF points. */
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly version: string | undefined;
  readonly producer: string | undefined;
}

type Stat = readonly [label: string, value: string | number];

function StatGrid({ title, stats }: { readonly title: string; readonly stats: readonly Stat[] }) {
  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-base tracking-tight">{title}</h2>
      <dl className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
        {stats.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-2 rounded-lg border bg-background p-3.5">
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="mt-auto break-words text-lg tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Summary of the sources and technical facts about the compiled PDF. */
export function DocumentInfo({
  project,
  compileState,
  pdf,
}: {
  readonly project: Project;
  readonly compileState: CompileState;
  readonly pdf: PdfDetails | undefined;
}) {
  const sources = useSources(project.id);
  const statistics = useMemo(
    () => (sources === undefined ? undefined : documentStatistics(sources, project.entry)),
    [sources, project.entry],
  );
  const build = compileState.lastPdf;

  return (
    <div className="h-full space-y-6 overflow-auto p-4 md:p-5">
      {statistics === undefined ? null : (
        <div className="space-y-2">
          <StatGrid
            title="Summary"
            stats={[
              ["Words", totalWords(statistics)],
              ["Words in text", statistics.wordsInText],
              ["Words in headings", statistics.wordsInHeadings],
              ["Words outside text", statistics.wordsOutsideText],
              ["Headings", statistics.headings],
              ["Figures", statistics.figures],
              ["Inline formulas", statistics.inlineMath],
              ["Displayed formulas", statistics.displayMath],
            ]}
          />
          <p className="text-muted-foreground text-xs">
            Estimated from the saved source files. Captions and footnotes count as outside text.
          </p>
        </div>
      )}
      {pdf === undefined || build === undefined ? (
        <p className="text-muted-foreground text-xs">
          PDF details appear after a successful build.
        </p>
      ) : (
        <StatGrid
          title="PDF"
          stats={[
            ["Pages", pdf.pages],
            ["File size", formatBytes(build.bytes.byteLength)],
            ["Page size", formatPageSize(pdf.pageWidth, pdf.pageHeight)],
            ["PDF version", pdf.version ?? "-"],
            ["Producer", pdf.producer ?? "-"],
            [
              "Compiler",
              project.compiler.engine === "typst"
                ? "Typst"
                : project.compiler.variant === "xelatex"
                  ? "XeLaTeX"
                  : "pdfLaTeX",
            ],
            ["Built at", formatTime(build.builtAt)],
            [
              "Last build time",
              compileState.durationMs === undefined
                ? "-"
                : `${Math.round(compileState.durationMs)} ms`,
            ],
          ]}
        />
      )}
    </div>
  );
}
