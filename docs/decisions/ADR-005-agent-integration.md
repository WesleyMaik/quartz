# ADR-005: Agent Integration through WebMCP

Status: Accepted, confirm with Spike 5. Date: 2026-11-26.

## Context

Agent interaction is Quartz's differentiator. Constraints: no backend, no bundled model, no API keys, no local companion server, and the app must work without WebMCP.

## Decision

1. Build a transport-independent **ToolRuntime** with a typed **tool catalog** in `packages/agent-bridge`. zod schemas are the source for runtime validation and for WebMCP JSON Schemas.
2. A **WebMCP adapter** registers the catalog with `document.modelContext.registerTool(tool, { signal })` when `"modelContext" in document`. Unregistration by `AbortController.abort()`.
3. **Writes are staged as change sets** and return immediately with `pending_review`; deletes always require explicit approval; opt-in auto-apply for non-destructive edits; every applied change set is undoable.
4. The Quartz UI shows a **tool activity panel**, not a chat. No fake AI states, no simulated responses, no LLM provider abstraction.
5. Optional `set_agent_status` tool lets an agent publish a self-reported name, status line and task list, shown and labeled as self-reported.
6. Supported consumer setups are documented, not shipped: browser-integrated assistants with WebMCP, WebMCP-capable extensions, and coding agents that drive Chrome through Chrome DevTools MCP (`--categoryExperimentalWebmcp`) or Playwright.

## Rejected alternatives

- **Local MCP server / companion app (stdio, SSE, HTTP):** forbidden by the zero-backend constraint.
- **Blocking writes until approved:** harness tool-call timeouts would turn review into failures; staged + poll is robust.
- **Unified diff `apply_patch` as the primary edit tool:** agents frequently produce malformed hunks; exact-match replacement edits (`{ oldText, newText }` with uniqueness check) are more reliable. A `unified_diff` input mode may be added later.
- **Arbitrary JS / "run command" tool:** violates the safety model.
- **`navigator.modelContext`:** superseded by `document.modelContext` in the current spec; feature-detect only the current name. **[FINDING]** If an older Chrome build only exposes the old name, the adapter can fall back, but no code depends on it.

## Consequences

- Agent UX quality depends on the harness's browser integration, which Quartz does not control.
- WebMCP is an origin-trial, draft API; the adapter is a small isolated module expected to change.
- Testing uses `@w3c/webmcp-polyfill` to validate Quartz's side in every browser.
