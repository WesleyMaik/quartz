import {
  buildOutline,
  type OutlineNode,
  type ProjectId,
  type ProjectPath,
} from "@qrtz/document-core";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { useServices } from "../../app/services";

const SCANNED_FILE = /\.(tex|ltx|typ)$/i;
const NO_HEADINGS: readonly OutlineNode[] = [];

/** Live heading tree of the project, refreshed whenever a source is saved. */
export function useOutline(
  projectId: ProjectId,
  entry: ProjectPath,
  activeFile: ProjectPath | undefined,
): readonly OutlineNode[] {
  const { db } = useServices();
  const sources = useLiveQuery(async () => {
    const files = await db.files
      .where("projectId")
      .equals(projectId)
      .filter((file) => SCANNED_FILE.test(file.path))
      .toArray();
    const contents = await db.fileContents.bulkGet(files.map((file) => file.id));
    return new Map(
      files.flatMap((file, index) => {
        const content = contents[index];
        return content?.kind === "text" ? [[file.path, content.text] as const] : [];
      }),
    );
  }, [db, projectId]);

  return useMemo(
    () => (sources === undefined ? NO_HEADINGS : buildOutline(sources, entry, activeFile)),
    [sources, entry, activeFile],
  );
}
