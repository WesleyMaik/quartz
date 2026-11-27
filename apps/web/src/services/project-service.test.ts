import {
  err,
  type NewFile,
  ok,
  type ProjectPath,
  parseProjectPath,
  quartzError,
} from "@qrtz/document-core";
import type { FileRepository, ProjectRepository } from "@qrtz/storage";
import { describe, expect, it, vi } from "vitest";
import type { ArchiveReader } from "./archive-reader";
import { ProjectService } from "./project-service";

const path = (value: string): ProjectPath => {
  const result = parseProjectPath(value);
  if (!result.ok) throw new Error(`invalid test path ${value}`);
  return result.value;
};

const text = (name: string, body: string): NewFile => ({
  path: path(name),
  content: { kind: "text", text: body },
});

const archive = new File(["zip"], "Thesis.zip");

function setup(files: readonly NewFile[]) {
  const create = vi.fn(async () => ok({}));
  const reader: ArchiveReader = async () =>
    ok({ files, folders: [path("figures")], binaryFallbacks: [] });
  const service = new ProjectService(
    { create } as unknown as ProjectRepository,
    {} as FileRepository,
    reader,
  );
  return { service, create };
}

describe("ProjectService import", () => {
  it("creates a project from the detected main document", async () => {
    const files = [text("main.tex", "\\documentclass{article}\n\\usepackage{fontspec}")];
    const { service, create } = setup(files);
    const draft = await service.inspectArchive(archive);
    if (!draft.ok || draft.value.suggested === undefined) throw new Error("expected suggestion");
    await service.importProject(draft.value, draft.value.suggested);
    expect(create).toHaveBeenCalledExactlyOnceWith(
      {
        title: "Thesis",
        engine: "latex",
        entry: "main.tex",
        compiler: { engine: "latex", variant: "xelatex" },
      },
      files,
      ["figures"],
    );
  });

  it("refuses an archive without documents", async () => {
    const { service } = setup([text("notes.md", "# Hi")]);
    const draft = await service.inspectArchive(archive);
    expect(draft.ok ? "ok" : draft.error.code).toBe("archive.no_document");
  });

  it("passes reader failures through", async () => {
    const service = new ProjectService({} as ProjectRepository, {} as FileRepository, async () =>
      err(quartzError("archive.invalid", "Damaged.")),
    );
    const draft = await service.inspectArchive(archive);
    expect(draft.ok ? "ok" : draft.error.code).toBe("archive.invalid");
  });
});
