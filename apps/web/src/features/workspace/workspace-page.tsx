import type { CompilerDiagnostic } from "@qrtz/compiler-core";
import { isWithin, type Project, type ProjectPath, parseProjectId } from "@qrtz/document-core";
import { cn, Icon, ResizableGroup, ResizableHandle, ResizablePanel, Sheet } from "@qrtz/ui";
import { ArrowUp01Icon, Cancel01Icon, File01Icon } from "@qrtz/ui/icons";
import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Link, useParams } from "react-router";
import { useServices } from "../../app/services";
import { useDocumentTitle } from "../../app/use-document-title";
import { MOBILE_QUERY, useMediaQuery } from "../../app/use-media-query";
import { useSidebar } from "../../app/use-sidebar";
import { formatTime } from "../../lib/format";
import { PdfPreview } from "../preview/pdf-preview";
import { exportProject } from "../shared/export-project";
import { ProjectLoadingScreen } from "../shared/project-loading-screen";
import { EditorPane, type EditorPaneHandle } from "./editor-pane";
import { FileExplorer } from "./file-explorer";
import { ProblemsPanel } from "./problems-panel";
import { type SaveStatus, WorkspaceHeader } from "./workspace-header";

const AUTO_COMPILE_DELAY_MS = { typst: 600, latex: 2500 } as const;

type MobileTab = "files" | "editor" | "preview";

const MOBILE_TABS: readonly { readonly id: MobileTab; readonly label: string }[] = [
  { id: "files", label: "Files" },
  { id: "editor", label: "Editor" },
  { id: "preview", label: "Preview" },
];

export function WorkspacePage() {
  const { projectId: rawId } = useParams();
  const projectId = rawId === undefined ? undefined : parseProjectId(rawId);
  const { db } = useServices();
  const project = useLiveQuery(
    async () => (projectId === undefined ? null : ((await db.projects.get(projectId)) ?? null)),
    [db, projectId],
  );

  if (project === undefined) return <ProjectLoadingScreen />;
  if (project === null) {
    return (
      <div className="fade-in flex h-full animate-in flex-col items-center justify-center gap-2">
        <p className="font-medium">Project not found</p>
        <Link to="/" className="text-primary underline">
          Back to projects
        </Link>
      </div>
    );
  }
  return <Workspace key={project.id} project={project} />;
}

