# ADR-001: Frontend Stack

Status: Accepted (pending Phase 1 version pinning). Date: 2026-11-26.

## Context

Quartz must be a static, client-only application with heavy WebAssembly workers, a code editor and a PDF viewer. The initial proposal named React 19, TypeScript strict, Vite, Turborepo, pnpm, Tailwind 4, shadcn/ui, HugeIcons, and mentioned vinext as an option for `apps/web`.

## Decision

| Concern | Choice |
|---|---|
| UI runtime | React 19.2.x |
| Language | TypeScript, strict, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` |
| Bundler / dev server | Vite (latest stable major), SPA mode, `@vitejs/plugin-react` |
| Monorepo | Turborepo 2.x + pnpm workspaces (single lockfile, `catalog:` versions) |
| Styling | Tailwind CSS 4 via `@tailwindcss/vite` |
| Components | shadcn/ui on **Base UI** primitives + Smooth UI (see ADR-006) |
| Icons | HugeIcons Free (`@hugeicons/react`, `@hugeicons/core-free-icons`) |
| Routing | React Router 7, library mode |
| UI state | Zustand 5 (UI-only); domain state in Dexie |
| Validation and schemas | zod 4 (manifest, tool I/O, settings; JSON Schema generation for WebMCP) |
| Worker RPC | Comlink |
| Editor | CodeMirror 6 |
| PDF | pdfjs-dist with its viewer layer |
| Lint/format | Biome 2 |
| Tests | Vitest (+ browser mode), Playwright |
| PWA | vite-plugin-pwa |

## Rejected alternatives

- **vinext (Cloudflare's Vite-based Next.js API reimplementation).** **[FINDING]** It reimplements the Next.js API surface on Vite, targets Cloudflare Workers as the primary deployment, and its README still describes it as experimental with compatibility gaps despite a 1.0 announcement (https://github.com/cloudflare/vinext, https://blog.cloudflare.com/vinext-nextjs-on-vite/). Its value is server rendering and server functions, which Quartz forbids. It would add a framework layer and push toward a Workers runtime. Rejected.
- **Next.js (static export).** Same reasoning: App Router, RSC and image pipeline are server features; static export disables most of them. No benefit for a single-page editor.
- **Monaco Editor.** Strong diff editor and VS Code familiarity, but it is a large monolith (multi-MB), built around its own worker model, has weaker extension composition for custom languages, and its mobile support is poor. CodeMirror 6 is modular, tree-shakeable, has `@codemirror/merge` for diffs and Yjs bindings (`y-codemirror.next`) for future collaboration. **[REC]** CodeMirror 6.
- **ESLint + Prettier.** Biome covers lint and format in one fast tool; type-aware lint rules are less complete, which is accepted (TypeScript strict covers most).
- **TanStack Router.** More type-safe, but two routes do not justify it.
- **Redux / Jotai.** No need: Dexie liveQuery is the domain store; Zustand covers UI state.

## Editor language support

- LaTeX: start with `@codemirror/legacy-modes` `stex` via `StreamLanguage` (MIT, maintained by CodeMirror). Evaluate community Lezer grammars (`codemirror-lang-latex`) in T-3.3.1 for structure-aware features (folding, outline); adopt only if maintained and MIT-compatible.
- Typst: **[FINDING]** no official CodeMirror 6 Typst language exists. Start with a Quartz-owned `StreamLanguage` tokenizer (markup, `#` code, math `$...$`, strings, comments, headings) and get structure from the Typst compiler's diagnostics/outline rather than a full grammar. Evaluate community packages in T-3.3.2.
- Each language lives in `packages/editor/src/languages/<lang>/` exporting one `Extension` bundle (highlighting, completion sources, snippets, folding).

## Consequences

- No SSR, no server code paths, fully static deploy.
- Pinning versions happens in T-1.1.1 with `pnpm view`; this ADR lists majors only, because exact versions on the scaffold day are authoritative.
