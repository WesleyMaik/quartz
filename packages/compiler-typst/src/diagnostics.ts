import type { CompilerDiagnostic } from "@qrtz/compiler-core";

/** Shape of typst.ts "full" diagnostics (partially LSP-like). */
export interface TypstDiagnosticMessage {
  readonly package: string;
  readonly path: string;
  readonly severity: string;
  readonly range: string;
  readonly message: string;
}

const RANGE = /^(\d+):(\d+)/;

/**
 * Converts typst.ts diagnostics. `range` looks like "startLine:startCol-endLine:endCol" with
 * 0-based numbers (LSP convention); Quartz uses 1-based positions.
 */
export function normalizeTypstDiagnostic(raw: TypstDiagnosticMessage): CompilerDiagnostic {
  const match = RANGE.exec(raw.range);
  const severity = raw.severity.toLowerCase().startsWith("warn") ? "warning" : "error";
  const file = raw.package === "" ? raw.path.replace(/^\/+/, "") : `${raw.package}/${raw.path}`;
  const base = { severity, message: raw.message, source: "typst" } as const;
  if (match === null) return { ...base, file };
  return { ...base, file, line: Number(match[1]) + 1, column: Number(match[2]) + 1 };
}

export function isTypstDiagnosticMessage(value: unknown): value is TypstDiagnosticMessage {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.message === "string" &&
    typeof record.severity === "string" &&
    typeof record.path === "string" &&
    typeof record.range === "string"
  );
}
