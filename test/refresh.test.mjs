import test from "node:test";
import assert from "node:assert/strict";
import {
  deduplicateTransfers,
  flagCodeFromName,
  mergeHeadlineEvidence,
  parseBbcRumours,
  parseRssRumours,
  parseWikipediaClubTransfers,
  parseWikipediaDatedTransfers,
  parseWikipediaTransfers,
  positionCode,
} from "../scripts/refresh.mjs";

test("Wikipedia parser inherits a rowspan date and keeps source and club links", () => {
  const html = `
    <table class="wikitable">
      <tr><th>Date</th><th>Player</th><th>From</th><th>To</th><th>Fee</th></tr>
      <tr>
        <td rowspan="2">14 July 2026</td>
        <td><a title="Croatia"><img alt=""></a><a href="./Luka_Vu%C5%A1kovi%C4%87">Luka Vušković</a></td>
        <td><a href="./Tottenham_Hotspur_F.C.">Tottenham Hotspur</a></td>
        <td><a href="./Brighton_%26_Hove_Albion_F.C.">Brighton</a></td>
        <td>£46m<sup class="reference"><a href="#cite_note-1">[1]</a></sup></td>
      </tr>
      <tr>
        <td><img alt="France"><a href="./Example_Player">Example Player</a></td>
        <td>Club A</td><td>Club B</td><td>Undisclosed</td>
      </tr>
    </table>
    <ol><li id="cite_note-1"><a class="external" href="https://www.bbc.co.uk/sport/example">BBC</a></li></ol>`;

  const result = parseWikipediaTransfers(html, new Date("2026-07-15T12:00:00Z"));
  assert.equal(result.length, 2);
  assert.equal(result[0].date, "2026-07-14");
  assert.equal(result[1].date, "2026-07-14");
  assert.equal(result[0].player, "Luka Vušković");
  assert.equal(result[0].playerUrl, "https://en.wikipedia.org/wiki/Luka_Vu%C5%A1kovi%C4%87");
  assert.equal(result[0].fromClub, "Tottenham Hotspur");
  assert.equal(result[0].fromClubUrl, "https://en.wikipedia.org/wiki/Tottenham_Hotspur_F.C.");
  assert.equal(result[0].toClubUrl, "https://en.wikipedia.org/wiki/Brighton_%26_Hove_Albion_F.C.");
  assert.equal(result[0].sourceUrl, "https://www.bbc.co.uk/sport/example");
  assert.equal(result[0].flagCode, "hr");
  assert.equal(result[0].flag, "🇭🇷");
  assert.equal(result[1].fee, "Undisclosed");
});

test("country aliases map to local 4:3 SVG assets", () => {
  const cases = [
    ["England", "gb-eng"],
    ["Scotland", "gb-sct"],
    ["Wales", "gb-wls"],
    ["Northern Ireland", "gb-nir"],
    ["Kosovo", "xk"],
    ["Curaçao", "cw"],
    ["Georgia (country)", "ge"],
    ["Flag of The Gambia", "gm"],
    ["Côte d’Ivoire", "ci"],
  ];

  for (const [label, expected] of cases) assert.equal(flagCodeFromName(label), expected, label);
});

test("an anticipated move stays a rumour even when it appears in the table", () => {
  const html = `
    <table class="wikitable">
      <tr><th>Date</th><th>Player</th><th>From</th><th>To</th><th>Fee</th></tr>
      <tr><td>15 July 2026</td><td>Jan Kowalski</td><td>Club A</td><td>Club B</td>
        <td>£10m<sup class="reference"><a href="#cite_note-2">[2]</a></sup></td></tr>
    </table>
    <ol><li id="cite_note-2"><a class="external" href="https://www.bbc.co.uk/sport/example">Jan Kowalski set for Club B move</a></li></ol>`;

  const [result] = parseWikipediaTransfers(html, new Date("2026-07-15T12:00:00Z"));
  assert.equal(result.status, "rumour");
});

test("dated market parser supports Name headers and skips a citation without a source URL", () => {
  const html = `
    <table class="wikitable">
      <tr><th>Date</th><th>Name</th><th>Moving from</th><th>Moving to</th><th>Fee</th></tr>
      <tr>
        <td rowspan="2">14 July 2026</td><td><a href="./Alex">Álex</a></td><td>Milan</td><td>Bologna</td>
        <td>Undisclosed
          <sup class="reference"><a href="#cite_note-loan">[1]</a></sup>
          <sup class="reference"><a href="#cite_note-source">[2]</a></sup>
        </td>
      </tr>
      <tr><td>Domestic Player</td><td>Roma</td><td>Parma</td><td>Free<sup class="reference"><a href="#cite_note-source">[2]</a></sup></td></tr>
    </table>
    <ol>
      <li id="cite_note-loan">Permanent after loan.</li>
      <li id="cite_note-source"><a class="external" href="https://club.it/signing">Signing</a>
        <span class="Z3988" title="rft.date=2026-07-14&amp;rft_id=https%3A%2F%2Fclub.it%2Fsigning"></span>
      </li>
    </ol>`;
  const config = {
    id: "wikipedia-italy",
    url: "https://en.wikipedia.org/wiki/List_of_Italian_football_transfers_summer_2026",
    country: "Italy",
    competition: "Serie A / Serie B",
  };

  const result = parseWikipediaDatedTransfers(html, config, new Date("2026-07-15T12:00:00Z"));
  assert.equal(result.length, 2);
  assert.equal(result[0].sourceUrl, "https://club.it/signing");
  assert.equal(result[0].market, "Italy");
  assert.equal(result[0].nationality, null);
  assert.equal(result[1].date, "2026-07-14");
  assert.equal(result[1].nationality, "Italy");
  assert.equal(result[1].flagCode, "it");
});

