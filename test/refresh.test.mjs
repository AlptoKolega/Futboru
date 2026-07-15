import test from "node:test";
import assert from "node:assert/strict";
import {
  RSS_SOURCES,
  competitionGenderFromEntity,
  carryPreviousEnrichment,
  carryPreviousSourcePreviews,
  deduplicateTransfers,
  enrichCompetitionGenders,
  enrichOfficialSourcePreviews,
  extractRumourMovement,
  flagCodeFromName,
  hasStructuredRoute,
  inspectRssPayload,
  mergeHeadlineEvidence,
  mergeRumourFragments,
  matchesOfficialWebsite,
  newestPreviousTransfers,
  normaliseSourcePreview,
  normaliseStoredTransfer,
  parseBbcRumours,
  parseRssRumours,
  parseSourcePreviewHtml,
  parseWikipediaClubTransfers,
  parseWikipediaDatedTransfers,
  parseWikipediaTransfers,
  positionCode,
  previousTransfersForSource,
  validateRssPayload,
  verifyOfficialClubSources,
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
  assert.equal(result[0].competitionGender, "men");
  assert.equal(result[1].fee, "Undisclosed");
});

test("Wikidata P21 maps only unambiguous supported competition categories", () => {
  const claim = (qid, rank = "normal", referenceProperty = "P4656") => ({
    rank,
    mainsnak: { datavalue: { value: { id: qid } } },
    references: referenceProperty ? [{
      snaks: {
        [referenceProperty]: [{
          snaktype: "value", datavalue: { value: "https://example.test/reference" },
        }],
      },
    }] : [],
  });

  assert.equal(competitionGenderFromEntity({ claims: { P21: [claim("Q6581097")] } }), "men");
  assert.equal(competitionGenderFromEntity({ claims: { P21: [claim("Q6581072")] } }), "women");
  assert.equal(competitionGenderFromEntity({ claims: { P21: [] } }), "unknown");
  assert.equal(competitionGenderFromEntity({ claims: { P21: [claim("Q999999")] } }), "unknown");
  assert.equal(competitionGenderFromEntity({ claims: { P21: [claim("Q6581097"), claim("Q6581072")] } }), "unknown");
  assert.equal(competitionGenderFromEntity({
    claims: { P21: [claim("Q6581097"), claim("Q6581072", "preferred")] },
  }), "women");
  assert.equal(competitionGenderFromEntity({
    claims: { P21: [claim("Q6581097"), claim("Q6581072", "deprecated")] },
  }), "men");
  assert.equal(competitionGenderFromEntity({
    claims: { P21: [claim("Q6581097", "normal", "P887")] },
  }), "unknown");
  assert.equal(competitionGenderFromEntity({
    claims: { P21: [claim("Q6581097", "normal", null)] },
  }), "unknown");
  const emptyReferenceClaim = claim("Q6581097");
  emptyReferenceClaim.references = [{ snaks: { P4656: [] } }];
  assert.equal(competitionGenderFromEntity({ claims: { P21: [emptyReferenceClaim] } }), "unknown");
});

test("name-only rumours use an exact footballer entity and keep uncertain matches unknown", async () => {
  const transfers = [
    {
      player: "Melvine Malard", playerUrl: null, fromClub: "Manchester United", toClub: "Chelsea",
      competitionGender: "unknown",
    },
    {
      player: "Alex Example", playerUrl: null, fromClub: "Old Club", toClub: "New Club",
      competitionGender: "unknown",
    },
    {
      player: "Danilo Pereira", playerUrl: null, fromClub: "Rangers", toClub: "Botafogo",
      competitionGender: "unknown",
    },
    { player: "Known Player", playerUrl: null, competitionGender: "men" },
  ];
  const claim = (qid) => ({
    rank: "normal",
    mainsnak: { datavalue: { value: { id: qid } } },
    references: [{
      snaks: { P4656: [{ snaktype: "value", datavalue: { value: "https://example.test/reference" } }] },
    }],
  });

  await enrichCompetitionGenders(transfers, {
    wikipediaPageMetadata: async () => new Map([
      ["melvine malard", { qid: "Q1" }],
      ["alex example", { qid: "Q2" }],
      ["danilo pereira", { qid: "Q3" }],
    ]),
    wikidataEntities: async (_ids, props) => props === "labels"
      ? {
        Q4: { labels: { en: { value: "Manchester United W.F.C." } } },
        Q5: { labels: { en: { value: "Berwick Rangers F.C." } } },
      }
      : {
        Q1: {
          descriptions: { en: { value: "French footballer" } },
          claims: {
            P21: [claim("Q6581072")], P31: [claim("Q5")], P106: [claim("Q937857")], P54: [claim("Q4")],
          },
        },
        Q2: {
          descriptions: { en: { value: "British actor" } },
          claims: { P21: [claim("Q6581097")], P31: [claim("Q5")] },
        },
        Q3: {
          descriptions: { en: { value: "Portuguese footballer" } },
          claims: {
            P21: [claim("Q6581097")], P31: [claim("Q5")], P106: [claim("Q937857")], P54: [claim("Q5")],
          },
        },
      },
  });

  assert.equal(transfers[0].competitionGender, "women");
  assert.equal(transfers[0].competitionGenderSource, "wikidata-p21");
  assert.deepEqual(transfers[0].competitionGenderEvidence, {
    property: "P21", valueId: "Q6581072", referenceProperty: "P4656",
    referenceValue: "https://example.test/reference",
  });
  assert.equal(transfers[0].playerQid, "Q1");
  assert.equal(transfers[1].competitionGender, "unknown");
  assert.equal(transfers[2].competitionGender, "unknown");
  assert.equal(transfers[3].competitionGender, "men");
});

