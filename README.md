# Futboru

A minimalist, source-backed football transfer feed. The site does not reproduce articles: it shows a structured transfer record, its status, and a direct link to the source.

## What the PoC includes

- confirmed transfers from current English, German, Italian, French, Dutch, and Polish summer-window registers, including the original cited club or publication link for every row;
- league coverage across the Premier League and EFL, Bundesliga and 2. Bundesliga, Serie A and Serie B, Ligue 1 and Ligue 2, Eredivisie, Ekstraklasa, and other divisions present in those national registers;
- age, nationality, compact locally hosted SVG flags, and Football Manager-style position codes enriched from Wikidata where available;
- club crests and club links sourced from English Wikipedia page metadata;
- cautiously filtered transfer signals from national football RSS feeds in the United Kingdom, Germany, Italy, Spain, France, the Netherlands, Poland, Portugal, and Brazil, always marked as a `Rumour`; headlines are parsed into player, selling club, and buying club, and incomplete claims are not published as table rows;
- Transfermarkt DE news through its published RSS feed, never by scraping or copying its transfer database;
- manually curated, source-backed rumours in `data/manual-rumours.json`;
- claim-level deduplication that retains multiple source links when two markets report the same move;
- independent source health reports, stale-data fallback, validation, and a GitHub Actions refresh every 30 minutes;
- an accessible, responsive interface with no menu, cards, photography, or visual effects.

`Official` means the move appears in one of the completed-transfer registers. The source link in each row points to the cited club statement or publication. Newsroom, database, journalist, and community reports remain `Rumours` until the move appears in a completed register.

The public feed only contains structured movements: `Player · From club → To club`. A newsroom headline is kept as source metadata, never used as the player's name. Partial or ambiguous headlines may still help corroborate another record, but they are withheld from the table until the complete route can be established.

## Source network

Confirmed-transfer registers:

- [England](https://en.wikipedia.org/wiki/List_of_English_football_transfers_summer_2026)
- [Germany](https://en.wikipedia.org/wiki/List_of_German_football_transfers_summer_2026)
- [Italy](https://en.wikipedia.org/wiki/List_of_Italian_football_transfers_summer_2026)
- [France](https://en.wikipedia.org/wiki/List_of_French_football_transfers_summer_2026)
- [Netherlands](https://en.wikipedia.org/wiki/List_of_Dutch_football_transfers_summer_2026)
- [Poland](https://en.wikipedia.org/wiki/List_of_Polish_football_transfers_summer_2026)

Rumour and discovery feeds:

- United Kingdom: [BBC Sport](https://feeds.bbci.co.uk/sport/football/rss.xml), [The Guardian](https://www.theguardian.com/football/rss)
- Germany: [Sportschau](https://www.sportschau.de/fussball/bundesliga/index~rss2.xml), [Transfermarkt DE](https://www.transfermarkt.de/rss/news)
- Italy: [TuttomercatoWeb](https://www.tuttomercatoweb.com/rss/)
- Spain: [Marca](https://e00-marca.uecdn.es/rss/futbol/primera-division.xml)
- France: [RMC Sport](https://rmcsport.bfmtv.com/rss/football/)
- Netherlands: [Voetbal International](https://www.vi.nl/feed/news.xml)
- Poland: [Weszło](https://weszlo.com/feed/)
- Portugal: [MaisFutebol](https://maisfutebol.iol.pt/rss)
- Brazil: [ge](https://ge.globo.com/rss/ge/)

The registers are used as structured indexes, but Futboru does not send the reader to a generic index when a direct citation exists. The row links to the underlying club announcement or local/national publication. Transfermarkt is used only as a news signal through the RSS interface listed in its [official RSS guide](https://www.transfermarkt.us/intern/rssguide); its HTML database is not scraped.

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

- **X / Fabrizio Romano** — the data model now distinguishes reporters from official sources, but automatic monitoring still requires the official X API and an access token. A journalist's post remains a rumour until a club, league, or register confirms it.
- **Facebook Groups** — Meta no longer offers an official Groups API. Direct public links can be submitted and moderated manually; private group content is not republished.
- **Meczyki and other publishers without a public RSS feed or API** — another adapter should only be added after checking the publisher's terms or obtaining permission.
- **Transfermarkt HTML tables** — the published news RSS is used, but the database pages are not scraped or reproduced.

Club crests currently use Wikipedia page thumbnails for PoC coverage, including some non-free images hosted by English Wikipedia. A commercial release should use a licensed football-data/crest provider or a manually approved asset catalogue.

Country flags are self-hosted from the MIT-licensed `flag-icons` package; the licence notice is copied into every production build.

The next production step is to replace register-backed confirmation market by market with direct adapters for the official Premier League, Bundesliga, LaLiga, Serie A, Liga Portugal, and Ekstraklasa trackers. At larger scale, a licensed transfer API can supplement—but should not silently replace—direct official evidence.
