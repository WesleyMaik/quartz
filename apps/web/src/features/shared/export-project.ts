import type { Project, QuartzError } from "@qrtz/document-core";
import { toast } from "@qrtz/ui";
import { downloadBlob } from "../../lib/download";
import type { ProjectService } from "../../services/project-service";

export async function exportProject(
  projects: ProjectService,
  project: Project,
  describeError: (error: QuartzError) => string,
): Promise<void> {
  const result = await projects.exportZip(project);
  if (result.ok) downloadBlob(result.value.blob, result.value.fileName);
  else toast.error(describeError(result.error));
}
