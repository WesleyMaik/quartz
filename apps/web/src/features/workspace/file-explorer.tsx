import type { FileEntry, Project, ProjectPath } from "@qrtz/document-core";
import { Button, ContextMenu, cn, Icon, type MenuAction, toast } from "@qrtz/ui";
import {
  ArrowRight01Icon,
  File01Icon,
  FileAddIcon,
  Folder01Icon,
  FolderAddIcon,
  FolderOpenIcon,
  StarIcon,
  Upload04Icon,
} from "@qrtz/ui/icons";
import { useMemo, useRef, useState } from "react";
import { useServices } from "../../app/services";
import { ConfirmDialog } from "../shared/confirm-dialog";
import { PromptDialog } from "../shared/prompt-dialog";
import { buildFileTree, type TreeNode } from "./file-tree";

type PendingAction =
  | { readonly kind: "new-file" | "new-folder"; readonly parent: string }
  | { readonly kind: "rename"; readonly path: ProjectPath };

const parentOf = (path: string): string =>
  path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
const join = (parent: string, name: string): string => (parent === "" ? name : `${parent}/${name}`);

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
  const [deleting, setDeleting] = useState<TreeNode | undefined>();
  const uploadRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef("");

  const toggle = (path: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const actionsFor = (node: TreeNode): MenuAction[] => {
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
        onSelect: () => {
          uploadTarget.current = folder;
          uploadRef.current?.click();
        },
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
      onSelect: () => setDeleting(node),
    });
    return actions;
  };

  const renderNode = (node: TreeNode, depth: number) => {
    const isFolder = node.kind === "folder";
    const open = isFolder && !collapsed.has(node.path);
    return (
      <li key={node.path}>
        <ContextMenu actions={actionsFor(node)}>
          <button
            type="button"
            aria-expanded={isFolder ? open : undefined}
            aria-current={node.path === activePath ? "page" : undefined}
            className={cn(
              "flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-md pr-2 text-left text-muted-foreground transition-colors duration-150 hover:bg-muted/70 hover:text-foreground",
              node.path === activePath &&
                "bg-accent font-medium text-accent-foreground hover:bg-accent hover:text-accent-foreground",
            )}
            style={{ paddingLeft: 6 + depth * 12 }}
            onClick={() => (isFolder ? toggle(node.path) : onOpen(node.path))}
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

  return (
    <nav className="flex h-full flex-col bg-background" aria-label="Project files">
      <div className="flex h-11 shrink-0 items-center justify-between pr-1 pl-3">
        <span className="font-semibold text-sm tracking-tight">Files</span>
        <div className="flex">
          <Button
            variant="ghost"
            size="icon"
            aria-label="New file"
            onClick={() => setPending({ kind: "new-file", parent: "" })}
          >
            <Icon icon={FileAddIcon} size={15} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="New folder"
            onClick={() => setPending({ kind: "new-folder", parent: "" })}
          >
            <Icon icon={FolderAddIcon} size={15} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Upload files"
            onClick={() => {
              uploadTarget.current = "";
              uploadRef.current?.click();
            }}
          >
            <Icon icon={Upload04Icon} size={15} />
          </Button>
        </div>
      </div>
      <ul className="flex-1 overflow-auto px-2 pb-2">{tree.map((node) => renderNode(node, 0))}</ul>

      <input
        ref={uploadRef}
        type="file"
        multiple
        className="hidden"
        onChange={async (event) => {
          const selected = [...(event.target.files ?? [])];
          event.target.value = "";
          for (const file of selected) {
            const result = await files.upload(project.id, uploadTarget.current, file);
            if (!result.ok) toast.error(`${file.name}: ${result.error.message}`);
          }
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
          return undefined;
        }}
      />
      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title={`Delete ${deleting?.name ?? ""}?`}
        description={
          deleting?.kind === "folder"
            ? "The folder and everything inside it will be deleted. This cannot be undone."
            : "This file will be deleted. This cannot be undone."
        }
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (deleting === undefined) return;
          const result = await files.remove(project.id, deleting.path);
          if (!result.ok) toast.error(result.error.message);
          else onDeleted(deleting.path);
        }}
      />
    </nav>
  );
}
