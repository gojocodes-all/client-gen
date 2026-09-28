# Maintenance log

## 2026-09-28 — Clear the complete local workspace reliably

- **Rationale:** The “Clear local data” action removed the IndexedDB workspace but left WhatsApp verification statuses in `localStorage`, so re-importing the same leads could restore data the user had explicitly cleared. An IndexedDB rejection also stopped the interface reset before it rendered.
- **Files changed:** Updated `app.js` to settle both browser-storage cleanup operations before rendering, exposed a focused cleanup API from `whatsapp-status.js`, advanced the cache key in `sw.js`, and added regression coverage in `test/browser-wiring.test.js`.
- **Validation:** `npm run validate` (JavaScript syntax checks for the static application and crawler package plus the complete Node.js test suite) and `git diff --check`.
- **Risk:** Low. The change only affects the confirmed destructive action, adds no dependency, preserves existing state formats, and makes storage cleanup best-effort so the in-memory interface can still reset if browser storage is unavailable.
- **Rollback:** Revert this pull request to restore separate WhatsApp-status persistence and the previous fail-fast clear behavior.

## 2026-09-23 — Isolate and test data-import parsing

- **Rationale:** JSON record discovery and CSV/TSV delimiter parsing were embedded in the 970-line UI controller even though they are deterministic domain logic. Isolating them makes the import contract testable without a browser and reduces coupling between file ingestion and rendering.
- **Files changed:** Added `data-parsers.js`, parser tests, root validation scripts, `.gitignore`, and this log; updated `app.js`, `index.html`, `sw.js`, and `README.md`.
- **Validation:** `npm run validate` (syntax checks for the static application and crawler package, six parser tests, and two browser-wiring smoke tests). The cloud browser could not reach the local test server, so the script-loading and offline-cache contract is verified in an isolated browser-like runtime instead.
- **Risk:** Low. Parser behavior and public data shapes are preserved, no dependency is added, and the service-worker cache key is advanced so deployed clients receive the new required script.
- **Rollback:** Revert this pull request to move the parser functions back into `app.js`, remove the root test harness, and restore the previous service-worker cache manifest.
