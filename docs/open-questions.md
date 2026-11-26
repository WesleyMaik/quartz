# Open Questions

Decisions the project owner must make. Each has a recommendation and the phase it blocks.

| ID | Question | Recommendation | Blocks |
|---|---|---|---|
| OQ-1 | ~~What license will Quartz use?~~ **Decided 2026-11-26: open source, dual-licensed `MIT OR Apache-2.0`.** | Consequences recorded in [ADR-004](decisions/ADR-004-compiler-architecture.md#license-decision). Permissive licensing means Quartz's own code must not depend on AGPL/GPL libraries linked into the app bundle, because that would force the combined app under copyleft terms. GPL/AGPL programs are allowed only as separately loaded worker programs (TeX engines, Biber) with their corresponding source published. | Resolved |
| OQ-2 | Where are the LaTeX package bundles hosted? | Same static origin as the app (Cloudflare Pages/R2, Netlify, or any CDN with CORS and long cache headers). With Siglum's curated set the footprint is expected in the low hundreds of MB (v0.1 bundles were ~195 MB; TL2026 size measured in T-0.1.0), not a multi-GB mirror. Check per-file size limits of the host. | Phase 4b |
| OQ-3 | Is an optional dynamic package proxy acceptable for rare CTAN packages not in the curated set? | No. A proxy is a backend (Siglum's CTAN proxy stays disabled). Document missing packages, allow uploading `.sty`/`.cls` files into the project, and grow the curated set from corpus results. | Phase 4b |
| OQ-4 | Should Typst `@preview` packages be fetched from `packages.typst.org` on demand? | Yes, as an explicit, user-visible optional network operation, cached locally after first fetch. This is a third-party static registry, not a Quartz backend. | Phase 4 |
| OQ-5 | Default agent write policy: staged review or auto-apply? | Staged review by default. Allow per-project "auto-apply edits (undoable)" for non-destructive tools. Deletes always ask. | Phase 5 |
| OQ-6 | Is a WebMCP origin trial token acceptable in production? | Yes for Chrome/Edge while WebMCP is in origin trial. Tokens are static `<meta>` tags, no backend. Track expiry. | Phase 5 |
| OQ-7 | Product name collision: "Quartz" is also a popular static-site generator (jackyzha0/quartz). | Check trademark and package-name availability before public launch; the npm scope `@quartz/*` is likely unavailable, so internal packages use `@qrtz/*`. | Phase 1 |