test("previous Wikidata categories are reused only with stable entity evidence", () => {
  const current = [
    { id: "one", player: "Ambiguous Name", competitionGender: "unknown" },
    { id: "two", player: "Verified Name", competitionGender: "unknown" },
    { id: "three", player: "Register Player", competitionGender: "unknown" },
    { id: "four", player: "Verified Name", competitionGender: "unknown" },
  ];
  const previous = [
    {
      id: "one", player: "Ambiguous Name", competitionGender: "men",
      competitionGenderSource: "wikidata-p21", playerQid: null,
    },
    {
      id: "two", player: "Verified Name", competitionGender: "women",
      competitionGenderSource: "wikidata-p21", playerQid: "Q2",
      competitionGenderEvidence: {
        property: "P21", valueId: "Q6581072", referenceProperty: "P4656",
        referenceValue: "https://example.test/reference",
      },
    },
    {
      id: "three", player: "Register Player", competitionGender: "men",
      competitionGenderSource: "source-register", sourceAdapter: "wikipedia-england", playerQid: null,
    },
  ];

  carryPreviousEnrichment(current, previous);
  assert.equal(current[0].competitionGender, "unknown");
  assert.equal(current[1].competitionGender, "women");
  assert.equal(current[1].playerQid, "Q2");
  assert.equal(current[1].competitionGenderEvidence.valueId, "Q6581072");
  assert.equal(current[2].competitionGender, "men");
  assert.equal(current[3].competitionGender, "unknown");
});

test("normalisation preserves an explicit category conflict and only migrates a missing legacy field", () => {
  const conflict = normaliseStoredTransfer({
    id: "conflict", player: "Example", competitionGender: "unknown",
    competitionGenderSource: "conflict", sourceAdapter: "wikipedia-england",
  });
  const legacy = normaliseStoredTransfer({
    id: "legacy", player: "Example", sourceAdapter: "wikipedia-england",
  });
  const unproven = normaliseStoredTransfer({
    id: "unproven", player: "Example", competitionGender: "women",
    competitionGenderSource: "wikidata-p21", playerQid: "Q1",
  });
  const falseScoped = normaliseStoredTransfer({
    id: "false-scoped", player: "Example", competitionGender: "women",
    competitionGenderSource: "source-feed", sourceAdapter: "ge-rss",
  });
  const scoped = normaliseStoredTransfer({
    id: "scoped", player: "Example", competitionGender: "men",
    competitionGenderSource: "source-feed", sourceAdapter: "marca-rss",
  });

  assert.equal(conflict.competitionGender, "unknown");
  assert.equal(conflict.competitionGenderSource, "conflict");
  assert.equal(legacy.competitionGender, "men");
  assert.equal(legacy.competitionGenderSource, "source-register");
  assert.equal(unproven.competitionGender, "unknown");
  assert.equal(unproven.competitionGenderSource, null);
  assert.equal(falseScoped.competitionGender, "unknown");
  assert.equal(falseScoped.competitionGenderSource, null);
  assert.equal(scoped.competitionGender, "men");
  assert.equal(scoped.competitionGenderSource, "source-feed");
});

test("the newest deployed snapshot wins over an older repository fallback", () => {
  const [latest] = newestPreviousTransfers([
    {
      generatedAt: "2026-07-15T08:00:00.000Z",
      transfers: [{ id: "old", player: "Old", sourceAdapter: "wikipedia-england" }],
    },
    {
      generatedAt: "2026-07-15T09:00:00.000Z",
      transfers: [{ id: "new", player: "New", sourceAdapter: "wikipedia-england" }],
    },
  ]);

  assert.equal(latest.id, "new");
  assert.equal(latest.competitionGender, "men");
});

test("a legacy zero-count source report does not hide an older per-source snapshot", () => {
  const sourceId = "transfermarkt-uk-rss";
  const olderTransfer = {
    id: "tm-old", date: "2026-07-14", player: "Player", fromClub: "Club A", toClub: "Club B",
    status: "rumour", sourceAdapter: sourceId, sourceName: "Transfermarkt UK",
    sourceUrl: "https://www.transfermarkt.co.uk/claim", sourceRole: "database",
  };
  const selected = previousTransfersForSource([
    {
      generatedAt: "2026-07-15T08:00:00.000Z",
      sources: [{ id: sourceId, status: "ok", count: 1 }],
      transfers: [olderTransfer],
    },
    {
      generatedAt: "2026-07-15T09:00:00.000Z",
      sources: [{ id: sourceId, status: "ok", count: 0 }],
      transfers: [],
    },
  ], sourceId);

  assert.deepEqual(selected.map((transfer) => transfer.id), ["tm-old"]);
});

test("an observed non-empty feed with no matches is an authoritative per-source zero", () => {
  const sourceId = "transfermarkt-uk-rss";
  const selected = previousTransfersForSource([
    {
      generatedAt: "2026-07-15T08:00:00.000Z",
      sources: [{ id: sourceId, status: "ok", count: 1 }],
      transfers: [{
        id: "tm-old", date: "2026-07-14", player: "Player", fromClub: "Club A", toClub: "Club B",
        status: "rumour", sourceAdapter: sourceId,
      }],
    },
    {
      generatedAt: "2026-07-15T09:00:00.000Z",
      sources: [{ id: sourceId, status: "ok", count: 0, observedCount: 10 }],
      transfers: [],
    },
  ], sourceId);

  assert.deepEqual(selected, []);
});

test("deduplication carries Wikidata identity evidence with an adopted category", () => {
  const evidence = {
    property: "P21", valueId: "Q6581072", referenceProperty: "P4656",
    referenceValue: "https://example.test/reference",
  };
  const records = [
    {
      id: "same", date: "2026-07-14", player: "Player", fromClub: "Club A", toClub: "Club B",
      competitionGender: "unknown", status: "rumour",
    },
    {
      id: "same", date: "2026-07-14", player: "Player", fromClub: "Club A", toClub: "Club B",
      competitionGender: "women", competitionGenderSource: "wikidata-p21",
      competitionGenderEvidence: evidence, playerQid: "Q1", status: "rumour",
    },
  ];

  const [merged] = deduplicateTransfers(records);
  assert.equal(merged.competitionGender, "women");
  assert.equal(merged.playerQid, "Q1");
  assert.deepEqual(merged.competitionGenderEvidence, evidence);
});

