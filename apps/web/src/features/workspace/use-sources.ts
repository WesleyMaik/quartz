import type { ProjectId, ProjectPath } from "@qrtz/document-core";
import { useLiveQuery } from "dexie-react-hooks";
import { useServices } from "../../app/services";

const SCANNED_FILE = /\.(tex|ltx|typ)$/i;

/** Saved text of the project's LaTeX and Typst files, refreshed on every save. */
export function useSources(projectId: ProjectId): ReadonlyMap<ProjectPath, string> | undefined {
  const { db } = useServices();
  return useLiveQuery(async () => {
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
}
