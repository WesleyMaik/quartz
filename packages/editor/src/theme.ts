import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

/** Editor chrome follows the app's CSS variables, so light/dark switch without reconfiguration. */
const chrome = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13.5px",
    backgroundColor: "var(--card)",
    color: "var(--card-foreground)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.6" },
  ".cm-content": { caretColor: "var(--primary)", padding: "8px 0" },
  ".cm-gutters": {
    backgroundColor: "var(--card)",
    color: "var(--muted-foreground)",
    border: "none",
  },
  ".cm-activeLine, .cm-activeLineGutter": {
    backgroundColor: "color-mix(in oklch, var(--muted) 60%, transparent)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in oklch, var(--primary) 25%, transparent) !important",
  },
  ".cm-cursor": { borderLeftColor: "var(--primary)" },
  ".cm-panels": { backgroundColor: "var(--panel)", color: "var(--foreground)" },
  ".cm-tooltip": {
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    boxShadow: "var(--shadow-lg)",
    overflow: "hidden",
  },
  ".cm-tooltip-autocomplete ul li": { borderRadius: "6px", margin: "0 4px" },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "var(--accent)",
    color: "var(--accent-foreground)",
  },
});

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword], color: "oklch(0.58 0.16 300)" },
  { tag: [t.tagName, t.function(t.variableName)], color: "oklch(0.56 0.14 250)" },
  { tag: [t.string, t.special(t.string)], color: "oklch(0.58 0.13 150)" },
  { tag: [t.number, t.atom, t.bool], color: "oklch(0.62 0.15 50)" },
  {
    tag: [t.comment, t.lineComment, t.blockComment],
    color: "var(--muted-foreground)",
    fontStyle: "italic",
  },
  { tag: [t.heading], fontWeight: "700", color: "oklch(0.55 0.15 275)" },
  { tag: [t.bracket, t.operator], color: "var(--muted-foreground)" },
  { tag: [t.labelName, t.link], color: "oklch(0.6 0.14 200)" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.monospace, fontFamily: "var(--font-mono)", color: "oklch(0.6 0.1 30)" },
  { tag: [t.special(t.variableName)], color: "oklch(0.6 0.12 200)" },
]);

export const quartzTheme: Extension = [chrome, syntaxHighlighting(highlight)];