test("a category conflict stays unknown while retaining both audit records", () => {
  const evidence = {
    property: "P21", valueId: "Q6581072", referenceProperty: "P4656",
    referenceValue: "https://example.test/reference",
  };
  const records = [
    {
      id: "same", date: "2026-07-14", player: "Player", fromClub: "Club A", toClub: "Club B",
      competitionGender: "men", competitionGenderSource: "source-register",
      sourceAdapter: "wikipedia-england", status: "rumour",
    },
    {
      id: "same", date: "2026-07-14", player: "Player", fromClub: "Club A", toClub: "Club B",
      competitionGender: "women", competitionGenderSource: "wikidata-p21",
      competitionGenderEvidence: evidence, playerQid: "Q1", sourceAdapter: "guardian-rss", status: "rumour",
    },
  ];

  const [merged] = deduplicateTransfers(records);
  assert.equal(merged.competitionGender, "unknown");
  assert.equal(merged.competitionGenderSource, "conflict");
  assert.equal(merged.playerQid, null);
  assert.deepEqual(merged.competitionGenderConflicts.map((entry) => entry.competitionGender), ["men", "women"]);
  assert.equal(merged.competitionGenderConflicts[1].playerQid, "Q1");
  assert.deepEqual(merged.competitionGenderConflicts[1].evidence, evidence);
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
  assert.equal(result[0].sourceRole, "publication");
  assert.equal(result[0].market, "Italy");
  assert.equal(result[0].nationality, null);
  assert.equal(result[0].competitionGender, "unknown");
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
  assert.equal(result[0].competitionGender, "unknown");
  assert.equal(result[0].nationality, "Morocco");
  assert.equal(result[0].flagCode, "ma");
  assert.equal(result[0].sourceName, "fcbayern.com");
  assert.equal(result[1].fromClub, "Bayern Munich");
  assert.equal(result[1].toClub.toLowerCase(), "free agent");
  assert.equal(result[1].fee, "Free");
});

test("RSS inspection recognizes RSS and Atom roots and rejects HTML masquerading as a feed", () => {
  assert.deepEqual(inspectRssPayload("<rss><channel><item/><item/></channel></rss>"), {
    rootName: "rss", isFeedRoot: true, observedCount: 2,
  });
  assert.deepEqual(inspectRssPayload("<feed><entry/></feed>"), {
    rootName: "feed", isFeedRoot: true, observedCount: 1,
  });
  assert.deepEqual(inspectRssPayload("<html><body>Access denied</body></html>"), {
    rootName: "html", isFeedRoot: false, observedCount: 0,
  });
  assert.throws(
    () => validateRssPayload("<html><body>Access denied</body></html>", { id: "transfermarkt-uk-rss", label: "Transfermarkt UK" }),
    /not an RSS or Atom feed/,
  );
  assert.throws(
    () => validateRssPayload("<rss><channel/></rss>", { id: "transfermarkt-uk-rss", label: "Transfermarkt UK" }),
    /contained no items/,
  );
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
  assert.equal(result[0].headline, "Arsenal linked with Jan Kowalski");
  assert.equal(result[0].player, "Jan Kowalski");
  assert.equal(result[0].fromClub, null);
  assert.equal(result[0].toClub, "Arsenal");
  assert.equal(result[0].extractionStatus, "partial");
  assert.equal(result[0].sourceName, "BBC Sport");
  assert.equal(result[0].competitionGender, "unknown");
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
    competitionGender: "men",
    pattern: /\bwechsel\b/i,
  };

  const [result] = parseRssRumours(xml, config, new Date("2026-07-15T12:00:00Z"));
  assert.equal(result.status, "rumour");
  assert.equal(result.market, "Germany");
  assert.equal(result.sourceRole, "publication");
  assert.equal(result.competitionGender, "men");
  assert.equal(result.competitionGenderSource, "source-feed");
  assert.equal(result.player, "Karim Adeyemi");
  assert.equal(result.toClub, "Barcelona");
  assert.equal(result.headline, "Barca bestätigt Adeyemi-Wechsel");
});

test("generic RSS parser can reject roundup headlines that are not discrete transfer claims", () => {
  const xml = `
    <rss><channel>
      <item><title>Calciomercato no stop - indiscrezioni e retroscena</title><link>https://example.it/roundup</link><pubDate>Tue, 14 Jul 2026 08:00:00 GMT</pubDate></item>
      <item><title>UFFICIALE: Club acquista Mario Rossi dal Rivale</title><link>https://example.it/claim</link><pubDate>Tue, 14 Jul 2026 07:00:00 GMT</pubDate></item>
    </channel></rss>`;
  const config = {
    id: "tmw-rss",
    label: "Italian source",
    market: "Italy",
    pattern: /\b(calciomercato|ufficiale|acquista)\b/i,
    excludePattern: /calciomercato no stop|indiscrezioni|retroscena/i,
  };

  const result = parseRssRumours(xml, config, new Date("2026-07-15T12:00:00Z"));
  assert.equal(result.length, 1);
  assert.equal(result[0].sourceUrl, "https://example.it/claim");
  assert.equal(result[0].player, "Mario Rossi");
  assert.equal(result[0].fromClub, "Rivale");
  assert.equal(result[0].toClub, "Club");
  assert.equal(result[0].extractionStatus, "complete");
});

test("localized headlines become movement claims instead of player names", () => {
  const cases = [
    {
      market: "Brazil",
      headline: "Botafogo negocia a contratação do atacante Danilo Pereira, que pertence ao Rangers",
      expected: { player: "Danilo Pereira", fromClub: "Rangers", toClub: "Botafogo", fee: "—" },
    },
    {
      market: "Brazil",
      headline: "Palmeiras negocia empréstimo de Luighi para o New York City",
      expected: { player: "Luighi", fromClub: "Palmeiras", toClub: "New York City FC", fee: "Loan" },
    },
    {
      market: "United Kingdom",
      headline: "Manchester United close to agreeing club-record sale of Melvine Malard to Chelsea",
      expected: { player: "Melvine Malard", fromClub: "Manchester United", toClub: "Chelsea", fee: "—" },
    },
    {
      market: "Spain",
      headline: "El Celta a un paso de cerrar la cesión de Hugo Sotelo al Levante",
      expected: { player: "Hugo Sotelo", fromClub: "Celta Vigo", toClub: "Levante", fee: "Loan" },
    },
  ];

  for (const { market, headline, expected } of cases) {
    const claim = extractRumourMovement(headline, { market });
    assert.deepEqual(
      { player: claim.player, fromClub: claim.fromClub, toClub: claim.toClub, fee: claim.fee },
      expected,
      headline,
    );
    assert.equal(claim.extractionStatus, "complete", headline);
    assert.equal(hasStructuredRoute(claim), true, headline);
  }
});

