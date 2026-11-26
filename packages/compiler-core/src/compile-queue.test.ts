import { describe, expect, it } from "vitest";
import { CompileQueue } from "./compile-queue";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("CompileQueue", () => {
  it("runs immediately when idle", async () => {
    const queue = new CompileQueue<number>();
    await expect(queue.request(async () => 1)).resolves.toBe(1);
  });

  it("coalesces requests made while busy into the latest one", async () => {
    const queue = new CompileQueue<string>();
    const first = deferred<string>();
    const started: string[] = [];
    const run = (id: string, value?: Promise<string>) => () => {
      started.push(id);
      return value ?? Promise.resolve(id);
    };

    const a = queue.request(run("a", first.promise));
    const b = queue.request(run("b"));
    const c = queue.request(run("c"));
    first.resolve("a");

    await expect(a).resolves.toBe("a");
    await expect(b).resolves.toBe("c");
    await expect(c).resolves.toBe("c");
    expect(started).toEqual(["a", "c"]);
  });

  it("propagates errors of the superseding job to all waiters", async () => {
    const queue = new CompileQueue<string>();
    const first = deferred<string>();
    queue.request(() => first.promise);
    const b = queue.request(() => Promise.reject(new Error("boom")));
    first.resolve("done");
    await expect(b).rejects.toThrow("boom");
    expect(queue.busy).toBe(false);
  });
});
