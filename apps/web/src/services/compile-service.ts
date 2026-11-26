import {
  type CompilationFile,
  type CompileEngine,
  CompileQueue,
  type CompilerDiagnostic,
  type CompileStatus,
  type EngineId,
  type HostResult,
} from "@qrtz/compiler-core";
import type { Project, ProjectId } from "@qrtz/document-core";
import type { SnapshotFile } from "@qrtz/storage";

export interface CompileState {
  readonly status: CompileStatus;
  readonly message: string;
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly log: string;
  readonly lastPdf:
    | { readonly bytes: Uint8Array; readonly builtAt: Date; readonly snapshotKey: string }
    | undefined;
  /** True when the latest build failed and the preview shows an older successful PDF. */
  readonly stale: boolean;
  readonly durationMs: number | undefined;
}

const INITIAL: CompileState = {
  status: "idle",
  message: "",
  diagnostics: [],
  log: "",
  lastPdf: undefined,
  stale: false,
  durationMs: undefined,
};

type Listener = () => void;

const assetBase = (engine: EngineId): string =>
  new URL(`/engines/${engine}/`, window.location.origin).href;

async function loadEngine(
  engine: EngineId,
  onMessage: (message: string) => void,
): Promise<CompileEngine> {
  switch (engine) {
    case "typst": {
      const { createTypstEngine } = await import("@qrtz/compiler-typst");
      return createTypstEngine({
        assetBaseUrl: assetBase("typst"),
        onProgress: (p) => onMessage(p.message),
      });
    }
    case "latex": {
      const { createLatexEngine } = await import("@qrtz/compiler-latex");
      return createLatexEngine({
        assetBaseUrl: assetBase("latex"),
        onProgress: (p) => onMessage(p.message),
      });
    }
  }
}

const compileOptions = (project: Project): Readonly<Record<string, string>> =>
  project.compiler.engine === "latex" ? { variant: project.compiler.variant } : {};

async function toCompilationFiles(snapshot: readonly SnapshotFile[]): Promise<CompilationFile[]> {
  return Promise.all(
    snapshot.map(
      async (file): Promise<CompilationFile> =>
        file.content.kind === "text"
          ? { path: file.path, kind: "text", text: file.content.text }
          : {
              path: file.path,
              kind: "binary",
              bytes: new Uint8Array(await file.content.bytes.arrayBuffer()),
            },
    ),
  );
}

const snapshotKeyOf = (snapshot: readonly SnapshotFile[], entry: string): string =>
  `${entry}|${snapshot
    .map((f) => `${f.path}@${f.revision}`)
    .sort()
    .join(",")}`;

/**
 * Compiles projects in engine workers. Engines load lazily on first use (no engine code in the
 * initial bundle). Keeps the last successful PDF when a build fails.
 */
export class CompileService {
  private readonly engines = new Map<EngineId, Promise<CompileEngine>>();
  private readonly queues = new Map<ProjectId, CompileQueue<HostResult>>();
  private readonly states = new Map<ProjectId, CompileState>();
  private readonly listeners = new Set<Listener>();

  constructor(private readonly snapshot: (projectId: ProjectId) => Promise<SnapshotFile[]>) {}

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = (projectId: ProjectId): CompileState => this.states.get(projectId) ?? INITIAL;

  private update(projectId: ProjectId, patch: Partial<CompileState>): void {
    this.states.set(projectId, { ...this.getState(projectId), ...patch });
    for (const listener of this.listeners) listener();
  }

  private engine(engine: EngineId, projectId: ProjectId): Promise<CompileEngine> {
    let host = this.engines.get(engine);
    if (host === undefined) {
      host = loadEngine(engine, (message) => this.update(projectId, { message }));
      host.catch(() => this.engines.delete(engine));
      this.engines.set(engine, host);
    }
    return host;
  }

  async compile(project: Project): Promise<void> {
    let queue = this.queues.get(project.id);
    if (queue === undefined) {
      queue = new CompileQueue<HostResult>();
      this.queues.set(project.id, queue);
    }
    if (queue.busy) this.update(project.id, { status: "queued" });

    try {
      const result = await queue.request(async () => {
        const firstUse = !this.engines.has(project.engine);
        if (firstUse)
          this.update(project.id, { status: "initializing", message: "Loading engine" });
        const host = await this.engine(project.engine, project.id);
        const snapshot = await this.snapshot(project.id);
        this.update(project.id, { status: "compiling", message: "Compiling" });
        return host.compile({
          projectId: project.id,
          entry: project.entry,
          files: await toCompilationFiles(snapshot),
          snapshotKey: snapshotKeyOf(snapshot, project.entry),
          options: compileOptions(project),
        });
      });
      this.publish(project.id, result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.update(project.id, {
        status: "error",
        message,
        diagnostics: [{ severity: "error", message, source: project.engine }],
        stale: this.getState(project.id).lastPdf !== undefined,
      });
    }
  }

  cancel(project: Project): void {
    void this.engines.get(project.engine)?.then((host) => host.cancel());
  }

  private publish(projectId: ProjectId, result: HostResult): void {
    const current = this.getState(projectId);
    if (result.status === "cancelled") {
      this.update(projectId, { status: "cancelled", message: "Cancelled" });
      return;
    }
    const common = {
      diagnostics: result.diagnostics,
      log: result.log,
      durationMs: result.durationMs,
    };
    if (result.status === "success" && result.pdf !== undefined) {
      this.update(projectId, {
        ...common,
        status: "success",
        message: "Built",
        stale: false,
        lastPdf: { bytes: result.pdf, builtAt: new Date(), snapshotKey: result.snapshotKey },
      });
      return;
    }
    this.update(projectId, {
      ...common,
      status: "error",
      message: `${result.diagnostics.filter((d) => d.severity === "error").length} error(s)`,
      stale: current.lastPdf !== undefined,
    });
  }
}
