import type { CompilerDiagnostic } from "@qrtz/compiler-core";
import { cn, Icon } from "@qrtz/ui";
import { Alert02Icon, AlertCircleIcon } from "@qrtz/ui/icons";
import { useState } from "react";

export function ProblemsPanel({
  diagnostics,
  log,
  onSelect,
}: {
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly log: string;
  readonly onSelect: (diagnostic: CompilerDiagnostic) => void;
}) {
  const [tab, setTab] = useState<"problems" | "log">("problems");
  const errors = diagnostics.filter((d) => d.severity === "error").length;
  const warnings = diagnostics.length - errors;

  return (
    <section className="flex h-full flex-col border-t" aria-label="Problems and log">
      <div className="flex h-9 shrink-0 items-center gap-1 px-2 text-xs" role="tablist">
        {(["problems", "log"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "pressable cursor-pointer rounded-full px-2.5 py-1 font-medium text-muted-foreground hover:text-foreground",
              tab === id && "bg-muted text-foreground",
            )}
          >
            {id === "problems"
              ? `Problems${diagnostics.length > 0 ? ` (${errors}/${warnings})` : ""}`
              : "Log"}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto px-2 pb-2 font-mono text-xs" role="tabpanel">
        {tab === "log" ? (
          <pre className="whitespace-pre-wrap text-muted-foreground">
            {log === "" ? "No output." : log}
          </pre>
        ) : diagnostics.length === 0 ? (
          <p className="px-1 py-1 font-sans text-muted-foreground">No problems.</p>
        ) : (
          <ul>
            {diagnostics.map((diagnostic, index) => (
              <li
                key={`${diagnostic.file}:${diagnostic.line}:${index}`}
                className="fade-in slide-in-from-left-1 animate-in fill-mode-both"
                style={{ animationDelay: `${Math.min(index, 10) * 20}ms` }}
              >
                <button
                  type="button"
                  onClick={() => onSelect(diagnostic)}
                  className="flex w-full cursor-pointer items-start gap-2 rounded-md px-1.5 py-1 text-left transition-colors duration-150 hover:bg-muted"
                >
                  <Icon
                    icon={diagnostic.severity === "error" ? AlertCircleIcon : Alert02Icon}
                    size={14}
                    className={cn(
                      "mt-px shrink-0",
                      diagnostic.severity === "error" ? "text-destructive" : "text-warning",
                    )}
                  />
                  <span className="min-w-0 flex-1 font-sans">{diagnostic.message}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {diagnostic.file ?? ""}
                    {diagnostic.line === undefined ? "" : `:${diagnostic.line}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
