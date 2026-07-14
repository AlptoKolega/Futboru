# Futboru

A minimalist, source-backed football transfer feed. The site does not reproduce articles: it shows a structured transfer record, its status, and a direct link to the source.

## What the PoC includes

- confirmed transfers from the current English summer transfer window list on Wikipedia, including each cited source;
- age, nationality, compact locally hosted SVG flags, and Football Manager-style position codes enriched from Wikidata where available;
- club crests and club links sourced from English Wikipedia page metadata;
- cautiously filtered transfer signals from the public BBC Football RSS feed, always marked as a `Rumour`;
- manually curated, source-backed rumours in `data/manual-rumours.json`;
- deduplication, validation, and a GitHub Actions refresh every 30 minutes;
- an accessible, responsive interface with no menu, cards, photography, or visual effects.

`Official` means the move appears in the completed-transfers list. The source link in each row points to the cited club statement or publication. BBC reports remain `Rumours` until the move appears in the completed list.

## Run locally

Node.js 22 or newer is required.

```bash
npm install
npm run check
python3 -m http.server 4173 --directory dist
```

Then open `http://127.0.0.1:4173`.

## Add a manual source

`data/manual-rumours.json` accepts an array of records. Minimal example:

```json
{
  "date": "2026-07-15",
  "player": "Player name",
  "fromClub": "Club A",
  "toClub": "Club B",
  "fee": "€30m?",
  "sourceName": "Source name",
  "sourceUrl": "https://source.example/post"
}
```

Do not add an entry without a direct link to the original publication.

## Sources the PoC deliberately does not scrape

- **X / Fabrizio Romano** — a stable integration requires the official X API and an access token. A journalist's post should still be marked as a rumour, not official confirmation.
- **Facebook Groups** — there is no stable, authorised route for automatically collecting group posts. Direct links can be curated manually.
- **Meczyki and other publishers without a public RSS feed or API** — another adapter should only be added after checking the publisher's terms or obtaining permission.

Club crests currently use Wikipedia page thumbnails for PoC coverage, including some non-free images hosted by English Wikipedia. A commercial release should use a licensed football-data/crest provider or a manually approved asset catalogue.

Country flags are self-hosted from the MIT-licensed `flag-icons` package; the licence notice is copied into every production build.

The next production step is to add direct adapters for official Premier League, Bundesliga, LaLiga, Serie A, and Ekstraklasa trackers. At multi-league scale, a licensed API is likely to be more reliable than maintaining many HTML parsers.
