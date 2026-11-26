# ADR-006: UI Primitives (shadcn/ui on Base UI) and Smooth UI

Status: Accepted, confirm with Spike 6. Date: 2026-11-26.

## Context

shadcn/ui can generate components on Radix UI or Base UI primitives. Smooth UI is required for agent UI components; **[FACT]** its installation guide states its owned primitives ship on Base UI by default, configures the registry as `"@smoothui": "https://smoothui.dev/r/{style}/{name}.json"`, and serves the Base twin for `base-*` styles (https://smoothui.dev/docs/guides/installation.mdx). Smooth UI is MIT, requires React 19+, Tailwind 4+, and Motion 12+ (`motion`, imported from `motion/react`).

## Decision

- **shadcn/ui with Base UI** (`"style": "base-nova"` or the current Base style at scaffold time) for every primitive in `packages/ui`.
- Smooth UI components installed through the shadcn CLI and the `@smoothui` namespaced registry into `packages/ui`, never into `apps/web`.
- Do not mix Radix and Base UI primitives. If a needed component exists only for Radix, port it to Base UI inside `packages/ui` or skip it.
- Icons: HugeIcons. Vendored Smooth UI components that import `lucide-react` get their icons swapped to HugeIcons at install time (the code is copied into the repo, so this is a normal edit). Rationale: one icon set, one visual language, no duplicate icon dependency. **[ASSUMPTION]** the number of lucide icons in selected components is small; Spike 6 counts them.

## Why Base UI rather than Radix

1. Smooth UI's default and best-tested path is Base UI; using Radix means relying on the style-aware twin for every component.
2. One primitive system across shadcn and Smooth UI avoids duplicated focus management, portal and dismissable-layer logic.
3. shadcn officially supports Base UI styles, so the shadcn CLI, theming and registry flow stay standard.

Trade-off: Radix has a longer track record and more community examples; Base UI is newer. Accepted because Base UI is maintained by the MUI team with a stable 1.x line **[FINDING]**, and the dependency is confined to `packages/ui`.

## Monorepo layout for packages/ui

```
packages/ui/
├── components.json          # style, aliases → @qrtz/ui paths, registries: { "@smoothui": ... }
├── src/
│   ├── components/          # shadcn primitives (button, dialog, resizable, command, ...)
│   ├── smoothui/            # Smooth UI components as installed (ai-tool-call, ...)
│   ├── composites/          # Quartz-specific compositions (file-tree, status-badge)
│   ├── lib/utils.ts         # cn()
│   └── styles/globals.css   # Tailwind 4 @import, theme tokens, dark mode
└── package.json             # exports "./components/*", "./smoothui/*", "./styles.css"
```

The app's Tailwind entry imports `@qrtz/ui/styles.css` and adds `@source "../../packages/ui/src"` so classes inside the package are generated.

Install commands (run from repo root, pnpm only):

```
pnpm dlx shadcn@latest init -c packages/ui
pnpm dlx shadcn@latest add button dialog dropdown-menu resizable command tabs tooltip sonner -c packages/ui
pnpm dlx shadcn@latest add @smoothui/ai-tool-call @smoothui/ai-approval @smoothui/ai-diff @smoothui/ai-task-list @smoothui/ai-conversation @smoothui/ai-loader @smoothui/agent-avatar -c packages/ui
```

`smoothui-cli` (`pnpm dlx smoothui-cli@latest add ...`) is the alternative; **[REC]** prefer the shadcn registry path so one CLI and one `components.json` manage everything. Spike 6 confirms `-c` (cwd) works with the monorepo aliases.
