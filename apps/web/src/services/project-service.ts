import {
  err,
  findTemplate,
  type NewFile,
  ok,
  type Project,
  type ProjectId,
  parseProjectPath,
  type QuartzError,
  quartzError,
  type Result,
} from "@qrtz/document-core";
import { createProjectZip, projectArchiveName } from "@qrtz/project-format";
import type { FileRepository, ProjectRepository } from "@qrtz/storage";

export interface ProjectArchive {
  readonly fileName: string;
  readonly blob: Blob;
}

/** Project lifecycle use cases. UI and future agent tools call this, never the repository. */
export class ProjectService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly files: FileRepository,
  ) {}

  async createFromTemplate(
    templateId: string,
    title: string,
  ): Promise<Result<Project, QuartzError>> {
    const template = findTemplate(templateId);
    if (template === undefined) return err(quartzError("project.not_found", "Unknown template."));
    const entry = parseProjectPath(template.entry);
    if (!entry.ok) return err(quartzError("path.invalid", "Template entry is invalid."));

    const files: NewFile[] = [];
    for (const [path, text] of Object.entries(template.files)) {
      const parsed = parseProjectPath(path);
      if (!parsed.ok) return err(quartzError("path.invalid", `Template path ${path} is invalid.`));
      files.push({ path: parsed.value, content: { kind: "text", text } });
    }
    const name = title.trim() === "" ? template.label : title.trim();
    return this.projects.create(
      { title: name, engine: template.engine, entry: entry.value, compiler: template.compiler },
      files,
    );
  }

  /** Stored bytes per project; reads only file metadata, so it is cheap to keep live. */
  sizes() {
    return this.projects.sizes();
  }

  rename(id: ProjectId, title: string) {
    return this.projects.rename(id, title);
  }

  duplicate(project: Project) {
    return this.projects.duplicate(project.id, `${project.title} (copy)`);
  }

  /** Packs the stored project tree into a standard ZIP. Unsaved editor buffers are not included. */
  async exportZip(project: Project): Promise<Result<ProjectArchive, QuartzError>> {
    try {
      const [files, entries] = await Promise.all([
        this.files.snapshot(project.id),
        this.files.listTree(project.id),
      ]);
      const bytes = await createProjectZip({
        files,
        folders: entries.filter((entry) => entry.kind === "folder").map((entry) => entry.path),
        modifiedAt: new Date(project.updatedAt),
      });
      return ok({
        fileName: projectArchiveName(project.title),
        blob: new Blob([bytes], { type: "application/zip" }),
      });
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      return err(quartzError("archive.export_failed", `Export failed: ${reason}`));
    }
  }

  delete(id: ProjectId) {
    return this.projects.delete(id);
  }
}
