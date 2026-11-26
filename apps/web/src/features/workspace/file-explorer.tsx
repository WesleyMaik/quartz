import {
  type FileEntry,
  type Project,
  type ProjectPath,
  parseProjectPath,
  type UploadPlan,
} from "@qrtz/document-core";
import { Button, ContextMenu, cn, Icon, type MenuAction, toast } from "@qrtz/ui";
import {
  ArrowRight01Icon,
  File01Icon,
  FileAddIcon,
  Folder01Icon,
  FolderAddIcon,
  FolderOpenIcon,
  FolderUploadIcon,
  StarIcon,
  Upload04Icon,
} from "@qrtz/ui/icons";
import {
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useServices } from "../../app/services";
import type { UploadSource } from "../../services/file-service";
import { ConfirmDialog } from "../shared/confirm-dialog";
import { PromptDialog } from "../shared/prompt-dialog";
import {
  isOsFileDrag,
  QUARTZ_PATHS_TYPE,
  readDroppedFiles,
  sourcesFromInput,
} from "./dropped-files";
import { buildFileTree, type TreeNode } from "./file-tree";
import { UploadConfirmDialog } from "./upload-confirm-dialog";

type PendingAction =
  | { readonly kind: "new-file" | "new-folder"; readonly parent: string }
  | { readonly kind: "rename"; readonly path: ProjectPath };

interface PendingUpload {
  readonly plan: UploadPlan;
  readonly sources: readonly UploadSource[];
  readonly folder: string;
}

interface Marquee {
  readonly startX: number;
  readonly startY: number;
  readonly x: number;
  readonly y: number;
  readonly base: ReadonlySet<ProjectPath>;
}

/** Hovering a collapsed folder this long while dragging opens it. */
const AUTO_EXPAND_MS = 600;
/** Pointer travel before a press on empty space becomes a selection rectangle. */
const MARQUEE_THRESHOLD = 4;

const parentOf = (path: string): string =>
  path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
const join = (parent: string, name: string): string => (parent === "" ? name : `${parent}/${name}`);

/** Drag payloads can come from other tabs or pages; only valid project paths are accepted. */
function parseDraggedPaths(raw: string): ProjectPath[] {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      if (typeof item !== "string") return [];
      const parsed = parseProjectPath(item);
      return parsed.ok ? [parsed.value] : [];
    });
  } catch {
    return [];
  }
}