test("localized Transfermarkt feeds stay database rumours and merge the same structured claim", () => {
  const transfermarktFeeds = RSS_SOURCES.filter((source) => source.id.startsWith("transfermarkt-"));
  assert.deepEqual(
    transfermarktFeeds.map((source) => source.id),
    [
      "transfermarkt-de-rss",
      "transfermarkt-uk-rss",
      "transfermarkt-it-rss",
      "transfermarkt-es-rss",
      "transfermarkt-nl-rss",
      "transfermarkt-pl-rss",
      "transfermarkt-pt-rss",
    ],
  );
  assert.equal(transfermarktFeeds.every((source) => source.sourceRole === "database"), true);

  const item = (title, link) => `<rss><channel><item><title>${title}</title><link>${link}</link><pubDate>Tue, 14 Jul 2026 08:00:00 GMT</pubDate></item></channel></rss>`;
  const uk = RSS_SOURCES.find((source) => source.id === "transfermarkt-uk-rss");
  const pl = RSS_SOURCES.find((source) => source.id === "transfermarkt-pl-rss");
  const [englishClaim] = parseRssRumours(
    item("Chelsea signs Jan Kowalski from Arsenal", "https://www.transfermarkt.co.uk/claim"),
    uk,
    new Date("2026-07-15T12:00:00Z"),
  );
  const [polishClaim] = parseRssRumours(
    item("Jan Kowalski przechodzi z Arsenal do Chelsea", "https://www.transfermarkt.pl/claim"),
    pl,
    new Date("2026-07-15T12:00:00Z"),
  );

  assert.equal(englishClaim.status, "rumour");
  assert.equal(polishClaim.status, "rumour");
  assert.equal(englishClaim.sourceRole, "database");
  assert.equal(polishClaim.sourceRole, "database");
  const [merged] = deduplicateTransfers([englishClaim, polishClaim]);
  assert.equal(merged.sources.length, 2);
});

test("localized Transfermarkt fixtures parse useful claims and reject locale-specific noise", () => {
  const fixtures = [
    {
      id: "transfermarkt-de-rss",
      useful: "SC Paderborn verleiht Martin Ens an MSV Duisburg in die 3. Liga",
      noise: "WM-Blog: Bayern vor Transfer",
      expected: { player: "Martin Ens", fromClub: "SC Paderborn", toClub: "MSV Duisburg", fee: "Loan", status: "complete" },
    },
    {
      id: "transfermarkt-uk-rss",
      useful: "Tarik Muharemović set to join Leeds United from Sassuolo in club record deal",
      noise: "Transfer news LIVE: all the latest moves",
      expected: { player: "Tarik Muharemović", fromClub: "Sassuolo", toClub: "Leeds United", fee: "—", status: "complete" },
    },
    {
      id: "transfermarkt-it-rss",
      useful: "UFFICIALE: Juventus acquista Mario Rossi dal Sassuolo",
      noise: "Calciomercato: formazioni e convocati",
      expected: { player: "Mario Rossi", fromClub: "Sassuolo", toClub: "Juventus", fee: "—", status: "complete" },
    },
    {
      id: "transfermarkt-es-rss",
      useful: "Youri Tielemans se muda a Manchester United",
      noise: "Valores de mercado: transferencias y jugadores más valiosos",
      expected: { player: "Youri Tielemans", fromClub: null, toClub: "Manchester United", fee: "—", status: "partial" },
    },
    {
      id: "transfermarkt-nl-rss",
      useful: "Jeremy Monga verruilt Leicester City voor Manchester City",
      noise: "Transfers op Transfermarkt: ranglijst meest waardevolle spelers",
      expected: { player: "Jeremy Monga", fromClub: "Leicester City", toClub: "Manchester City", fee: "—", status: "complete" },
    },
    {
      id: "transfermarkt-pl-rss",
      useful: "Mazurek za 7,5 miliona euro do Red Bull Salzburg",
      noise: "Ranking Top 10 najdroższych transferów",
      expected: { player: "Mazurek", fromClub: null, toClub: "Red Bull Salzburg", fee: "€7.5m", status: "partial" },
    },
    {
      id: "transfermarkt-pt-rss",
      useful: "Jesse Derry é reforço do Sporting: extremo chega por empréstimo do Chelsea",
      noise: "Últimas do mercado: transferências e valores de mercado",
      expected: { player: "Jesse Derry", fromClub: "Chelsea", toClub: "Sporting", fee: "Loan", status: "complete" },
    },
  ];
  const now = new Date("2026-07-15T12:00:00Z");

  for (const fixture of fixtures) {
    const source = RSS_SOURCES.find((item) => item.id === fixture.id);
    const xml = `<rss><channel>
      <item><title>${fixture.useful}</title><link>https://example.test/${fixture.id}/claim</link><pubDate>Tue, 14 Jul 2026 08:00:00 GMT</pubDate></item>
      <item><title>${fixture.noise}</title><link>https://example.test/${fixture.id}/noise</link><pubDate>Tue, 14 Jul 2026 09:00:00 GMT</pubDate></item>
    </channel></rss>`;
    const result = parseRssRumours(xml, source, now);

    assert.equal(result.length, 1, fixture.id);
    assert.deepEqual({
      player: result[0].player,
      fromClub: result[0].fromClub,
      toClub: result[0].toClub,
      fee: result[0].fee,
      status: result[0].extractionStatus,
    }, fixture.expected, fixture.id);
    assert.equal(result[0].status, "rumour", fixture.id);
    assert.equal(result[0].sourceRole, "database", fixture.id);
    assert.equal(result[0].competitionGender, "unknown", fixture.id);
  }
});

