# Futboru

A minimalist, source-backed football transfer feed. The site does not reproduce full articles: it shows a structured transfer record and, for verified club announcements, a short publisher-provided link preview with a direct link to the original source.

## What the PoC includes

- confirmed transfers from 11 current summer-window registers: England, Germany, Italy, France, the Netherlands, Poland, Scotland, Denmark, Switzerland, Norway, and Sweden, including the original cited club or publication link for every row;
- 26 filterable competitions across 11 countries, with season-scoped club membership so a cross-league move appears under either endpoint league rather than the country of the reporting publication;
- age, nationality, compact locally hosted SVG flags, and Football Manager-style position codes enriched from Wikidata and Wikipedia, with source-backed exceptions in `data/player-metadata.json`;
- exact, source-backed corrections for register typos in `data/transfer-corrections.json`, applied only when the cited URL already belongs to that transfer record;
- club crests and club links sourced from English Wikipedia page metadata;
- cautiously filtered transfer signals from national football RSS feeds in the United Kingdom, Germany, Italy, Spain, France, the Netherlands, Poland, Portugal, and Brazil, always marked as a `Rumour`; headlines are parsed into player, selling club, and buying club, and incomplete claims are not published as table rows;
- localized Transfermarkt news through the published German, UK, Italian, Spanish, Dutch, Polish, and Portuguese RSS feeds, never by scraping or copying its transfer database;
- a vetted Transfermarkt news-archive backfill from 1 July in the same chronological feed; archived items are kept only when the player and both clubs can be identified, and remain `Rumour` unless a completed-transfer register confirms them;
- direct club announcements discovered from verified club sitemaps and validated against the full player identity, transfer-completion language, route counterpart, date, and final hostname before they can replace a publication;
- additional audited club announcements curated in `data/official-sources.json`; these use an exact dated route and official-domain boundary check, while BBC, Transfermarkt, and other corroborating links remain attached;
- manually curated, source-backed rumours in `data/manual-rumours.json`;
- claim-level deduplication that retains multiple source links when two markets report the same move; secondary links are exposed in the source drawer instead of creating duplicate rows;
- window-long retention for structured RSS claims, so a dated rumour does not disappear merely because it rotates out of a publisher's short live feed;
- independent source health reports, per-source last-good-data fallback, validation, and a GitHub Actions refresh every 30 minutes;
- an accessible, responsive interface with inline status/category controls, a single compact league picker, and a restrained source-preview drawer on verified official rows.

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

The registers are used as structured indexes, but Futboru does not send the reader to a generic index when a direct citation exists. Every direct citation attached to a register row is retained, rather than keeping only the first footnote. The row links to the best underlying club announcement or local/national publication, and the remaining evidence stays available in the drawer. A citation receives the highest `primary_official` priority only when its hostname matches the official website (`P856`) of the selling or buying club in Wikidata, or an audited club/domain alias, and the source still supports the player identity. An unknown domain remains a publication source; source quality never changes an already confirmed transfer back into a rumour. Previously verified official links are carried into the next refresh only as untrusted candidates and must pass the current domain audit again. Transfermarkt is used as a news signal through the RSS interface listed in its [official RSS guide](https://www.transfermarkt.us/intern/rssguide) and, for the requested 1 July backfill, its public day-by-day news archive. Its HTML transfer database is not scraped.

Official register rows are retained for the whole configured transfer window; the refresh no longer applies a hidden per-country or global row cap. Source health reports expose both the number observed and any operator-imposed emergency truncation.

Clicking a row opens the preview only when its preferred link is a verified `primary_official` club source. The preview job reads at most the first 192 KiB of the page and stops at the end of `<head>`; it stores only capped Open Graph/Twitter title, description, image URL, site/language/date metadata, and never stores or republishes the article body. Preview requests are deduplicated, limited to 24 new URLs per refresh, serialized per host, cached for seven days, and isolated so a blocked club page cannot break the transfer feed.

The direct-discovery pass now checks bounded `sitemap.xml` URL sets on verified endpoint-club websites. It considers only same-date HTTPS pages whose path contains a distinctive player token, ranks announcement URLs above interviews, galleries, shops, and training content, and then requires the full player name plus a directional, completed move involving the route counterpart in one local fragment. Contract renewals, reversed routes, and evidence assembled from unrelated paragraphs fail closed. JavaScript-only EFL Digital sites are validated through the unauthenticated read-only endpoint advertised by their own public frontend; the public club article remains the canonical link, and the fetched body is discarded after validation. Every network target and redirect is limited to public DNS addresses, HTTPS on the default port, and the verified hostname boundary. Sitemap and article bodies are read as capped streams with time and size limits, failures are isolated per host, and this layer can only replace or corroborate an already structured transfer—it cannot create a row by itself.

The next source layer is competition-official coverage: Premier League, Bundesliga and 2. Bundesliga transfer centres, Lega Serie A, LaLiga/Hypermotion, Ligue 1/Ligue 2, and Ekstraklasa. Google News RSS may later be used only for discovery and must resolve back to the original publisher. X remains a manually submitted supporting source until an official API workflow is available.

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
