# Futboru

A minimalist, source-backed football transfer feed. The site does not reproduce full articles: it shows a structured transfer record and, for verified club announcements, a short publisher-provided link preview with a direct link to the original source.

## What the PoC includes

- confirmed transfers from 11 current summer-window registers: England, Germany, Italy, France, the Netherlands, Poland, Scotland, Denmark, Switzerland, Norway, and Sweden, including the original cited club or publication link for every row;
- league coverage across the Premier League and EFL, Bundesliga and 2. Bundesliga, Serie A and Serie B, Ligue 1 and Ligue 2, Eredivisie, Ekstraklasa, the Scottish Premiership, Superliga, Swiss Super League, Eliteserien, Allsvenskan, and other divisions present in those national registers;
- age, nationality, compact locally hosted SVG flags, and Football Manager-style position codes enriched from Wikidata and Wikipedia, with source-backed exceptions in `data/player-metadata.json`;
- exact, source-backed corrections for register typos in `data/transfer-corrections.json`, applied only when the cited URL already belongs to that transfer record;
- club crests and club links sourced from English Wikipedia page metadata;
- cautiously filtered transfer signals from national football RSS feeds in the United Kingdom, Germany, Italy, Spain, France, the Netherlands, Poland, Portugal, and Brazil, always marked as a `Rumour`; headlines are parsed into player, selling club, and buying club, and incomplete claims are not published as table rows;
- localized Transfermarkt news through the published German, UK, Italian, Spanish, Dutch, Polish, and Portuguese RSS feeds, never by scraping or copying its transfer database;
- a vetted Transfermarkt news-archive backfill from 1 July in the same chronological feed; archived items are kept only when the player and both clubs can be identified, and remain `Rumour` unless a completed-transfer register confirms them;
- direct club announcements curated in `data/official-sources.json`; these replace a publication as the preferred link on a matching confirmed row while keeping BBC, Transfermarkt, and other corroborating links attached;
- manually curated, source-backed rumours in `data/manual-rumours.json`;
- claim-level deduplication that retains multiple source links when two markets report the same move; secondary links are exposed in the source drawer instead of creating duplicate rows;
- window-long retention for structured RSS claims, so a dated rumour does not disappear merely because it rotates out of a publisher's short live feed;
- independent source health reports, per-source last-good-data fallback, validation, and a GitHub Actions refresh every 30 minutes;
- an accessible, responsive interface with no menu or cards, plus a restrained source-preview drawer on verified official rows.

`Official` means the move appears in one of the completed-transfer registers. The source link in each row points to the cited club statement or publication. Newsroom, database, journalist, and community reports remain `Rumours` until the move appears in a completed register.

The public feed only contains structured movements: `Player · From club → To club`. A newsroom headline is kept as source metadata, never used as the player's name. Partial or ambiguous headlines may still help corroborate another record, but they are withheld from the table until the complete route can be established.

Every visible player, including every rumour, must also have a nationality and a compact position code. The refresh resolves an exact footballer only when the player's club history matches the transfer route, prefers Wikidata's country-for-sport value over citizenship, and uses Wikidata or the player's Wikipedia infobox for positions. Remaining gaps can be filled only by an exact dated route with a direct supporting URL in `data/player-metadata.json`. Entries that still lack either field are written to `withheldTransfers` for review and are not published in the feed.

## Source network

Confirmed-transfer registers:

