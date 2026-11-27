import type { Project } from "@qrtz/document-core";
import { Badge, Button, cn, Icon, Switch } from "@qrtz/ui";
import {
  AlertCircleIcon,
  ArrowLeft01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Download04Icon,
  Loading03Icon,
  Moon02Icon,
  PlayIcon,
  Sun03Icon,
} from "@qrtz/ui/icons";
import { Link } from "react-router";
import { useTheme } from "../../app/theme";
import { formatTime } from "../../lib/format";
import type { CompileState } from "../../services/compile-service";
import { QuartzLogo } from "../shared/quartz-logo";
import { SidebarToggle } from "../shared/sidebar-toggle";

export type SaveStatus = "saved" | "unsaved" | "saving";

const engineLabel = (project: Project): string =>
  project.compiler.engine === "latex"
    ? `LaTeX · ${project.compiler.variant === "xelatex" ? "XeLaTeX" : "pdfLaTeX"}`
    : "Typst";

function CompileIndicator({ state }: { readonly state: CompileState }) {
  const busy =
    state.status === "initializing" || state.status === "compiling" || state.status === "queued";
  if (busy) {
    return (
      <span className="fade-in flex animate-in items-center gap-1.5 text-muted-foreground">
        <Icon icon={Loading03Icon} size={14} className="animate-spin" />{" "}
        {state.message || "Compiling"}
      </span>
    );
  }
  if (state.status === "error") {
    return (
      <span className="fade-in slide-in-from-top-1 flex animate-in items-center gap-1.5 text-destructive">
        <Icon icon={AlertCircleIcon} size={14} /> {state.message}
      </span>
    );
  }
  if (state.status === "success" && state.lastPdf !== undefined) {
    return (
      <span className="fade-in flex animate-in items-center gap-1.5 text-muted-foreground">
        <Icon
          icon={CheckmarkCircle02Icon}
          size={14}
          className="zoom-in-50 animate-in text-success duration-300"
        />
        Built {formatTime(state.lastPdf.builtAt)}
        {state.durationMs === undefined ? "" : ` in ${Math.round(state.durationMs)} ms`}
      </span>
    );
  }
  if (state.status === "cancelled") return <span className="text-muted-foreground">Cancelled</span>;
  return null;
}

export function WorkspaceHeader({
  project,
  saveStatus,
  compileState,
  autoCompile,
  onToggleAutoCompile,
  onCompile,
  onCancel,
  onExport,
  sidebar,
}: {
  readonly project: Project;
  readonly saveStatus: SaveStatus;
  readonly compileState: CompileState;
  readonly autoCompile: boolean;
  readonly onToggleAutoCompile: () => void;
  readonly onCompile: () => void;
  readonly onCancel: () => void;
  readonly onExport: () => void;
  /** Explorer collapse control; omitted on mobile, where files live in a tab. */
  readonly sidebar?: { readonly collapsed: boolean; readonly onToggle: () => void } | undefined;
}) {
  const { theme, toggle } = useTheme();
  const busy = compileState.status === "compiling" || compileState.status === "initializing";
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 px-3">
      <Link
        to="/"
        className="pressable group flex items-center gap-1.5 rounded-md py-1 pr-1 pl-0.5 font-semibold hover:bg-muted"
        aria-label="Back to projects"
      >
        <Icon
          icon={ArrowLeft01Icon}
          size={14}
          className="text-muted-foreground transition-transform duration-200 ease-out group-hover:-translate-x-0.5"
        />
        <QuartzLogo
          size={24}
          className="transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-110"
        />
      </Link>
      {sidebar === undefined ? null : (
        <SidebarToggle
          collapsed={sidebar.collapsed}
          onToggle={sidebar.onToggle}
          className="-ml-1"
        />
      )}
      <h1 className="truncate font-semibold tracking-tight">{project.title}</h1>
      <Badge className="max-md:hidden">{engineLabel(project)}</Badge>
      <span
        className="flex items-center gap-1.5 text-muted-foreground text-xs max-md:hidden"
        aria-live="polite"
      >
        <span
          className={cn(
            "size-1.5 rounded-full transition-colors duration-300",
            saveStatus === "saved" ? "bg-success" : "bg-warning",
          )}
        />
        <span className={cn(saveStatus !== "saved" && "text-foreground")}>
          {saveStatus === "saved"
            ? "Saved"
            : saveStatus === "saving"
              ? "Saving…"
              : "Unsaved changes"}
        </span>
      </span>
      <div className="flex-1" />
      <div className="text-xs max-md:hidden" aria-live="polite">
        <CompileIndicator state={compileState} />
      </div>
      <div className="flex items-center gap-2 px-2 text-muted-foreground text-xs max-md:hidden">
        <Switch
          checked={autoCompile}
          onCheckedChange={onToggleAutoCompile}
          aria-label="Auto compile"
        />
        <span aria-hidden="true">Auto</span>
      </div>
      <Button variant="ghost" size="sm" onClick={onExport} title="Download project as ZIP">
        <Icon icon={Download04Icon} size={14} />
        <span className="max-md:sr-only">Export (zip)</span>
      </Button>
      {busy ? (
        <Button variant="outline" size="sm" onClick={onCancel}>
          <Icon icon={Cancel01Icon} size={14} />
          <span className="max-md:sr-only">Cancel</span>
        </Button>
      ) : (
        <Button size="sm" onClick={onCompile} title="Compile (Ctrl+Enter)">
          <Icon icon={PlayIcon} size={14} />
          <span className="max-md:sr-only">Compile</span>
        </Button>
      )}
      <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggle}>
        <Icon
          key={theme}
          icon={theme === "dark" ? Sun03Icon : Moon02Icon}
          className="fade-in spin-in-45 animate-in duration-300"
        />
      </Button>
    </header>
  );
}
