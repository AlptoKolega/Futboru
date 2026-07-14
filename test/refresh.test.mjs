import test from "node:test";
import assert from "node:assert/strict";
import { parseBbcRumours, parseWikipediaTransfers } from "../scripts/refresh.mjs";

test("parser Wikipedii dziedziczy datę z rowspan i zachowuje link źródłowy", () => {
  const html = `
    <table class="wikitable">
      <tr><th>Date</th><th>Player</th><th>From</th><th>To</th><th>Fee</th></tr>
      <tr>
        <td rowspan="2">14 July 2026</td>
        <td><img alt="Croatia"><a href="./Luka_Vu%C5%A1kovi%C4%87">Luka Vušković</a></td>
        <td>Tottenham Hotspur</td><td>Brighton</td>
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
  assert.equal(result[0].sourceUrl, "https://www.bbc.co.uk/sport/example");
  assert.equal(result[0].flag, "🇭🇷");
});

test("zapowiedź ruchu pozostaje plotką mimo obecności w tabeli", () => {
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

test("parser BBC przyjmuje wyłącznie sygnały o charakterze plotki", () => {
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