- [England](https://en.wikipedia.org/wiki/List_of_English_football_transfers_summer_2026)
- [Germany](https://en.wikipedia.org/wiki/List_of_German_football_transfers_summer_2026)
- [Italy](https://en.wikipedia.org/wiki/List_of_Italian_football_transfers_summer_2026)
- [France](https://en.wikipedia.org/wiki/List_of_French_football_transfers_summer_2026)
- [Netherlands](https://en.wikipedia.org/wiki/List_of_Dutch_football_transfers_summer_2026)
- [Poland](https://en.wikipedia.org/wiki/List_of_Polish_football_transfers_summer_2026)
- [Scotland](https://en.wikipedia.org/wiki/List_of_Scottish_football_transfers_summer_2026)
- [Denmark](https://en.wikipedia.org/wiki/List_of_Danish_football_transfers_summer_2026)
- [Switzerland](https://en.wikipedia.org/wiki/List_of_Swiss_football_transfers_summer_2026)
- [Norway](https://en.wikipedia.org/wiki/List_of_Norwegian_football_transfers_summer_2026)
- [Sweden](https://en.wikipedia.org/wiki/List_of_Swedish_football_transfers_summer_2026)

Rumour and discovery feeds:

- United Kingdom: [BBC Sport](https://feeds.bbci.co.uk/sport/football/rss.xml), [The Guardian](https://www.theguardian.com/football/rss), [Transfermarkt UK](https://www.transfermarkt.co.uk/rss/news)
- Germany: [Sportschau](https://www.sportschau.de/fussball/bundesliga/index~rss2.xml), [Transfermarkt DE](https://www.transfermarkt.de/rss/news)
- Italy: [TuttomercatoWeb](https://www.tuttomercatoweb.com/rss/), [Transfermarkt IT](https://www.transfermarkt.it/rss/news)
- Spain: [Marca](https://e00-marca.uecdn.es/rss/futbol/primera-division.xml), [Transfermarkt ES](https://www.transfermarkt.es/rss/news)
- France: [RMC Sport](https://rmcsport.bfmtv.com/rss/football/)
- Netherlands: [Voetbal International](https://www.vi.nl/feed/news.xml), [Transfermarkt NL](https://www.transfermarkt.nl/rss/news)
- Poland: [Weszło](https://weszlo.com/feed/), [Transfermarkt PL](https://www.transfermarkt.pl/rss/news)
- Portugal: [MaisFutebol](https://maisfutebol.iol.pt/rss), [Transfermarkt PT](https://www.transfermarkt.pt/rss/news)
- Brazil: [ge](https://ge.globo.com/rss/ge/)

The registers are used as structured indexes, but Futboru does not send the reader to a generic index when a direct citation exists. The row links to the underlying club announcement or local/national publication. A citation receives the highest `primary_official` priority only when its hostname matches the official website (`P856`) of the selling or buying club in Wikidata, or when a curated announcement's URL matches the audited official website stored alongside it. An unknown domain remains a publication source; source quality never changes an already confirmed transfer back into a rumour. Transfermarkt is used as a news signal through the RSS interface listed in its [official RSS guide](https://www.transfermarkt.us/intern/rssguide) and, for the requested 1 July backfill, its public day-by-day news archive. Its HTML transfer database is not scraped.

Official register rows are retained for the whole configured transfer window; the refresh no longer applies a hidden per-country or global row cap. Source health reports expose both the number observed and any operator-imposed emergency truncation.

Clicking a row opens the preview only when its preferred link is a verified `primary_official` club source. The refresh job reads at most the first 192 KiB of the page and stops at the end of `<head>`; it stores only capped Open Graph/Twitter title, description, image URL, site/language/date metadata, and never reads or republishes the article body. Preview requests are deduplicated, limited to 24 new URLs per refresh, serialized per host, cached for seven days, and isolated so a blocked club page cannot break the transfer feed.

The next direct-discovery layer will use official club sitemaps or clearly separated team news listings rather than undocumented app APIs. The first adapter candidates are Manchester City's news sitemap, Manchester United's separate men's and women's listings, Liverpool's `Transfer` category (excluding `Media watch`), Barcelona's detailed article sitemap, and Juventus' separate men's and women's sitemaps. Initially these adapters should only replace or corroborate the source of an already structured transfer. Publishing a brand-new row from a club article will require explicit completion language plus an unambiguous player and route. Until those adapters land, audited direct announcements can be added to `data/official-sources.json` without creating another row or view.

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

The current feed retains the 2026 summer window from `2026-07-01`. Override `TRANSFER_WINDOW_START` for another window; outside that configured year the refresh falls back to the rolling `LOOKBACK_DAYS` window.

## Sources the PoC deliberately does not scrape

- **X / Fabrizio Romano** — the data model now distinguishes reporters from official sources, but automatic monitoring still requires the official X API and an access token. A journalist's post remains a rumour until a club, league, or register confirms it.
- **Facebook Groups** — Meta no longer offers an official Groups API. Direct public links can be submitted and moderated manually; private group content is not republished.
- **Meczyki and other publishers without a public RSS feed or API** — another adapter should only be added after checking the publisher's terms or obtaining permission.
- **Transfermarkt HTML transfer tables** — the published news RSS and public dated news archive are used, but player/transfer database tables are not scraped or reproduced.

Club crests currently use Wikipedia page thumbnails for PoC coverage, including some non-free images hosted by English Wikipedia. A commercial release should use a licensed football-data/crest provider or a manually approved asset catalogue.

Country flags are self-hosted from the MIT-licensed `flag-icons` package; the licence notice is copied into every production build.

The next production step is to add direct club-news adapters market by market, backed by the official Premier League, Bundesliga, LaLiga, Serie A, Liga Portugal, and Ekstraklasa trackers. The intended source order is: club announcement, league or federation register, established publication, reporter, database, then community or aggregator. At larger scale, a licensed transfer API can supplement—but should not silently replace—direct official evidence.
