# Client Gen

A local-first lead intelligence and contextual outreach workspace for messy crawler exports.

## What it does

- Imports JSON, NDJSON/JSONL, CSV, TSV, XLSX/XLS, XML and HTML tables.
- Detects nested record collections instead of assuming one fixed JSON shape.
- Infers schema roles such as business name, phone, website, category, address, city, rating and source URL.
- Lets the user correct field mappings per dataset.
- Normalizes multiple differently-shaped datasets into one lead workspace.
- Classifies each lead by business type and creates context-aware website outreach copy.
- Generates WhatsApp click-to-chat links with the message prefilled; sending remains manual.
- Scores and filters leads, tracks statuses, notes and follow-up dates.
- Deduplicates by phone, email, website or name/location.
- Exports filtered leads to CSV and supports full workspace backup.
- Stores imported data in IndexedDB on the user's device. No lead backend is required.
- Installable PWA with basic offline support.

## Architecture

This app intentionally uses modern browser APIs rather than a framework because the product is a single-user, local-first data tool with no server-rendered pages or shared state. That keeps the deployment tiny and means lead files do not leave the user's device.

Excel parsing is loaded on demand from the pinned SheetJS Community Edition standalone build (`0.20.3`) hosted by the official SheetJS CDN. JSON/CSV/TSV/XML/HTML parsing is handled locally. XML files containing `DOCTYPE` are rejected before parsing.

## Run locally

Serve the directory with any static file server. For example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Deploy

The repo is static and Vercel-compatible. No environment variables are required.

## Privacy / outreach behavior

Client Gen does not bulk-send messages. The WhatsApp action only opens a conversation with text prefilled so the user can review and manually send it. Leads can be marked `Do not contact` and the WhatsApp action is disabled for them.
