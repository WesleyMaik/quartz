import * as Comlink from "comlink";
import type {
  CompilationProject,
  CompilationResult,
  EngineId,
  EngineWorkerApi,
  HostResult,
  InitializeOptions,
  InitProgress,
} from "./types";

export interface EngineHostOptions {
  readonly engine: EngineId;
  readonly createWorker: () => Worker;
  readonly initialize: InitializeOptions;
  readonly timeoutMs: number;
  readonly onProgress?: (progress: InitProgress) => void;
}

class CompileTimeoutError extends Error {
  constructor(ms: number) {
    super(`Compilation timed out after ${Math.round(ms / 1000)} s.`);
  }
}

/**
 * Owns one engine worker. Starts it lazily, restarts it after crashes, and terminates it to
 * cancel or time out a compile, because synchronous WASM runs cannot be interrupted otherwise.
 */
export class EngineHost {
  private worker: Worker | undefined;
  private api: Comlink.Remote<EngineWorkerApi> | undefined;
  private ready: Promise<void> | undefined;
  private cancelCurrent: (() => void) | undefined;

  constructor(private readonly options: EngineHostOptions) {}

  get engine(): EngineId {
    return this.options.engine;
  }

  private start(): Promise<void> {
    if (this.ready !== undefined) return this.ready;
    const worker = this.options.createWorker();
    const api = Comlink.wrap<EngineWorkerApi>(worker);
    this.worker = worker;
    this.api = api;
    const onProgress = this.options.onProgress ?? (() => undefined);
    this.ready = api
      .initialize(this.options.initialize, Comlink.proxy(onProgress))
      .catch((error: unknown) => {
        this.stop();
        throw error;
      });
    return this.ready;
  }

  private stop(): void {
    this.worker?.terminate();
    this.worker = undefined;
    this.api?.[Comlink.releaseProxy]();
    this.api = undefined;
    this.ready = undefined;
  }

  /** Initializes the worker without compiling (used to warm up the engine). */
  warmUp(): Promise<void> {
    return this.start();
  }

  async compile(project: CompilationProject): Promise<HostResult> {
    const startedAt = performance.now();
    await this.start();
    const api = this.api;
    if (api === undefined) throw new Error("Engine worker is not available.");

    const transfers = project.files.flatMap((file) =>
      file.kind === "binary" ? [file.bytes.buffer] : [],
    );
    const run = api.compile(Comlink.transfer(project, transfers as Transferable[]));

    const outcome = await new Promise<CompilationResult | "cancelled">((resolve, reject) => {
      const timer = setTimeout(() => {
        this.stop();
        reject(new CompileTimeoutError(this.options.timeoutMs));
      }, this.options.timeoutMs);
      this.cancelCurrent = () => {
        clearTimeout(timer);
        this.stop();
        resolve("cancelled");
      };
      run.then(
        (result) => {
          clearTimeout(timer);
          resolve(result);
        },
        (error: unknown) => {
          clearTimeout(timer);
          this.stop();
          reject(error);
        },
      );
    }).finally(() => {
      this.cancelCurrent = undefined;
    });

    if (outcome === "cancelled") {
      return {
        status: "cancelled",
        snapshotKey: project.snapshotKey,
        durationMs: performance.now() - startedAt,
      };
    }
    return { ...outcome, snapshotKey: project.snapshotKey };
  }

  /** Cancels the running compile by terminating the worker; the next compile restarts it. */
  cancel(): void {
    this.cancelCurrent?.();
  }

  dispose(): void {
    this.cancel();
    this.stop();
  }
}
