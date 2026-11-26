import type { FileEntry, FileId, Project, ProjectId } from "@qrtz/document-core";
import { Dexie, type EntityTable } from "dexie";

export type StoredContent =
  | { readonly fileId: FileId; readonly kind: "text"; readonly text: string }
  | { readonly fileId: FileId; readonly kind: "binary"; readonly bytes: Blob };

export interface WorkspaceStateRecord {
  readonly projectId: ProjectId;
  readonly openFiles: readonly string[];
  readonly activeFile: string | undefined;
  readonly layout: Readonly<Record<string, number>>;
}

/** IndexedDB schema v1. See docs/architecture/storage-architecture.md §3. */
export class QuartzDatabase extends Dexie {
  projects!: EntityTable<Project, "id">;
  files!: EntityTable<FileEntry, "id">;
  fileContents!: EntityTable<StoredContent, "fileId">;
  workspaceState!: EntityTable<WorkspaceStateRecord, "projectId">;

  constructor(name = "quartz") {
    super(name);
    this.version(1).stores({
      projects: "id, updatedAt",
      files: "id, projectId, &[projectId+path]",
      fileContents: "fileId",
      workspaceState: "projectId",
    });
  }
}
