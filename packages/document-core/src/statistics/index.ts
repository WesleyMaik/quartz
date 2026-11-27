import { documentFiles } from "../outline";
import type { ProjectPath } from "../paths";
import { countLatex } from "./latex";
import { type DocumentStatistics, emptyStatistics } from "./types";
import { countTypst } from "./typst";

export type { DocumentStatistics } from "./types";

/**
 * Statistics of the document compiled from `entry`, including the files it includes (each counted
 * once). Estimated from the sources: text produced by macros is not seen.
 */
export function documentStatistics(
  sources: ReadonlyMap<ProjectPath, string>,
  entry: ProjectPath,
): DocumentStatistics {
  const counts = emptyStatistics();
  for (const path of documentFiles(sources, entry)) {
    const count = /\.typ$/i.test(path) ? countTypst : countLatex;
    count(sources.get(path) ?? "", counts);
  }
  return counts;
}

export const totalWords = (statistics: DocumentStatistics): number =>
  statistics.wordsInText + statistics.wordsInHeadings + statistics.wordsOutsideText;
