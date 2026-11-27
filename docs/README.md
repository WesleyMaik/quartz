# Quartz Planning Documentation

Planning set produced on 2026-11-26. No application code exists yet. These documents are the input for the implementation phase.

## Evidence legend

Every technical claim in this set is tagged so readers can tell how much weight it carries.

| Tag | Meaning |
|---|---|
| **[FACT]** | Confirmed from official documentation, a license file, or a source repository. A URL is given. |
| **[FINDING]** | Research result from secondary sources or partial reads. Likely true, re-check before relying on it. |
| **[REC]** | Architectural recommendation made by this plan. Has a stated reason. |
| **[ASSUMPTION]** | Unvalidated assumption. Must be confirmed by a spike or a decision. |
| **[OPEN]** | Open question that needs a decision from the project owner. |
| **[DEFERRED]** | Explicitly out of the MVP. |

## Reading order

1. [PRD.md](PRD.md): product requirements and MVP scope.
2. [architecture/overview.md](architecture/overview.md): the whole system on one page.
3. [architecture/final-review.md](architecture/final-review.md): the self-critique and answers to the 15 review questions.
4. [decisions/](decisions/): the ADRs.
5. [technical-spikes/](technical-spikes/): what must be proven before Phase 1.
6. [roadmap/implementation-plan.md](roadmap/implementation-plan.md) and [roadmap/task-backlog.md](roadmap/task-backlog.md).

## Index

### Product
- [PRD.md](PRD.md)
- [open-questions.md](open-questions.md)

### Architecture
- [overview.md](architecture/overview.md)
- [monorepo.md](architecture/monorepo.md)
- [client-side-architecture.md](architecture/client-side-architecture.md)
- [storage-architecture.md](architecture/storage-architecture.md)
- [compiler-architecture.md](architecture/compiler-architecture.md)
- [agent-bridge.md](architecture/agent-bridge.md)
- [security.md](architecture/security.md)
- [testing-strategy.md](architecture/testing-strategy.md)
- [final-review.md](architecture/final-review.md)

### Specifications
- [project-archive.md](specifications/project-archive.md)
- [document-domain.md](specifications/document-domain.md)
- [compiler-contracts.md](specifications/compiler-contracts.md)
- [webmcp-tools.md](specifications/webmcp-tools.md)
- [workspace-ux.md](specifications/workspace-ux.md)

### Technical spikes
- [latex-wasm.md](technical-spikes/latex-wasm.md)
- [typst-wasm.md](technical-spikes/typst-wasm.md)
- [browser-storage.md](technical-spikes/browser-storage.md)
- [project-archive.md](technical-spikes/project-archive.md)
- [webmcp-feasibility.md](technical-spikes/webmcp-feasibility.md)
- [smoothui-integration.md](technical-spikes/smoothui-integration.md)

### Decisions
- [ADR-001 Frontend stack](decisions/ADR-001-frontend-stack.md)
- [ADR-002 Browser storage](decisions/ADR-002-browser-storage.md)
- [ADR-003 Project format](decisions/ADR-003-project-format.md)
- [ADR-004 Compiler architecture](decisions/ADR-004-compiler-architecture.md)
- [ADR-005 Agent integration](decisions/ADR-005-agent-integration.md)
- [ADR-006 UI primitives](decisions/ADR-006-ui-primitives.md)
- [ADR-007 Internationalization](decisions/ADR-007-internationalization.md)

### Roadmap
- [implementation-plan.md](roadmap/implementation-plan.md)
- [task-backlog.md](roadmap/task-backlog.md)
- [acceptance-criteria.md](roadmap/acceptance-criteria.md)

Repository rules for coding agents live in the root [AGENTS.md](../AGENTS.md).
