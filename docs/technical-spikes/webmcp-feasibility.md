# Spike 5: WebMCP Feasibility

Task IDs: T-0.5.x. Architecture: [agent-bridge.md](../architecture/agent-bridge.md). Decision: [ADR-005](../decisions/ADR-005-agent-integration.md).

## Objective

Prove that at least one real, user-controlled agent harness can discover and invoke Quartz tools registered through `document.modelContext`, end to end, with no Quartz server, and learn how tool activity, cancellation and errors behave.

## Hypothesis

In Chrome with WebMCP enabled (flag or origin trial), a coding agent (Claude Code or Codex) using Chrome DevTools MCP with `--categoryExperimentalWebmcp` can list and execute Quartz tools on the open tab; Quartz observes each call through its own `execute` wrapper.

## Research findings (2026-11-26)

- **[FACT]** Current API surface: `document.modelContext.registerTool(tool, { signal, exposedTo })`, tool fields `name`, `title`, `description`, `inputSchema`, `outputSchema`, `execute(input, { signal })`, `annotations { readOnlyHint, untrustedContentHint, consequentialHint, debugging }`; events `toolchange`, `toolactivated`, `toolcancel`; unregistration via `AbortSignal`. Spec: https://webmachinelearning.github.io/webmcp/ ; Chrome: https://developer.chrome.com/docs/ai/webmcp/imperative-api
- **[FACT]** Chrome origin trial from Chrome 149 (https://developer.chrome.com/blog/ai-webmcp-origin-trial); flag `chrome://flags/#enable-webmcp-testing`; Edge origin trial from 150; no Firefox/Safari implementation (https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md).
- **[FACT]** Declarative API (`<form toolname tooldescription>`) is Chrome-only and not in the spec. Quartz does not use it.
- **[FACT]** Chrome documents extensions consuming tools via content scripts and provides a "Model Context Tool Inspector" extension; DevTools has an Application > WebMCP panel (https://developer.chrome.com/docs/devtools/application/webmcp).
- **[FINDING]** Chrome DevTools MCP exposes `list_webmcp_tools` and `execute_webmcp_tool` behind `--categoryExperimentalWebmcp`; a community fork `@mcp-b/chrome-devtools-mcp` uses `call_webmcp_tool`. CDP has a `WebMCP` domain; Playwright documents a `WebMCP` class. (https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md, https://chromedevtools.github.io/devtools-protocol/tot/WebMCP, https://playwright.dev/java/docs/api/class-webmcp)
- **[FINDING]** Testing utilities: `@w3c/webmcp-polyfill`, `webmcp-types`. React hook `use-webmcp-tool` exists; maintenance not verified. **[REC]** Do not depend on the hook: registration is ~40 lines in the adapter and must happen outside React anyway (tools must survive component remounts).
- **[FINDING]** `requestUserInteraction()` appears in Chrome security guidance as a draft idea; not part of the IDL as read. Not used.
- **[FACT]** WebMCP provides tools only; no resources, prompts, sampling or conversation streaming.

## Risks

| Risk | Mitigation |
|---|---|
| API churn during origin trial (name moves already happened: `navigator` → `document`) | Single adapter module; feature detection; polyfill-based contract tests |
| No harness reliably available to users | Document setups; Quartz is fully usable without agents |
| Harness timeouts on long tools (compile, approval) | Staged writes return immediately; `compile_project` `wait` with ≤ 120 s timeout and `wait:false` option |
| Origin trial token expiry | Calendar reminder; build fails if token expires within 14 days |
| Prompt injection from document content steering the agent to destructive actions | Destructive approval, staged writes, `untrustedContentHint` |

## Validation steps

1. T-0.5.1 Minimal page registering 3 tools (`ping`, `read_note`, `stage_note`) with zod-generated schemas; verify in DevTools WebMCP panel.
2. T-0.5.2 Model Context Tool Inspector extension: invoke tools manually; record `toolactivated`/`toolcancel` behavior and `signal` abort.
3. T-0.5.3 Chrome DevTools MCP + Claude Code (and/or Codex): configure `--categoryExperimentalWebmcp`; ask the agent to list and call tools; record exact tool names, argument passing and result format seen by the agent.
4. T-0.5.4 Error semantics: thrown `Error` vs rejected promise vs structured error object; how the agent sees each.
5. T-0.5.5 Long call: tool that resolves after 60 s and 180 s; record harness timeouts.
6. T-0.5.6 Lifecycle: abort and re-register on navigation within the SPA; multiple tabs with the same tools; `toolchange` events.
7. T-0.5.7 Polyfill: same page in Firefox and Safari with `@w3c/webmcp-polyfill`, driving `executeTool` from tests.
8. T-0.5.8 Origin trial: deploy the spike page to a static host with an OT token; verify without flags.

## Expected results

A setup guide draft ("Connect your agent to Quartz") and a results file with observed behaviors for each harness.

## Go / no-go

- **Go** if at least one coding-agent harness completes list → read → stage → poll against a static deployment, and Quartz records every call.
- **Partial go** if only extension/inspector paths work: ship the bridge, document as experimental.
- **No-go is not a product blocker**: Quartz remains a complete editor; Phase 5 scope shrinks to the internal ToolRuntime (used by the command palette) and the polyfill-tested adapter.
