import type { ProjectId } from "@qrtz/document-core";
import type { QuartzDatabase, ThumbnailRecord } from "./database";

export class ThumbnailRepository {
  constructor(private readonly db: QuartzDatabase) {}

  get(projectId: ProjectId): Promise<ThumbnailRecord | undefined> {
    return this.db.thumbnails.get(projectId);
  }

  /** Ignored when the project no longer exists, so a late render cannot leave an orphan. */
  async save(record: ThumbnailRecord): Promise<void> {
    await this.db.transaction("rw", [this.db.projects, this.db.thumbnails], async () => {
      if ((await this.db.projects.get(record.projectId)) === undefined) return;
      await this.db.thumbnails.put(record);
    });
  }
}