test("current Transfermarkt headlines produce safe structured routes and retain partial evidence", () => {
  const now = new Date("2026-07-15T18:00:00Z");
  const item = (title, slug, description = "") => `
    <item><title>${title}</title><link>https://example.test/${slug}</link>
      <pubDate>Wed, 15 Jul 2026 14:00:00 GMT</pubDate><description>${description}</description></item>`;
  const source = (id) => RSS_SOURCES.find((entry) => entry.id === id);

  const de = parseRssRumours(`<rss><channel>
    ${item("1860 München: Thomas Dähne wechselt zu Heidenheim", "daehne")}
    ${item("Eintracht Frankfurt: Noel Aseko vom FC Bayern vor Unterschrift", "aseko")}
    ${item("Schalke arbeitet an Leihe von Valencia-Verteidiger Cenk Özkacar", "oezkacar")}
    ${item("VfL Osnabrück: Ex-Profi Simakala wechselt nach Belgien zu Eupen", "simakala")}
  </channel></rss>`, source("transfermarkt-de-rss"), now);
  const uk = parseRssRumours(`<rss><channel>
    ${item("Manchester United sign Youri Tielemans from Aston Villa", "tielemans")}
    ${item("€30m package - Galatasaray sign Lesley Ugochukwu from Burnley", "ugochukwu")}
    ${item(
      "Leandro Trossard joins Beşiktaş for €20m package as Arsenal eye Rogers",
      "trossard",
      "Leandro Trossard has completed his move to Besitkas from Arsenal with the Turkish club confirming the deal.",
    )}
  </channel></rss>`, source("transfermarkt-uk-rss"), now);
  const nl = parseRssRumours(`<rss><channel>
    ${item("Manchester City haalt Jeremy Monga binnen – waar staat hij op de ranglijst van duurste 16-jarigen?", "monga")}
    ${item("Transfers op Transfermarkt: ranglijst meest waardevolle spelers", "noise")}
  </channel></rss>`, source("transfermarkt-nl-rss"), now);
  const pt = parseRssRumours(`<rss><channel>
    ${item("Hjulmand reforça Atlético de Madrid e torna-se na sétima maior venda", "hjulmand")}
    ${item("As últimas do mercado: todas as transferências", "noise-pt")}
  </channel></rss>`, source("transfermarkt-pt-rss"), now);

  assert.deepEqual(
    de.filter(hasStructuredRoute).map(({ player, fromClub, toClub }) => ({ player, fromClub, toClub })),
    [
      { player: "Thomas Dähne", fromClub: "1860 München", toClub: "Heidenheim" },
      { player: "Noel Aseko", fromClub: "FC Bayern", toClub: "Eintracht Frankfurt" },
      { player: "Cenk Özkacar", fromClub: "Valencia", toClub: "Schalke" },
    ],
  );
  const simakala = de.find((entry) => entry.headline.includes("Simakala"));
  assert.equal(simakala.extractionStatus, "unresolved");
  assert.equal(simakala.player, null);
  assert.equal(simakala.fromClub, null);

  assert.deepEqual(
    uk.map(({ player, fromClub, toClub, fee, extractionStatus }) => ({ player, fromClub, toClub, fee, extractionStatus })),
    [
      { player: "Youri Tielemans", fromClub: "Aston Villa", toClub: "Manchester United", fee: "—", extractionStatus: "complete" },
      { player: "Lesley Ugochukwu", fromClub: "Burnley", toClub: "Galatasaray", fee: "€30m", extractionStatus: "complete" },
      { player: "Leandro Trossard", fromClub: "Arsenal", toClub: "Beşiktaş", fee: "€20m", extractionStatus: "complete" },
    ],
  );
  assert.equal(Object.hasOwn(uk[2], "description"), false);
  assert.equal(nl.length, 1);
  assert.equal(nl[0].player, "Jeremy Monga");
  assert.equal(nl[0].extractionStatus, "partial");
  assert.equal(pt.length, 1);
  assert.equal(pt[0].player, "Hjulmand");
  assert.equal(pt[0].extractionStatus, "partial");

  const finalStructuredYield = [...de, ...uk, ...nl, ...pt].filter(hasStructuredRoute);
  assert.deepEqual(finalStructuredYield.map((entry) => entry.player), [
    "Thomas Dähne", "Noel Aseko", "Cenk Özkacar", "Youri Tielemans", "Lesley Ugochukwu", "Leandro Trossard",
  ]);
});

test("a complete UK Transfermarkt claim absorbs its matching Spanish partial signal", () => {
  const item = (title, link) => `<rss><channel><item><title>${title}</title><link>${link}</link><pubDate>Tue, 14 Jul 2026 08:00:00 GMT</pubDate></item></channel></rss>`;
  const now = new Date("2026-07-15T12:00:00Z");
  const [ukClaim] = parseRssRumours(
    item("Youri Tielemans set to join Manchester United from Aston Villa", "https://www.transfermarkt.co.uk/tielemans"),
    RSS_SOURCES.find((source) => source.id === "transfermarkt-uk-rss"),
    now,
  );
  const [spanishSignal] = parseRssRumours(
    item("Youri Tielemans se muda a Manchester United", "https://www.transfermarkt.es/tielemans"),
    RSS_SOURCES.find((source) => source.id === "transfermarkt-es-rss"),
    now,
  );

  const [merged] = mergeRumourFragments([ukClaim, spanishSignal]);
  assert.equal(merged.player, "Youri Tielemans");
  assert.equal(merged.fromClub, "Aston Villa");
  assert.equal(merged.toClub, "Manchester United");
  assert.equal(merged.sources.length, 2);
  assert.deepEqual(merged.sourceAdapters, ["transfermarkt-uk-rss", "transfermarkt-es-rss"]);
});

test("official source preview reads only capped head metadata and resolves a secure image", () => {
  const longDescription = `A concise official announcement ${"with transfer details ".repeat(30)}`;
  const preview = parseSourcePreviewHtml(`
    <html lang="en-GB"><head>
      <title>Fallback title</title>
      <meta property="og:title" content="  Player joins Club  ">
      <meta property="og:description" content="${longDescription}">
      <meta property="og:image" content="/media/player.jpg">
      <meta property="og:site_name" content="Club FC">
      <meta property="article:published_time" content="2026-07-15T09:30:00+02:00">
    </head><body><article>Full article body that must never be copied.</article></body></html>
  `, {
    sourceUrl: "https://club.example/news/player",
    sourceName: "Club",
    fetchedAt: "2026-07-15T10:00:00Z",
  });

  assert.equal(preview.title, "Player joins Club");
  assert.equal(preview.description.length <= 360, true);
  assert.equal(preview.description.endsWith("…"), true);
  assert.equal(preview.description.includes("Full article body"), false);
  assert.equal(preview.imageUrl, "https://club.example/media/player.jpg");
  assert.equal(preview.siteName, "Club FC");
  assert.equal(preview.publishedAt, "2026-07-15T07:30:00.000Z");
  assert.equal(preview.language, "en-GB");
});

