import type { Engine, Project } from "@qrtz/document-core";
import {
  isNearQuota,
  readStorageStatus,
  requestPersistentStorage,
  type StorageStatus,
} from "@qrtz/storage";
import { Badge, Button, cn, DropdownMenu, Icon, Input, toast } from "@qrtz/ui";
import {
  Add01Icon,
  File01Icon,
  Folder01Icon,
  Moon02Icon,
  MoreHorizontalIcon,
  Search01Icon,
  Sun03Icon,
} from "@qrtz/ui/icons";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useServices } from "../../app/services";
import { useTheme } from "../../app/theme";
import { formatBytes, formatRelative } from "../../lib/format";
import { ConfirmDialog } from "../shared/confirm-dialog";
import { PromptDialog } from "../shared/prompt-dialog";
import { QuartzLogo } from "../shared/quartz-logo";
import { NewProjectDialog } from "./new-project-dialog";

type EngineFilter = "all" | Engine;

const FILTERS: readonly { readonly id: EngineFilter; readonly label: string }[] = [
  { id: "all", label: "All projects" },
  { id: "latex", label: "LaTeX" },
  { id: "typst", label: "Typst" },
];

/** Rows beyond this index appear without a stagger delay, so long lists do not feel slow. */
const MAX_STAGGERED_ROWS = 12;

export function DashboardPage() {
  const { db, projects } = useServices();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const list = useLiveQuery(() => db.projects.orderBy("updatedAt").reverse().toArray(), [db]);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<Project | undefined>();
  const [deleting, setDeleting] = useState<Project | undefined>();
  const [storage, setStorage] = useState<StorageStatus | undefined>();
  const [filter, setFilter] = useState<EngineFilter>("all");
  const [query, setQuery] = useState("");

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

  const needle = query.trim().toLowerCase();
  const visible = list?.filter(
    (project) =>
      (filter === "all" || project.engine === filter) &&
      (needle === "" || project.title.toLowerCase().includes(needle)),
  );
  const heading = FILTERS.find((item) => item.id === filter)?.label ?? "Projects";
  const usageRatio =
    storage?.usageBytes !== undefined && storage.quotaBytes !== undefined && storage.quotaBytes > 0
      ? Math.min(1, storage.usageBytes / storage.quotaBytes)
      : undefined;

  return (
    <div className="flex h-full bg-background">
      <aside className="flex w-60 shrink-0 flex-col gap-6 px-3 py-4">
        <div className="flex items-center justify-between pl-2">
          <div className="group flex items-center gap-2 font-semibold tracking-tight">
            <QuartzLogo
              size={28}
              className="transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-110"
            />
            Quartz
          </div>
          <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggle}>
            <Icon
              key={theme}
              icon={theme === "dark" ? Sun03Icon : Moon02Icon}
              className="fade-in spin-in-45 animate-in duration-300"
            />
          </Button>
        </div>

        <nav aria-label="Project filters" className="flex flex-col gap-0.5">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={filter === item.id ? "page" : undefined}
              onClick={() => setFilter(item.id)}
              className={cn(
                "pressable flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-3 text-left text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                filter === item.id && "bg-muted font-medium text-foreground",
              )}
            >
              <Icon icon={item.id === "all" ? Folder01Icon : File01Icon} size={15} />
              {item.label}
              {list === undefined ? null : (
                <span className="ml-auto text-muted-foreground text-xs tabular-nums">
                  {item.id === "all"
                    ? list.length
                    : list.filter((project) => project.engine === item.id).length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto rounded-lg border bg-card p-3 text-muted-foreground text-xs shadow-xs">
          {storage?.usageBytes === undefined ? (
            <p>Storage usage unavailable</p>
          ) : (
            <>
              <p
                className={cn(
                  "font-medium text-foreground",
                  isNearQuota(storage) && "text-warning",
                )}
              >
                {formatBytes(storage.usageBytes)} used
                {storage.quotaBytes === undefined ? "" : ` of ${formatBytes(storage.quotaBytes)}`}
              </p>
              {usageRatio === undefined ? null : (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full min-w-1 rounded-full transition-[width] duration-500 ease-out",
                      isNearQuota(storage) ? "bg-warning" : "bg-primary",
                    )}
                    style={{ width: `${usageRatio * 100}%` }}
                  />
                </div>
              )}
            </>
          )}
          <p className="mt-2 leading-relaxed">
            {storage?.persisted === true
              ? "Persistent storage granted. Nothing leaves your device."
              : "Storage may be cleared by the browser. Clearing site data deletes projects."}
          </p>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden py-2 pr-2">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
          <header className="flex h-16 shrink-0 items-center gap-3 border-b px-6">
            <h1 className="truncate font-semibold text-lg tracking-tight">{heading}</h1>
            <div className="flex-1" />
            <div className="relative w-full max-w-72">
              <Icon
                icon={Search01Icon}
                size={15}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search projects"
                aria-label="Search projects"
                className="rounded-full pl-9"
              />
            </div>
            <Button onClick={() => setCreating(true)}>
              <Icon icon={Add01Icon} size={15} /> New
            </Button>
          </header>

          <div className="min-h-0 flex-1 overflow-auto">
            {visible === undefined ? null : list?.length === 0 ? (
              <div className="fade-in zoom-in-95 m-auto flex h-full max-w-sm animate-in flex-col items-center justify-center text-center duration-300">
                <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Icon icon={File01Icon} size={22} />
                </span>
                <p className="font-medium text-base">No projects yet</p>
                <p className="mt-1 text-muted-foreground">
                  Create a LaTeX or Typst project to start writing. Everything stays in this
                  browser.
                </p>
                <Button className="mt-5" onClick={() => setCreating(true)}>
                  <Icon icon={Add01Icon} size={15} /> Create your first project
                </Button>
              </div>
            ) : visible.length === 0 ? (
              <p className="fade-in animate-in p-10 text-center text-muted-foreground">
                No projects match your search.
              </p>
            ) : (
              <>
                <div className="flex h-9 items-center gap-3 px-6 text-muted-foreground text-xs">
                  <span className="flex-1">Name</span>
                  <span className="w-28 text-right">Edited</span>
                  <span className="w-7" />
                </div>
                <ul className="px-3 pb-3" aria-label="Projects">
                  {visible.map((project, index) => (
                    <li
                      key={project.id}
                      className="group fade-in slide-in-from-bottom-1 flex animate-in items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-150 fill-mode-both hover:bg-muted/60"
                      style={{ animationDelay: `${Math.min(index, MAX_STAGGERED_ROWS) * 25}ms` }}
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md text-left"
                        onClick={() => navigate(`/p/${project.id}`)}
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground transition-[color,border-color] duration-150 group-hover:border-primary/30 group-hover:text-primary">
                          <Icon icon={File01Icon} size={16} />
                        </span>
                        <span className="truncate font-medium">{project.title}</span>
                        <Badge>{project.engine === "latex" ? "LaTeX" : "Typst"}</Badge>
                      </button>
                      <span className="w-28 text-right text-muted-foreground text-xs">
                        {formatRelative(project.updatedAt)}
                      </span>
                      <DropdownMenu
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Actions for ${project.title}`}
                            className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100 data-[popup-open]:opacity-100"
                          >
                            <Icon icon={MoreHorizontalIcon} />
                          </Button>
                        }
                        actions={[
                          {
                            id: "open",
                            label: "Open",
                            onSelect: () => navigate(`/p/${project.id}`),
                          },
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
              </>
            )}
          </div>
        </div>
      </main>

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
