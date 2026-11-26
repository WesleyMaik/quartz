# Agent Bridge

Decision record: [ADR-005](../decisions/ADR-005-agent-integration.md). Tool catalog: [webmcp-tools.md](../specifications/webmcp-tools.md). Feasibility: [webmcp-feasibility.md](../technical-spikes/webmcp-feasibility.md).

## 1. What WebMCP is (confirmed facts)

- **[FACT]** WebMCP is a W3C Web Machine Learning Community Group draft ("Draft Community Group Report, 24 November 2026"), not a W3C standard. https://webmachinelearning.github.io/webmcp/
- **[FACT]** Entry point is `document.modelContext` (`[SecureContext]`). Older guides use `navigator.modelContext`; the current spec IDL and Chrome docs use `document.modelContext`. https://developer.chrome.com/docs/ai/webmcp/imperative-api
- **[FACT]** IDL (spec §4.2):
  - `registerTool(ModelContextTool tool, optional { exposedTo, signal })` returns `Promise<undefined>`.
  - `ModelContextTool { name (1-128 chars, [A-Za-z0-9_.-]), title?, description, inputSchema?, outputSchema?, execute(input, { signal }), annotations? }`.
  - `ToolAnnotations { readOnlyHint, untrustedContentHint, consequentialHint, debugging }`, all default `false`.
  - Events on `modelContext`: `toolchange`, `toolactivated`, `toolcancel` (`toolName` attribute).
  - `getTools()`, `executeTool()` and `waitForToolsUntil()` exist for consumers and late registration.
  - There is no `unregisterTool`; unregistration is by aborting the `signal` passed at registration.
- **[FACT]** `execute` returns any JSON-serializable value; a rejected promise surfaces to the agent as an error.
- **[FACT]** Permissions Policy feature `tools`, default `self`; cross-origin iframes need `allow="tools"`.
- **[FACT]** Availability: Chrome origin trial from Chrome 149; local testing via `chrome://flags/#enable-webmcp-testing`; Edge origin trial from Edge 150. Firefox and Safari have standards-position discussions only. https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md
- **[FINDING]** Some fields arrived in later Chrome versions (for example `outputSchema` in Chrome 159, `waitForToolsUntil` in Chrome 160, `annotations.debugging` in Chrome 156), per the Chrome imperative API page. Quartz must feature-detect behavior, not versions.
- **[FINDING]** `requestUserInteraction()` is mentioned in Chrome's security guidance as a spec draft item but is not in the IDL as read. Quartz must not depend on it.

## 2. Who can call Quartz tools

WebMCP only defines the page side. A consumer must sit in or control the browser:

