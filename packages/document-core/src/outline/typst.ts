import { blank, directoryOf, joinPath, type OutlineItem, type OutlineScanner } from "./types";

/** Blanks comments and fenced raw blocks, which never produce headings. */
function maskTypst(source: string): string {
  let result = "";
  let index = 0;
  const copy = (end: number) => {
    result += source.slice(index, end);
    index = end;
  };
  const hide = (end: number) => {
    result += blank(source.slice(index, end));
    index = end;
  };
  const endAfter = (closing: string, from: number): number => {
    const at = source.indexOf(closing, from);
    return at === -1 ? source.length : at + closing.length;
  };

  while (index < source.length) {
    const char = source.charAt(index);
    const next = source.charAt(index + 1);
    if (char === "\\") {
      copy(index + 2);
    } else if (char === '"') {
      // Skipping quoted text keeps "src/*.rs" from opening a comment.
      const closing = source.indexOf('"', index + 1);
      const sameLine = closing !== -1 && !source.slice(index, closing).includes("\n");
      copy(sameLine ? closing + 1 : index + 1);
    } else if (source.startsWith("```", index)) {
      const fence = /^`+/.exec(source.slice(index))?.[0] ?? "```";
      hide(endAfter(fence, index + fence.length));
    } else if (char === "/" && next === "/" && source.charAt(index - 1) !== ":") {
      const newline = source.indexOf("\n", index);
      hide(newline === -1 ? source.length : newline);
    } else if (char === "/" && next === "*") {
      hide(endAfter("*/", index + 2));
    } else {
      copy(index + 1);
    }
  }
  return result;
}

const MARKUP_HEADING = /^[ \t]*(=+)[ \t]+(.*)$/;
const FUNCTION_HEADING = /#heading(?:\(([^)]*)\))?\[([^\]]*)\]/g;
const INCLUDE = /#include\s+"([^"]+)"/g;

/** Turns the markup of a heading into the text a reader would see. */
function plainTitle(source: string): string {
  return source
    .replace(/\s*<[\w.:-]+>\s*$/, "")
    .replace(/#footnote\[[^\]]*\]/g, "")
    .replace(/#[\w.-]+(?:\([^()]*\))?\[([^\]]*)\]/g, "$1")
    .replace(/(?<![\\\p{L}\p{N}])[*_]|(?<!\\)[*_](?![\p{L}\p{N}])/gu, "")
    .replace(/(?<!\\)[`$]/g, "")
    .replace(/\\(.)/g, "$1")
    .replace(/~/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Headings and file inclusions of one Typst source. */
export const scanTypst: OutlineScanner = (source, { path }) => {
  const directory = directoryOf(path);
  const items: OutlineItem[] = [];
  maskTypst(source.replace(/\r\n?/g, "\n"))
    .split("\n")
    .forEach((text, index) => {
      const heading = (level: number, title: string) =>
        items.push({
          kind: "heading",
          level,
          title: plainTitle(title) || "(untitled)",
          line: index + 1,
        });
      const markup = MARKUP_HEADING.exec(text);
      if (markup !== null) heading((markup[1] as string).length, markup[2] as string);
      for (const call of text.matchAll(FUNCTION_HEADING)) {
        const level = /level:\s*(\d+)/.exec(call[1] ?? "")?.[1];
        heading(Number(level ?? 1), call[2] as string);
      }
      for (const include of text.matchAll(INCLUDE)) {
        const name = include[1] as string;
        const target = joinPath(name.startsWith("/") ? "" : directory, name);
        if (target !== undefined) items.push({ kind: "include", targets: [target] });
      }
    });
  return items;
};
