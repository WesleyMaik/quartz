/**
 * Coalescing queue: at most one running job and one pending job. A new request replaces the
 * pending one, and every caller waiting on a replaced request receives the newer job's result.
 */
export class CompileQueue<T> {
  private running: Promise<T> | undefined;
  private pending:
    | {
        readonly run: () => Promise<T>;
        readonly waiters: Array<(r: PromiseSettledResult<T>) => void>;
      }
    | undefined;

  get busy(): boolean {
    return this.running !== undefined;
  }

  request(run: () => Promise<T>): Promise<T> {
    if (this.running === undefined) return this.start(run);

    return new Promise<T>((resolve, reject) => {
      const waiter = (result: PromiseSettledResult<T>) =>
        result.status === "fulfilled" ? resolve(result.value) : reject(result.reason);
      const waiters = this.pending?.waiters ?? [];
      waiters.push(waiter);
      this.pending = { run, waiters };
    });
  }

  private start(run: () => Promise<T>): Promise<T> {
    const job = run();
    this.running = job;
    const next = () => {
      this.running = undefined;
      const pending = this.pending;
      this.pending = undefined;
      if (pending === undefined) return;
      this.start(pending.run).then(
        (value) => {
          for (const waiter of pending.waiters) waiter({ status: "fulfilled", value });
        },
        (reason: unknown) => {
          for (const waiter of pending.waiters) waiter({ status: "rejected", reason });
        },
      );
    };
    job.then(next, next);
    return job;
  }
}