test("club market parser reads direction, competition, source date, nationality and compact position", () => {
  const html = `
    <section>
      <div class="mw-heading2"><h2>Bundesliga</h2></div>
      <section>
        <div class="mw-heading3"><h3 id="Bayern_Munich">Bayern Munich</h3></div>
        <table><tr><td class="col-break">
          <p>In:</p>
          <table class="wikitable football-squad">
            <tr><th>No.</th><th>Pos.</th><th>Nation</th><th>Player</th></tr>
            <tr><td>34</td><td><abbr>FW</abbr></td>
              <td><img resource="//en.wikipedia.org/wiki/File:Flag_of_Morocco.svg">MAR</td>
              <td><span class="fn"><a href="./Ismael_Saibari">Ismael Saibari</a></span>
                <i>(from <a href="./PSV">PSV</a>)</i>
                <sup class="reference"><a href="#cite_note-1">[1]</a></sup>
              </td>
            </tr>
          </table>
        </td><td class="col-break">
          <p>Out:</p>
          <table class="wikitable football-squad">
            <tr><th>No.</th><th>Pos.</th><th>Nation</th><th>Player</th></tr>
            <tr><td>—</td><td><abbr>DF</abbr></td><td>GER</td>
              <td><span class="fn">Perr Schuurs</span><i>(free agent)</i>
                <sup class="reference"><a href="#cite_note-2">[2]</a></sup>
              </td>
            </tr>
          </table>
        </td></tr></table>
      </section>
    </section>
    <ol>
      <li id="cite_note-1"><a class="external" href="https://fcbayern.com/signing">Signing</a>
        <span class="Z3988" title="rft.date=2026-07-01&amp;rft_id=https%3A%2F%2Ffcbayern.com%2Fsigning"></span>
      </li>
      <li id="cite_note-2"><a class="external" href="https://fcbayern.com/release">Release</a>
        <span class="Z3988" title="rft.date=2026-07-02&amp;rft_id=https%3A%2F%2Ffcbayern.com%2Frelease"></span>
      </li>
    </ol>`;
  const config = { id: "wikipedia-germany", url: "https://example.test/germany", country: "Germany" };

  const result = parseWikipediaClubTransfers(html, config, new Date("2026-07-15T12:00:00Z"));
  assert.equal(result.length, 2);
  assert.deepEqual(
    { from: result[0].fromClub, to: result[0].toClub, position: result[0].position },
    { from: "PSV", to: "Bayern Munich", position: "ST" },
  );
  assert.equal(result[0].competition, "Bundesliga");
  assert.equal(result[0].nationality, "Morocco");
  assert.equal(result[0].flagCode, "ma");
  assert.equal(result[0].sourceName, "fcbayern.com");
  assert.equal(result[1].fromClub, "Bayern Munich");
  assert.equal(result[1].toClub.toLowerCase(), "free agent");
  assert.equal(result[1].fee, "Free");
});

test("BBC parser accepts only transfer-rumour signals", () => {
  const xml = `
    <rss><channel>
      <item>
        <title>Football transfer rumours: Arsenal linked with Jan Kowalski</title>
        <link>https://www.bbc.co.uk/sport/football/1</link>
        <pubDate>Wed, 15 Jul 2026 08:00:00 GMT</pubDate>
      </item>
      <item>
        <title>Team wins a friendly match</title>
        <link>https://www.bbc.co.uk/sport/football/2</link>
        <pubDate>Wed, 15 Jul 2026 07:00:00 GMT</pubDate>
      </item>
    </channel></rss>`;

  const result = parseBbcRumours(xml, new Date("2026-07-15T12:00:00Z"));
  assert.equal(result.length, 1);
  assert.equal(result[0].status, "rumour");
  assert.equal(result[0].player, "Arsenal linked with Jan Kowalski");
  assert.equal(result[0].sourceName, "BBC Sport");
});

test("generic RSS parser supports a localized publication without promoting it to official", () => {
  const xml = `
    <rss><channel>
      <item><title>Barca bestätigt Adeyemi-Wechsel</title><link>https://sportschau.de/1</link><pubDate>Tue, 14 Jul 2026 08:00:00 GMT</pubDate></item>
      <item><title>Friendly match report</title><link>https://sportschau.de/2</link><pubDate>Tue, 14 Jul 2026 07:00:00 GMT</pubDate></item>
    </channel></rss>`;
  const config = {
    id: "sportschau-rss",
    label: "Sportschau",
    market: "Germany",
    pattern: /\bwechsel\b/i,
  };

  const [result] = parseRssRumours(xml, config, new Date("2026-07-15T12:00:00Z"));
  assert.equal(result.status, "rumour");
  assert.equal(result.market, "Germany");
  assert.equal(result.sourceRole, "publication");
});