test("source preview normalization is bound to a verified HTTPS club source", () => {
  const transfer = {
    status: "official",
    sourceRole: "primary_official",
    sourceUrl: "https://club.example/news/player",
  };
  const normalized = normaliseSourcePreview({
    version: 1,
    sourceUrl: transfer.sourceUrl,
    title: "Player signs",
    description: "Official announcement.",
    imageUrl: "javascript:alert(1)",
    fetchedAt: "2026-07-15T10:00:00Z",
    articleBody: "Do not keep this",
  }, transfer);

  assert.equal(normalized.title, "Player signs");
  assert.equal(normalized.imageUrl, null);
  assert.equal("articleBody" in normalized, false);
  assert.equal(normaliseSourcePreview(normalized, { ...transfer, sourceUrl: "https://other.example/post" }), null);
  assert.equal(normaliseSourcePreview(normalized, { ...transfer, sourceRole: "publication" }), null);
});

test("source previews carry by exact URL and enrichment fetches eligible URLs once", async () => {
  const previous = [{
    id: "old-id",
    status: "official",
    sourceRole: "primary_official",
    sourceName: "Carried Club",
    sourceUrl: "https://carried.example/news/player",
    sourcePreviewCheckedAt: "2026-07-15T09:00:00Z",
    sourcePreview: {
      version: 1,
      sourceUrl: "https://carried.example/news/player",
      title: "Carried title",
      description: "Carried description",
      imageUrl: null,
      siteName: "Carried Club",
      publishedAt: null,
      language: "en",
      fetchedAt: "2026-07-15T09:00:00Z",
    },
  }];
  const base = {
    status: "official",
    sourceRole: "primary_official",
    sourceName: "Club",
  };
  const transfers = [
    { ...base, id: "new-id", sourceUrl: "https://carried.example/news/player" },
    { ...base, id: "one", sourceUrl: "https://fresh.example/news/player" },
    { ...base, id: "two", sourceUrl: "https://fresh.example/news/player" },
    { ...base, id: "failed", sourceUrl: "https://failed.example/news/player" },
    { ...base, id: "rumour", status: "rumour", sourceUrl: "https://rumour.example/news/player" },
    { ...base, id: "publication", sourceRole: "publication", sourceUrl: "https://publication.example/news/player" },
  ];
  carryPreviousSourcePreviews(transfers, previous);
  assert.equal(transfers[0].sourcePreview.title, "Carried title");

  const fetched = [];
  await enrichOfficialSourcePreviews(transfers, previous, {
    now: "2026-07-15T10:00:00Z",
    maxItems: 10,
    concurrency: 2,
    fetchHtml: async (url) => {
      fetched.push(url);
      if (url.includes("failed.example")) throw new Error("blocked");
      return `<html><head><meta property="og:title" content="Fresh title"><meta property="og:description" content="Fresh description"><meta property="og:image" content="https://cdn.example/player.jpg"></head></html>`;
    },
  });

  assert.deepEqual(fetched.sort(), [
    "https://failed.example/news/player",
    "https://fresh.example/news/player",
  ]);
  assert.equal(transfers[1].sourcePreview.title, "Fresh title");
  assert.equal(transfers[2].sourcePreview.title, "Fresh title");
  assert.equal(transfers[3].sourcePreview, undefined);
  assert.equal(transfers[3].sourcePreviewCheckedAt, "2026-07-15T10:00:00.000Z");
  assert.equal(transfers[4].sourcePreview, undefined);
  assert.equal(transfers[5].sourcePreview, undefined);
});

test("unresolved headlines never qualify as public transfer rows", () => {
  const claim = extractRumourMovement(
    "Kibic Schalke wróci do domu? Wymarzony transfer na ostatniej prostej",
    { market: "Poland" },
  );
  assert.equal(claim.player, null);
  assert.equal(claim.extractionStatus, "unresolved");
  assert.equal(hasStructuredRoute(claim), false);
});

test("source limits prefer a structured movement over newer unresolved headlines", () => {
  const items = [1, 2, 3, 4].map((index) => `
    <item><title>Transfer targets roundup ${index}</title><link>https://example.test/noise-${index}</link><pubDate>Wed, 15 Jul 2026 0${index}:00:00 GMT</pubDate></item>
  `).join("");
  const xml = `<rss><channel>${items}
    <item><title>Manchester United close to agreeing sale of Melvine Malard to Chelsea</title><link>https://example.test/claim</link><pubDate>Tue, 14 Jul 2026 08:00:00 GMT</pubDate></item>
  </channel></rss>`;
  const config = {
    id: "test-rss", label: "Test", market: "United Kingdom", maxItems: 2,
    pattern: /transfer|sale/i,
  };

  const result = parseRssRumours(xml, config, new Date("2026-07-15T12:00:00Z"));
  assert.equal(result.length, 2);
  assert.equal(result[0].player, "Melvine Malard");
  assert.equal(result[0].extractionStatus, "complete");
});

