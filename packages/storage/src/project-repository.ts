import {
  err,
  type FileEntry,
  inferFileKind,
  type NewFile,
  newFileId,
  newProjectId,
  ok,
  type Project,
  type ProjectId,
  type ProjectPath,
  type QuartzError,
  quartzError,
  type Result,
} from "@qrtz/document-core";
import type { QuartzDatabase, StoredContent } from "./database";
import { toStorageError } from "./errors";

export type NewProject = Omit<Project, "id" | "createdAt" | "updatedAt">;

const contentSize = (file: NewFile): number =>
  file.content.kind === "text"
    ? new TextEncoder().encode(file.content.text).length
    : file.content.bytes.size;

export class ProjectRepository {
  constructor(private readonly db: QuartzDatabase) {}

  list(): Promise<Project[]> {
    return this.db.projects.orderBy("updatedAt").reverse().toArray();
  }

  /** Total stored bytes per project, summed from file metadata without reading contents. */
  async sizes(): Promise<ReadonlyMap<ProjectId, number>> {
    const totals = new Map<ProjectId, number>();
    await this.db.files.each((file) => {
      totals.set(file.projectId, (totals.get(file.projectId) ?? 0) + file.size);
    });
    return totals;
  }

  get(id: ProjectId): Promise<Project | undefined> {
    return this.db.projects.get(id);
  }

  /** Creates a project with its files and folder entries in one transaction. */
  async create(
    input: NewProject,
    files: readonly NewFile[],
    folders: readonly ProjectPath[] = [],
  ): Promise<Result<Project, QuartzError>> {
    const now = new Date().toISOString();
    const project: Project = { ...input, id: newProjectId(), createdAt: now, updatedAt: now };
    const entries: FileEntry[] = [];
    const contents: StoredContent[] = [];
    for (const file of files) {
      const id = newFileId();
      entries.push({
        id,
        projectId: project.id,
        path: file.path,
        kind: inferFileKind(file.path),
        size: contentSize(file),
        revision: 1,
        updatedAt: now,
      });
      contents.push(
        file.content.kind === "text"
          ? { fileId: id, kind: "text", text: file.content.text }
          : { fileId: id, kind: "binary", bytes: file.content.bytes },
      );
    }
    for (const path of folders) {
      entries.push({
        id: newFileId(),
        projectId: project.id,
        path,
        kind: "folder",
        size: 0,
        revision: 1,
        updatedAt: now,
      });
    }
    try {
      await this.db.transaction(
        "rw",
        [this.db.projects, this.db.files, this.db.fileContents],
        async () => {
          await this.db.projects.add(project);
          await this.db.files.bulkAdd(entries);
          await this.db.fileContents.bulkAdd(contents);
        },
      );
      return ok(project);
    } catch (cause) {
      return err(toStorageError(cause));
    }
  }

  async rename(id: ProjectId, title: string): Promise<Result<Project, QuartzError>> {
    const trimmed = title.trim();
    if (trimmed.length === 0) return err(quartzError("path.invalid", "Title cannot be empty."));
    try {
      const updatedAt = new Date().toISOString();
      const count = await this.db.projects.update(id, { title: trimmed, updatedAt });
      const project = await this.db.projects.get(id);
      if (count === 0 || project === undefined) {
        return err(quartzError("project.not_found", "Project not found."));
      }
      return ok(project);
    } catch (cause) {
      return err(toStorageError(cause));
    }
  }

  async touch(id: ProjectId): Promise<void> {
    await this.db.projects.update(id, { updatedAt: new Date().toISOString() });
  }

  async duplicate(id: ProjectId, title: string): Promise<Result<Project, QuartzError>> {
    const source = await this.db.projects.get(id);
    if (source === undefined) return err(quartzError("project.not_found", "Project not found."));
    const entries = await this.db.files.where("projectId").equals(id).toArray();
    const contents = await this.db.fileContents.bulkGet(entries.map((entry) => entry.id));
    const files: NewFile[] = [];
    entries.forEach((entry, index) => {
      const content = contents[index];
      if (entry.kind === "folder" || content === undefined) return;
      files.push({
        path: entry.path,
        content:
          content.kind === "text"
            ? { kind: "text", text: content.text }
            : { kind: "binary", bytes: content.bytes },
      });
    });
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = source;
    const folders = entries.filter((entry) => entry.kind === "folder").map((entry) => entry.path);
    const created = await this.create({ ...rest, title }, files, folders);
    if (created.ok) await this.copyThumbnail(id, created.value.id);
    return created;
  }

  /** Best effort: a copy without a thumbnail gets one on its first compile. */
  private async copyThumbnail(from: ProjectId, to: ProjectId): Promise<void> {
    try {
      const thumbnail = await this.db.thumbnails.get(from);
      if (thumbnail !== undefined) await this.db.thumbnails.put({ ...thumbnail, projectId: to });
    } catch (cause) {
      console.warn("Could not copy the project thumbnail.", cause);
    }
  }

  /** Deletes the project and every record that belongs to it, atomically. */
  async delete(id: ProjectId): Promise<Result<void, QuartzError>> {
    try {
      await this.db.transaction(
        "rw",
        [
          this.db.projects,
          this.db.files,
          this.db.fileContents,
          this.db.workspaceState,
          this.db.thumbnails,
        ],
        async () => {
          const fileIds = await this.db.files.where("projectId").equals(id).primaryKeys();
          await this.db.fileContents.bulkDelete(fileIds);
          await this.db.files.where("projectId").equals(id).delete();
          await this.db.workspaceState.delete(id);
          await this.db.thumbnails.delete(id);
          await this.db.projects.delete(id);
        },
      );
      return ok(undefined);
    } catch (cause) {
      return err(toStorageError(cause));
    }
  }
}
