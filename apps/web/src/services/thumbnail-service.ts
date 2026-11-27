import type { ProjectId } from "@qrtz/document-core";
import type { ThumbnailRecord } from "@qrtz/storage";

/** Quiet period after a build, so continuous typing does not render a thumbnail per compile. */
export const THUMBNAIL_DELAY_MS = 1500;

export interface ThumbnailStore {
  get(projectId: ProjectId): Promise<ThumbnailRecord | undefined>;
  save(record: ThumbnailRecord): Promise<void>;
}

export type ThumbnailRenderer = (pdf: Uint8Array) => Promise<Blob>;

/** Keeps each project's first-page thumbnail in step with its latest successful build. */
export class ThumbnailService {
  private readonly timers = new Map<ProjectId, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly store: ThumbnailStore,
    private readonly render: ThumbnailRenderer,
  ) {}

  /** Only the latest build requested within the quiet period is rendered. */
  schedule(projectId: ProjectId, pdf: Uint8Array, sourceKey: string): void {
    clearTimeout(this.timers.get(projectId));
    this.timers.set(
      projectId,
      setTimeout(() => {
        this.timers.delete(projectId);
        void this.update(projectId, pdf, sourceKey);
      }, THUMBNAIL_DELAY_MS),
    );
  }

  private async update(projectId: ProjectId, pdf: Uint8Array, sourceKey: string): Promise<void> {
    try {
      const current = await this.store.get(projectId);
      if (current?.sourceKey === sourceKey) return;
      await this.store.save({ projectId, image: await this.render(pdf), sourceKey });
    } catch (error: unknown) {
      // A thumbnail is decoration: the dashboard falls back to an icon.
      console.warn("Could not update the project thumbnail.", error);
    }
  }
}