test("generic RSS parser can reject roundup headlines that are not discrete transfer claims", () => {
  const xml = `
    <rss><channel>
      <item><title>Calciomercato no stop - indiscrezioni e retroscena</title><link>https://example.it/roundup</link><pubDate>Tue, 14 Jul 2026 08:00:00 GMT</pubDate></item>
      <item><title>Club ufficiale: acquista Mario Rossi</title><link>https://example.it/claim</link><pubDate>Tue, 14 Jul 2026 07:00:00 GMT</pubDate></item>
    </channel></rss>`;
  const config = {
    id: "italy-rss",
    label: "Italian source",
    market: "Italy",
    pattern: /\b(calciomercato|ufficiale|acquista)\b/i,
    excludePattern: /calciomercato no stop|indiscrezioni|retroscena/i,
  };

  const result = parseRssRumours(xml, config, new Date("2026-07-15T12:00:00Z"));
  assert.equal(result.length, 1);
  assert.equal(result[0].sourceUrl, "https://example.it/claim");
});

test("duplicate transfer claims merge source evidence and prefer the primary source", () => {
  const records = [
    {
      id: "one", date: "2026-07-08", player: "Emersonn", fromClub: "Toulouse FC", toClub: "Ipswich Town",
      status: "official", market: "England", sourceAdapter: "wikipedia-england", sourceName: "BBC Sport",
      sourceUrl: "https://bbc.co.uk/story", sourceRole: "publication",
    },
    {
      id: "two", date: "2026-07-09", player: "Emersonn", fromClub: "Toulouse", toClub: "Ipswich Town FC",
      status: "official", market: "France", sourceAdapter: "wikipedia-france", sourceName: "Toulouse FC",
      sourceUrl: "https://toulousefc.com/announcement", sourceRole: "primary_official",
    },
  ];

  const merged = deduplicateTransfers(records);
  const [result] = merged;
  assert.equal(merged.length, 1);
  assert.equal(result.sources.length, 2);
  assert.equal(result.sourceName, "Toulouse FC");
  assert.deepEqual(result.markets, ["England", "France"]);
});

test("unknown and social domains never outrank a known publication without explicit trust metadata", () => {
  const records = [
    {
      id: "social", date: "2026-07-08", player: "Example Player", fromClub: "Club A", toClub: "Club B",
      status: "rumour", sourceAdapter: "manual", sourceName: "Instagram",
      sourceUrl: "https://www.instagram.com/p/example",
    },
    {
      id: "news", date: "2026-07-08", player: "Example Player", fromClub: "Club A", toClub: "Club B",
      status: "rumour", sourceAdapter: "bbc-rss", sourceName: "BBC Sport",
      sourceUrl: "https://www.bbc.co.uk/sport/example", sourceRole: "publication",
    },
  ];

  const [result] = deduplicateTransfers(records);
  assert.equal(result.sourceName, "BBC Sport");
  assert.equal(result.sources.find((source) => source.name === "Instagram").role, "community");
});

test("a matching news headline becomes evidence for one structured transfer instead of a duplicate row", () => {
  const structured = [{
    id: "move", date: "2026-07-14", player: "Luka Vušković", fromClub: "Tottenham Hotspur", toClub: "Brighton",
    status: "official", sourceAdapter: "wikipedia-england", sourceName: "BBC Sport",
    sourceUrl: "https://www.bbc.co.uk/sport/move", sourceRole: "publication",
  }];
  const signals = [{
    id: "news", date: "2026-07-14", player: "Luka Vuskovic wechselt zu Brighton", fromClub: "—", toClub: "—",
    status: "rumour", sourceAdapter: "sportschau-rss", sourceName: "Sportschau",
    sourceUrl: "https://sportschau.de/move", sourceRole: "publication",
  }];

  const remaining = mergeHeadlineEvidence(structured, signals);
  assert.equal(remaining.length, 0);
  assert.equal(structured[0].status, "official");
  assert.deepEqual(structured[0].sources.map((source) => source.name), ["BBC Sport", "Sportschau"]);
});

test("football positions use compact Football Manager-style codes", () => {
  const cases = [
    ["goalkeeper", "GK"],
    ["centre-back", "DC"],
    ["left-back", "DL"],
    ["right-back", "DR"],
    ["defensive midfielder", "DM"],
    ["wing-back", "WB"],
    ["wide midfielder", "WM"],
    ["attacking midfielder", "AMC"],
    ["right winger", "AMR"],
    ["left winger", "AML"],
    ["centre-forward", "ST"],
  ];

  for (const [label, expected] of cases) assert.equal(positionCode(label), expected, label);
  assert.equal(positionCode("anything", "Q201330"), "GK");
  assert.equal(positionCode("unknown role"), null);
});
