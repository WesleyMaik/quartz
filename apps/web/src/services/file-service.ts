import {
  err,
  type FileContent,
  type FileEntry,
  inferFileKind,
  isTextKind,
  type PlannedMove,
  type ProjectId,
  type ProjectPath,
  parseProjectPath,
  planMove,
  planUpload,
  type QuartzError,
  quartzError,
  type Result,
  type UploadPlan,
  userMessageForPathError,
} from "@qrtz/document-core";
import type { FileRepository, QuartzDatabase } from "@qrtz/storage";

/** A picked or dropped file with its folder path inside the selection ("fonts/a.ttf"). */
export interface UploadSource {
  readonly file: File;
  readonly relativePath: string;
}

export interface BatchOutcome<T> {
  readonly done: readonly T[];
  /** User-facing messages for items that failed; the rest of the batch still went through. */
  readonly failed: readonly string[];
}

/** File use cases. Every path from the UI is validated here through `parseProjectPath`. */
export class FileService {
  constructor(
    private readonly files: FileRepository,
    private readonly db: QuartzDatabase,
  ) {}

  parsePath(input: string): Result<ProjectPath, QuartzError> {
    const parsed = parseProjectPath(input.trim());
    return parsed.ok
      ? parsed
      : err(quartzError("path.invalid", userMessageForPathError(parsed.error)));
  }

  async createFile(projectId: ProjectId, input: string): Promise<Result<FileEntry, QuartzError>> {
    const path = this.parsePath(input);
    if (!path.ok) return path;
    return this.files.create(projectId, path.value, { kind: "text", text: "" });
  }

  async createFolder(projectId: ProjectId, input: string): Promise<Result<FileEntry, QuartzError>> {
    const path = this.parsePath(input);
    if (!path.ok) return path;
    return this.files.create(projectId, path.value, "folder");
  }

  /** Validates an upload against the project before anything is written (see `planUpload`). */
  async planUpload(
    projectId: ProjectId,
    sources: readonly UploadSource[],
    folder: string,
  ): Promise<Result<UploadPlan, QuartzError>> {
    const existing = await this.db.files.where("projectId").equals(projectId).toArray();
    return planUpload(
      sources.map((source) => ({ relativePath: source.relativePath, size: source.file.size })),
      folder,
      existing.map((entry) => entry.path),
    );
  }

  async applyUpload(
    projectId: ProjectId,
    plan: UploadPlan,
    sources: readonly UploadSource[],
  ): Promise<BatchOutcome<ProjectPath>> {
    const done: ProjectPath[] = [];
    const failed: string[] = [];
    for (const upload of plan.uploads) {
      const source = sources[upload.index];
      if (source === undefined) continue;
      const content: FileContent = isTextKind(inferFileKind(upload.path))
        ? { kind: "text", text: await source.file.text() }
        : { kind: "binary", bytes: source.file };
      const result = await this.files.create(projectId, upload.path, content);
      if (result.ok) done.push(upload.path);
      else failed.push(`${upload.path}: ${result.error.message}`);
    }
    return { done, failed };
  }

  read(projectId: ProjectId, path: ProjectPath) {
    return this.files.read(projectId, path);
  }

  saveText(projectId: ProjectId, path: ProjectPath, text: string) {
    return this.files.write(projectId, path, { kind: "text", text });
  }

  async move(
    projectId: ProjectId,
    from: ProjectPath,
    toInput: string,
  ): Promise<Result<void, QuartzError>> {
    const to = this.parsePath(toInput);
    if (!to.ok) return to;
    return this.files.move(projectId, from, to.value);
  }

  /** Moves dragged items into `folder` ("" is the root); see `planMove` for what is skipped. */
  async moveMany(
    projectId: ProjectId,
    paths: readonly ProjectPath[],
    folder: string,
  ): Promise<BatchOutcome<PlannedMove>> {
    const done: PlannedMove[] = [];
    const failed: string[] = [];
    for (const move of planMove(paths, folder)) {
      const result = await this.files.move(projectId, move.from, move.to);
      if (result.ok) done.push(move);
      else failed.push(`${move.from}: ${result.error.message}`);
    }
    return { done, failed };
  }

  remove(projectId: ProjectId, path: ProjectPath) {
    return this.files.remove(projectId, path);
  }

  async setEntry(projectId: ProjectId, path: ProjectPath): Promise<void> {
    await this.db.projects.update(projectId, { entry: path, updatedAt: new Date().toISOString() });
  }

  snapshot(projectId: ProjectId) {
    return this.files.snapshot(projectId);
  }
}
