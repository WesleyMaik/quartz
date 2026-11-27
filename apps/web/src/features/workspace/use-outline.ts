import {
  buildOutline,
  type OutlineNode,
  type ProjectId,
  type ProjectPath,
} from "@qrtz/document-core";
import { useMemo } from "react";
import { useSources } from "./use-sources";

const NO_HEADINGS: readonly OutlineNode[] = [];

/** Live heading tree of the project, refreshed whenever a source is saved. */
export function useOutline(
  projectId: ProjectId,
  entry: ProjectPath,
  activeFile: ProjectPath | undefined,
): readonly OutlineNode[] {
  const sources = useSources(projectId);
  return useMemo(
    () => (sources === undefined ? NO_HEADINGS : buildOutline(sources, entry, activeFile)),
    [sources, entry, activeFile],
  );
}