export function FileExplorer({
  project,
  entries,
  activePath,
  dirtyPaths,
  onOpen,
  onRenamed,
  onDeleted,
}: {
  readonly project: Project;
  readonly entries: readonly FileEntry[];
  readonly activePath: string | undefined;
  readonly dirtyPaths: ReadonlySet<string>;
  readonly onOpen: (path: ProjectPath) => void;
  readonly onRenamed: (from: string, to: string) => void;
  readonly onDeleted: (path: string) => void;
}) {
  const { files } = useServices();
  const tree = useMemo(() => buildFileTree(entries), [entries]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [pending, setPending] = useState<PendingAction | undefined>();
  const [deleting, setDeleting] = useState<readonly TreeNode[]>([]);
  const [selected, setSelected] = useState<ReadonlySet<ProjectPath>>(new Set());
  const [anchor, setAnchor] = useState<ProjectPath | undefined>();
  const [dropTarget, setDropTarget] = useState<string | undefined>();
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | undefined>();
  const [marquee, setMarquee] = useState<Marquee | undefined>();
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef("");
  const listRef = useRef<HTMLUListElement>(null);
  const expandTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const nodes = useMemo(() => {
    const byPath = new Map<string, TreeNode>();
    const visit = (list: readonly TreeNode[]) => {
      for (const node of list) {
        byPath.set(node.path, node);
        visit(node.children);
      }
    };
    visit(tree);
    return byPath;
  }, [tree]);

  /** Rows in screen order, for Shift+click ranges. */
  const visible = useMemo(() => {
    const out: ProjectPath[] = [];
    const visit = (list: readonly TreeNode[]) => {
      for (const node of list) {
        out.push(node.path);
        if (node.kind === "folder" && !collapsed.has(node.path)) visit(node.children);
      }
    };
    visit(tree);
    return out;
  }, [tree, collapsed]);

  // Drop selections whose files were removed or renamed elsewhere.
  useEffect(() => {
    setSelected((current) => {
      const next = new Set([...current].filter((path) => nodes.has(path)));
      return next.size === current.size ? current : next;
    });
  }, [nodes]);

  useEffect(() => () => clearTimeout(expandTimer.current), []);

  const setOpen = (path: string, open: boolean) =>
    setCollapsed((current) => {
      if (current.has(path) !== open) return current;
      const next = new Set(current);
      if (open) next.delete(path);
      else next.add(path);
      return next;
    });

  /** Folder that header actions target: the single selected folder, else the root. */
  const selectedFolder = (): string => {
    if (selected.size !== 1) return "";
    const [only] = selected;
    return only !== undefined && nodes.get(only)?.kind === "folder" ? only : "";
  };

  const pickFiles = (folder: string, input: HTMLInputElement | null) => {
    uploadTarget.current = folder;
    input?.click();
  };

  const startUpload = async (
    sources: readonly UploadSource[],
    folder: string,
    confirm: boolean,
  ) => {
    if (sources.length === 0) return;
    const plan = await files.planUpload(project.id, sources, folder);
    if (!plan.ok) {
      toast.error(plan.error.message);
      return;
    }
    if (plan.value.uploads.length === 0) {
      toast.message("Nothing to upload: every file was skipped or already exists.");
      return;
    }
    if (confirm || plan.value.skipped.length > 0) {
      setPendingUpload({ plan: plan.value, sources, folder });
      return;
    }
    await applyUpload({ plan: plan.value, sources, folder });
  };

  const applyUpload = async ({ plan, sources, folder }: PendingUpload) => {
    const outcome = await files.applyUpload(project.id, plan, sources);
    if (folder !== "") setOpen(folder, true);
    for (const name of plan.folders) setOpen(join(folder, name), true);
    if (outcome.done.length > 0) {
      const where = folder === "" ? "" : ` to ${folder}/`;
      toast.success(
        `Uploaded ${outcome.done.length} ${outcome.done.length === 1 ? "file" : "files"}${where}`,
      );
    }
    for (const message of outcome.failed) toast.error(message);
  };

  const moveInto = async (paths: readonly ProjectPath[], folder: string) => {
    const outcome = await files.moveMany(project.id, paths, folder);
    for (const move of outcome.done) onRenamed(move.from, move.to);
    if (outcome.done.length > 0) {
      if (folder !== "") setOpen(folder, true);
      setSelected(new Set(outcome.done.map((move) => move.to)));
    }
    for (const message of outcome.failed) toast.error(message);
  };

  // --- Selection -------------------------------------------------------------------------------

  const onRowClick = (event: MouseEvent, node: TreeNode) => {
    if (event.ctrlKey || event.metaKey) {
      setSelected((current) => {
        const next = new Set(current);
        if (next.has(node.path)) next.delete(node.path);
        else next.add(node.path);
        return next;
      });
      setAnchor(node.path);
      return;
    }
    if (event.shiftKey && anchor !== undefined) {
      const from = visible.indexOf(anchor);
      const to = visible.indexOf(node.path);
      if (from !== -1 && to !== -1) {
        setSelected(new Set(visible.slice(Math.min(from, to), Math.max(from, to) + 1)));
        return;
      }
    }
    setSelected(new Set([node.path]));
    setAnchor(node.path);
    if (node.kind === "folder") setOpen(node.path, collapsed.has(node.path));
    else onOpen(node.path);
  };

  const onListKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && selected.size > 0) {
      event.stopPropagation();
      setSelected(new Set());
    }
  };

  // Selection rectangle: starts on empty list space, selects every row it touches.
  const onListPointerDown = (event: PointerEvent<HTMLUListElement>) => {
    if (event.button !== 0 || event.pointerType === "touch") return;
    if ((event.target as HTMLElement).closest("[data-path]") !== null) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const additive = event.ctrlKey || event.metaKey;
    setMarquee({
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      base: additive ? selected : new Set(),
    });
  };

  const onListPointerMove = (event: PointerEvent<HTMLUListElement>) => {
    if (marquee === undefined) return;
    const next = { ...marquee, x: event.clientX, y: event.clientY };
    setMarquee(next);
    const left = Math.min(next.startX, next.x);
    const right = Math.max(next.startX, next.x);
    const top = Math.min(next.startY, next.y);
    const bottom = Math.max(next.startY, next.y);
    if (right - left < MARQUEE_THRESHOLD && bottom - top < MARQUEE_THRESHOLD) return;
    const hit = new Set(next.base);
    for (const row of listRef.current?.querySelectorAll<HTMLElement>("[data-path]") ?? []) {
      const box = row.getBoundingClientRect();
      if (box.bottom >= top && box.top <= bottom && box.right >= left && box.left <= right) {
        hit.add(row.dataset.path as ProjectPath);
      }
    }
    setSelected(hit);
  };

  const onListPointerUp = (event: PointerEvent<HTMLUListElement>) => {
    if (marquee === undefined) return;
    const moved =
      Math.abs(event.clientX - marquee.startX) >= MARQUEE_THRESHOLD ||
      Math.abs(event.clientY - marquee.startY) >= MARQUEE_THRESHOLD;
    // A plain click on empty space clears the selection.
    if (!moved && marquee.base.size === 0) setSelected(new Set());
    setMarquee(undefined);
  };

  // --- Drag and drop ---------------------------------------------------------------------------

  const onRowDragStart = (event: DragEvent, node: TreeNode) => {
    const paths = selected.has(node.path) ? [...selected] : [node.path];
    if (!selected.has(node.path)) setSelected(new Set([node.path]));
    event.dataTransfer.setData(QUARTZ_PATHS_TYPE, JSON.stringify(paths));
    event.dataTransfer.effectAllowed = "move";
  };

  const acceptsDrag = (event: DragEvent): boolean =>
    event.dataTransfer.types.includes(QUARTZ_PATHS_TYPE) || isOsFileDrag(event.dataTransfer);

  const onDragOverTarget = (event: DragEvent, folder: string) => {
    if (!acceptsDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = isOsFileDrag(event.dataTransfer) ? "copy" : "move";
    if (dropTarget === folder) return;
    setDropTarget(folder);
    clearTimeout(expandTimer.current);
    if (folder !== "" && collapsed.has(folder)) {
      expandTimer.current = setTimeout(() => setOpen(folder, true), AUTO_EXPAND_MS);
    }
  };

  const onDropTarget = async (event: DragEvent, folder: string) => {
    if (!acceptsDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    clearTimeout(expandTimer.current);
    setDropTarget(undefined);
    const internal = event.dataTransfer.getData(QUARTZ_PATHS_TYPE);
    if (internal !== "") {
      await moveInto(parseDraggedPaths(internal), folder);
      return;
    }
    const { sources, hasFolders } = await readDroppedFiles(event.dataTransfer);
    await startUpload(sources, folder, hasFolders);
  };

  const clearDrop = () => {
    clearTimeout(expandTimer.current);
    setDropTarget(undefined);
  };

  // --- Menus -----------------------------------------------------------------------------------

  const actionsFor = (node: TreeNode): MenuAction[] => {
    if (selected.size > 1 && selected.has(node.path)) {
      const targets = [...selected].flatMap((path) => nodes.get(path) ?? []);
      return [
        {
          id: "delete-selected",
          label: `Delete ${targets.length} items`,
          destructive: true,
          onSelect: () => setDeleting(targets),
        },
      ];
    }
    const folder = node.kind === "folder" ? node.path : parentOf(node.path);
    const actions: MenuAction[] = [
      {
        id: "new-file",
        label: "New file…",
        onSelect: () => setPending({ kind: "new-file", parent: folder }),
      },
      {
        id: "new-folder",
        label: "New folder…",
        onSelect: () => setPending({ kind: "new-folder", parent: folder }),
      },
      {
        id: "upload",
        label: "Upload files…",
        onSelect: () => pickFiles(folder, fileInput.current),
      },
      {
        id: "upload-folder",
        label: "Upload folder…",
        onSelect: () => pickFiles(folder, folderInput.current),
      },
      {
        id: "rename",
        label: "Rename…",
        onSelect: () => setPending({ kind: "rename", path: node.path }),
      },
    ];
    if (node.kind === "source" && node.path !== project.entry) {
      actions.push({
        id: "entry",
        label: "Set as main document",
        onSelect: () => void files.setEntry(project.id, node.path),
      });
    }
    actions.push({
      id: "delete",
      label: "Delete",
      destructive: true,
      onSelect: () => setDeleting([node]),
    });
    return actions;
  };

  // --- Rendering -------------------------------------------------------------------------------

  const renderNode = (node: TreeNode, depth: number) => {
    const isFolder = node.kind === "folder";
    const open = isFolder && !collapsed.has(node.path);
    const isSelected = selected.has(node.path);
    const dropFolder = isFolder ? node.path : parentOf(node.path);
    return (
      <li key={node.path}>
        <ContextMenu actions={actionsFor(node)}>
          <button
            type="button"
            data-path={node.path}
            draggable
            aria-expanded={isFolder ? open : undefined}
            aria-current={node.path === activePath ? "page" : undefined}
            className={cn(
              "flex h-7 w-full cursor-pointer select-none items-center gap-1.5 rounded-md pr-2 text-left text-muted-foreground transition-[background-color,color,box-shadow] duration-150 hover:bg-muted/70 hover:text-foreground",
              node.path === activePath &&
                "bg-accent font-medium text-accent-foreground hover:bg-accent hover:text-accent-foreground",
              isSelected &&
                "bg-primary/12 text-foreground ring-1 ring-primary/30 ring-inset hover:bg-primary/15",
              isFolder &&
                dropTarget === node.path &&
                "bg-primary/15 text-foreground ring-2 ring-primary/60 ring-inset",
            )}
            style={{ paddingLeft: 6 + depth * 12 }}
            onClick={(event) => onRowClick(event, node)}
            onDragStart={(event) => onRowDragStart(event, node)}
            onDragEnd={clearDrop}
            onDragOver={(event) => onDragOverTarget(event, dropFolder)}
            onDrop={(event) => void onDropTarget(event, dropFolder)}
          >
            {isFolder ? (
              <Icon
                icon={ArrowRight01Icon}
                size={12}
                className={cn(
                  "text-muted-foreground transition-transform duration-200 ease-out",
                  open && "rotate-90",
                )}
              />
            ) : (
              <span className="w-3" />
            )}
            <Icon
              icon={isFolder ? (open ? FolderOpenIcon : Folder01Icon) : File01Icon}
              size={15}
              className="shrink-0 opacity-80"
            />
            <span className="truncate">{node.name}</span>
            {isSelected ? <span className="sr-only">(selected)</span> : null}
            {node.path === project.entry ? (
              <Icon icon={StarIcon} size={12} className="text-warning" aria-label="Main document" />
            ) : null}
            {dirtyPaths.has(node.path) ? (
              <span className="zoom-in-0 ml-auto size-1.5 shrink-0 animate-in rounded-full bg-warning">
                <span className="sr-only">Unsaved</span>
              </span>
            ) : null}
          </button>
        </ContextMenu>
        {open && node.children.length > 0 ? (
          <ul className="fade-in slide-in-from-top-1 animate-in duration-150">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </ul>
        ) : null}
      </li>
    );
  };

  const prompt = (() => {
    if (pending === undefined) return { title: "", label: "", initial: "", confirm: "" };
    if (pending.kind === "rename") {
      return { title: "Rename", label: "Path", initial: pending.path, confirm: "Rename" };
    }
    const isFile = pending.kind === "new-file";
    return {
      title: isFile ? "New file" : "New folder",
      label: "Path",
      initial: join(
        pending.parent,
        isFile ? (project.engine === "typst" ? "untitled.typ" : "untitled.tex") : "folder",
      ),
      confirm: "Create",
    };
  })();

  const marqueeBox =
    marquee === undefined || listRef.current === null
      ? undefined
      : (() => {
          const bounds = listRef.current.getBoundingClientRect();
          const scroll = listRef.current.scrollTop;
          return {
            left: Math.min(marquee.startX, marquee.x) - bounds.left,
            top: Math.min(marquee.startY, marquee.y) - bounds.top + scroll,
            width: Math.abs(marquee.x - marquee.startX),
            height: Math.abs(marquee.y - marquee.startY),
          };
        })();

  return (
    <nav className="flex h-full flex-col bg-background" aria-label="Project files">
      <div className="flex h-11 shrink-0 items-center justify-between pr-1 pl-3">
        <span className="font-semibold text-sm tracking-tight">
          Files
          {selected.size > 1 ? (
            <span className="fade-in ml-2 animate-in font-normal text-muted-foreground text-xs">
              {selected.size} selected
            </span>
          ) : null}
        </span>
        <div className="flex">
          <Button
            variant="ghost"
            size="icon"
            aria-label="New file"
            onClick={() => setPending({ kind: "new-file", parent: selectedFolder() })}
          >
            <Icon icon={FileAddIcon} size={15} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="New folder"
            onClick={() => setPending({ kind: "new-folder", parent: selectedFolder() })}
          >
            <Icon icon={FolderAddIcon} size={15} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Upload files"
            title="Upload files"
            onClick={() => pickFiles(selectedFolder(), fileInput.current)}
          >
            <Icon icon={Upload04Icon} size={15} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Upload folder"
            title="Upload folder"
            onClick={() => pickFiles(selectedFolder(), folderInput.current)}
          >
            <Icon icon={FolderUploadIcon} size={15} />
          </Button>
        </div>
      </div>
      <ul
        ref={listRef}
        aria-label="Project tree"
        className={cn(
          "relative flex-1 overflow-auto rounded-lg px-2 pb-2 outline-none transition-[background-color,box-shadow] duration-150",
          dropTarget === "" && "bg-primary/5 ring-2 ring-primary/40 ring-inset",
        )}
        onKeyDown={onListKeyDown}
        onPointerDown={onListPointerDown}
        onPointerMove={onListPointerMove}
        onPointerUp={onListPointerUp}
        onPointerCancel={() => setMarquee(undefined)}
        onDragOver={(event) => onDragOverTarget(event, "")}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) clearDrop();
        }}
        onDrop={(event) => void onDropTarget(event, "")}
      >
        {tree.map((node) => renderNode(node, 0))}
        {marqueeBox === undefined ? null : (
          <li
            aria-hidden="true"
            className="pointer-events-none absolute rounded-sm border border-primary/60 bg-primary/10"
            style={marqueeBox}
          />
        )}
      </ul>

      <input
        ref={fileInput}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const sources = sourcesFromInput(event.target.files);
          event.target.value = "";
          void startUpload(sources, uploadTarget.current, false);
        }}
      />
      <input
        ref={(element) => {
          folderInput.current = element;
          // Not in React's typings; the folder picker fills `webkitRelativePath` for each file.
          if (element !== null) element.webkitdirectory = true;
        }}
        type="file"
        className="hidden"
        onChange={(event) => {
          const sources = sourcesFromInput(event.target.files);
          event.target.value = "";
          void startUpload(sources, uploadTarget.current, true);
        }}
      />

      <UploadConfirmDialog
        plan={pendingUpload?.plan}
        folder={pendingUpload?.folder ?? ""}
        onCancel={() => setPendingUpload(undefined)}
        onConfirm={() => {
          const upload = pendingUpload;
          setPendingUpload(undefined);
          if (upload !== undefined) void applyUpload(upload);
        }}
      />
      <PromptDialog
        open={pending !== undefined}
        onOpenChange={(open) => !open && setPending(undefined)}
        title={prompt.title}
        label={prompt.label}
        initialValue={prompt.initial}
        confirmLabel={prompt.confirm}
        onSubmit={async (value) => {
          if (pending === undefined) return undefined;
          if (pending.kind === "rename") {
            const result = await files.move(project.id, pending.path, value);
            if (!result.ok) return result.error.message;
            onRenamed(pending.path, value.trim());
            return undefined;
          }
          const result =
            pending.kind === "new-file"
              ? await files.createFile(project.id, value)
              : await files.createFolder(project.id, value);
          if (!result.ok) return result.error.message;
          if (pending.kind === "new-file") onOpen(result.value.path);
          else if (pending.parent !== "") setOpen(pending.parent, true);
          return undefined;
        }}
      />
      <ConfirmDialog
        open={deleting.length > 0}
        onOpenChange={(open) => !open && setDeleting([])}
        title={
          deleting.length === 1
            ? `Delete ${deleting[0]?.name ?? ""}?`
            : `Delete ${deleting.length} items?`
        }
        description={
          deleting.some((node) => node.kind === "folder")
            ? "Selected folders and everything inside them will be deleted. This cannot be undone."
            : "This cannot be undone."
        }
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          const targets = deleting.filter(
            (node) =>
              !deleting.some((other) => other !== node && node.path.startsWith(`${other.path}/`)),
          );
          for (const node of targets) {
            const result = await files.remove(project.id, node.path);
            if (!result.ok) toast.error(result.error.message);
            else onDeleted(node.path);
          }
          setSelected(new Set());
        }}
      />
    </nav>
  );
}
