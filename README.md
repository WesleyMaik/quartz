<div align="center">

<img src="docs/assets/quartz-logo-256x256.png" alt="Quartz logo" width="160" height="160" />

# Quartz

**A local-first, AI-native scientific writing workspace for LaTeX and Typst that runs entirely in your browser.**

Write, compile and preview documents on your own device. Bring your own AI agent. No account, no server, no lock-in.

<br />

[![Status](https://img.shields.io/badge/status-early%20development-7c5cff?style=flat-square)](docs/roadmap/implementation-plan.md)
[![License](https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-7c5cff?style=flat-square)](#license)
[![Local-first](https://img.shields.io/badge/local--first-no%20backend-2ea44f?style=flat-square)](#why-quartz)
[![LaTeX](https://img.shields.io/badge/LaTeX-TeX%20Live%202026-008080?style=flat-square&logo=latex&logoColor=white)](docs/technical-spikes/latex-wasm.md)
[![Typst](https://img.shields.io/badge/Typst-0.14-239dad?style=flat-square&logo=typst&logoColor=white)](docs/technical-spikes/typst-wasm.md)
<br />
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646cff?style=flat-square&logo=vite&logoColor=white)](https://vite.dev)
[![WebAssembly](https://img.shields.io/badge/WebAssembly-compilers-654ff0?style=flat-square&logo=webassembly&logoColor=white)](docs/architecture/compiler-architecture.md)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-f69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io)

</div>

---

## Why Quartz

Scientific writing tools have drifted toward the cloud. Your paper lives on someone else's server, compilation happens on someone else's machine, and the AI assistant is whatever model the vendor chose to bundle. When the vendor changes its plans, your workflow changes with it. OpenAI announced that Prism, its AI LaTeX workspace, shuts down on January 1, 2027, and its users have to export their projects before then.

Quartz takes the opposite approach:

- **Your documents stay on your device.** Projects are stored in your browser. Nothing is uploaded, and there is no account to create.
- **Compilation happens locally.** LaTeX and Typst compile to PDF with WebAssembly, in Web Workers, inside your browser tab. There is no hidden remote compiler.
- **Your AI, your choice.** Quartz does not ship a model or ask for API keys. It exposes its project operations as browser tools through [WebMCP](https://developer.chrome.com/docs/ai/webmcp/), so the agent you already use can read, edit, review and compile your documents, and you approve every change. _(Planned, see the [roadmap](docs/roadmap/implementation-plan.md).)_
- **Your files stay portable.** Original `.tex`, `.typ` and `.bib` files are never rewritten or hidden. A project downloads as a standard `.zip` of your files, with no custom format.
- **Static hosting only.** The whole application is static files: any static host can serve it, and it keeps working offline once the engines are cached.

## Features

| Area                                                                                   | Status     |
| -------------------------------------------------------------------------------------- | ---------- |
| Project dashboard: create from templates, rename, duplicate, delete                    | ✅         |
| File explorer with folders, upload, rename, delete, main document selection            | ✅         |
| CodeMirror 6 editor with LaTeX and Typst highlighting, tabs, search, autocompletion    | ✅         |
| Autosave to IndexedDB with recovery after reload                                       | ✅         |
| Typst compilation in a Web Worker with live preview                                    | ✅         |
| LaTeX compilation (pdfLaTeX, XeLaTeX, BibTeX) with a self-hosted TeX Live 2026 runtime | ✅         |
| Diagnostics mapped to file and line, compile log, last successful PDF preserved        | ✅         |
| PDF preview with zoom, page navigation, text selection and download                    | ✅         |
| Document outline across included files, with jump to heading                           | ✅         |
| Document statistics and PDF details                                                    | ✅         |
| Settings: editor, PDF viewer and data controls                                         | ✅         |
| First-page thumbnails in the project list                                              | ✅         |
| Light and dark themes                                                                  | ✅         |
| Interface in English, Portuguese, Spanish, Chinese (Simplified, Traditional), Japanese | ✅         |
| Download a project as a standard ZIP                                                   | ✅         |
| Import a ZIP archive, with main document detection                                     | ✅         |
| Single-file and folder import as a new project                                         | 🚧 Planned |
| WebMCP agent tools with staged change review and undo                                  | 🚧 Planned |
| Offline PWA, command palette, bibliography tools, SyncTeX navigation                   | 🚧 Planned |

Browser support: verified in Chromium. Firefox and Safari are not verified yet.

## Tech stack

| Concern            | Technology                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| UI                 | [React 19](https://react.dev), [Tailwind CSS 4](https://tailwindcss.com), [Base UI](https://base-ui.com) primitives in the shadcn/ui style, [HugeIcons](https://hugeicons.com) |
| Language and build | [TypeScript](https://www.typescriptlang.org) (strict), [Vite 8](https://vite.dev)                                                                                              |
| Monorepo           | [pnpm workspaces](https://pnpm.io/workspaces), [Turborepo](https://turborepo.com)                                                                                              |
| Editor             | [CodeMirror 6](https://codemirror.net)                                                                                                                                         |
| PDF                | [PDF.js](https://mozilla.github.io/pdf.js/)                                                                                                                                    |
| Storage            | IndexedDB through [Dexie](https://dexie.org)                                                                                                                                   |
| LaTeX engine       | [Siglum](https://github.com/SiglumProject/siglum) (BusyTeX, TeX Live 2026, WebAssembly)                                                                                        |
| Typst engine       | [typst.ts](https://github.com/Myriad-Dreamin/typst.ts) (WebAssembly)                                                                                                           |
| Worker RPC         | [Comlink](https://github.com/GoogleChromeLabs/comlink)                                                                                                                         |
| Quality            | [Biome](https://biomejs.dev) for lint and format, [Vitest](https://vitest.dev) for tests                                                                                       |

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org) 22 or newer (development tooling only; Quartz itself runs in the browser)
- [pnpm](https://pnpm.io) 10 (the repository pins its version through the `packageManager` field; enable it with `corepack enable`)
- About 600 MB of free disk space for the engine assets

> This repository uses **pnpm only**. Do not use npm, npx, yarn or bun.

### Install and run

```bash
# 1. Install dependencies
pnpm install

# 2. Download runtime assets once (Typst fonts and the Siglum TeX Live runtime, ~217 MB, checksum-verified)
pnpm --filter @qrtz/web fetch:assets

# 3. Start the development server
pnpm dev
```

Open <http://localhost:5173>, create a project from a template and start writing.

The runtime assets are stored in `apps/web/public/engines/`, which is ignored by Git. Quartz serves them from its own origin, so compiling never contacts a third-party server.

### Scripts

| Command                                | Description                                    |
| -------------------------------------- | ---------------------------------------------- |
| `pnpm dev`                             | Start the web app in development mode          |
| `pnpm build`                           | Build every package and the production web app |
| `pnpm typecheck`                       | Type-check every package                       |
| `pnpm test`                            | Run unit tests with Vitest                     |
| `pnpm lint`                            | Lint and check formatting with Biome           |
| `pnpm format`                          | Apply Biome formatting and safe fixes          |
| `pnpm --filter @qrtz/web fetch:assets` | Download the engine runtime assets             |
| `pnpm --filter @qrtz/web preview`      | Serve the production build locally             |

## Project structure

```
quartz/
├── apps/
│   └── web/                 # Vite + React app: dashboard, workspace, services
├── packages/
│   ├── document-core/       # Framework-free domain: projects, paths, templates, engine detection
│   ├── messages/            # Interface translations (en, pt-BR, es, zh-CN, zh-TW, ja)
│   ├── storage/             # Dexie (IndexedDB) repositories and storage status
│   ├── editor/              # CodeMirror 6 setup with LaTeX and Typst languages
│   ├── compiler-core/       # Compiler contracts, worker host, compile queue
│   ├── compiler-typst/      # Typst WebAssembly worker
│   ├── compiler-latex/      # Siglum LaTeX adapter and TeX log parser
│   └── ui/                  # Shared UI components, theme tokens and icons
├── docs/                    # PRD, architecture, ADRs, specifications, spikes, roadmap
└── AGENTS.md                # Rules for contributors and AI coding agents
```

## Deployment

Quartz builds to static files: no Node.js server is involved at runtime. After `fetch:assets`, `pnpm build` writes the app and the engine runtime (copied from `apps/web/public/engines/`) to `apps/web/dist`, about 330 MB in total.

To host under a sub-path, set `QUARTZ_BASE` at build time:

```bash
QUARTZ_BASE=/quartz/ pnpm --filter @qrtz/web build
```

Any static host works if it respects two rules:

- Serve `/engines/**/*.gz` as `application/octet-stream` **without** a `Content-Encoding` header. The engines decompress these files themselves; a transport encoding header makes the browser decompress them first and corrupts them.
- Serve `index.html` for unknown paths so that project URLs such as `/p/<id>` load the app.

### GitHub Pages

The [`Deploy to GitHub Pages`](.github/workflows/deploy-pages.yml) workflow runs on every push to `main`. It checks, builds with the right base path, adds a `404.html` SPA fallback and deploys. A final step checks the engine bundle headers on the live site and fails if GitHub Pages adds `Content-Encoding`.

To enable it, open **Settings → Pages** and set **Source** to **GitHub Actions**. GitHub Pages for private repositories requires a paid GitHub plan.

### Cloudflare Pages

Cloudflare Pages limits single files to 25 MiB, and three engine files are larger (the Typst and LaTeX WebAssembly binaries and the `cm-super` font bundle). Host `engines/` on Cloudflare R2 or another object store, and serve the app from Pages.

## Your data

Projects are stored in your browser's storage for this site. Clearing site data, or the browser evicting storage, deletes them. Quartz asks the browser for persistent storage, but the browser decides whether to grant it. Download projects as ZIP regularly to keep backups of important work. A downloaded ZIP can be imported back as a new project.

## Documentation

- [Product requirements](docs/PRD.md)
- [Architecture overview](docs/architecture/overview.md)
- [Architecture decision records](docs/decisions/)
- [Technical spikes and results](docs/technical-spikes/)
- [Implementation roadmap](docs/roadmap/implementation-plan.md)
- [Contributor and agent guidelines](AGENTS.md)

## Contributing

Quartz is in early development and the architecture is still settling. Before contributing, read [AGENTS.md](AGENTS.md): it describes the architecture boundaries, the no-backend rule, coding standards and the commit convention (Conventional Commits with a scope, for example `feat(editor): add bracket matching`). Run `pnpm lint`, `pnpm typecheck` and `pnpm test` before opening a pull request.

## License

Quartz is dual-licensed under either of the following, at your option:

- MIT License ([LICENSE-MIT](LICENSE-MIT))
- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))

Unless you explicitly state otherwise, any contribution you intentionally submit for inclusion in Quartz is dual-licensed as above, without any additional terms or conditions.

Third-party engines keep their own licenses: TeX engine binaries are GPL and are loaded as separate programs in their own workers, typst.ts is Apache-2.0, and Siglum is MIT. See [ADR-004](docs/decisions/ADR-004-compiler-architecture.md#license-decision) for the full policy.

<div align="center">
<br />
<sub>Built for people who want to own their writing.</sub>
</div>
