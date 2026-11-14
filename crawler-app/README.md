# Mahoraga Crawler

Mahoraga Crawler is the optional data-collection companion to Client Gen. It is
a Node.js 20+ Express application with a browser dashboard over Crawlee 3.17's
`CheerioCrawler`. It visits bounded sets of public, server-rendered pages,
extracts business and contact signals, and exports records that the root Client
Gen workspace can import.

The crawler and the root workspace are separate applications. Client Gen does
not require the crawler to be running, and the crawler does not write directly
to Client Gen's IndexedDB workspace.

## What it collects

For each successfully processed page, the crawler can retain:

- the page URL, title, description, HTTP status, and crawl timestamp;
- JSON-LD business or organization names, categories, and addresses;
- telephone numbers and email addresses found in structured data, links, or
  visible page text;
- links to supported social platforms;
- one normalized lead record, deduplicated primarily by phone, then email, then
  website and title.

Exports are available as JSON or CSV. JavaScript-rendered content is not
executed, so client-only sites may expose little useful information.

## Requirements

- Node.js 20 or newer
- npm
- outbound DNS and HTTP(S) access to the public sites being crawled
- permission to crawl the selected sites under their terms and applicable law

The crawler has its own `package.json` and dependency installation. The
repository does not currently include a crawler lockfile, so `npm install`
resolves the manifest rather than reproducing a previously locked graph.

## Run locally

From a fresh clone:

```bash
git clone https://github.com/gojocodes-all/client-gen.git
cd client-gen/crawler-app
npm install
npm start
```

Open <http://localhost:3000>. To use another port:

```bash
PORT=4000 npm start
```

No `.env` file is loaded by the application. `PORT` is the only environment
variable read directly by the current source.

## Dashboard workflow

1. Enter a label and one to five public HTTP(S) start URLs.
2. Choose the page, depth, concurrency, delay, and same-host link-following
   limits.
3. Start the crawl and watch page, lead, and failure counts update.
4. Stop the job if needed; stopping takes effect after the current request.
5. Download JSON or CSV, then import that file into the root Client Gen
   workspace.

The accepted limits are:

| Setting | Range | Default |
| --- | ---: | ---: |
| Start URLs | 1–5 | required |
| Maximum pages | 1–100 | 30 |
| Link depth | 0–3 | 1 |
| Concurrency | 1–5 | 2 |
| Delay per host | 0.5–10 seconds | 1 second |
| Follow same-host links | enabled/disabled | enabled |

Followed links whose paths look like static assets are skipped. Cross-host
navigation, non-HTTP(S) URLs, localhost, private network ranges, link-local
addresses, and hosts resolving to a private address are rejected. `robots.txt`
is respected. Each request is retried at most once, and navigation and handler
timeouts are bounded.

## API

The dashboard uses the following internal routes:

| Method and route | Purpose |
| --- | --- |
| `GET /api/health` | Report service and crawler-engine status |
| `POST /api/crawls` | Validate configuration and start a crawl |
| `GET /api/crawls/:id` | Read progress, recent pages, errors, and leads |
| `POST /api/crawls/:id/stop` | Request that a running crawl stop |
| `GET /api/crawls/:id/export.json` | Download normalized leads as JSON |
| `GET /api/crawls/:id/export.csv` | Download normalized leads as CSV |

`POST /api/crawls` accepts:

```json
{
  "label": "Lagos private schools",
  "startUrls": ["https://example.com/directory"],
  "maxPages": 30,
  "maxDepth": 1,
  "concurrency": 2,
  "delaySecs": 1,
  "followLinks": true
}
```

The API is an application-internal contract, not a versioned public API.

## Data, privacy, and access boundary

- Job configuration, results, and errors live in server memory. Restarting the
  process clears them.
- Jobs that are no longer running or stopping become eligible for cleanup one
  hour after their last update; cleanup runs every ten minutes.
- Public job responses expose at most the latest 250 leads, 100 pages, and 20
  errors, while exports contain the current deduplicated lead set.
- Crawl starts are limited to five per ten minutes for the client address
  observed by Express.
- Crawlee may create local runtime state under `crawler-app/storage/`; that
  generated directory is ignored by Git.
- The service has no authentication or per-user isolation. Do not expose it to
  untrusted users without adding an appropriate access-control layer.
- Exported contact data remains the operator's responsibility. Review it before
  outreach and comply with site terms, privacy rules, and do-not-contact
  requests.

## Security behavior

The server disables Express's identifying header, limits JSON requests to 64
KB, applies Helmet response headers and a same-origin content security policy,
and validates target DNS addresses before starting and before navigation.
These safeguards reduce accidental private-network access; they do not turn an
unauthenticated deployment into a multi-user service.

## Commands and validation

Run these commands from `crawler-app/`:

| Command | Purpose |
| --- | --- |
| `npm start` | Start the Express dashboard and crawler |
| `npm run check` | Syntax-check the server and dashboard controller |

From the repository root, run the complete dependency-free project gate:

```bash
npm run validate
```

That command checks the root application, crawler JavaScript, and root
regression tests. It does not install crawler dependencies, start a live
crawl, or prove that a target site permits collection.

## Project structure

| Path | Responsibility |
| --- | --- |
| `package.json` | Node.js requirement, dependencies, and crawler commands |
| `src/server.js` | Express routes, target validation, crawl lifecycle, extraction, and exports |
| `public/index.html` | Dashboard structure and crawl controls |
| `public/app.js` | Form submission, polling, stopping, rendering, and export links |
| `public/styles.css` | Responsive dashboard presentation |
| `storage/` | Generated Crawlee runtime state; ignored by Git |

## Deployment and contribution guidance

Deploy this directory as a long-running Node.js service with `npm start`; it is
not part of the root static Vercel deployment. The host needs outbound DNS and
HTTP(S) access and must preserve a running process while crawl jobs are active.
Because jobs are not durable, restarts or horizontal replicas do not share
their state.

Keep changes within the existing bounded public-web crawler scope. Before
opening a pull request:

1. verify every documented command and path against the current source;
2. run `npm run check` here and `npm run validate` at the repository root;
3. review target validation, rate limits, export fields, and dashboard text when
   changing crawl behavior;
4. never commit crawler output, credentials, private contact datasets, or
   generated runtime storage;
5. record the rationale, validation, risk, and rollback plan in
   `.github/maintenance-log.md`.
