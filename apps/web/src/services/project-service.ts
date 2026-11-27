import {
  type DetectionResult,
  err,
  findEntryCandidates,
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
import {
  createProjectZip,
  type ProjectArchiveContents,
  projectArchiveName,
  projectTitleFromArchive,
} from "@qrtz/project-format";
import type { FileRepository, ProjectRepository } from "@qrtz/storage";
import type { ArchiveReader } from "./archive-reader";

export interface ProjectArchive {
  readonly fileName: string;
  readonly blob: Blob;
}

/** A validated archive that has not been stored yet. */
export interface ImportDraft {
  readonly title: string;
  readonly contents: ProjectArchiveContents;
  /** Possible main documents; never empty. */
  readonly candidates: readonly DetectionResult[];
  /** Set when the main document is unambiguous. */
  readonly suggested: DetectionResult | undefined;
}

/** Project lifecycle use cases. UI and future agent tools call this, never the repository. */
export class ProjectService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly files: FileRepository,
    private readonly readArchive: ArchiveReader,
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

  /** Validates a ZIP and finds its possible main documents without writing anything. */
  async inspectArchive(file: File): Promise<Result<ImportDraft, QuartzError>> {
    const read = await this.readArchive(file);
    if (!read.ok) return read;
    const documents = read.value.files.flatMap(({ path, content }) =>
      content.kind === "text" ? [{ path, text: content.text }] : [],
    );
    const { candidates, suggested } = findEntryCandidates(documents);
    if (candidates.length === 0) {
      return err(
        quartzError("archive.no_document", "The archive has no UTF-8 .tex or .typ document."),
      );
    }
    const title = projectTitleFromArchive(file.name);
    return ok({ title, contents: read.value, candidates, suggested });
  }

  /** Stores an inspected archive as a new project that opens on `main`. */
  async importProject(
    draft: ImportDraft,
    main: DetectionResult,
  ): Promise<Result<Project, QuartzError>> {
    const entry = parseProjectPath(main.entry);
    if (!entry.ok) return err(quartzError("path.invalid", "The main document path is invalid."));
    return this.projects.create(
      { title: draft.title, engine: main.engine, entry: entry.value, compiler: main.compiler },
      draft.contents.files,
      draft.contents.folders,
    );
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
