export interface StorageStatus {
  readonly usageBytes: number | undefined;
  readonly quotaBytes: number | undefined;
  readonly persisted: boolean | undefined;
}

export const STORAGE_WARNING_RATIO = 0.8;

/** Reads quota and persistence state. Values are undefined where the browser does not expose them. */
export async function readStorageStatus(): Promise<StorageStatus> {
  const manager = globalThis.navigator?.storage;
  if (manager === undefined) {
    return { usageBytes: undefined, quotaBytes: undefined, persisted: undefined };
  }
  const [estimate, persisted] = await Promise.all([
    manager.estimate?.().catch(() => undefined),
    manager.persisted?.().catch(() => undefined),
  ]);
  return { usageBytes: estimate?.usage, quotaBytes: estimate?.quota, persisted };
}

/** Requests persistent storage. The browser may deny it; callers must not assume success. */
export async function requestPersistentStorage(): Promise<boolean> {
  const manager = globalThis.navigator?.storage;
  if (manager?.persist === undefined) return false;
  return manager.persist().catch(() => false);
}

export const isNearQuota = (status: StorageStatus): boolean =>
  status.usageBytes !== undefined &&
  status.quotaBytes !== undefined &&
  status.quotaBytes > 0 &&
  status.usageBytes / status.quotaBytes >= STORAGE_WARNING_RATIO;
