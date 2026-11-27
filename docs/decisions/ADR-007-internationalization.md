# ADR-007: Internationalization (react-intl and `@qrtz/messages`)

Status: Accepted. Date: 2026-11-27.

## Context

Quartz shipped English text only, with a stored language preference ready for more. Interface languages must work offline from static files, add little to the initial download and keep the domain packages free of UI concerns.

## Decision

- **react-intl** (FormatJS, BSD-3-Clause) in `apps/web`: ICU messages (plurals per language), `Intl`-based number, date and list formatting, no network access.
- **`@qrtz/messages`** owns the catalogs: one flat JSON file per locale in `src/catalogs/`, the locale list, `resolveLocale` and `loadMessages`. It has no runtime dependencies and no React. Only `apps/web` consumes it.
- Initial locales: `en`, `pt-BR`, `es`, `zh-CN`, `zh-TW`, `ja`. English is the source and the fallback; every other catalog is a separate chunk loaded when selected.
- Message ids are typed: an unknown id in `apps/web` and a catalog with a missing id are both compile errors. Tests also check ICU syntax and that every translation takes the same arguments as English.
- Domain packages stay language-neutral: `QuartzError` carries a `key` and `values`; the interface turns them into a sentence. Its `message` remains English for logs and non-UI callers.
- CodeMirror's built-in strings are translated through `EditorState.phrases`, passed to `@qrtz/editor` as an editor preference.

## Not translated

Document content and templates' file content, file names, compiler diagnostics and logs, engine download progress, product and engine names, and the static metadata in `index.html`.

## Adding a language

1. Add the id and native name in `packages/messages/src/locales.ts`, and its browser tags in `resolveLocale`.
2. Add `src/catalogs/<id>.json` and its loader in `src/index.ts`.
3. Add the native name to `.github/ISSUE_TEMPLATE/translation.yml`.
4. Run `pnpm typecheck` and `pnpm test`.

## Translation quality

Translations are made with AI. Settings says so next to the language choice and links to the `translation.yml` issue form, which opens on GitHub only when the user follows the link.

## Alternatives

- `use-intl`: comparable and MIT; react-intl was chosen for its wider use and the standard FormatJS tooling.
- Catalogs inside `apps/web`: workable, but a package keeps translations reviewable on their own and reusable without importing the app.
