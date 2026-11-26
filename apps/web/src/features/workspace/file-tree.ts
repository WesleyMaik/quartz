import type { FileEntry, FileKind, ProjectPath } from "@qrtz/document-core";

export interface TreeNode {
  readonly name: string;
  readonly path: ProjectPath;
  readonly kind: FileKind;
  readonly children: TreeNode[];
}

interface MutableNode {
  name: string;
  path: ProjectPath;
  kind: FileKind;
  children: Map<string, MutableNode>;
}

const freeze = (node: MutableNode): TreeNode => ({
  name: node.name,
  path: node.path,
  kind: node.kind,
  children: [...node.children.values()]
    .sort((a, b) =>
      a.kind === "folder" && b.kind !== "folder"
        ? -1
        : a.kind !== "folder" && b.kind === "folder"
          ? 1
          : a.name.localeCompare(b.name),
    )
    .map(freeze),
});

/** Builds a sorted tree (folders first) from flat entries; folders implied by file paths are added. */
export function buildFileTree(entries: readonly FileEntry[]): TreeNode[] {
  const root: MutableNode = {
    name: "",
    path: "" as ProjectPath,
    kind: "folder",
    children: new Map(),
  };
  for (const entry of entries) {
    const segments = entry.path.split("/");
    let node = root;
    segments.forEach((segment, index) => {
      const isLast = index === segments.length - 1;
      const path = segments.slice(0, index + 1).join("/") as ProjectPath;
      let child = node.children.get(segment);
      if (child === undefined) {
        child = { name: segment, path, kind: isLast ? entry.kind : "folder", children: new Map() };
        node.children.set(segment, child);
      }
      node = child;
    });
  }
  return freeze(root).children;
}
