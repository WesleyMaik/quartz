import type { Project } from "@qrtz/document-core";
import {
  isNearQuota,
  readStorageStatus,
  requestPersistentStorage,
  type StorageStatus,
} from "@qrtz/storage";
import { Badge, Button, DropdownMenu, Icon, toast } from "@qrtz/ui";
import { Add01Icon, DiamondIcon, Moon02Icon, MoreHorizontalIcon, Sun03Icon } from "@qrtz/ui/icons";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useServices } from "../../app/services";
import { useTheme } from "../../app/theme";
import { formatBytes, formatRelative } from "../../lib/format";
import { ConfirmDialog } from "../shared/confirm-dialog";
import { PromptDialog } from "../shared/prompt-dialog";
import { NewProjectDialog } from "./new-project-dialog";

export function DashboardPage() {
  const { db, projects } = useServices();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const list = useLiveQuery(() => db.projects.orderBy("updatedAt").reverse().toArray(), [db]);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<Project | undefined>();
  const [deleting, setDeleting] = useState<Project | undefined>();
  const [storage, setStorage] = useState<StorageStatus | undefined>();

  useEffect(() => {
    void readStorageStatus().then(setStorage);
  }, []);

  const afterCreate = async (project: Project) => {
    if (storage?.persisted === false) {
      const granted = await requestPersistentStorage();
      setStorage(await readStorageStatus());
      if (!granted)
        toast.message("Projects are stored in this browser only. Export backups regularly.");
    }
    navigate(`/p/${project.id}`);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2 font-semibold">
          <Icon icon={DiamondIcon} className="text-primary" /> Quartz
        </div>
        <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggle}>
          <Icon icon={theme === "dark" ? Sun03Icon : Moon02Icon} />
        </Button>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 overflow-auto px-6 py-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="font-semibold text-xl">Projects</h1>
            <p className="mt-1 text-muted-foreground">
              Stored locally in this browser. Nothing leaves your device.
            </p>
          </div>
          <Button onClick={() => setCreating(true)}>
            <Icon icon={Add01Icon} size={15} /> New project
          </Button>
        </div>

        {list === undefined ? null : list.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <p className="font-medium">No projects yet</p>
            <p className="mt-1 text-muted-foreground">
              Create a LaTeX or Typst project to start writing.
            </p>
            <Button className="mt-4" onClick={() => setCreating(true)}>
              Create your first project
            </Button>
          </div>
        ) : (
          <ul className="divide-y rounded-lg border" aria-label="Projects">
            {list.map((project) => (
              <li key={project.id} className="flex items-center gap-3 px-4 py-3 hover:bg-panel">
                <button
                  type="button"
                  className="min-w-0 flex-1 cursor-pointer text-left"
                  onClick={() => navigate(`/p/${project.id}`)}
                >
                  <div className="truncate font-medium">{project.title}</div>
                  <div className="text-muted-foreground text-xs">
                    Edited {formatRelative(project.updatedAt)}
                  </div>
                </button>
                <Badge>{project.engine === "latex" ? "LaTeX" : "Typst"}</Badge>
                <DropdownMenu
                  trigger={
                    <Button variant="ghost" size="icon" aria-label={`Actions for ${project.title}`}>
                      <Icon icon={MoreHorizontalIcon} />
                    </Button>
                  }
                  actions={[
                    { id: "open", label: "Open", onSelect: () => navigate(`/p/${project.id}`) },
                    { id: "rename", label: "Rename", onSelect: () => setRenaming(project) },
                    {
                      id: "duplicate",
                      label: "Duplicate",
                      onSelect: async () => {
                        const result = await projects.duplicate(project);
                        if (!result.ok) toast.error(result.error.message);
                      },
                    },
                    {
                      id: "delete",
                      label: "Delete",
                      destructive: true,
                      onSelect: () => setDeleting(project),
                    },
                  ]}
                />
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="flex h-9 shrink-0 items-center gap-3 border-t px-4 text-muted-foreground text-xs">
        {storage?.usageBytes === undefined ? (
          <span>Storage usage unavailable</span>
        ) : (
          <span className={isNearQuota(storage) ? "text-warning" : undefined}>
            {formatBytes(storage.usageBytes)} used
            {storage.quotaBytes === undefined ? "" : ` of ${formatBytes(storage.quotaBytes)}`}
          </span>
        )}
        <span>·</span>
        <span>
          {storage?.persisted === true
            ? "Persistent storage granted"
            : "Storage may be cleared by the browser. Clearing site data deletes projects."}
        </span>
      </footer>

      <NewProjectDialog open={creating} onOpenChange={setCreating} onCreated={afterCreate} />
      <PromptDialog
        open={renaming !== undefined}
        onOpenChange={(open) => !open && setRenaming(undefined)}
        title="Rename project"
        label="Title"
        initialValue={renaming?.title ?? ""}
        confirmLabel="Rename"
        onSubmit={async (value) => {
          if (renaming === undefined) return undefined;
          const result = await projects.rename(renaming.id, value);
          return result.ok ? undefined : result.error.message;
        }}
      />
      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title={`Delete "${deleting?.title ?? ""}"?`}
        description="All files of this project are removed from this browser. This cannot be undone."
        confirmLabel="Delete project"
        destructive
        onConfirm={async () => {
          if (deleting === undefined) return;
          const result = await projects.delete(deleting.id);
          if (!result.ok) toast.error(result.error.message);
        }}
      />
    </div>
  );
}
