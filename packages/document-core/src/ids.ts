import { ulid } from "ulid";

declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type ProjectId = Brand<string, "ProjectId">;
export type FileId = Brand<string, "FileId">;

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export const newProjectId = (): ProjectId => ulid() as ProjectId;
export const newFileId = (): FileId => ulid() as FileId;

/** Validates an untrusted string (for example a route parameter) as a ProjectId. */
export const parseProjectId = (value: string): ProjectId | undefined =>
  ULID_PATTERN.test(value) ? (value as ProjectId) : undefined;
