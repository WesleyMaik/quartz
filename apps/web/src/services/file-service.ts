import {
  err,
  type FileContent,
  type FileEntry,
  inferFileKind,
  isTextKind,
  type ProjectId,
  type ProjectPath,
  parseProjectPath,
  type QuartzError,
  quartzError,
  type Result,
  userMessageForPathError,
} from "@qrtz/document-core";
import type { FileRepository, QuartzDatabase } from "@qrtz/storage";

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

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

  async upload(
    projectId: ProjectId,
    folder: string,
    file: File,
  ): Promise<Result<FileEntry, QuartzError>> {
    if (file.size > MAX_UPLOAD_BYTES) {
      return err(quartzError("path.invalid", `${file.name} is larger than 100 MB.`));
    }
    const path = this.parsePath(folder === "" ? file.name : `${folder}/${file.name}`);
    if (!path.ok) return path;
    const content: FileContent = isTextKind(inferFileKind(path.value))
      ? { kind: "text", text: await file.text() }
      : { kind: "binary", bytes: file };
    return this.files.create(projectId, path.value, content);
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
