import type { ProjectPath } from "../paths";
import { scanLatex } from "./latex";
import { directoryOf, type OutlineItem, type OutlineScanner } from "./types";
import { scanTypst } from "./typst";

export interface OutlineNode {
  readonly title: string;
  readonly level: number;
  readonly file: ProjectPath;
  /** 1-based line of the heading in `file`. */
  readonly line: number;
  readonly children: readonly OutlineNode[];
}

/** Bounds for pathological inputs, such as files that include each other many times. */
export const MAX_OUTLINE_HEADINGS = 2000;
export const MAX_OUTLINE_FILE_VISITS = 500;

const scannerFor = (path: string): OutlineScanner | undefined => {
  if (/\.(tex|ltx)$/i.test(path)) return scanLatex;
  if (/\.typ$/i.test(path)) return scanTypst;
  return undefined;
};

type MutableNode = Omit<OutlineNode, "children"> & { readonly children: MutableNode[] };

function walk(sources: ReadonlyMap<ProjectPath, string>, root: ProjectPath) {
  const nodes: MutableNode[] = [];
  /** Open ancestors of the next heading, outermost first. */
  const stack: MutableNode[] = [];
  const visited = new Set<ProjectPath>();
  const active = new Set<ProjectPath>();
  const cache = new Map<ProjectPath, OutlineItem[]>();
  const rootDirectory = directoryOf(root);
  let headings = 0;
  let visits = 0;

  const visit = (path: ProjectPath) => {
    const text = sources.get(path);
    const scan = scannerFor(path);
    if (text === undefined || scan === undefined || active.has(path)) return;
    if (visits++ >= MAX_OUTLINE_FILE_VISITS) return;
    visited.add(path);
    active.add(path);
    let items = cache.get(path);
    if (items === undefined) {
      items = scan(text, { path, rootDirectory });
      cache.set(path, items);
    }
    for (const item of items) {
      if (item.kind === "include") {
        const target = item.targets.find((candidate) => sources.has(candidate as ProjectPath));
        if (target !== undefined) visit(target as ProjectPath);
      } else if (headings < MAX_OUTLINE_HEADINGS) {
        headings++;
        const node: MutableNode = {
          title: item.title,
          level: item.level,
          line: item.line,
          file: path,
          children: [],
        };
        while ((stack.at(-1)?.level ?? -1) >= item.level) stack.pop();
        (stack.at(-1)?.children ?? nodes).push(node);
        stack.push(node);
      }
    }
    active.delete(path);
  };

  visit(root);
  return { nodes: nodes as readonly OutlineNode[], visited };
}

/** Sources that make up the document compiled from `entry`, in the order they are reached. */
export const documentFiles = (
  sources: ReadonlyMap<ProjectPath, string>,
  entry: ProjectPath,
): readonly ProjectPath[] => [...walk(sources, entry).visited];

/**
 * Heading tree of the document compiled from `entry`, following included files in document order.
 * When the file being edited is a source that the document does not include, its own outline is
 * returned instead. `sources` maps project paths to their text.
 */
export function buildOutline(
  sources: ReadonlyMap<ProjectPath, string>,
  entry: ProjectPath,
  activeFile?: ProjectPath,
): readonly OutlineNode[] {
  const document = walk(sources, entry);
  if (
    activeFile === undefined ||
    document.visited.has(activeFile) ||
    !sources.has(activeFile) ||
    scannerFor(activeFile) === undefined
  ) {
    return document.nodes;
  }
  return walk(sources, activeFile).nodes;
}
