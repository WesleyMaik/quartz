import {
  err,
  findTemplate,
  type NewFile,
  type Project,
  type ProjectId,
  parseProjectPath,
  type QuartzError,
  quartzError,
  type Result,
} from "@qrtz/document-core";
import type { ProjectRepository } from "@qrtz/storage";

/** Project lifecycle use cases. UI and future agent tools call this, never the repository. */
export class ProjectService {
  constructor(private readonly projects: ProjectRepository) {}

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

  rename(id: ProjectId, title: string) {
    return this.projects.rename(id, title);
  }

  duplicate(project: Project) {
    return this.projects.duplicate(project.id, `${project.title} (copy)`);
  }

  delete(id: ProjectId) {
    return this.projects.delete(id);
  }
}
