# Spike 6: Smooth UI in the Monorepo

Task IDs: T-0.6.x. Decision: [ADR-006](../decisions/ADR-006-ui-primitives.md).

## Objective

Install the selected Smooth UI components into `packages/ui` with shadcn on Base UI, Tailwind 4 and Motion, consume them from `apps/web`, and confirm they can be driven by real Quartz data.

## Research findings (2026-11-26)

Sources read: https://smoothui.dev/llms.txt, https://smoothui.dev/docs/guides/installation.mdx, parts of https://smoothui.dev/llms-full.txt, https://smoothui.dev/docs/templates/chat, https://github.com/educlopez/smoothui.

- **[FACT]** MIT license. Requirements: React 19+, Tailwind CSS 4+, Motion 12+ (`motion`, import `motion/react`), `clsx` + `tailwind-merge` (`cn()`), path alias. Some components use `lucide-react`; some use `tw-animate-css`; a shared `components/smoothui/lib/animation.ts` is pulled in by several components.
- **[FACT]** Install: `smoothui-cli add <names>` or shadcn registry namespace `@smoothui` (`shadcn add @smoothui/<name>`), registry URL `https://smoothui.dev/r/{style}/{name}.json`; owned primitives default to Base UI; non-`base-*` styles receive Radix twins.
- **[FINDING]** Docs are inconsistent about the registry URL (`/r/{name}.json` vs `/r/{style}/{name}.json`). Use the style-aware one and verify the resolved files.
- **[FACT]** Chat Template: "Every reply is scripted." Not adopted; used only as a reference for layout.
- **[FINDING]** Per-component npm/registry dependency lists and `ai-core` exported types were not found in the pages read. `ai-core` exports an `AIState` type (`idle | listening | thinking | streaming | done | error`) used by `ai-orb-face`. Inspect registry JSON during the spike.
- **[FINDING]** No markdown renderer or diff library is named for `ai-response` / `ai-diff`; `ai-diff` takes pre-computed lines.

## Component selection

| Component | Data shape (from docs) | Decision | Quartz data source |
|---|---|---|---|
| `ai-tool-call` | `name`, `status: pending|running|success|error`, `args`, `result`, `summary` | **MVP** | `ActivityEvent` from ToolRuntime |
| `ai-approval` | `question`, `options[{id,label,destructive?}]`, `onDecide`, `resolvedId` | **MVP** | Pending change sets |
| `ai-diff` | `lines[{number?, kind: added|removed|context, content}]`, `onAccept`, `onReject`, `title` | **MVP** (compact per-file summary) | Line diff computed in a worker (`diff` package, BSD-3-Clause, or CodeMirror merge's diff) |
| `ai-task-list` | `tasks[{id,label,note?,status: pending|running|done|failed,children?}]` | **MVP** | `set_agent_status` (self-reported) |
| `ai-conversation` | scroll container with follow-bottom and jump-to-latest | **MVP** | Wraps the activity timeline |
| `ai-loader` | variants `dots|bar|grid`, `showElapsed` | **MVP** | Running tool call / engine init |
| `agent-avatar` | pixel avatar from seed | **MVP** | Seed = self-reported label or "agent" |
| `ai-message` | `from: user|assistant`, avatar, timestamp | Deferred | Only if an inbox/notes feature ships |
| `ai-response` | `text`, `citations`, `isStreaming` | Deferred | No assistant text exists |
| `ai-prompt-input` | composer with submit/stop | **Excluded from MVP** | No real channel to the agent (see agent-bridge §6) |
| `ai-suggestions` | `suggestions`, `onSelect` | Excluded | Would need a model |
| `ai-reasoning` | collapsible reasoning | Excluded | Quartz has no reasoning data; must not invent it |
| `ai-context-meter` | `used`, `limit`, `breakdown` | Excluded | No reliable token data |
| `ai-branch` | branch navigation | Excluded | No conversation branches |
| `ai-artifact` | `code`, `preview`, `title` | Phase 6 candidate | Could preview agent-created files |
| `ai-citation`, `ai-sources` | citation pills / source list | Phase 6 candidate | Bibliography features, not agent UI |
| `ai-core` | shared types | Installed only as a dependency if required | |

**[REC]** For full file review, use `@codemirror/merge` (MIT) inside the editor; `ai-diff` is for compact cards in the panel. This avoids building a second diff viewer.

## Risks

| Risk | Mitigation |
|---|---|
| Registry `{style}` resolution gives Radix twins by mistake | Assert no `@radix-ui/*` in `pnpm why` after install (CI check) |
| Alias mismatch in monorepo (`@/components/smoothui/...` imports) | Configure `components.json` aliases to `@qrtz/ui/...` or a package-local `#ui/*` subpath import; fix imports once at install |
| lucide icons inside components | Replace with HugeIcons during install; lint rule bans `lucide-react` imports |
| Tailwind classes in package not generated | `@source` directive in app CSS |
| Motion bundle weight | Only the agent panel imports Smooth UI; lazy-load the panel |

## Validation steps

1. T-0.6.1 Throwaway monorepo (apps/web + packages/ui) with pnpm, Vite, Tailwind 4, shadcn `init` Base style in `packages/ui`.
2. T-0.6.2 Install the 7 MVP components through `pnpm dlx shadcn@latest add @smoothui/<name> -c packages/ui`; record every file, npm dependency and registry dependency added.
3. T-0.6.3 Check: no Radix packages, imports resolve, typecheck strict passes (no `any` introduced; fix or wrap).
4. T-0.6.4 Render each component from `apps/web` with real-shaped fixture data (from ActivityEvent and ChangeSet types).
5. T-0.6.5 Swap lucide → HugeIcons; measure bundle size of the agent panel chunk.
6. T-0.6.6 Accessibility pass: keyboard on `ai-approval`, focus order, reduced motion.

## Go / no-go

- **Go** if components install into `packages/ui` with Base UI only, pass strict typecheck, render from the app, and the agent-panel chunk stays < 120 KB gzip.
- **No-go** for a specific component → write a small Quartz component in `packages/ui/composites` with the same props shape.