function Workspace({ project }: { readonly project: Project }) {
  const { db, compiler, projects } = useServices();
  const entries = useLiveQuery(
    () => db.files.where("projectId").equals(project.id).sortBy("path"),
    [db, project.id],
  );
  const compileState = useSyncExternalStore(compiler.subscribe, () =>
    compiler.getState(project.id),
  );
  const editorRef = useRef<EditorPaneHandle>(null);
  const [tabs, setTabs] = useState<ProjectPath[]>([]);
  const [active, setActive] = useState<ProjectPath | undefined>();
  const [dirty, setDirty] = useState<ReadonlySet<string>>(new Set());
  const [autoCompile, setAutoCompile] = useState(true);
  const [restored, setRestored] = useState(false);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [mobileTab, setMobileTab] = useState<MobileTab>("editor");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loaderVisible, setLoaderVisible] = useState(true);
  const hideLoader = useCallback(() => setLoaderVisible(false), []);
  const sidebar = useSidebar("quartz:workspace-sidebar");
  const autoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const projectRef = useRef(project);
  projectRef.current = project;

  // Restore open tabs, or open the entry document.
  useEffect(() => {
    void db.workspaceState.get(project.id).then((state) => {
      const open = (state?.openFiles ?? []) as ProjectPath[];
      const initialTabs = open.length > 0 ? open : [project.entry];
      setTabs(initialTabs);
      setActive((state?.activeFile as ProjectPath | undefined) ?? initialTabs[0]);
      setRestored(true);
    });
  }, [db, project.id, project.entry]);

  useEffect(() => {
    if (!restored) return;
    void db.workspaceState.put({
      projectId: project.id,
      openFiles: tabs,
      activeFile: active,
      layout: {},
    });
  }, [db, project.id, tabs, active, restored]);

  // Close tabs whose files no longer exist.
  useEffect(() => {
    if (entries === undefined) return;
    const existing = new Set(
      entries.filter((e) => e.kind !== "folder").map((e) => e.path as string),
    );
    setTabs((current) => {
      const next = current.filter((path) => existing.has(path));
      return next.length === current.length ? current : next;
    });
    setActive((current) => (current !== undefined && !existing.has(current) ? undefined : current));
  }, [entries]);

  const compileNow = useCallback(async () => {
    clearTimeout(autoTimer.current);
    await editorRef.current?.flush();
    await compiler.compile(projectRef.current);
  }, [compiler]);

  const exportNow = async () => {
    await editorRef.current?.flush();
    await exportProject(projects, projectRef.current);
  };

  // First build when the workspace opens.
  useEffect(() => {
    if (compiler.getState(project.id).status === "idle") void compiler.compile(projectRef.current);
  }, [compiler, project.id]);

  const onSaved = useCallback(() => {
    if (!autoCompile) return;
    clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(
      () => void compiler.compile(projectRef.current),
      AUTO_COMPILE_DELAY_MS[projectRef.current.engine],
    );
  }, [autoCompile, compiler]);

  useEffect(() => () => clearTimeout(autoTimer.current), []);

  const onDirtyChange = useCallback((path: string, isDirty: boolean) => {
    setDirty((current) => {
      if (current.has(path) === isDirty) return current;
      const next = new Set(current);
      if (isDirty) next.add(path);
      else next.delete(path);
      return next;
    });
  }, []);

  const open = useCallback((path: ProjectPath) => {
    setTabs((current) => (current.includes(path) ? current : [...current, path]));
    setActive(path);
  }, []);

  const close = (path: ProjectPath) => {
    void editorRef.current?.flush().then(() => editorRef.current?.forget(path));
    setTabs((current) => {
      const next = current.filter((p) => p !== path);
      if (active === path) setActive(next[Math.max(0, current.indexOf(path) - 1)]);
      return next;
    });
  };

  const onRenamed = (from: string, to: string) => {
    editorRef.current?.forget(from);
    const rename = (path: ProjectPath) =>
      isWithin(path, from as ProjectPath)
        ? (`${to}${path.slice(from.length)}` as ProjectPath)
        : path;
    setTabs((current) => current.map(rename));
    setActive((current) => (current === undefined ? current : rename(current)));
  };

  const onDeleted = (path: string) => {
    for (const tab of tabs) if (isWithin(tab, path as ProjectPath)) editorRef.current?.forget(tab);
  };

  const selectDiagnostic = (diagnostic: CompilerDiagnostic) => {
    if (diagnostic.file === undefined) return;
    const path = diagnostic.file as ProjectPath;
    open(path);
    if (diagnostic.line !== undefined) {
      const line = diagnostic.line;
      setTimeout(() => editorRef.current?.reveal(line), 50);
    }
  };

  const saveStatus: SaveStatus = dirty.size > 0 ? "unsaved" : "saved";
  const notice = useMemo(() => {
    if (!compileState.stale || compileState.lastPdf === undefined) return undefined;
    return `Build failed. Showing last successful build from ${formatTime(compileState.lastPdf.builtAt)}`;
  }, [compileState.stale, compileState.lastPdf]);
  useDocumentTitle(
    `Quartz - ${active === undefined ? project.title : active.slice(active.lastIndexOf("/") + 1)}`,
  );
  const entryStem = project.entry.slice(project.entry.lastIndexOf("/") + 1).replace(/\.[^.]+$/, "");

  const explorer = (onOpen: (path: ProjectPath) => void) => (
    <FileExplorer
      project={project}
      entries={entries ?? []}
      activePath={active}
      dirtyPaths={dirty}
      onOpen={onOpen}
      onRenamed={onRenamed}
      onDeleted={onDeleted}
    />
  );
  const editor = (
    <EditorPane
      ref={editorRef}
      projectId={project.id}
      path={active}
      diagnostics={compileState.diagnostics}
      onSaved={onSaved}
      onDirtyChange={onDirtyChange}
      onCompileShortcut={() => void compileNow()}
    />
  );
  const problems = (
    <ProblemsPanel
      diagnostics={compileState.diagnostics}
      log={compileState.log}
      onSelect={selectDiagnostic}
    />
  );
  const preview = (
    <PdfPreview
      bytes={compileState.lastPdf?.bytes}
      fileName={`${entryStem}.pdf`}
      notice={notice}
      emptyMessage={
        compileState.status === "initializing"
          ? "Loading the compiler. The first build downloads the engine once."
          : compileState.status === "error"
            ? "The build failed. See Problems for details."
            : "Compile to see the PDF."
      }
    />
  );
  const activeName =
    active === undefined ? "No file open" : active.slice(active.lastIndexOf("/") + 1);

  return (
    <div className="flex h-full flex-col bg-background">
      <WorkspaceHeader
        project={project}
        saveStatus={saveStatus}
        compileState={compileState}
        autoCompile={autoCompile}
        onToggleAutoCompile={() => setAutoCompile((value) => !value)}
        onCompile={() => void compileNow()}
        onCancel={() => compiler.cancel(project)}
        onExport={() => void exportNow()}
        sidebar={isMobile ? undefined : { collapsed: sidebar.collapsed, onToggle: sidebar.toggle }}
      />
      {isMobile ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-11 shrink-0 border-b px-2" role="tablist" aria-label="Workspace">
            {MOBILE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={mobileTab === tab.id}
                onClick={() => setMobileTab(tab.id)}
                className={cn(
                  "relative flex-1 cursor-pointer font-medium text-muted-foreground transition-colors duration-150",
                  mobileTab === tab.id && "text-foreground",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "absolute inset-x-6 bottom-0 h-0.5 origin-center scale-x-0 rounded-full bg-primary transition-transform duration-200 ease-out",
                    mobileTab === tab.id && "scale-x-100",
                  )}
                />
              </button>
            ))}
          </div>
          <div className="relative min-h-0 flex-1">
            {mobileTab === "files" ? (
              <div className="fade-in absolute inset-0 animate-in">
                {explorer((path) => {
                  open(path);
                  setMobileTab("editor");
                })}
              </div>
            ) : null}
            {/* Editor and preview stay mounted so buffers and the PDF viewer survive tab switches. */}
            <div
              className={cn(
                "absolute inset-0 flex flex-col bg-card",
                mobileTab !== "editor" && "pointer-events-none invisible",
              )}
            >
              <div className="min-h-0 flex-1">{editor}</div>
              <div className="h-28 shrink-0">{problems}</div>
              <div className="flex h-14 shrink-0 items-center border-t px-3">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="pressable flex min-w-0 cursor-pointer items-center gap-2 rounded-full border bg-muted/60 px-3 py-1.5 font-medium"
                >
                  <Icon icon={File01Icon} size={15} className="shrink-0 text-muted-foreground" />
                  <span className="truncate">{activeName}</span>
                  {active !== undefined && dirty.has(active) ? (
                    <span className="size-1.5 shrink-0 rounded-full bg-warning" />
                  ) : null}
                  <Icon icon={ArrowUp01Icon} size={14} className="shrink-0 text-muted-foreground" />
                </button>
              </div>
            </div>
            <div
              className={cn(
                "absolute inset-0 bg-card",
                mobileTab !== "preview" && "pointer-events-none invisible",
              )}
            >
              {preview}
            </div>
          </div>
          <Sheet
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            title="Project files"
            header={
              <div className="flex items-center gap-2 border-b px-4 pt-2 pb-3 font-semibold">
                <Icon icon={File01Icon} size={15} className="text-muted-foreground" />
                <span className="truncate">{activeName}</span>
              </div>
            }
            className="h-[60dvh]"
          >
            {explorer((path) => {
              open(path);
              setDrawerOpen(false);
            })}
          </Sheet>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 pr-2 pb-2">
          <div
            className={cn(
              "shrink-0 overflow-hidden transition-[width] duration-300 ease-out",
              sidebar.collapsed ? "w-2" : "w-60",
            )}
            inert={sidebar.collapsed}
          >
            <div
              className={cn(
                "h-full w-58 transition-[opacity,translate] duration-300 ease-out",
                sidebar.collapsed && "-translate-x-6 opacity-0",
              )}
            >
              {explorer(open)}
            </div>
          </div>
          <ResizableGroup orientation="horizontal" id="quartz-workspace-main" className="min-w-0">
            <ResizablePanel id="editor" defaultSize="50%" minSize="25%">
              <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
                <div
                  className="flex h-11 shrink-0 items-center gap-1 overflow-x-auto border-b px-2"
                  role="tablist"
                  aria-label="Open files"
                >
                  {tabs.map((path) => (
                    <div
                      key={path}
                      className={cn(
                        "group fade-in zoom-in-95 flex h-7 shrink-0 animate-in items-center gap-1 rounded-lg border pr-1 pl-2.5 text-xs transition-colors duration-150",
                        path === active
                          ? "border-border bg-muted/70 font-medium text-foreground"
                          : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      )}
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={path === active}
                        className="cursor-pointer whitespace-nowrap"
                        onClick={() => setActive(path)}
                        title={path}
                      >
                        {path.slice(path.lastIndexOf("/") + 1)}
                      </button>
                      <button
                        type="button"
                        aria-label={`Close ${path}`}
                        onClick={() => close(path)}
                        className="pressable flex size-5 cursor-pointer items-center justify-center rounded-md hover:bg-foreground/10"
                      >
                        {dirty.has(path) ? (
                          <span className="size-1.5 rounded-full bg-foreground/70 group-hover:hidden" />
                        ) : null}
                        <Icon
                          icon={Cancel01Icon}
                          size={12}
                          className={cn(dirty.has(path) && "hidden group-hover:block")}
                        />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="min-h-0 flex-1">{editor}</div>
                <div className="h-40 shrink-0">{problems}</div>
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel id="preview" defaultSize="50%" minSize="20%">
              <div className="h-full overflow-hidden rounded-xl border bg-card shadow-sm">
                {preview}
              </div>
            </ResizablePanel>
          </ResizableGroup>
        </div>
      )}
      {loaderVisible ? (
        <ProjectLoadingScreen ready={entries !== undefined && restored} onFinished={hideLoader} />
      ) : null}
    </div>
  );
}
