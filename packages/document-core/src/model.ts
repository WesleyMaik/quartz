import type { FileId, ProjectId } from "./ids";
import type { ProjectPath } from "./paths";

export type Engine = "latex" | "typst";
export type LatexVariant = "pdflatex" | "xelatex";

export type CompilerConfig =
  | { readonly engine: "latex"; readonly variant: LatexVariant }
  | { readonly engine: "typst" };

export interface Project {
  readonly id: ProjectId;
  readonly title: string;
  readonly engine: Engine;
  readonly entry: ProjectPath;
  readonly compiler: CompilerConfig;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type FileKind = "folder" | "source" | "bibliography" | "asset" | "font" | "data";

export interface FileEntry {
  readonly id: FileId;
  readonly projectId: ProjectId;
  readonly path: ProjectPath;
  readonly kind: FileKind;
  readonly size: number;
  /** Increments on every content write; used for conflict detection and compile staleness. */
  readonly revision: number;
  readonly updatedAt: string;
}

export type FileContent =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "binary"; readonly bytes: Blob };

export interface NewFile {
  readonly path: ProjectPath;
  readonly content: FileContent;
}

export interface ProjectTemplate {
  readonly id: string;
  readonly label: string;
  readonly engine: Engine;
  readonly compiler: CompilerConfig;
  readonly entry: string;
  readonly files: Readonly<Record<string, string>>;
}
