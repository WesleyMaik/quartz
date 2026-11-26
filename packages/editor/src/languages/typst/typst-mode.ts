import type { StreamParser, StringStream } from "@codemirror/language";

/**
 * Tokenizer state. Typst switches between markup, code (after `#`) and math (`$...$`).
 * `codeDepth` tracks brackets opened in code mode so `#f(a, b)` stays code until it closes.
 */
export interface TypstState {
  mode: "markup" | "math";
  inCode: boolean;
  /** Code started by a statement keyword (`#set`, `#let`, ...) runs to the end of the line. */
  lineCode: boolean;
  codeDepth: number;
  inBlockComment: boolean;
  inRaw: boolean;
}

const KEYWORDS = new Set([
  "let",
  "set",
  "show",
  "if",
  "else",
  "for",
  "in",
  "while",
  "break",
  "continue",
  "return",
  "import",
  "include",
  "as",
  "context",
  "and",
  "or",
  "not",
]);
const ATOMS = new Set(["none", "auto", "true", "false"]);

function tokenCode(stream: StringStream, state: TypstState): string | null {
  if (stream.eatSpace()) {
    if (state.codeDepth === 0 && !state.lineCode) state.inCode = false;
    return null;
  }
  if (stream.match(/^"(?:[^"\\]|\\.)*"?/)) return "string";
  if (stream.match(/^\d+(\.\d+)?(pt|mm|cm|in|em|fr|%|deg|rad)?/)) return "number";
  if (stream.match(/^[A-Za-z_][\w-]*/)) {
    const word = stream.current();
    if (KEYWORDS.has(word)) return "keyword";
    if (ATOMS.has(word)) return "atom";
    if (stream.peek() === "(" || stream.peek() === "[") return "variableName.function";
    return "variableName";
  }
  const ch = stream.next();
  if (ch === "(" || ch === "[" || ch === "{") {
    state.codeDepth += 1;
    return "bracket";
  }
  if (ch === ")" || ch === "]" || ch === "}") {
    state.codeDepth = Math.max(0, state.codeDepth - 1);
    if (state.codeDepth === 0 && !state.lineCode) state.inCode = false;
    return "bracket";
  }
  if (ch === "." || ch === ":" || ch === "," || ch === "=" || ch === "+" || ch === "-")
    return "operator";
  return null;
}

/** Minimal Typst tokenizer for highlighting; structure comes from the compiler. */
export const typstMode: StreamParser<TypstState> = {
  name: "typst",
  startState: () => ({
    mode: "markup",
    inCode: false,
    lineCode: false,
    codeDepth: 0,
    inBlockComment: false,
    inRaw: false,
  }),
  copyState: (state) => ({ ...state }),
  token(stream, state) {
    if (stream.sol() && state.lineCode) {
      state.lineCode = false;
      if (state.codeDepth === 0) state.inCode = false;
    }
    if (state.inBlockComment) {
      if (stream.skipTo("*/")) {
        stream.match("*/");
        state.inBlockComment = false;
      } else stream.skipToEnd();
      return "comment";
    }
    if (state.inRaw) {
      if (stream.skipTo("```")) {
        stream.match("```");
        state.inRaw = false;
      } else stream.skipToEnd();
      return "monospace";
    }
    if (stream.match("//")) {
      stream.skipToEnd();
      return "comment";
    }
    if (stream.match("/*")) {
      state.inBlockComment = true;
      return "comment";
    }
    if (state.inCode) return tokenCode(stream, state);

    if (stream.match("$")) {
      state.mode = state.mode === "math" ? "markup" : "math";
      return "keyword";
    }
    if (state.mode === "math") {
      if (stream.match(/^[A-Za-z][\w.]*/)) return "variableName.special";
      stream.next();
      return "string.special";
    }
    if (stream.match("```")) {
      state.inRaw = true;
      return "monospace";
    }
    if (stream.match(/^`[^`]*`/)) return "monospace";
    if (stream.sol() && stream.match(/^\s*=+\s.*/)) return "heading";
    if (stream.sol() && stream.match(/^\s*[-+]\s/)) return "list";
    if (stream.match(/^#[A-Za-z_][\w-]*/)) {
      const word = stream.current().slice(1);
      if (KEYWORDS.has(word)) {
        state.inCode = true;
        state.lineCode = true;
        return "keyword";
      }
      state.inCode = stream.peek() === "(" || stream.peek() === "[" || stream.peek() === ".";
      return "variableName.function";
    }
    if (stream.match(/^<[\w:.-]+>/)) return "labelName";
    if (stream.match(/^@[\w:.-]+/)) return "link";
    if (stream.match(/^\*[^*\n]+\*/)) return "strong";
    if (stream.match(/^_[^_\n]+_/)) return "emphasis";
    if (stream.match(/^\\./)) return "escape";
    stream.next();
    return null;
  },
  languageData: { commentTokens: { line: "//", block: { open: "/*", close: "*/" } } },
};
