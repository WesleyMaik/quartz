import type { Engine, Project } from "@qrtz/document-core";
import type { MessageId } from "@qrtz/messages";
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
  Loading03Icon,
  Moon02Icon,
  MoreHorizontalIcon,
  Search01Icon,
  Sun03Icon,
  Upload04Icon,
} from "@qrtz/ui/icons";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router";
import { useServices } from "../../app/services";
import { useTheme } from "../../app/theme";
import { useDescribeError } from "../../app/use-describe-error";
import { useFormat } from "../../app/use-format";
import { useSidebar } from "../../app/use-sidebar";
import { SettingsButton } from "../settings/settings-button";
import { ConfirmDialog } from "../shared/confirm-dialog";
import { exportProject } from "../shared/export-project";
import { PromptDialog } from "../shared/prompt-dialog";
import { QuartzLogo } from "../shared/quartz-logo";
import { SidebarToggle } from "../shared/sidebar-toggle";
import { NewProjectDialog } from "./new-project-dialog";
import { CardThumbnail, RowThumbnail } from "./project-thumbnail";
import { type DashboardView, useDashboardView } from "./use-dashboard-view";
import { useProjectImport } from "./use-project-import";

type EngineFilter = "all" | Engine;

/** Engine names are proper nouns; only the unfiltered entry is translated. */
const FILTERS: readonly EngineFilter[] = ["all", "latex", "typst"];
const ENGINE_NAMES: Readonly<Record<Engine, string>> = { latex: "LaTeX", typst: "Typst" };

const VIEWS: readonly {
  readonly id: DashboardView;
  readonly label: MessageId;
  readonly icon: typeof GridViewIcon;
}[] = [
  { id: "list", label: "dashboard.view.list", icon: ListViewIcon },
  { id: "grid", label: "dashboard.view.grid", icon: GridViewIcon },
];

/** Rows beyond this index appear without a stagger delay, so long lists do not feel slow. */
const MAX_STAGGERED_ROWS = 12;