test("a headline copied into the player field is never a publishable movement", () => {
  const headline = "Chelsea linked with Example Player";
  assert.equal(hasStructuredRoute({
    player: headline,
    headline,
    fromClub: "Club A",
    toClub: "Chelsea",
  }), false);
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

test("only a club domain verified through Wikidata becomes the preferred official source", async () => {
  const transfers = [{
    id: "verified", date: "2026-07-14", player: "Example Player",
    fromClub: "Toulouse FC", fromClubUrl: "https://en.wikipedia.org/wiki/Toulouse_FC",
    toClub: "Ipswich Town", toClubUrl: "https://en.wikipedia.org/wiki/Ipswich_Town_F.C.",
    status: "official", sourceName: "BBC Sport", sourceUrl: "https://www.bbc.co.uk/sport/example",
    sourceRole: "publication", sources: [
      { name: "BBC Sport", url: "https://www.bbc.co.uk/sport/example", role: "publication" },
      { name: "toulousefc.com", url: "https://news.toulousefc.com/announcement", role: "publication" },
      { name: "Impostor", url: "https://toulousefc.com.evil.example/post", role: "publication" },
    ],
  }, {
    id: "unverified", date: "2026-07-14", player: "Another Player",
    fromClub: "Toulouse FC", fromClubUrl: "https://en.wikipedia.org/wiki/Toulouse_FC",
    toClub: "Ipswich Town", toClubUrl: "https://en.wikipedia.org/wiki/Ipswich_Town_F.C.",
    status: "official", sourceName: "Regional blog", sourceUrl: "https://regional.example/post",
    sourceRole: "primary_official",
  }];
  const pageMetadata = new Map([
    ["toulouse fc", { qid: "Q1" }],
    ["ipswich town f.c.", { qid: "Q2" }],
  ]);
  const entities = {
    Q1: { claims: {
      P31: [{ mainsnak: { datavalue: { value: { id: "Q476028" } } } }],
      P856: [{ mainsnak: { datavalue: { value: "https://www.toulousefc.com" } } }],
    } },
    Q2: { claims: {
      P31: [{ mainsnak: { datavalue: { value: { id: "Q476028" } } } }],
      P856: [{ mainsnak: { datavalue: { value: "https://www.itfc.co.uk" } } }],
    } },
  };

  await verifyOfficialClubSources(transfers, {
    wikipediaPageMetadata: async () => pageMetadata,
    wikidataEntities: async () => entities,
  });

  assert.equal(transfers[0].sourceName, "Toulouse FC");
  assert.equal(transfers[0].sourceRole, "primary_official");
  assert.equal(transfers[0].sources.find((source) => source.name === "Impostor").role, "publication");
  assert.equal(transfers[1].status, "official");
  assert.equal(transfers[1].sourceRole, "publication");
});

test("official website matching respects hostname boundaries", () => {
  assert.equal(matchesOfficialWebsite("https://news.club.example/post", "https://club.example"), true);
  assert.equal(matchesOfficialWebsite("https://club.example/post", "https://news.club.example"), false);
  assert.equal(matchesOfficialWebsite("https://club.example.evil.test/post", "https://club.example"), false);
  assert.equal(matchesOfficialWebsite("https://medium.example/club/post", "https://medium.example/club"), true);
  assert.equal(matchesOfficialWebsite("https://medium.example/other/post", "https://medium.example/club"), false);
  assert.equal(matchesOfficialWebsite("not a url", "https://club.example"), false);
});

test("a non-club Wikidata entity cannot verify an official source", async () => {
  const transfers = [{
    id: "city", date: "2026-07-14", player: "Example Player",
    fromClub: "Monaco", fromClubUrl: "https://en.wikipedia.org/wiki/Monaco",
    toClub: "Club B", toClubUrl: "https://en.wikipedia.org/wiki/Club_B",
    status: "official", sourceName: "Monaco", sourceUrl: "https://www.gouv.mc/announcement",
    sourceRole: "publication",
  }];

  await verifyOfficialClubSources(transfers, {
    wikipediaPageMetadata: async () => new Map([
      ["monaco", { qid: "Q235" }],
      ["club b", { qid: "Q2" }],
    ]),
    wikidataEntities: async () => ({
      Q235: { claims: {
        P31: [{ mainsnak: { datavalue: { value: { id: "Q6256" } } } }],
        P856: [{ mainsnak: { datavalue: { value: "https://www.gouv.mc" } } }],
      } },
      Q2: { claims: {} },
    }),
  });

  assert.equal(transfers[0].sourceRole, "publication");
});

test("an audited club override resolves an ambiguous Wikipedia title without trusting another domain", async () => {
  const base = {
    date: "2026-07-14", player: "Example Player",
    fromClub: "Monaco", fromClubUrl: "https://en.wikipedia.org/wiki/Monaco",
    toClub: "Club B", toClubUrl: "https://en.wikipedia.org/wiki/Club_B",
    status: "official", sourceRole: "publication",
  };
  const transfers = [{
    ...base, id: "club", sourceName: "asmonaco.com", sourceUrl: "https://www.asmonaco.com/fr/news/signing",
  }, {
    ...base, id: "state", sourceName: "Monaco government", sourceUrl: "https://www.gouv.mc/announcement",
  }];
  const pageMetadata = new Map([
    ["monaco", { qid: "Q235" }],
    ["club b", { qid: "Q2" }],
  ]);
  const entities = {
    Q235: { claims: {
      P31: [{ mainsnak: { datavalue: { value: { id: "Q6256" } } } }],
      P856: [{ mainsnak: { datavalue: { value: "https://www.gouv.mc" } } }],
    } },
    Q2: { claims: {} },
  };

  await verifyOfficialClubSources(transfers, {
    wikipediaPageMetadata: async () => pageMetadata,
    wikidataEntities: async () => entities,
  });

  assert.equal(transfers[0].sourceRole, "primary_official");
  assert.equal(transfers[1].sourceRole, "publication");
});

test("association football alone does not make a federation or competition a club", async () => {
  const transfers = [{
    id: "federation", date: "2026-07-14", player: "Example Player",
    fromClub: "Club A", fromClubUrl: "https://en.wikipedia.org/wiki/Club_A",
    toClub: "Club B", toClubUrl: "https://en.wikipedia.org/wiki/Club_B",
    status: "official", sourceName: "Football body", sourceUrl: "https://football-body.example/post",
    sourceRole: "publication",
  }];

  await verifyOfficialClubSources(transfers, {
    wikipediaPageMetadata: async () => new Map([
      ["club a", { qid: "Q1" }],
      ["club b", { qid: "Q2" }],
    ]),
    wikidataEntities: async () => ({
      Q1: { claims: {
        P31: [{ mainsnak: { datavalue: { value: { id: "Q327333" } } } }],
        P641: [{ mainsnak: { datavalue: { value: { id: "Q2736" } } } }],
        P856: [{ mainsnak: { datavalue: { value: "https://football-body.example" } } }],
      } },
      Q2: { claims: {} },
    }),
  });

  assert.equal(transfers[0].sourceRole, "publication");
});

test("official source verification fails closed without changing transfer status", async () => {
  const transfers = [{
    id: "stale", date: "2026-07-14", player: "Example Player",
    fromClub: "Club A", fromClubUrl: "https://en.wikipedia.org/wiki/Club_A",
    toClub: "Club B", toClubUrl: "https://en.wikipedia.org/wiki/Club_B",
    status: "official", sourceName: "Club A", sourceUrl: "https://club-a.example/post",
    sourceRole: "primary_official",
  }];

  await assert.rejects(verifyOfficialClubSources(transfers, {
    wikipediaPageMetadata: async () => { throw new Error("metadata unavailable"); },
  }), /metadata unavailable/);

  assert.equal(transfers[0].status, "official");
  assert.equal(transfers[0].sourceRole, "publication");
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
    id: "news", date: "2026-07-14", headline: "Luka Vuskovic wechselt zu Brighton", player: null, fromClub: null, toClub: null,
    status: "rumour", sourceAdapter: "sportschau-rss", sourceName: "Sportschau",
    sourceUrl: "https://sportschau.de/move", sourceRole: "publication",
  }];

  const remaining = mergeHeadlineEvidence(structured, signals);
  assert.equal(remaining.length, 0);
  assert.equal(structured[0].status, "official");
  assert.deepEqual(structured[0].sources.map((source) => source.name), ["BBC Sport", "Sportschau"]);
});

