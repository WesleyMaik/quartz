import { maskTypst } from "../outline/typst";
import { countWords, type MutableStatistics } from "./types";

const CLOSING: Readonly<Record<string, string>> = { "(": ")", "[": "]", "{": "}" };

/** Index after the bracket that closes the one at `open`, or the end of the text. */
function endOfBlock(text: string, open: number): number {
  const opening = text.charAt(open);
  const closing = CLOSING[opening];
  let depth = 0;
  for (let index = open; index < text.length; index++) {
    const char = text.charAt(index);
    if (char === "\\") index++;
    else if (char === opening) depth++;
    else if (char === closing && --depth === 0) return index + 1;
  }
  return text.length;
}

/** Cuts `[...]` blocks introduced by `pattern` out of the text and returns their contents. */
function extractBlocks(text: string, pattern: RegExp): { rest: string; blocks: string[] } {
  const blocks: string[] = [];
  let rest = text;
  for (let match = pattern.exec(rest); match !== null; match = pattern.exec(rest)) {
    const open = match.index + match[0].length - 1;
    const end = endOfBlock(rest, open);
    blocks.push(rest.slice(open + 1, end - 1));
    rest = `${rest.slice(0, match.index)} ${rest.slice(end)}`;
  }
  return { rest, blocks };
}

/** Statements that configure the document; their arguments are code. */
const STATEMENT = /#(?:set|show|import|include|let)\b/;

/** Removes code statements, including bracketed parts that continue on later lines. */
function removeStatements(text: string): string {
  let rest = text;
  for (let match = STATEMENT.exec(rest); match !== null; match = STATEMENT.exec(rest)) {
    let end = match.index + match[0].length;
    while (end < rest.length && rest.charAt(end) !== "\n") {
      end = Object.hasOwn(CLOSING, rest.charAt(end)) ? endOfBlock(rest, end) : end + 1;
    }
    rest = rest.slice(0, match.index) + rest.slice(end);
  }
  return rest;
}

/** Removes function names and parenthesized arguments, keeping trailing content blocks. */
function removeCalls(text: string): string {
  const call = /#[\p{L}_][\p{L}\p{N}_.-]*/u;
  let rest = text;
  for (let match = call.exec(rest); match !== null; match = call.exec(rest)) {
    let end = match.index + match[0].length;
    if (rest.charAt(end) === "(") end = endOfBlock(rest, end);
    rest = `${rest.slice(0, match.index)} ${rest.slice(end)}`;
  }
  return rest;
}

const prose = (text: string): number =>
  countWords(
    removeCalls(text)
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/<[\w.:-]+>|@[\w.:-]+/g, " ")
      .replace(/`[^`\n]*`/g, " "),
  );

/** Adds the counts of one Typst source to `counts`. */
export function countTypst(source: string, counts: MutableStatistics): void {
  let body = maskTypst(source.replace(/\r\n?/g, "\n"));

  // A formula padded with whitespace on both sides is set on its own line.
  body = body.replace(/(?<!\\)\$((?:\\[\s\S]|[^$\\])*)\$/g, (_, formula: string) => {
    counts[/^\s[\s\S]*\s$/.test(formula) ? "displayMath" : "inlineMath"]++;
    return " ";
  });
  counts.figures += body.match(/(?<![\w.])#?figure\s*\(/g)?.length ?? 0;

  for (const pattern of [/\bcaption\s*:\s*\[/, /#footnote\s*\[/]) {
    const { rest, blocks } = extractBlocks(body, pattern);
    body = rest;
    for (const block of blocks) counts.wordsOutsideText += prose(block);
  }

  const heading = extractBlocks(body, /#heading(?:\([^)]*\))?\[/);
  for (const block of heading.blocks) {
    counts.headings++;
    counts.wordsInHeadings += prose(block);
  }
  body = removeStatements(heading.rest).replace(/^[ \t]*=+[ \t]+(.*)$/gm, (_, title: string) => {
    counts.headings++;
    counts.wordsInHeadings += prose(title);
    return "";
  });
  counts.wordsInText += prose(body);
}
