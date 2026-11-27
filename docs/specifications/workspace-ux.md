# Workspace UX Specification

Desktop-first (≥ 1280 px primary, ≥ 1024 px supported, < 1024 px read-mostly with stacked panels). Functional reference: Prism, Overleaf, VS Code, the Typst web app; interaction quality reference: Linear. No proprietary branding or assets are copied.

## 1. Screens

1. **Dashboard** (`/`): recent projects (first-page thumbnail, title, engine badge, updated time, size), "New project" (template picker), "Import" (drop zone accepting `.zip`, `.tex`, `.typ`, folders), storage meter with persistence state and "Export all" action.
2. **Workspace** (`/p/:id`).

## 2. Workspace layout

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Header: ◆ Quartz │ Project title ▾ │ LaTeX·pdfLaTeX │ ● Saved │ ✓ Built 12:04 │ ▶ Compile │ ⋯ │
├──────────┬──────────────────────────────┬──────────────────────────┬──────────┤
│ Explorer │ Tabs: main.tex  intro.tex ×  │ PDF toolbar: ‹ 3/12 › 110% │ Agent    │
│ (tree)   │──────────────────────────────│──────────────────────────│ (panel)  │
│          │ CodeMirror editor            │ PDF.js viewer            │ activity │
│          │                              │                          │ reviews  │
│          │──────────────────────────────│                          │          │
│          │ Problems / Log (collapsible) │                          │          │
└──────────┴──────────────────────────────┴──────────────────────────┴──────────┘
```

- All vertical splits use shadcn `Resizable` (react-resizable-panels). Explorer and Agent panel collapse to icon rails. Sizes and collapsed states persist per project in `workspaceState`.
- Default proportions: explorer 15 %, editor 42 %, preview 43 %, agent panel closed until WebMCP is available or the user opens it.
- Bottom panel (Problems, Log) under the editor, collapsed by default, auto-opens on compile error (configurable).

## 3. Header

| Element | Behavior |
|---|---|
| Project title | Inline rename; dropdown with Duplicate, Download as ZIP, Export PDF, Project settings, Delete |
| Engine badge | `LaTeX · pdfLaTeX` / `LaTeX · XeLaTeX` / `Typst`; click opens compiler settings |
| Save status | `Saved`, `Saving…`, `Unsaved changes`, `Not saved: <reason>` (destructive color) |
| Compile status | Icon + text from the status model; click opens the log; shows progress during `initializing` |
| Compile button | Primary action; split button with "Auto compile" toggle |
| Agent indicator | Dot: grey (WebMCP unavailable), outline (available, no activity), pulsing (tool running), badge count for pending reviews |

## 4. Explorer

- Tree with folders first, then files, alphabetical; icons by kind; entry file marked with a star.
- Context menu: New file, New folder, Rename (F2), Duplicate, Delete (Del, confirm), Set as main document, Copy path, Download.
- Drag and drop: move within tree; drop files from the OS to upload (validated with `parseProjectPath` and size limits).
- Inline validation of names with the same path rules as import.

### Outline

Collapsible section below the file tree (and in the mobile files tab and drawer). It lists the headings of the document compiled from the entry file, following included files in document order; for a source the document does not include, it shows that file's own headings. Selecting a heading opens the file at its line. It updates on autosave.

- LaTeX: `\part` to `\subparagraph` (starred included) and Beamer frame titles; `\input`, `\include`, `\subfile`, `\import` and `\subimport` are followed.
- Typst: `=` headings and `#heading(...)[...]`; `#include` is followed.
- List items, figures and headings produced by user-defined macros are not listed; sources are scanned, never compiled.

## 5. Editor

