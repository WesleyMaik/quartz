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

/** Small image of a project's first compiled page. Derived data: safe to drop and rebuild. */
export interface ThumbnailRecord {
  readonly projectId: ProjectId;
  readonly image: Blob;
  /** Identifies the build the image came from, so unchanged sources are not rendered again. */
  readonly sourceKey: string;
}

/** IndexedDB schema. See docs/architecture/storage-architecture.md §3. */
export class QuartzDatabase extends Dexie {
  projects!: EntityTable<Project, "id">;
  files!: EntityTable<FileEntry, "id">;
  fileContents!: EntityTable<StoredContent, "fileId">;
  workspaceState!: EntityTable<WorkspaceStateRecord, "projectId">;
  thumbnails!: EntityTable<ThumbnailRecord, "projectId">;

  constructor(name = "quartz") {
    super(name);
    this.version(1).stores({
      projects: "id, updatedAt",
      files: "id, projectId, &[projectId+path]",
      fileContents: "fileId",
      workspaceState: "projectId",
    });
    this.version(2).stores({ thumbnails: "projectId" });
  }
}
