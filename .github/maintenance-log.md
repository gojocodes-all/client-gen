# Maintenance log

## 2026-09-23 — Isolate and test data-import parsing

- **Rationale:** JSON record discovery and CSV/TSV delimiter parsing were embedded in the 970-line UI controller even though they are deterministic domain logic. Isolating them makes the import contract testable without a browser and reduces coupling between file ingestion and rendering.
- **Files changed:** Added `data-parsers.js`, parser tests, root validation scripts, `.gitignore`, and this log; updated `app.js`, `index.html`, `sw.js`, and `README.md`.
- **Validation:** `npm run validate` (syntax checks for the static application and crawler package, six parser tests, and two browser-wiring smoke tests). The cloud browser could not reach the local test server, so the script-loading and offline-cache contract is verified in an isolated browser-like runtime instead.
- **Risk:** Low. Parser behavior and public data shapes are preserved, no dependency is added, and the service-worker cache key is advanced so deployed clients receive the new required script.
- **Rollback:** Revert this pull request to move the parser functions back into `app.js`, remove the root test harness, and restore the previous service-worker cache manifest.
