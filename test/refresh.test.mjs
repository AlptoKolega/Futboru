import test from "node:test";
import assert from "node:assert/strict";
import { flagCodeFromName, parseBbcRumours, parseWikipediaTransfers, positionCode } from "../scripts/refresh.mjs";

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
