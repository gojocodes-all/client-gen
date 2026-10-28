# Maintenance log

## 2026-10-28 — Document the Excel offline boundary

- **Rationale:** The README described basic offline support and separately noted the on-demand SheetJS CDN, but did not explain that XLSX/XLS imports are outside the service worker's same-origin cache. Users could reasonably expect every advertised import format to work offline after installation.
- **Files changed:** `README.md` and `.github/maintenance-log.md`.
- **Changes:** Clarify which formats remain fully local after the core shell is cached, explain the first-use network requirement and ordinary-browser-cache limitation for Excel parsing, and provide CSV or JSON as the reliable disconnected alternative.
- **Validation:** Cross-checked the documented boundary against `app.js`'s pinned SheetJS loader and `sw.js`'s same-origin cache policy; ran `npm run validate` (all application and crawler syntax checks plus 13 tests); ran `git diff --check`; reviewed the complete diff for accuracy, privacy, security, backward compatibility, and repository scope.
- **Risk:** Low. Documentation only; import code, parser versions, service-worker behavior, cached assets, dependencies, stored lead data, crawler behavior, and deployment configuration are unchanged.
- **Rollback:** Revert this pull request to restore the prior shorter offline description; no runtime, cache, data, dependency, or deployment rollback is required.

## 2026-10-23 — Restore WhatsApp actions after status correction

- **Rationale:** Marking a lead as “Not on WhatsApp” correctly disabled its
  WhatsApp action, but changing that status to “Confirmed on WhatsApp” left the
  same button disabled until another action rerendered the entire lead list.
  Users could correct the status but still could not open the conversation.
- **Files changed:** Updated `app.js` to expose whether each WhatsApp action is
  unavailable for a lead-level reason; updated `whatsapp-status.js` to
  recompute both disabled and enabled states whenever a verification status
  changes; added a browser-like transition regression test in
  `test/browser-wiring.test.js`; advanced the offline cache in `sw.js`; and
  updated this log.
- **Validation:** Reproduced the stale disabled state with the new test before
  applying the fix; ran `npm run validate` (application and crawler syntax
  checks plus the complete Node.js test suite); ran `git diff --check`; and
  reviewed the complete diff for unavailable-phone and do-not-contact guards,
  accessibility, offline delivery, backward compatibility, and project scope.
- **Risk:** Low. Leads without a usable phone number and leads marked “Do not
  contact” remain disabled through the existing lead-level guard. The change
  only restores an otherwise available action after its separate WhatsApp
  verification status is corrected.
- **Rollback:** Revert this pull request to restore the previous one-way
  WhatsApp-status disabling behavior and offline cache version.

## 2026-10-17 — Make schema-dialog cancellation non-destructive

- **Rationale:** The schema dialog's × control omitted an explicit button type, so HTML treated it as a submit button. Client Gen's mapping-form submit handler therefore applied pending field mappings before closing the dialog, even though the control was presented and labelled as “Close.”
- **Files changed:** Updated `index.html` with an explicit non-submit close control, wired that control in `app.js`, added the regression contract in `test/browser-wiring.test.js`, advanced the offline cache in `sw.js`, and updated this log.
- **Validation:** Ran `npm run validate` (application and crawler syntax checks plus the complete Node.js test suite), verified the close control is separate from the apply submit path, and reviewed the complete diff for accessibility, mobile behavior, security, backward compatibility, and project scope.
- **Risk:** Low. Applying mappings still uses the existing submit handler; Escape and the dedicated × control now dismiss without changing workspace data. No stored-data format, import logic, dependency, or crawler behavior changes.
- **Rollback:** Revert this pull request to restore the previous implicit-submit close behavior and offline cache key.

## 2026-10-13 — Document the optional crawler application

- **Rationale:** The root README described the entire repository as static even though `crawler-app/` is a separate Node.js Express/Crawlee service. That made the crawler difficult to discover and left its setup and deployment boundary unclear.
- **Files changed:** Updated `README.md` to distinguish the static Client Gen workspace from the optional crawler, document the crawler's verified local startup path, and clarify that the two applications deploy independently; updated this log.
- **Validation:** Matched the documented commands, Node.js requirement, default port, and `PORT` override against both package manifests and `crawler-app/src/server.js`; verified the relative crawler-guide link and reviewed the complete documentation diff for accuracy, security, backward compatibility, and project scope.
- **Risk:** Low. Documentation only; application code, dependencies, stored data, crawler behavior, and deployment configuration are unchanged.
- **Rollback:** Revert this pull request to restore the previous root README and maintenance entry.

## 2026-10-08 — Restore mobile access to lead details

- **Rationale:** At widths of 620px and below, the responsive stylesheet hid every lead card's Details button. Because cards have no alternate click or keyboard handler, phone users could not edit status, notes, follow-up dates, or outreach copy.
- **Files changed:** Updated `app.js` with lead-specific accessible action names, updated `styles.css` to stack both card actions on narrow screens, extended `test/browser-wiring.test.js`, and updated this log.
- **Validation:** Ran the complete `npm run validate` workflow through GitHub Actions (application and crawler syntax checks plus the Node.js test suite), verified the narrow-screen rule no longer hides Details, and reviewed the full diff for accessibility, responsive layout, backward compatibility, security, and project scope.
- **Risk:** Low. The change only affects lead-card action presentation below 620px and accessible names; data handling, persistence, outreach generation, and desktop layout are unchanged.
- **Rollback:** Revert this pull request to restore the single visible mobile action and the previous generic button names.

## 2026-10-03 — Add continuous validation

- **Rationale:** The repository had a complete dependency-free validation command but no hosted workflow, so parser, browser-wiring, service-worker, storage-cleanup, or crawler syntax regressions could be merged without running it.
- **Files changed:** Added `.github/workflows/ci.yml`; updated `package.json`, `README.md`, and `.github/maintenance-log.md`.
- **Validation:** Ran `npm run validate` (ten tests and all application/crawler syntax checks), parsed the workflow YAML, verified immutable Node.js 24 action pins and read-only permissions, checked the Node.js engine contract, and ran `git diff --check`. The hosted workflow passed without action-runtime deprecation warnings. A separate crawler dependency audit still reports upstream high-severity advisories; no uncertain dependency change is included in this CI-only update.
- **Risk:** Low. The workflow only reads repository contents and runs an existing dependency-free command on Node.js 20. Application, crawler runtime, dependencies, and deployment behavior are unchanged.
- **Rollback:** Revert this pull request or remove `.github/workflows/ci.yml` to stop hosted validation; runtime behavior is unaffected.

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