| Consumer | How | Status |
|---|---|---|
| Browser-integrated assistants (Gemini in Chrome, Brave Leo, Edge) | Native | **[FINDING]** Brave Leo support listed as expected early 2027; Gemini in Chrome consumption claimed by secondary sources, not confirmed in Chrome docs |
| Chrome extensions | Content scripts call `getTools`/`executeTool` (Chrome's example "Agentic Chrome Extension" and "Model Context Tool Inspector") | **[FACT]** documented by Chrome |
| Coding agents (Claude Code, Codex, Cursor, others) | Through a browser-automation MCP server the user runs: Chrome DevTools MCP with `--categoryExperimentalWebmcp` exposes `list_webmcp_tools` and `execute_webmcp_tool`; Playwright has a `WebMCP` API class; CDP has a `WebMCP` domain | **[FINDING]** experimental, flag names may change; https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md, https://chromedevtools.github.io/devtools-protocol/tot/WebMCP |

The Chrome DevTools MCP process is part of the **user's harness**, not a Quartz component. Quartz neither ships nor requires it, which keeps the zero-backend constraint intact. Quartz documents it as one supported setup.

## 3. Internal design

```
packages/agent-bridge
  ├─ catalog/            tool definitions: name, zod input schema, zod output schema,
  │                       annotations, policy, handler(ops, input, ctx)
  ├─ policy.ts           read | write-staged | write-auto | destructive → approval rules
  ├─ runtime.ts          ToolRuntime: validate → authorize → execute → record activity
  ├─ ports.ts            QuartzOperations (implemented by apps/web services)
  ├─ activity.ts         ActivityEvent types emitted by the runtime
  └─ webmcp/adapter.ts   registers catalog tools on document.modelContext
```

- **Catalog is the single source**: zod schemas generate the WebMCP `inputSchema`/`outputSchema` with `z.toJSONSchema()`, and the same schemas validate inputs at runtime. Never trust the agent to respect the JSON schema.
- **ToolRuntime is transport-independent.** The WebMCP adapter is one caller; the command palette's "Run tool" debug view and tests are others. A future transport (an extension message channel, for instance) is another adapter, not a rewrite.
- **QuartzOperations port** decouples the bridge from Dexie and compilers:

```ts
interface QuartzOperations {
  getActiveProject(): Promise<ProjectSummary | undefined>;
  listFiles(projectId: ProjectId, opts: ListOptions): Promise<FileEntry[]>;
  readFile(projectId: ProjectId, path: ProjectPath, range?: LineRange): Promise<ReadResult>;
  search(projectId: ProjectId, query: SearchQuery): Promise<SearchHit[]>;
  stageChangeSet(projectId: ProjectId, ops: FileOperation[], meta: ChangeSetMeta): Promise<Result<ChangeSet, QuartzError>>;
  applyChangeSet(id: ChangeSetId): Promise<Result<void, QuartzError>>;
  compile(projectId: ProjectId, opts: CompileRequestOptions): Promise<CompilationSummary>;
  getCompileState(projectId: ProjectId): CompileState;
  outline(projectId: ProjectId): Promise<OutlineNode[]>;
}
```

### Registration lifecycle

1. On workspace mount, if `"modelContext" in document`, register every catalog tool with one shared `AbortController`.
2. On project switch, tools stay registered (they act on the active project); a `project` context field is included in every result.
3. On unmount, lock loss (another tab took over) or a user toggle "Expose tools to agents: off", abort the controller.
4. Origin-trial token is a static `<meta http-equiv="origin-trial">` in `index.html`, injected at build time from an env var.
5. `exposedTo` is never set: tools are only for same-origin use by the agent controlling this tab.

## 4. Safety model

| Class | Examples | Default policy | WebMCP annotations |
|---|---|---|---|
| read | `get_project`, `list_files`, `read_files`, `search_files`, `get_diagnostics` | Allowed, logged | `readOnlyHint: true`, `untrustedContentHint: true` (file content is user/third-party text) |
| compile | `compile_project` | Allowed, logged, rate-limited (1 concurrent, 10/min) | `readOnlyHint: true` |
| write (staged) | `write_file`, `edit_file`, `create_file`, `rename_path` | Staged as a change set, user reviews | `consequentialHint: false` |
| destructive | `delete_path` | Always staged, always explicit approval, cannot be auto-applied | `consequentialHint: true` |
| review | `get_change_set` | Allowed | `readOnlyHint: true` |

Rules:

- Writes never touch files directly. They create a **change set**: a list of `FileOperation`s with base revisions and a before/after snapshot of each affected file.
- Staged mode (default): the tool returns `{ changeSetId, status: "pending_review", summary }` immediately. It does not block waiting for the human, because harnesses may time out a long tool call. The agent can poll `get_change_set` to learn `applied`, `rejected` or `conflict`.
- Auto-apply mode (opt-in per project, non-destructive tools only): change set is created and applied in one step; still undoable.
- Conflict detection: each op carries the file `revision` the agent read (`expectedRevision`). If the user edited the file since, apply fails with `conflict` and the review UI shows a three-way view.
- Undo: applying a change set stores the inverse ops; "Undo change set" applies them as a new change set (so undo is itself reviewable and redoable). Undo is available from the activity timeline and the review panel.
- Limits: max 50 ops per change set, max 2 MB of new content per call, max 200 files per `read_files`, max 1 MB returned per call (truncate with `truncated: true` and a continuation hint), max 30 tool calls per 10 s (excess → `rate_limited`).
- Paths validated by the shared `parseProjectPath` (no absolute paths, no `..`, no control characters).
- No tool executes code, evaluates expressions, fetches arbitrary URLs, or reads outside the active project.
- Prompt-injection awareness: file contents and compile logs are untrusted text for the agent. Tool results mark them as data (`untrustedContentHint`), and Quartz never interprets agent-provided text as commands.

## 5. Representing agent activity in the UI

WebMCP gives the page tool invocations, not the agent's conversation. Quartz shows only what it observes:

| UI element | Data source | Smooth UI component |
|---|---|---|
| Activity timeline | `ActivityEvent`s from `ToolRuntime` (start, success, error, cancelled via `signal.abort`) | `ai-conversation` (scroll container), `ai-tool-call` |
| Agent identity | Unknown by default; shows "Connected agent" with a generic avatar. If the agent calls `set_agent_status` with a name, that self-reported name is shown, labeled as self-reported | `agent-avatar` |
| Plan / progress | Only if the agent calls `set_agent_status` with a task list | `ai-task-list` |
| Pending reviews | Change sets with `pending_review` | `ai-approval`, `ai-diff` (summary), CodeMirror merge view (full review) |
| Working indicator | A tool call currently executing | `ai-loader` |

Not shown, because Quartz does not have the data: model reasoning, token/context usage, the agent's chat messages. `ai-reasoning` and `ai-context-meter` are therefore not used (see [smoothui-integration.md](../technical-spikes/smoothui-integration.md)).

## 6. Embedded chat: real limitations

- A prompt box in Quartz cannot deliver text to an external agent through WebMCP: the protocol is agent → page only.
- Options that respect zero-backend, all **[DEFERRED]**:
  1. **Inbox tool pattern**: the user types a note into Quartz; the agent reads it with `get_user_notes` when it next calls tools. Works only while the agent is actively looping and chooses to call the tool. Honest but weak.
  2. **Browser-integrated assistant**: if the user's agent lives in the browser (Gemini in Chrome, Leo), the conversation already happens in the browser's own UI next to Quartz. Quartz does not need a chat panel.
  3. **Extension channel**: a user-installed extension that bridges a harness could also relay messages to the page via `postMessage`. Requires a separate product; out of scope.
- **[REC]** The MVP ships the activity panel, not a chat. This is the honest version of the "AI-native" claim.
