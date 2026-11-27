import { documentStatistics, type Project, totalWords } from "@qrtz/document-core";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { useFormat } from "../../app/use-format";
import { describePageSize } from "../../lib/page-size";
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
  const intl = useIntl();
  const format = useFormat();
  const sources = useSources(project.id);
  const statistics = useMemo(
    () => (sources === undefined ? undefined : documentStatistics(sources, project.entry)),
    [sources, project.entry],
  );
  const build = compileState.lastPdf;

  const pageSize = ({ pageWidth, pageHeight }: PdfDetails): string => {
    const { paper, landscape, dimensions } = describePageSize(pageWidth, pageHeight);
    if (paper === undefined) return dimensions;
    const id = landscape ? "info.page_size.landscape" : "info.page_size.portrait";
    return intl.formatMessage({ id }, { paper, dimensions });
  };

  return (
    <div className="h-full space-y-6 overflow-auto p-4 md:p-5">
      {statistics === undefined ? null : (
        <div className="space-y-2">
          <StatGrid
            title={intl.formatMessage({ id: "info.summary" })}
            stats={[
              [intl.formatMessage({ id: "info.words" }), format.number(totalWords(statistics))],
              [
                intl.formatMessage({ id: "info.words_text" }),
                format.number(statistics.wordsInText),
              ],
              [
                intl.formatMessage({ id: "info.words_headings" }),
                format.number(statistics.wordsInHeadings),
              ],
              [
                intl.formatMessage({ id: "info.words_outside" }),
                format.number(statistics.wordsOutsideText),
              ],
              [intl.formatMessage({ id: "info.headings" }), format.number(statistics.headings)],
              [intl.formatMessage({ id: "info.figures" }), format.number(statistics.figures)],
              [
                intl.formatMessage({ id: "info.inline_math" }),
                format.number(statistics.inlineMath),
              ],
              [
                intl.formatMessage({ id: "info.display_math" }),
                format.number(statistics.displayMath),
              ],
            ]}
          />
          <p className="text-muted-foreground text-xs">
            {intl.formatMessage({ id: "info.estimate" })}
          </p>
        </div>
      )}
      {pdf === undefined || build === undefined ? (
        <p className="text-muted-foreground text-xs">
          {intl.formatMessage({ id: "info.after_build" })}
        </p>
      ) : (
        <StatGrid
          title="PDF"
          stats={[
            [intl.formatMessage({ id: "info.pages" }), format.number(pdf.pages)],
            [intl.formatMessage({ id: "info.file_size" }), format.bytes(build.bytes.byteLength)],
            [intl.formatMessage({ id: "info.page_size" }), pageSize(pdf)],
            [intl.formatMessage({ id: "info.pdf_version" }), pdf.version ?? "-"],
            [intl.formatMessage({ id: "info.producer" }), pdf.producer ?? "-"],
            [
              intl.formatMessage({ id: "info.compiler" }),
              project.compiler.engine === "typst"
                ? "Typst"
                : project.compiler.variant === "xelatex"
                  ? "XeLaTeX"
                  : "pdfLaTeX",
            ],
            [intl.formatMessage({ id: "info.built_at" }), format.time(build.builtAt)],
            [
              intl.formatMessage({ id: "info.build_time" }),
              compileState.durationMs === undefined
                ? "-"
                : intl.formatMessage(
                    { id: "info.duration" },
                    { duration: format.number(Math.round(compileState.durationMs)) },
                  ),
            ],
          ]}
        />
      )}
    </div>
  );
}
