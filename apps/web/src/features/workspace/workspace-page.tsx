import type { CompilerDiagnostic } from "@qrtz/compiler-core";
import { isWithin, type Project, type ProjectPath, parseProjectId } from "@qrtz/document-core";
import { cn, Icon, ResizableGroup, ResizableHandle, ResizablePanel } from "@qrtz/ui";
import { Cancel01Icon } from "@qrtz/ui/icons";
import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Link, useParams } from "react-router";
import { useServices } from "../../app/services";
import { useDocumentTitle } from "../../app/use-document-title";
import { formatTime } from "../../lib/format";
import { PdfPreview } from "../preview/pdf-preview";
import { EditorPane, type EditorPaneHandle } from "./editor-pane";
import { FileExplorer } from "./file-explorer";
import { ProblemsPanel } from "./problems-panel";
import { type SaveStatus, WorkspaceHeader } from "./workspace-header";

const AUTO_COMPILE_DELAY_MS = { typst: 600, latex: 2500 } as const;

export function WorkspacePage() {
  const { projectId: rawId } = useParams();
  const projectId = rawId === undefined ? undefined : parseProjectId(rawId);
  const { db } = useServices();
  const project = useLiveQuery(
    async () => (projectId === undefined ? null : ((await db.projects.get(projectId)) ?? null)),
    [db, projectId],
  );

  if (project === undefined) return null;
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
  const { db, compiler } = useServices();
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
      />
      <div className="min-h-0 flex-1 pr-2 pb-2">
        <ResizableGroup orientation="horizontal" id="quartz-workspace">
          <ResizablePanel id="explorer" defaultSize="18%" minSize="160px" collapsible>
            <FileExplorer
              project={project}
              entries={entries ?? []}
              activePath={active}
              dirtyPaths={dirty}
              onOpen={open}
              onRenamed={onRenamed}
              onDeleted={onDeleted}
            />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel id="editor" defaultSize="41%" minSize="25%">
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
              <div className="min-h-0 flex-1">
                <EditorPane
                  ref={editorRef}
                  projectId={project.id}
                  path={active}
                  diagnostics={compileState.diagnostics}
                  onSaved={onSaved}
                  onDirtyChange={onDirtyChange}
                  onCompileShortcut={() => void compileNow()}
                />
              </div>
              <div className="h-40 shrink-0">
                <ProblemsPanel
                  diagnostics={compileState.diagnostics}
                  log={compileState.log}
                  onSelect={selectDiagnostic}
                />
              </div>
            </div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel id="preview" defaultSize="41%" minSize="20%">
            <div className="h-full overflow-hidden rounded-xl border bg-card shadow-sm">
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
            </div>
          </ResizablePanel>
        </ResizableGroup>
      </div>
    </div>
  );
}