export function DashboardPage() {
  const { db, projects } = useServices();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const intl = useIntl();
  const format = useFormat();
  const describeError = useDescribeError();
  const filterLabel = (id: EngineFilter): string =>
    id === "all" ? intl.formatMessage({ id: "dashboard.filter.all" }) : ENGINE_NAMES[id];
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
  const thumbnails = useLiveQuery(
    async () =>
      new Map((await db.thumbnails.toArray()).map((item) => [item.projectId, item.image])),
    [db],
  );

  useEffect(() => {
    void readStorageStatus().then(setStorage);
  }, []);

  const afterCreate = async (project: Project) => {
    if (storage?.persisted === false) {
      const granted = await requestPersistentStorage();
      setStorage(await readStorageStatus());
      if (!granted) toast.message(intl.formatMessage({ id: "dashboard.local_only" }));
    }
    navigate(`/p/${project.id}`);
  };

  const projectImport = useProjectImport(afterCreate);
  const importIcon = (
    <Icon
      icon={projectImport.busy ? Loading03Icon : Upload04Icon}
      size={15}
      className={cn(projectImport.busy && "animate-spin")}
    />
  );

  const needle = query.trim().toLowerCase();
  const visible = list?.filter(
    (project) =>
      (filter === "all" || project.engine === filter) &&
      (needle === "" || project.title.toLowerCase().includes(needle)),
  );
  const sizeOf = (project: Project): string => {
    const bytes = sizes?.get(project.id);
    return bytes === undefined ? "-" : format.bytes(bytes);
  };
  const stagger = (index: number) => ({
    animationDelay: `${Math.min(index, MAX_STAGGERED_ROWS) * 25}ms`,
  });
  const actionsFor = (project: Project): MenuAction[] => [
    {
      id: "open",
      label: intl.formatMessage({ id: "dashboard.action.open" }),
      onSelect: () => navigate(`/p/${project.id}`),
    },
    {
      id: "rename",
      label: intl.formatMessage({ id: "common.rename" }),
      onSelect: () => setRenaming(project),
    },
    {
      id: "duplicate",
      label: intl.formatMessage({ id: "dashboard.action.duplicate" }),
      onSelect: async () => {
        const title = intl.formatMessage(
          { id: "dashboard.duplicate_title" },
          { title: project.title },
        );
        const result = await projects.duplicate(project, title);
        if (!result.ok) toast.error(describeError(result.error));
      },
    },
    {
      id: "export",
      label: intl.formatMessage({ id: "dashboard.action.export" }),
      onSelect: () => void exportProject(projects, project, describeError),
    },
    {
      id: "delete",
      label: intl.formatMessage({ id: "common.delete" }),
      destructive: true,
      onSelect: () => setDeleting(project),
    },
  ];
  const menuFor = (project: Project, className?: string) => (
    <DropdownMenu
      trigger={
        <Button
          variant="ghost"
          size="icon"
          aria-label={intl.formatMessage({ id: "dashboard.actions_for" }, { title: project.title })}
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
  const heading = filterLabel(filter);
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
              <Button
                variant="ghost"
                size="icon"
                aria-label={intl.formatMessage({ id: "common.toggle_theme" })}
                onClick={toggle}
              >
                <Icon
                  key={theme}
                  icon={theme === "dark" ? Sun03Icon : Moon02Icon}
                  className="fade-in spin-in-45 animate-in duration-300"
                />
              </Button>
              <SidebarToggle collapsed={false} onToggle={sidebar.toggle} />
            </div>
          </div>

          <nav
            aria-label={intl.formatMessage({ id: "dashboard.filters" })}
            className="flex flex-col gap-0.5"
          >
            {FILTERS.map((id) => (
              <button
                key={id}
                type="button"
                aria-current={filter === id ? "page" : undefined}
                onClick={() => setFilter(id)}
                className={cn(
                  "pressable flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-3 text-left text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                  filter === id && "bg-muted font-medium text-foreground",
                )}
              >
                <Icon icon={id === "all" ? Folder01Icon : File01Icon} size={15} />
                {filterLabel(id)}
                {list === undefined ? null : (
                  <span className="ml-auto text-muted-foreground text-xs tabular-nums">
                    {format.number(
                      id === "all"
                        ? list.length
                        : list.filter((project) => project.engine === id).length,
                    )}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="mt-auto rounded-lg border bg-card p-3 text-muted-foreground text-xs shadow-xs">
            {storage?.usageBytes === undefined ? (
              <p>{intl.formatMessage({ id: "dashboard.usage.unavailable" })}</p>
            ) : (
              <>
                <p
                  className={cn(
                    "font-medium text-foreground",
                    isNearQuota(storage) && "text-warning",
                  )}
                >
                  {storage.quotaBytes === undefined
                    ? intl.formatMessage(
                        { id: "dashboard.usage.used" },
                        { used: format.bytes(storage.usageBytes) },
                      )
                    : intl.formatMessage(
                        { id: "dashboard.usage.used_of" },
                        {
                          used: format.bytes(storage.usageBytes),
                          total: format.bytes(storage.quotaBytes),
                        },
                      )}
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
              {intl.formatMessage({
                id:
                  storage?.persisted === true
                    ? "dashboard.usage.persistent"
                    : "dashboard.usage.not_persistent",
              })}
            </p>
          </div>
          <div className="-mt-4">
            <SettingsButton />
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
          <div className="flex items-center">
            <SettingsButton compact />
            <Button
              variant="ghost"
              size="icon"
              aria-label={intl.formatMessage({ id: "common.toggle_theme" })}
              onClick={toggle}
            >
              <Icon
                key={theme}
                icon={theme === "dark" ? Sun03Icon : Moon02Icon}
                className="fade-in spin-in-45 animate-in duration-300"
              />
            </Button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card md:rounded-xl md:border md:shadow-sm">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 md:h-16 md:gap-3 md:px-6">
            {sidebar.collapsed ? (
              <div className="fade-in slide-in-from-left-2 -ml-2 flex animate-in items-center gap-1 duration-300 max-md:hidden">
                <SidebarToggle collapsed onToggle={sidebar.toggle} />
                <SettingsButton compact />
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
                actions={FILTERS.map((id) => ({
                  id,
                  label: filterLabel(id),
                  selected: filter === id,
                  onSelect: () => setFilter(id),
                }))}
              />
            )}
            <div className="flex-1 max-md:hidden" />
            {searchOpen ? null : <div className="flex-1 md:hidden" />}
            <Button
              variant="ghost"
              size="icon"
              aria-label={intl.formatMessage({ id: "dashboard.search" })}
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
                placeholder={intl.formatMessage({ id: "dashboard.search" })}
                aria-label={intl.formatMessage({ id: "dashboard.search" })}
                className="rounded-full pl-9"
                autoFocus={searchOpen}
                onBlur={() => {
                  if (query === "") setSearchOpen(false);
                }}
              />
            </div>
            <fieldset className="flex shrink-0 items-center rounded-full bg-muted p-0.5 max-sm:hidden">
              <legend className="sr-only">
                {intl.formatMessage({ id: "dashboard.view.legend" })}
              </legend>
              {VIEWS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={intl.formatMessage({ id: item.label })}
                  aria-pressed={view === item.id}
                  title={intl.formatMessage({ id: item.label })}
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
              variant="outline"
              onClick={projectImport.pick}
              disabled={projectImport.busy}
              aria-label={intl.formatMessage({ id: "dashboard.import_zip" })}
              title={intl.formatMessage({ id: "dashboard.import_title" })}
              className="max-md:size-9 max-md:px-0"
            >
              {importIcon}
              <span className="max-md:hidden">
                {intl.formatMessage({ id: "dashboard.import" })}
              </span>
            </Button>
            <Button
              onClick={() => setCreating(true)}
              aria-label={intl.formatMessage({ id: "dashboard.new_project" })}
              className="max-md:size-9 max-md:px-0"
            >
              <Icon icon={Add01Icon} size={15} />
              <span className="max-md:hidden">{intl.formatMessage({ id: "dashboard.new" })}</span>
            </Button>
          </header>

          <div className="min-h-0 flex-1 overflow-auto">
            {visible === undefined ? null : list?.length === 0 ? (
              <div className="fade-in zoom-in-95 m-auto flex h-full max-w-sm animate-in flex-col items-center justify-center text-center duration-300">
                <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Icon icon={File01Icon} size={22} />
                </span>
                <p className="font-medium text-base">
                  {intl.formatMessage({ id: "dashboard.empty.title" })}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {intl.formatMessage({ id: "dashboard.empty.description" })}
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Button onClick={() => setCreating(true)}>
                    <Icon icon={Add01Icon} size={15} />{" "}
                    {intl.formatMessage({ id: "dashboard.empty.create" })}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={projectImport.pick}
                    disabled={projectImport.busy}
                  >
                    {importIcon} {intl.formatMessage({ id: "dashboard.import_zip" })}
                  </Button>
                </div>
              </div>
            ) : visible.length === 0 ? (
              <p className="fade-in animate-in p-10 text-center text-muted-foreground">
                {intl.formatMessage({ id: "dashboard.no_match" })}
              </p>
            ) : view === "grid" ? (
              <ul
                key="grid"
                className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 p-4 md:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] md:gap-4 md:p-6"
                aria-label={intl.formatMessage({ id: "dashboard.projects" })}
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
                      <CardThumbnail image={thumbnails?.get(project.id)} />
                      <span className="flex flex-col gap-1 border-t px-3 py-2.5">
                        <span className="truncate pr-6 font-medium">{project.title}</span>
                        <span className="flex items-center gap-2 text-muted-foreground text-xs">
                          <Badge>{ENGINE_NAMES[project.engine]}</Badge>
                          <span className="truncate">{format.relative(project.updatedAt)}</span>
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
                  <span className="flex-1">
                    {intl.formatMessage({ id: "dashboard.column.name" })}
                  </span>
                  <span className="w-20 text-right @max-md:hidden">
                    {intl.formatMessage({ id: "dashboard.column.size" })}
                  </span>
                  <span className="w-28 text-right @max-lg:hidden">
                    {intl.formatMessage({ id: "dashboard.column.edited" })}
                  </span>
                  <span className="w-7" />
                </div>
                <ul
                  className="px-3 pb-3"
                  aria-label={intl.formatMessage({ id: "dashboard.projects" })}
                >
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
                        <RowThumbnail image={thumbnails?.get(project.id)} />
                        <span className="truncate font-medium">{project.title}</span>
                        <Badge>{ENGINE_NAMES[project.engine]}</Badge>
                      </button>
                      <span className="w-20 text-right text-muted-foreground text-xs tabular-nums @max-md:hidden">
                        {sizeOf(project)}
                      </span>
                      <span className="w-28 text-right text-muted-foreground text-xs @max-lg:hidden">
                        {format.relative(project.updatedAt)}
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

      {projectImport.elements}
      <NewProjectDialog open={creating} onOpenChange={setCreating} onCreated={afterCreate} />
      <PromptDialog
        open={renaming !== undefined}
        onOpenChange={(open) => !open && setRenaming(undefined)}
        title={intl.formatMessage({ id: "dashboard.rename.title" })}
        label={intl.formatMessage({ id: "dashboard.title_label" })}
        initialValue={renaming?.title ?? ""}
        confirmLabel={intl.formatMessage({ id: "common.rename" })}
        onSubmit={async (value) => {
          if (renaming === undefined) return undefined;
          const result = await projects.rename(renaming.id, value);
          return result.ok ? undefined : describeError(result.error);
        }}
      />
      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title={intl.formatMessage(
          { id: "dashboard.delete.title" },
          { title: deleting?.title ?? "" },
        )}
        description={intl.formatMessage({ id: "dashboard.delete.description" })}
        confirmLabel={intl.formatMessage({ id: "dashboard.delete.confirm" })}
        destructive
        onConfirm={async () => {
          if (deleting === undefined) return;
          const result = await projects.delete(deleting.id);
          if (!result.ok) toast.error(describeError(result.error));
        }}
      />
    </div>
  );
}
