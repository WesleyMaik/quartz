import {
  err,
  type FileContent,
  type FileEntry,
  inferFileKind,
  isWithin,
  newFileId,
  ok,
  type ProjectId,
  type ProjectPath,
  type QuartzError,
  quartzError,
  type Result,
} from "@qrtz/document-core";
import type { QuartzDatabase, StoredContent } from "./database";
import { toStorageError } from "./errors";

export interface SnapshotFile {
  readonly path: ProjectPath;
  readonly revision: number;
  readonly content: FileContent;
}

const sizeOf = (content: FileContent): number =>
  content.kind === "text" ? new TextEncoder().encode(content.text).length : content.bytes.size;

const toStored = (fileId: FileEntry["id"], content: FileContent): StoredContent =>
  content.kind === "text"
    ? { fileId, kind: "text", text: content.text }
    : { fileId, kind: "binary", bytes: content.bytes };

const toContent = (stored: StoredContent): FileContent =>
  stored.kind === "text"
    ? { kind: "text", text: stored.text }
    : { kind: "binary", bytes: stored.bytes };

export class FileRepository {
  constructor(private readonly db: QuartzDatabase) {}

  private get tables() {
    return [this.db.projects, this.db.files, this.db.fileContents] as const;
  }

  private findEntry(projectId: ProjectId, path: ProjectPath): Promise<FileEntry | undefined> {
    return this.db.files.where("[projectId+path]").equals([projectId, path]).first();
  }

  private bumpProject(projectId: ProjectId, updatedAt: string): Promise<number> {
    return this.db.projects.update(projectId, { updatedAt });
  }

  listTree(projectId: ProjectId): Promise<FileEntry[]> {
    return this.db.files.where("projectId").equals(projectId).sortBy("path");
  }

  async read(
    projectId: ProjectId,
    path: ProjectPath,
  ): Promise<{ entry: FileEntry; content: FileContent } | undefined> {
    const entry = await this.findEntry(projectId, path);
    if (entry === undefined || entry.kind === "folder") return undefined;
    const stored = await this.db.fileContents.get(entry.id);
    return stored === undefined ? undefined : { entry, content: toContent(stored) };
  }

  async create(
    projectId: ProjectId,
    path: ProjectPath,
    content: FileContent | "folder",
  ): Promise<Result<FileEntry, QuartzError>> {
    const now = new Date().toISOString();
    const entry: FileEntry = {
      id: newFileId(),
      projectId,
      path,
      kind: content === "folder" ? "folder" : inferFileKind(path),
      size: content === "folder" ? 0 : sizeOf(content),
      revision: 1,
      updatedAt: now,
    };
    try {
      await this.db.transaction("rw", this.tables, async () => {
        if (await this.pathTaken(projectId, path))
          throw new DOMException("exists", "ConstraintError");
        await this.db.files.add(entry);
        if (content !== "folder") await this.db.fileContents.add(toStored(entry.id, content));
        await this.bumpProject(projectId, now);
      });
      return ok(entry);
    } catch (cause) {
      return err(toStorageError(cause));
    }
  }

  /** A path is taken if a file or folder exists there, or a file lives below it. */
  private async pathTaken(projectId: ProjectId, path: ProjectPath): Promise<boolean> {
    const entries = await this.db.files.where("projectId").equals(projectId).toArray();
    return entries.some((entry) => entry.path === path || isWithin(entry.path, path));
  }

  /**
   * Writes content and increments the revision. With `expectedRevision`, fails with
   * `revision.conflict` when the stored revision differs.
   */
  async write(
    projectId: ProjectId,
    path: ProjectPath,
    content: FileContent,
    expectedRevision?: number,
  ): Promise<Result<FileEntry, QuartzError>> {
    const now = new Date().toISOString();
    try {
      const updated = await this.db.transaction("rw", this.tables, async () => {
        const entry = await this.findEntry(projectId, path);
        if (entry === undefined || entry.kind === "folder") return undefined;
        if (expectedRevision !== undefined && entry.revision !== expectedRevision)
          return "conflict";
        const next: FileEntry = {
          ...entry,
          size: sizeOf(content),
          revision: entry.revision + 1,
          updatedAt: now,
        };
        await this.db.files.put(next);
        await this.db.fileContents.put(toStored(entry.id, content));
        await this.bumpProject(projectId, now);
        return next;
      });
      if (updated === undefined)
        return err(quartzError("path.not_found", `${path} does not exist.`));
      if (updated === "conflict") {
        return err(quartzError("revision.conflict", `${path} changed since it was read.`));
      }
      return ok(updated);
    } catch (cause) {
      return err(toStorageError(cause));
    }
  }

  /** Moves a file or a folder with everything inside it. */
  async move(
    projectId: ProjectId,
    from: ProjectPath,
    to: ProjectPath,
  ): Promise<Result<void, QuartzError>> {
    if (from === to) return ok(undefined);
    if (isWithin(to, from)) {
      return err(quartzError("path.invalid", "A folder cannot be moved into itself."));
    }
    const now = new Date().toISOString();
    try {
      const outcome = await this.db.transaction("rw", this.tables, async () => {
        const all = await this.db.files.where("projectId").equals(projectId).toArray();
        const moving = all.filter((entry) => isWithin(entry.path, from));
        if (moving.length === 0) return "missing";
        const others = all.filter((entry) => !isWithin(entry.path, from));
        const collides = others.some(
          (entry) =>
            isWithin(entry.path, to) || (entry.kind !== "folder" && isWithin(to, entry.path)),
        );
        if (collides) return "exists";
        await this.db.files.bulkPut(
          moving.map((entry) => ({
            ...entry,
            path: `${to}${entry.path.slice(from.length)}` as ProjectPath,
            updatedAt: now,
          })),
        );
        await this.bumpProject(projectId, now);
        return "moved";
      });
      if (outcome === "missing")
        return err(quartzError("path.not_found", `${from} does not exist.`));
      if (outcome === "exists") return err(quartzError("path.exists", `${to} already exists.`));
      return ok(undefined);
    } catch (cause) {
      return err(toStorageError(cause));
    }
  }

  /** Removes a file, or a folder and everything inside it. */
  async remove(projectId: ProjectId, path: ProjectPath): Promise<Result<number, QuartzError>> {
    const now = new Date().toISOString();
    try {
      const removed = await this.db.transaction("rw", this.tables, async () => {
        const all = await this.db.files.where("projectId").equals(projectId).toArray();
        const ids = all.filter((entry) => isWithin(entry.path, path)).map((entry) => entry.id);
        await this.db.fileContents.bulkDelete(ids);
        await this.db.files.bulkDelete(ids);
        if (ids.length > 0) await this.bumpProject(projectId, now);
        return ids.length;
      });
      if (removed === 0) return err(quartzError("path.not_found", `${path} does not exist.`));
      return ok(removed);
    } catch (cause) {
      return err(toStorageError(cause));
    }
  }

  /** Consistent read of every file in the project, used as compiler input. */
  async snapshot(projectId: ProjectId): Promise<SnapshotFile[]> {
    return this.db.transaction("r", [this.db.files, this.db.fileContents], async () => {
      const entries = (await this.db.files.where("projectId").equals(projectId).toArray()).filter(
        (entry) => entry.kind !== "folder",
      );
      const contents = await this.db.fileContents.bulkGet(entries.map((entry) => entry.id));
      const files: SnapshotFile[] = [];
      entries.forEach((entry, index) => {
        const stored = contents[index];
        if (stored !== undefined) {
          files.push({ path: entry.path, revision: entry.revision, content: toContent(stored) });
        }
      });
      return files;
    });
  }
}