test("a unique surname-only headline can become evidence for a full-name movement", () => {
  const structured = [{
    id: "move", date: "2026-07-14", player: "Danilho Doekhi", fromClub: "Union Berlin", toClub: "Lazio",
    status: "official", sourceAdapter: "wikipedia-germany", sourceName: "Lazio",
    sourceUrl: "https://sslazio.it/doekhi", sourceRole: "primary_official",
  }];
  const signals = [{
    id: "news", date: "2026-07-14", headline: "Doekhi zu Lazio Rom - Ex-Unioner Verteidiger mit Italienern einig",
    player: "Danilho Doekhi", fromClub: null, toClub: "Lazio", status: "rumour",
    sourceAdapter: "sportschau-rss", sourceName: "Sportschau",
    sourceUrl: "https://sportschau.de/doekhi", sourceRole: "publication",
  }];

  assert.deepEqual(mergeHeadlineEvidence(structured, signals), []);
  assert.equal(structured[0].sources.length, 2);
});

test("a same-player headline with a conflicting destination stays a separate signal", () => {
  const structured = [{
    id: "move", date: "2026-07-14", player: "Danilho Doekhi", fromClub: "Union Berlin", toClub: "Lazio",
    status: "official", sourceName: "Lazio", sourceUrl: "https://sslazio.it/doekhi", sourceRole: "primary_official",
  }];
  const signal = {
    id: "news", date: "2026-07-14", headline: "Doekhi close to Milan move", player: "Danilho Doekhi",
    fromClub: "Union Berlin", toClub: "Milan", status: "rumour",
    sourceName: "News", sourceUrl: "https://news.test/doekhi", sourceRole: "publication",
  };

  assert.deepEqual(mergeHeadlineEvidence(structured, [signal]), [signal]);
  assert.equal(structured[0].sources, undefined);
});

test("partial reports merge into one complete rumour with all source evidence", () => {
  const fragments = [
    {
      id: "one", date: "2026-07-14", headline: "Fenerbahce meldet Greenwood-Deal", player: "Greenwood",
      fromClub: null, toClub: "Fenerbahçe", fee: "—", status: "rumour",
      sourceAdapter: "transfermarkt-de-rss", sourceName: "Transfermarkt DE",
      sourceUrl: "https://transfermarkt.de/greenwood", sourceRole: "database",
    },
    {
      id: "two", date: "2026-07-14", headline: "l'OM vend Greenwood", player: "Greenwood",
      fromClub: "Marseille", toClub: null, fee: "—", status: "rumour",
      sourceAdapter: "rmc-rss", sourceName: "RMC Sport",
      sourceUrl: "https://rmcsport.fr/greenwood", sourceRole: "publication",
    },
    {
      id: "three", date: "2026-07-14", headline: "Fenerbahçe contrata Greenwood por 39 milhões de euros",
      player: "Greenwood", fromClub: null, toClub: "Fenerbahçe", fee: "€39m", status: "rumour",
      sourceAdapter: "maisfutebol-rss", sourceName: "MaisFutebol",
      sourceUrl: "https://maisfutebol.pt/greenwood", sourceRole: "publication",
    },
  ];

  const [result] = mergeRumourFragments(fragments);
  assert.equal(hasStructuredRoute(result), true);
  assert.equal(result.player, "Mason Greenwood");
  assert.equal(result.fromClub, "Marseille");
  assert.equal(result.toClub, "Fenerbahçe");
  assert.equal(result.fee, "€39m");
  assert.equal(result.extractionStatus, "complete");
  assert.equal(result.sources.length, 3);
});

test("an ambiguous surname is not resolved or published with the wrong club context", () => {
  const [result] = mergeRumourFragments([
    {
      id: "one", date: "2026-07-14", headline: "Chelsea linked with Greenwood", player: "Greenwood",
      fromClub: null, toClub: "Chelsea", fee: "—", status: "rumour",
      sourceName: "Source A", sourceUrl: "https://a.test/greenwood", sourceRole: "publication",
    },
    {
      id: "two", date: "2026-07-14", headline: "Manchester City vend Greenwood", player: "Greenwood",
      fromClub: "Manchester City", toClub: null, fee: "—", status: "rumour",
      sourceName: "Source B", sourceUrl: "https://b.test/greenwood", sourceRole: "publication",
    },
  ]);

  assert.equal(result.player, "Greenwood");
  assert.equal(hasStructuredRoute(result), false);
});

test("a German salary comparison is not treated as the selling club", () => {
  const claim = extractRumourMovement(
    "Fenerbahce meldet Greenwood-Deal – Dreifaches Gehalt wie in Marseille",
    { market: "Germany" },
  );

  assert.equal(claim.player, "Greenwood");
  assert.equal(claim.fromClub, null);
  assert.equal(claim.toClub, "Fenerbahçe");
  assert.equal(claim.extractionStatus, "partial");
  assert.equal(hasStructuredRoute(claim), false);
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
