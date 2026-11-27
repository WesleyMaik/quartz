import { newProjectId } from "@qrtz/document-core";
import type { ThumbnailRecord } from "@qrtz/storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THUMBNAIL_DELAY_MS, ThumbnailService } from "./thumbnail-service";

const projectId = newProjectId();
const image = new Blob(["img"]);
const pdf = (byte: number) => new Uint8Array([byte]);

function setup(stored?: ThumbnailRecord) {
  const store = {
    get: vi.fn(async () => stored),
    save: vi.fn(async (_record: ThumbnailRecord) => {}),
  };
  const render = vi.fn(async (_pdf: Uint8Array) => image);
  return { store, render, service: new ThumbnailService(store, render) };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ThumbnailService", () => {
  it("renders only the latest build after the quiet period", async () => {
    const { service, store, render } = setup();
    service.schedule(projectId, pdf(1), "a");
    await vi.advanceTimersByTimeAsync(THUMBNAIL_DELAY_MS - 1);
    service.schedule(projectId, pdf(2), "b");
    await vi.advanceTimersByTimeAsync(THUMBNAIL_DELAY_MS - 1);
    expect(render).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(render).toHaveBeenCalledExactlyOnceWith(pdf(2));
    expect(store.save).toHaveBeenCalledExactlyOnceWith({ projectId, image, sourceKey: "b" });
  });

  it("skips a build that already has a thumbnail", async () => {
    const { service, render } = setup({ projectId, image, sourceKey: "a" });
    service.schedule(projectId, pdf(1), "a");
    await vi.advanceTimersByTimeAsync(THUMBNAIL_DELAY_MS);
    expect(render).not.toHaveBeenCalled();
  });

  it("keeps the previous thumbnail when rendering fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { service, store, render } = setup();
    render.mockRejectedValueOnce(new Error("broken pdf"));
    service.schedule(projectId, pdf(1), "a");
    await vi.advanceTimersByTimeAsync(THUMBNAIL_DELAY_MS);
    expect(store.save).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
  });
});
