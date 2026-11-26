import type { CompilerDiagnostic } from "@qrtz/compiler-core";

/**
 * Extracts diagnostics from a TeX log. TeX does not emit structured output, so this follows the
 * conventional patterns: `! message` errors with a later `l.<n>` line marker, LaTeX and package
 * warnings with "on input line <n>", and the file stack opened by `(path` tokens.
 */

const ERROR_START = /^! (.*)$/;
const LINE_MARKER = /^l\.(\d+)/;
const FILE_LINE_ERROR = /^(?:\.\/)?([^:\s()]+\.(?:tex|sty|cls|bib|ltx)):(\d+): (.*)$/;
const WARNING = /^((?:LaTeX|Package [\w-]+|Class [\w-]+) Warning): (.*)$/;
const INPUT_LINE = /on input line (\d+)/;
const OPENED_FILE = /\((?:\.\/)?([^\s()]+\.(?:tex|ltx))/g;
const BOX = /^((?:Over|Under)full \\[hv]box .*?) in paragraph at lines (\d+)--\d+/;

const MAX_DIAGNOSTICS = 200;

const normalizeFile = (file: string, projectFiles: ReadonlySet<string>): string | undefined => {
  const clean = file.replace(/^\.\//, "");
  if (projectFiles.has(clean)) return clean;
  if (projectFiles.has(`${clean}.tex`)) return `${clean}.tex`;
  return undefined;
};

export function parseLatexLog(
  log: string,
  entry: string,
  projectFiles: ReadonlySet<string>,
): CompilerDiagnostic[] {
  const lines = log.split(/\r?\n/);
  const diagnostics: CompilerDiagnostic[] = [];
  let currentFile = entry;
  const seen = new Set<string>();

  const push = (diagnostic: CompilerDiagnostic) => {
    const key = `${diagnostic.severity}|${diagnostic.file}|${diagnostic.line}|${diagnostic.message}`;
    if (seen.has(key) || diagnostics.length >= MAX_DIAGNOSTICS) return;
    seen.add(key);
    diagnostics.push(diagnostic);
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";

    for (const match of line.matchAll(OPENED_FILE)) {
      const file = normalizeFile(match[1] ?? "", projectFiles);
      if (file !== undefined) currentFile = file;
    }

    const fileLine = FILE_LINE_ERROR.exec(line);
    if (fileLine !== null) {
      const file = normalizeFile(fileLine[1] ?? "", projectFiles) ?? currentFile;
      push({
        severity: "error",
        message: fileLine[3] ?? "",
        file,
        line: Number(fileLine[2]),
        source: "latex",
      });
      continue;
    }

    const error = ERROR_START.exec(line);
    if (error !== null) {
      let lineNumber: number | undefined;
      for (let ahead = index + 1; ahead < Math.min(lines.length, index + 12); ahead += 1) {
        const marker = LINE_MARKER.exec(lines[ahead] ?? "");
        if (marker !== null) {
          lineNumber = Number(marker[1]);
          break;
        }
      }
      push({
        severity: "error",
        message: (error[1] ?? "").replace(/\.$/, ""),
        file: currentFile,
        ...(lineNumber === undefined ? {} : { line: lineNumber }),
        source: "latex",
      });
      continue;
    }

    const warning = WARNING.exec(line);
    if (warning !== null) {
      let message = warning[2] ?? "";
      // Warnings wrap onto following lines until an empty line.
      for (
        let ahead = index + 1;
        ahead < lines.length && (lines[ahead] ?? "").trim() !== "";
        ahead += 1
      ) {
        message += ` ${(lines[ahead] ?? "").replace(/^\([\w-]+\)\s*/, "").trim()}`;
        if (INPUT_LINE.test(message)) break;
      }
      const inputLine = INPUT_LINE.exec(message);
      push({
        severity: "warning",
        message: message.replace(/\s+/g, " ").trim(),
        file: currentFile,
        ...(inputLine === null ? {} : { line: Number(inputLine[1]) }),
        source: "latex",
      });
      continue;
    }

    const box = BOX.exec(line);
    if (box !== null) {
      push({
        severity: "info",
        message: box[1] ?? "",
        file: currentFile,
        line: Number(box[2]),
        source: "latex",
      });
    }
  }
  return diagnostics;
}