- Tabs: open, close (Ctrl/Cmd+W), reorder, dirty dot, middle-click close, overflow menu. Restored after reload.
- Features: line numbers, active line, bracket matching, folding, search/replace panel (Ctrl/Cmd+F, Ctrl/Cmd+H), go to line (Ctrl/Cmd+G), multiple cursors, soft wrap toggle, lint gutter with compiler diagnostics.
- Completion: LaTeX commands and environments (static list + `\newcommand` in project), `\ref{}`/`\cref{}` → labels, `\cite{}` → bib keys; Typst: functions/keywords static list, `@label` refs, `@key` citations.
- Outline: Ctrl/Cmd+Shift+O shows document outline (from the indexer) for quick navigation.
- Pending agent edits for the open file are shown as inline decorations (added/removed highlights) with Accept/Reject in a gutter widget.

## 6. Preview

- PDF.js viewer with toolbar: page x / n, prev/next, zoom (fit width, fit page, presets, Ctrl/Cmd + wheel), search (Ctrl/Cmd+Shift+F inside preview), download.
- Text selection and copy enabled (text layer).
- On rebuild: keep scroll position and zoom; swap documents only when the new one has rendered its first visible page (no flash).
- States: empty ("Compile to see the PDF"), initializing (engine download progress), stale badge on failure ("Showing last successful build from 12:04"), error card linking to Problems.

## 7. Agent panel

Tabs: **Activity** and **Reviews (n)**.

- Connection card: WebMCP status (available / unavailable with "How to connect your agent" link to docs), toggle "Expose tools to agents", write policy selector (Staged / Auto-apply edits).
- Activity: chronological tool calls (`ai-tool-call`: name, status, args summary, result summary, duration), compile runs triggered by agents, change-set events, self-reported agent status (`agent-avatar`, label marked "self-reported", `ai-task-list` if tasks provided).
- Reviews: one card per pending change set (`ai-approval` with Approve / Reject / Review). "Review" opens a full-height diff view (CodeMirror merge, unified or side-by-side) per file; per-file accept/reject; "Approve all".
- Applied change sets show "Undo" for 30 days (until retention ends).
- Nothing is shown that Quartz did not observe: no reasoning, no token meters, no chat transcript.

## 8. Command palette (Ctrl/Cmd+K)

Groups: Files (fuzzy open), Commands (Compile, Toggle auto compile, Toggle explorer/preview/agent panel, Switch theme, New file, New project, Download as ZIP, Export PDF, Import), Projects (switch), Settings. Built on shadcn `Command` (cmdk). Every command has an ID used by keyboard shortcuts, so shortcuts and palette share one registry.

## 9. Keyboard shortcuts (defaults)

| Action | Shortcut |
|---|---|
| Command palette | Ctrl/Cmd+K |
| Quick open file | Ctrl/Cmd+P |
| Compile | Ctrl/Cmd+Enter, Ctrl/Cmd+S (save = flush + compile if auto compile is on) |
| Toggle explorer / preview / agent panel | Ctrl/Cmd+B / Ctrl/Cmd+J / Ctrl/Cmd+Shift+A |
| Next / previous tab | Ctrl+Tab / Ctrl+Shift+Tab |
| Focus editor / preview | Ctrl/Cmd+1 / Ctrl/Cmd+2 |

## 10. Theming and accessibility

- Light and dark themes with system default; tokens as CSS variables in `packages/ui`; CodeMirror and PDF.js chrome follow the theme (PDF pages stay white; optional "dim pages" filter).
- WCAG 2.2 AA contrast; all actions reachable by keyboard; visible focus; ARIA labels on icon buttons; `prefers-reduced-motion` disables Motion transitions; live region for compile status announcements.
- Motion used sparingly: panel collapse, toasts, tool-call status transitions only.

## 11. Storage and safety UX

- First project creation shows a one-time notice: "Your projects are stored only in this browser. Clearing site data deletes them. Export ZIP backups." with "Keep data persistent" (calls `persist()`).
- Settings → Storage: usage, quota, persisted state, cached engine assets size with "Clear engine cache".
- Delete project requires typing nothing but confirming in a destructive dialog that names the project and offers "Export first".
