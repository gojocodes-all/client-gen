# Mahoraga Crawler

A practical web UI built on **Crawlee 3.17.0** for collecting public business/contact signals and exporting them into a Client Gen-friendly dataset.

## What it does

- Crawls 1–5 public HTTP(S) start URLs.
- Uses Crawlee `CheerioCrawler` for fast server-rendered pages.
- Recursively follows same-host links with bounded depth/page limits.
- Respects `robots.txt`.
- Extracts JSON-LD business/organization data, phones, emails, addresses, social URLs, titles and descriptions.
- Deduplicates leads and exports JSON/CSV.
- Blocks localhost/private-network targets and caps crawl size/concurrency.
- Exposes a small live job API and web dashboard.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Notes

This is a general public-web crawler, not a specialized Google Maps scraper. JavaScript-only websites may expose little useful HTML to Cheerio. A browser-rendering engine can be added later when the hosting budget/resources justify Chromium.
