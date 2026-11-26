import type { Engine, Project } from "@qrtz/document-core";
import {
  isNearQuota,
  readStorageStatus,
  requestPersistentStorage,
  type StorageStatus,
} from "@qrtz/storage";
import { Badge, Button, cn, DropdownMenu, Icon, Input, type MenuAction, toast } from "@qrtz/ui";
import {
  Add01Icon,
  ArrowDown01Icon,
  File01Icon,
  Folder01Icon,
  GridViewIcon,
  ListViewIcon,
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
import { useSidebar } from "../../app/use-sidebar";
import { formatBytes, formatRelative } from "../../lib/format";
import { ConfirmDialog } from "../shared/confirm-dialog";
import { PromptDialog } from "../shared/prompt-dialog";
import { QuartzLogo } from "../shared/quartz-logo";
import { SidebarToggle } from "../shared/sidebar-toggle";
import { NewProjectDialog } from "./new-project-dialog";
import { type DashboardView, useDashboardView } from "./use-dashboard-view";

type EngineFilter = "all" | Engine;

const FILTERS: readonly { readonly id: EngineFilter; readonly label: string }[] = [
  { id: "all", label: "All projects" },
  { id: "latex", label: "LaTeX" },
  { id: "typst", label: "Typst" },
];

const VIEWS: readonly {
  readonly id: DashboardView;
  readonly label: string;
  readonly icon: typeof GridViewIcon;
}[] = [
  { id: "list", label: "List view", icon: ListViewIcon },
  { id: "grid", label: "Grid view", icon: GridViewIcon },
];

const engineName = (project: Project): string => (project.engine === "latex" ? "LaTeX" : "Typst");

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
  const [searchOpen, setSearchOpen] = useState(false);
  const sidebar = useSidebar("quartz:dashboard-sidebar");
  const { view, setView } = useDashboardView();
  const sizes = useLiveQuery(() => projects.sizes(), [projects]);

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
  const sizeOf = (project: Project): string => {
    const bytes = sizes?.get(project.id);
    return bytes === undefined ? "-" : formatBytes(bytes);
  };
  const stagger = (index: number) => ({
    animationDelay: `${Math.min(index, MAX_STAGGERED_ROWS) * 25}ms`,
  });
  const actionsFor = (project: Project): MenuAction[] => [
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
    { id: "delete", label: "Delete", destructive: true, onSelect: () => setDeleting(project) },
  ];
  const menuFor = (project: Project, className?: string) => (
    <DropdownMenu
      trigger={
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Actions for ${project.title}`}
          className={cn(
            "opacity-0 focus-visible:opacity-100 group-hover:opacity-100 data-[popup-open]:opacity-100",
            className,
          )}
        >
          <Icon icon={MoreHorizontalIcon} />
        </Button>
      }
      actions={actionsFor(project)}
    />
  );
  const heading = FILTERS.find((item) => item.id === filter)?.label ?? "Projects";
  const usageRatio =
    storage?.usageBytes !== undefined && storage.quotaBytes !== undefined && storage.quotaBytes > 0
      ? Math.min(1, storage.usageBytes / storage.quotaBytes)
      : undefined;

  return (
    <div className="flex h-full bg-background">
      <aside
        className={cn(
          "shrink-0 overflow-hidden transition-[width] duration-300 ease-out max-md:hidden",
          sidebar.collapsed ? "w-0" : "w-60",
        )}
        inert={sidebar.collapsed}
      >
        <div
          className={cn(
            "flex h-full w-60 flex-col gap-6 px-3 py-4 transition-[opacity,translate] duration-300 ease-out",
            sidebar.collapsed && "-translate-x-6 opacity-0",
          )}
        >
          <div className="flex items-center justify-between pl-2">
            <div className="group flex items-center gap-2 font-semibold tracking-tight">
              <QuartzLogo
                size={28}
                className="transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-110"
              />
              Quartz
            </div>
            <div className="flex items-center">
              <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggle}>
                <Icon
                  key={theme}
                  icon={theme === "dark" ? Sun03Icon : Moon02Icon}
                  className="fade-in spin-in-45 animate-in duration-300"
                />
              </Button>
              <SidebarToggle collapsed={false} onToggle={sidebar.toggle} />
            </div>
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
        </div>
      </aside>

      <main
        className={cn(
          "flex min-w-0 flex-1 flex-col overflow-hidden transition-[padding] duration-300 ease-out md:py-2 md:pr-2",
          sidebar.collapsed && "md:pl-2",
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b px-4 md:hidden">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <QuartzLogo size={26} />
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
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card md:rounded-xl md:border md:shadow-sm">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 md:h-16 md:gap-3 md:px-6">
            {sidebar.collapsed ? (
              <div className="fade-in slide-in-from-left-2 -ml-2 flex animate-in items-center gap-1 duration-300 max-md:hidden">
                <SidebarToggle collapsed onToggle={sidebar.toggle} />
                <QuartzLogo size={24} className="mr-1" />
              </div>
            ) : null}
            <h1 className="shrink-0 font-semibold text-lg tracking-tight max-md:hidden">
              {heading}
            </h1>
            {searchOpen ? null : (
              <DropdownMenu
                align="start"
                trigger={
                  <button
                    type="button"
                    className="pressable flex min-w-0 cursor-pointer items-center gap-1.5 rounded-md py-1 font-semibold text-lg tracking-tight md:hidden"
                  >
                    <span className="truncate">{heading}</span>
                    <Icon icon={ArrowDown01Icon} size={16} className="text-muted-foreground" />
                  </button>
                }
                actions={FILTERS.map((item) => ({
                  id: item.id,
                  label: item.label,
                  onSelect: () => setFilter(item.id),
                }))}
              />
            )}
            <div className="flex-1 max-md:hidden" />
            {searchOpen ? null : <div className="flex-1 md:hidden" />}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Search projects"
              onClick={() => setSearchOpen(true)}
              className={cn("size-9 md:hidden", searchOpen && "hidden")}
            >
              <Icon icon={Search01Icon} size={18} />
            </Button>
            <div
              className={cn(
                "relative min-w-0 flex-1 md:max-w-72",
                !searchOpen && "max-md:hidden",
                searchOpen && "fade-in slide-in-from-right-2 animate-in md:animate-none",
              )}
            >
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
                autoFocus={searchOpen}
                onBlur={() => {
                  if (query === "") setSearchOpen(false);
                }}
              />
            </div>
            <fieldset className="flex shrink-0 items-center rounded-full bg-muted p-0.5 max-sm:hidden">
              <legend className="sr-only">Layout</legend>
              {VIEWS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={item.label}
                  aria-pressed={view === item.id}
                  title={item.label}
                  onClick={() => setView(item.id)}
                  className={cn(
                    "pressable flex size-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:text-foreground",
                    view === item.id && "bg-card text-foreground shadow-xs",
                  )}
                >
                  <Icon icon={item.icon} size={15} />
                </button>
              ))}
            </fieldset>
            <Button
              onClick={() => setCreating(true)}
              aria-label="New project"
              className="max-md:size-9 max-md:px-0"
            >
              <Icon icon={Add01Icon} size={15} />
              <span className="max-md:hidden">New</span>
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
            ) : view === "grid" ? (
              <ul
                key="grid"
                className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 p-4 md:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] md:gap-4 md:p-6"
                aria-label="Projects"
              >
                {visible.map((project, index) => (
                  <li
                    key={project.id}
                    className="group fade-in zoom-in-95 relative animate-in fill-mode-both"
                    style={stagger(index)}
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/p/${project.id}`)}
                      className="pressable flex w-full cursor-pointer flex-col overflow-hidden rounded-lg border bg-card text-left hover:border-primary/30 hover:shadow-md"
                    >
                      <span className="flex aspect-[4/3] items-center justify-center bg-muted/60 text-muted-foreground transition-colors duration-200 group-hover:text-primary">
                        <span className="flex h-20 w-16 items-center justify-center rounded-sm bg-card shadow-sm transition-transform duration-300 ease-out group-hover:-translate-y-1">
                          <Icon icon={File01Icon} size={22} />
                        </span>
                      </span>
                      <span className="flex flex-col gap-1 border-t px-3 py-2.5">
                        <span className="truncate pr-6 font-medium">{project.title}</span>
                        <span className="flex items-center gap-2 text-muted-foreground text-xs">
                          <Badge>{engineName(project)}</Badge>
                          <span className="truncate">{formatRelative(project.updatedAt)}</span>
                          <span className="ml-auto shrink-0 tabular-nums">{sizeOf(project)}</span>
                        </span>
                      </span>
                    </button>
                    {menuFor(project, "absolute top-2 right-2 bg-card/80 backdrop-blur-sm")}
                  </li>
                ))}
              </ul>
            ) : (
              <div key="list" className="@container">
                <div className="flex h-9 items-center gap-3 px-6 text-muted-foreground text-xs">
                  <span className="flex-1">Name</span>
                  <span className="w-20 text-right @max-md:hidden">Size</span>
                  <span className="w-28 text-right @max-lg:hidden">Edited</span>
                  <span className="w-7" />
                </div>
                <ul className="px-3 pb-3" aria-label="Projects">
                  {visible.map((project, index) => (
                    <li
                      key={project.id}
                      className="group fade-in slide-in-from-bottom-1 flex animate-in items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-150 fill-mode-both hover:bg-muted/60"
                      style={stagger(index)}
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
                        <Badge>{engineName(project)}</Badge>
                      </button>
                      <span className="w-20 text-right text-muted-foreground text-xs tabular-nums @max-md:hidden">
                        {sizeOf(project)}
                      </span>
                      <span className="w-28 text-right text-muted-foreground text-xs @max-lg:hidden">
                        {formatRelative(project.updatedAt)}
                      </span>
                      {menuFor(project)}
                    </li>
                  ))}
                </ul>
              </div>
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
