import type { Project } from "@qrtz/document-core";
import { Badge, Button, cn, Icon } from "@qrtz/ui";
import {
  AlertCircleIcon,
  ArrowLeft01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  DiamondIcon,
  Loading03Icon,
  Moon02Icon,
  PlayIcon,
  Sun03Icon,
} from "@qrtz/ui/icons";
import { Link } from "react-router";
import { useTheme } from "../../app/theme";
import { formatTime } from "../../lib/format";
import type { CompileState } from "../../services/compile-service";

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
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Icon icon={Loading03Icon} size={14} className="animate-spin" />{" "}
        {state.message || "Compiling"}
      </span>
    );
  }
  if (state.status === "error") {
    return (
      <span className="flex items-center gap-1.5 text-destructive">
        <Icon icon={AlertCircleIcon} size={14} /> {state.message}
      </span>
    );
  }
  if (state.status === "success" && state.lastPdf !== undefined) {
    return (
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Icon icon={CheckmarkCircle02Icon} size={14} className="text-success" />
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
}: {
  readonly project: Project;
  readonly saveStatus: SaveStatus;
  readonly compileState: CompileState;
  readonly autoCompile: boolean;
  readonly onToggleAutoCompile: () => void;
  readonly onCompile: () => void;
  readonly onCancel: () => void;
}) {
  const { theme, toggle } = useTheme();
  const busy = compileState.status === "compiling" || compileState.status === "initializing";
  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b px-3">
      <Link
        to="/"
        className="flex items-center gap-1.5 font-semibold"
        aria-label="Back to projects"
      >
        <Icon icon={ArrowLeft01Icon} size={14} className="text-muted-foreground" />
        <Icon icon={DiamondIcon} size={16} className="text-primary" />
      </Link>
      <h1 className="truncate font-medium">{project.title}</h1>
      <Badge>{engineLabel(project)}</Badge>
      <span
        className={cn(
          "text-xs",
          saveStatus === "saved" ? "text-muted-foreground" : "text-foreground",
        )}
        aria-live="polite"
      >
        {saveStatus === "saved" ? "Saved" : saveStatus === "saving" ? "Saving…" : "Unsaved changes"}
      </span>
      <div className="flex-1" />
      <div className="text-xs" aria-live="polite">
        <CompileIndicator state={compileState} />
      </div>
      <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground text-xs">
        <input
          type="checkbox"
          checked={autoCompile}
          onChange={onToggleAutoCompile}
          className="accent-primary"
        />
        Auto
      </label>
      {busy ? (
        <Button variant="outline" size="sm" onClick={onCancel}>
          <Icon icon={Cancel01Icon} size={14} /> Cancel
        </Button>
      ) : (
        <Button size="sm" onClick={onCompile} title="Compile (Ctrl+Enter)">
          <Icon icon={PlayIcon} size={14} /> Compile
        </Button>
      )}
      <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggle}>
        <Icon icon={theme === "dark" ? Sun03Icon : Moon02Icon} />
      </Button>
    </header>
  );
}
