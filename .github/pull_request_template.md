## Summary

<!-- What this PR changes and why. -->

- **Closes**: #<!-- issue number, or N/A -->
- **Decision record**: `docs/decisions/ADR-XXX-<name>.md` (or `N/A` when no architectural decision changed)

## Changes Made

- 

## Verification

<!-- Tick what you ran and describe the observed results. -->

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] Checked in the browser: <!-- browser, flows and interface languages inspected, or N/A -->

### Remaining for Owner Check

- 

## Checklist

- [ ] No backend, telemetry or AI runtime added; the build output stays static files.
- [ ] Heavy work stays off the main thread, and user source files are only changed by explicit operations.
- [ ] Package boundaries respected, strict types preserved (no TypeScript `any`).
- [ ] New logic has tests; bug fixes have a regression test where practical.
- [ ] User-facing text goes through react-intl, with the id present in every catalog of `packages/messages` (or no UI text changed).
- [ ] [Security checklist](https://github.com/WesleyMaik/quartz/blob/main/docs/architecture/security.md#4-security-checklist-for-prs) followed: untrusted input validated, new network destinations reflected in the CSP and the security document.
- [ ] New dependencies are permissively licensed and their reason is stated above (or none added).
- [ ] Only pnpm used; no secrets, build output or downloaded engine assets committed.
- [ ] Commits follow Conventional Commits with a scope.
- [ ] Documentation updated (`docs/`, `AGENTS.md`, `README.md`) where behavior or structure changed.
