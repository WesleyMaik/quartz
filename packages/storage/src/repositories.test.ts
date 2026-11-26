import "fake-indexeddb/auto";
import { type NewFile, type ProjectPath, parseProjectPath } from "@qrtz/document-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QuartzDatabase } from "./database";
import { FileRepository } from "./file-repository";
import { ProjectRepository } from "./project-repository";

const path = (value: string): ProjectPath => {
  const result = parseProjectPath(value);
  if (!result.ok) throw new Error(`invalid test path ${value}`);
  return result.value;
};

const text = (p: string, body: string): NewFile => ({
  path: path(p),
  content: { kind: "text", text: body },
});

let db: QuartzDatabase;
let projects: ProjectRepository;
let files: FileRepository;

beforeEach(() => {
  db = new QuartzDatabase(`test-${crypto.randomUUID()}`);
  projects = new ProjectRepository(db);
  files = new FileRepository(db);
});

afterEach(async () => {
  await db.delete();
});

async function createProject() {
  const result = await projects.create(
    { title: "Paper", engine: "typst", entry: path("main.typ"), compiler: { engine: "typst" } },
    [text("main.typ", "= Hi"), text("sections/a.typ", "A")],
  );
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe("ProjectRepository", () => {
  it("creates a project with its files", async () => {
    const project = await createProject();
    expect(await projects.list()).toHaveLength(1);
    expect((await files.listTree(project.id)).map((f) => f.path)).toEqual([
      "main.typ",
      "sections/a.typ",
    ]);
  });

  it("sums stored bytes per project", async () => {
    const first = await createProject();
    const second = await projects.create(
      { title: "Other", engine: "typst", entry: path("main.typ"), compiler: { engine: "typst" } },
      [text("main.typ", "ção")],
    );
    if (!second.ok) throw new Error(second.error.message);
    const sizes = await projects.sizes();
    // "= Hi" (4 bytes) + "A" (1 byte); "ção" is 5 bytes in UTF-8.
    expect(sizes.get(first.id)).toBe(5);
    expect(sizes.get(second.value.id)).toBe(5);
  });

  it("reports no sizes when there are no projects", async () => {
    expect((await projects.sizes()).size).toBe(0);
  });

  it("duplicates contents under new ids", async () => {
    const project = await createProject();
    const copy = await projects.duplicate(project.id, "Copy");
    expect(copy.ok).toBe(true);
    if (!copy.ok) return;
    expect(copy.value.id).not.toBe(project.id);
    const read = await files.read(copy.value.id, path("main.typ"));
    expect(read?.content).toEqual({ kind: "text", text: "= Hi" });
  });

  it("deletes every record of the project", async () => {
    const project = await createProject();
    await projects.delete(project.id);
    expect(await db.projects.count()).toBe(0);
    expect(await db.files.count()).toBe(0);
    expect(await db.fileContents.count()).toBe(0);
  });
});

describe("FileRepository", () => {
  it("increments revision on write and detects conflicts", async () => {
    const project = await createProject();
    const first = await files.write(project.id, path("main.typ"), { kind: "text", text: "v2" }, 1);
    expect(first.ok && first.value.revision).toBe(2);
    const stale = await files.write(project.id, path("main.typ"), { kind: "text", text: "v3" }, 1);
    expect(stale.ok ? "ok" : stale.error.code).toBe("revision.conflict");
  });

  it("rejects creating a duplicate path", async () => {
    const project = await createProject();
    const dup = await files.create(project.id, path("main.typ"), { kind: "text", text: "" });
    expect(dup.ok ? "ok" : dup.error.code).toBe("path.exists");
  });

  it("moves folders with their contents and removes recursively", async () => {
    const project = await createProject();
    expect((await files.move(project.id, path("sections"), path("chapters"))).ok).toBe(true);
    expect((await files.listTree(project.id)).map((f) => f.path)).toContain("chapters/a.typ");
    const removed = await files.remove(project.id, path("chapters"));
    expect(removed.ok && removed.value).toBe(1);
  });

  it("refuses to move a folder into itself", async () => {
    const project = await createProject();
    const result = await files.move(project.id, path("sections"), path("sections/inner"));
    expect(result.ok ? "ok" : result.error.code).toBe("path.invalid");
  });

  it("snapshots all file contents with revisions", async () => {
    const project = await createProject();
    const snapshot = await files.snapshot(project.id);
    expect(snapshot.map((f) => [f.path, f.revision])).toEqual(
      expect.arrayContaining([
        ["main.typ", 1],
        ["sections/a.typ", 1],
      ]),
    );
  });
});
