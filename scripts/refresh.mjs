import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

export const WIKIPEDIA_URL = "https://en.wikipedia.org/wiki/List_of_English_football_transfers_summer_2026";
export const BBC_RSS_URL = "https://feeds.bbci.co.uk/sport/football/rss.xml";

const OUTPUT_URL = new URL("../data/transfers.json", import.meta.url);
const MANUAL_RUMOURS_URL = new URL("../data/manual-rumours.json", import.meta.url);
const USER_AGENT = "Futboru/0.1 (+https://github.com/AlptoKolega/Futboru; public transfer-feed PoC)";
const LOOKBACK_DAYS = Number(process.env.LOOKBACK_DAYS || 14);
const MAX_OFFICIAL = Number(process.env.MAX_OFFICIAL || 120);
const MAX_RUMOURS = Number(process.env.MAX_RUMOURS || 12);

const COUNTRY_FLAGS = new Map([
  ["albania", "🇦🇱"], ["algeria", "🇩🇿"], ["argentina", "🇦🇷"], ["australia", "🇦🇺"],
  ["austria", "🇦🇹"], ["belgium", "🇧🇪"], ["bosnia and herzegovina", "🇧🇦"], ["brazil", "🇧🇷"],
  ["bulgaria", "🇧🇬"], ["cameroon", "🇨🇲"], ["canada", "🇨🇦"], ["chile", "🇨🇱"],
  ["colombia", "🇨🇴"], ["costa rica", "🇨🇷"], ["croatia", "🇭🇷"], ["cyprus", "🇨🇾"],
  ["czech republic", "🇨🇿"], ["czechia", "🇨🇿"], ["denmark", "🇩🇰"], ["ecuador", "🇪🇨"],
  ["england", "🇬🇧"], ["finland", "🇫🇮"], ["france", "🇫🇷"], ["gabon", "🇬🇦"],
  ["georgia", "🇬🇪"], ["germany", "🇩🇪"], ["ghana", "🇬🇭"], ["greece", "🇬🇷"],
  ["guinea", "🇬🇳"], ["hungary", "🇭🇺"], ["iceland", "🇮🇸"], ["iran", "🇮🇷"],
  ["ireland", "🇮🇪"], ["republic of ireland", "🇮🇪"], ["israel", "🇮🇱"], ["italy", "🇮🇹"],
  ["ivory coast", "🇨🇮"], ["côte d'ivoire", "🇨🇮"], ["jamaica", "🇯🇲"], ["japan", "🇯🇵"],
  ["kosovo", "🇽🇰"], ["mali", "🇲🇱"], ["mexico", "🇲🇽"], ["morocco", "🇲🇦"],
  ["netherlands", "🇳🇱"], ["new zealand", "🇳🇿"], ["nigeria", "🇳🇬"], ["north macedonia", "🇲🇰"],
  ["northern ireland", "🇬🇧"], ["norway", "🇳🇴"], ["paraguay", "🇵🇾"], ["peru", "🇵🇪"],
  ["poland", "🇵🇱"], ["portugal", "🇵🇹"], ["romania", "🇷🇴"], ["scotland", "🇬🇧"],
  ["senegal", "🇸🇳"], ["serbia", "🇷🇸"], ["slovakia", "🇸🇰"], ["slovenia", "🇸🇮"],
  ["south africa", "🇿🇦"], ["south korea", "🇰🇷"], ["spain", "🇪🇸"], ["sweden", "🇸🇪"],
  ["switzerland", "🇨🇭"], ["tunisia", "🇹🇳"], ["turkey", "🇹🇷"], ["ukraine", "🇺🇦"],
  ["united states", "🇺🇸"], ["uruguay", "🇺🇾"], ["venezuela", "🇻🇪"], ["wales", "🇬🇧"],
]);

const POLISH_COUNTRIES = new Map([
  ["England", "Anglia"], ["Scotland", "Szkocja"], ["Wales", "Walia"], ["Northern Ireland", "Irlandia Północna"],
  ["Republic of Ireland", "Irlandia"], ["Germany", "Niemcy"], ["France", "Francja"], ["Spain", "Hiszpania"],
  ["Italy", "Włochy"], ["Netherlands", "Holandia"], ["Sweden", "Szwecja"], ["Brazil", "Brazylia"],
  ["Argentina", "Argentyna"], ["Portugal", "Portugalia"], ["Nigeria", "Nigeria"], ["Croatia", "Chorwacja"],
  ["Poland", "Polska"], ["Belgium", "Belgia"], ["Denmark", "Dania"], ["Norway", "Norwegia"],
  ["Switzerland", "Szwajcaria"], ["United States", "Stany Zjednoczone"], ["Ivory Coast", "Wybrzeże Kości Słoniowej"],
]);

function cleanText(value) {
  return String(value ?? "")
    .replace(/\[[^\]]*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isoDate(value) {
  const normalized = cleanText(value).replace(/\b(\d+)(st|nd|rd|th)\b/gi, "$1");
  const date = new Date(`${normalized} 12:00:00 UTC`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function inLookback(dateKey, now = new Date()) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - LOOKBACK_DAYS);
  return date >= cutoff && date <= new Date(now.getTime() + 86_400_000);
}

function flagFromName(name) {
  const key = cleanText(name).toLowerCase().replace(/^flag of /, "");
  return COUNTRY_FLAGS.get(key) || "";
}

function sourceLabel(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const known = {
      "bbc.co.uk": "BBC Sport",
      "arsenal.com": "Arsenal.com",
      "premierleague.com": "Premier League",
      "tottenhamhotspur.com": "Tottenham Hotspur",
      "liverpoolfc.com": "Liverpool FC",
      "chelseafc.com": "Chelsea FC",
      "mancity.com": "Manchester City",
      "manutd.com": "Manchester United",
      "en.wikipedia.org": "Wikipedia",
    };
    return known[hostname] || hostname;
  } catch {
    return "Źródło";
  }
}

function firstArticleLink($, cell) {
  return cell
    .find('a[rel~="mw:WikiLink"], a[href^="./"], a[href^="/wiki/"], a[href^="//en.wikipedia.org/wiki/"]')
    .toArray()
    .map((anchor) => ({ anchor, text: cleanText($(anchor).text()) }))
    .find(({ text }) => text)?.anchor;
}

function absoluteWikipediaUrl(href) {
  if (!href) return null;
  return new URL(href, "https://en.wikipedia.org/wiki/").href;
}

function firstReference($, feeCell) {
  const href = feeCell.find('sup.reference a[href^="#"]').first().attr("href");
  if (!href) return null;
  const id = decodeURIComponent(href.slice(1));
  const reference = $(`[id="${id}"]`);
  const external = reference.find('a.external[href^="http"]').first();
  const url = external.attr("href");
  return url ? { url, title: cleanText(reference.text()) } : null;
}

function statusFromReference(reference) {
  if (!reference) return "official";
  const uncertainty = /\b(set (?:for|to)|close to|poised to|expected to|in talks|target(?:s|ing)?|linked|bid for|could join|agrees? (?:a )?deal)\b/i;
  return uncertainty.test(reference.title) ? "rumour" : "official";
}

export function parseWikipediaTransfers(html, now = new Date()) {
  const $ = cheerio.load(html);
  const table = $("table.wikitable").first();
  if (!table.length) throw new Error("Wikipedia: nie znaleziono tabeli transferów");

  const transfers = [];
  let currentDate = null;

  table.find("tr").each((_, row) => {
    const cells = $(row).children("td");
    if (cells.length < 4) return;

    let offset = 0;
    if (cells.length >= 5) {
      currentDate = isoDate($(cells[0]).text());
      offset = 1;
    }
    if (!currentDate || !inLookback(currentDate, now)) return;

    const playerCell = $(cells[offset]);
    const fromCell = $(cells[offset + 1]);
    const toCell = $(cells[offset + 2]);
    const feeCell = $(cells[offset + 3]);
    if (!feeCell.length) return;

    const playerAnchor = firstArticleLink($, playerCell);
    const player = cleanText(playerAnchor ? $(playerAnchor).text() : playerCell.clone().children("sup").remove().end().text());
    if (!player) return;

    const flagImage = playerCell.find("img").first();
    const country = cleanText(flagImage.attr("alt") || flagImage.attr("title") || "England") || "England";
    const reference = firstReference($, feeCell);
    const sourceUrl = reference?.url || WIKIPEDIA_URL;
    const rawFee = cleanText(feeCell.clone().children("sup").remove().end().text()) || "Undisclosed";
    const fee = rawFee
      .replace(/^Undisclosed$/i, "nieujawniona")
      .replace(/^Free$/i, "bez odstępnego")
      .replace(/^Loan$/i, "wypożyczenie");

    transfers.push({
      id: createHash("sha1").update(`official|${currentDate}|${player}|${cleanText(fromCell.text())}|${cleanText(toCell.text())}`).digest("hex").slice(0, 14),
      date: currentDate,
      time: "—",
      player,
      playerUrl: absoluteWikipediaUrl(playerAnchor ? $(playerAnchor).attr("href") : null),
      age: null,
      position: null,
      nationality: POLISH_COUNTRIES.get(country) || country,
      flag: flagFromName(country),
      fromClub: cleanText(fromCell.text()),
      toClub: cleanText(toCell.text()),
      fee,
      status: statusFromReference(reference),
      sourceAdapter: "wikipedia",
      sourceName: sourceLabel(sourceUrl),
      sourceUrl,
      firstSeenAt: `${currentDate}T12:00:00.000Z`,
    });
  });

  return transfers;
}

function normaliseTitle(title) {
  return cleanText(title).replace(/^Football transfer (?:rumours|news):?\s*/i, "");
}

function looksLikeRumour(title) {
  return /\b(rumou?r|linked|target|bid|interest|interested|talks|set to|close to|poised|could|want|eyeing|agrees? deal|transfer news)\b/i.test(title);
}

export function parseBbcRumours(xml, now = new Date()) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const rumours = [];

  $("item").each((_, item) => {
    if (rumours.length >= MAX_RUMOURS) return;
    const title = cleanText($(item).find("title").first().text());
    const link = cleanText($(item).find("link").first().text());
    const published = new Date(cleanText($(item).find("pubDate").first().text()));
    if (!title || !link || Number.isNaN(published.getTime()) || !looksLikeRumour(title)) return;
    if (now.getTime() - published.getTime() > LOOKBACK_DAYS * 86_400_000) return;

    const displayTitle = normaliseTitle(title);
    const date = published.toISOString().slice(0, 10);
    const time = new Intl.DateTimeFormat("pl-PL", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Warsaw",
    }).format(published);

    rumours.push({
      id: createHash("sha1").update(`rumour|${link}`).digest("hex").slice(0, 14),
      date,
      time,
      player: displayTitle,
      playerUrl: null,
      age: null,
      position: "doniesienie",
      nationality: null,
      flag: "",
      fromClub: "—",
      toClub: "—",
      fee: "—",
      status: "rumour",
      sourceAdapter: "bbc-rss",
      sourceName: "BBC Sport",
      sourceUrl: link,
      firstSeenAt: published.toISOString(),
    });
  });

  return rumours;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

async function wikidataEntities(ids, props = "claims|descriptions") {
  if (!ids.length) return {};
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.search = new URLSearchParams({
    action: "wbgetentities",
    format: "json",
    languages: "pl|en",
    props,
    ids: ids.join("|"),
  });
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Wikidata: HTTP ${response.status}`);
  const payload = await response.json();
  return payload.entities || {};
}

function ageAt(birthTime, dateKey) {
  if (!birthTime || !dateKey) return null;
  const match = birthTime.match(/^\+?(\d{4})-(\d{2})-(\d{2})T/);
  if (!match) return null;
  const birth = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const date = new Date(`${dateKey}T12:00:00Z`);
  let age = date.getUTCFullYear() - birth.year;
  const beforeBirthday = date.getUTCMonth() + 1 < birth.month || (date.getUTCMonth() + 1 === birth.month && date.getUTCDate() < birth.day);
  if (beforeBirthday) age -= 1;
  return age >= 15 && age <= 50 ? age : null;
}

function claimIds(entity, property) {
  return (entity?.claims?.[property] || [])
    .map((claim) => claim?.mainsnak?.datavalue?.value?.id)
    .filter(Boolean);
}

function positionInPolish(label = "") {
  const value = label.toLowerCase();
  if (/goalkeeper|bramkar/.test(value)) return "bramkarz";
  if (/centre-back|center-back|środkowy obrońca/.test(value)) return "środkowy obrońca";
  if (/full-back|boczny obrońca/.test(value)) return "boczny obrońca";
  if (/defender|obrońca/.test(value)) return "obrońca";
  if (/defensive midfielder|defensywny pomocnik/.test(value)) return "defensywny pomocnik";
  if (/attacking midfielder|ofensywny pomocnik/.test(value)) return "ofensywny pomocnik";
  if (/winger|skrzydłowy/.test(value)) return "skrzydłowy";
  if (/midfielder|pomocnik/.test(value)) return "pomocnik";
  if (/forward|striker|napastnik/.test(value)) return "napastnik";
  return label || null;
}

async function enrichOfficialTransfers(transfers) {
  const withPages = transfers.filter((transfer) => transfer.playerUrl).slice(0, 50);
  if (!withPages.length) return transfers;

  const titles = withPages.map((transfer) => decodeURIComponent(new URL(transfer.playerUrl).pathname.replace(/^\/wiki\//, "")).replaceAll("_", " "));
  const queryUrl = new URL("https://en.wikipedia.org/w/api.php");
  queryUrl.search = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "pageprops",
    ppprop: "wikibase_item",
    redirects: "1",
    titles: titles.join("|"),
  });
  const response = await fetch(queryUrl, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Wikipedia API: HTTP ${response.status}`);
  const payload = await response.json();
  const pageToQid = new Map();
  for (const page of Object.values(payload?.query?.pages || {})) {
    if (page?.title && page?.pageprops?.wikibase_item) pageToQid.set(page.title.toLowerCase(), page.pageprops.wikibase_item);
  }

  const qids = [...new Set(pageToQid.values())];
  const entities = await wikidataEntities(qids);
  const positionIds = [...new Set(qids.flatMap((qid) => claimIds(entities[qid], "P413")))];
  const countryIds = [...new Set(qids.flatMap((qid) => claimIds(entities[qid], "P27")))];
  const positionEntities = await wikidataEntities(positionIds, "labels");
  const countryEntities = await wikidataEntities(countryIds, "labels|claims");

  for (let index = 0; index < withPages.length; index += 1) {
    const transfer = withPages[index];
    const qid = pageToQid.get(titles[index].toLowerCase());
    const entity = entities[qid];
    if (!entity) continue;

    const birthTime = entity?.claims?.P569?.[0]?.mainsnak?.datavalue?.value?.time;
    transfer.age = ageAt(birthTime, transfer.date);

    const positionId = claimIds(entity, "P413")[0];
    const positionEntity = positionEntities[positionId];
    const label = positionEntity?.labels?.pl?.value || positionEntity?.labels?.en?.value;
    transfer.position = positionInPolish(label);

    const countryId = claimIds(entity, "P27")[0];
    const countryEntity = countryEntities[countryId];
    if (countryEntity) {
      transfer.nationality = countryEntity?.labels?.pl?.value || countryEntity?.labels?.en?.value || transfer.nationality;
      const specialFlags = {
        Q21: "🇬🇧",
        Q22: "🇬🇧",
        Q25: "🇬🇧",
        Q26: "🇬🇧",
      };
      const isoCode = countryEntity?.claims?.P297?.[0]?.mainsnak?.datavalue?.value;
      if (specialFlags[countryId]) {
        transfer.flag = specialFlags[countryId];
      } else if (/^[A-Z]{2}$/.test(isoCode || "")) {
        transfer.flag = String.fromCodePoint(...[...isoCode].map((character) => 127397 + character.charCodeAt(0)));
      }
    }
  }

  return transfers;
}

function validateManualRumour(item) {
  return item
    && typeof item === "object"
    && /^\d{4}-\d{2}-\d{2}$/.test(item.date || "")
    && item.player
    && item.sourceUrl
    && /^https:\/\//.test(item.sourceUrl);
}

async function readManualRumours() {
  try {
    const items = JSON.parse(await readFile(MANUAL_RUMOURS_URL, "utf8"));
    return items.filter(validateManualRumour).map((item) => ({
      age: null,
      position: "doniesienie",
      nationality: null,
      flag: "",
      fromClub: "—",
      toClub: "—",
      fee: "—",
      status: "rumour",
      sourceAdapter: "manual",
      time: "—",
      ...item,
      id: item.id || createHash("sha1").update(`manual|${item.sourceUrl}`).digest("hex").slice(0, 14),
    }));
  } catch {
    return [];
  }
}

function deduplicate(transfers) {
  const seen = new Set();
  return transfers.filter((transfer) => {
    const key = transfer.id || `${transfer.status}|${transfer.player}|${transfer.fromClub}|${transfer.toClub}|${transfer.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function refresh() {
  const generatedAt = new Date().toISOString();
  const sourceReports = [];
  let previousTransfers = [];
  try {
    const previous = JSON.parse(await readFile(OUTPUT_URL, "utf8"));
    previousTransfers = Array.isArray(previous.transfers) ? previous.transfers : [];
  } catch {
    previousTransfers = [];
  }

  const [wikipediaResult, bbcResult] = await Promise.allSettled([
    fetchText(WIKIPEDIA_URL),
    fetchText(BBC_RSS_URL),
  ]);

  let official = [];
  if (wikipediaResult.status === "fulfilled") {
    official = parseWikipediaTransfers(wikipediaResult.value).slice(-MAX_OFFICIAL).reverse();
    try {
      await enrichOfficialTransfers(official);
    } catch (error) {
      console.warn(`Wzbogacanie Wikidata pominięte: ${error.message}`);
    }
    sourceReports.push({ id: "wikipedia", label: "English Wikipedia", url: WIKIPEDIA_URL, status: "ok", count: official.length });
  } else {
    official = previousTransfers.filter((transfer) => transfer.sourceAdapter === "wikipedia");
    sourceReports.push({ id: "wikipedia", label: "English Wikipedia", url: WIKIPEDIA_URL, status: "stale", count: official.length });
    console.error(wikipediaResult.reason);
  }

  let rumours = [];
  if (bbcResult.status === "fulfilled") {
    rumours = parseBbcRumours(bbcResult.value);
    sourceReports.push({ id: "bbc", label: "BBC Sport RSS", url: BBC_RSS_URL, status: "ok", count: rumours.length });
  } else {
    rumours = previousTransfers.filter((transfer) => transfer.sourceAdapter === "bbc-rss");
    sourceReports.push({ id: "bbc", label: "BBC Sport RSS", url: BBC_RSS_URL, status: "stale", count: rumours.length });
    console.error(bbcResult.reason);
  }

  const manualRumours = await readManualRumours();
  const transfers = deduplicate([...official, ...rumours, ...manualRumours]).sort((a, b) => {
    const dateOrder = b.date.localeCompare(a.date);
    if (dateOrder !== 0) return dateOrder;
    if (a.status !== b.status) return a.status === "official" ? -1 : 1;
    return (b.firstSeenAt || "").localeCompare(a.firstSeenAt || "");
  });

  if (!transfers.length) {
    throw new Error("Żadne źródło nie zwróciło wpisów; poprzedni plik danych pozostaje bez zmian");
  }

  const payload = { generatedAt, sources: sourceReports, transfers };
  await writeFile(OUTPUT_URL, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  const officialCount = transfers.filter((transfer) => transfer.status === "official").length;
  const rumourCount = transfers.filter((transfer) => transfer.status === "rumour").length;
  console.log(`Zapisano ${transfers.length} wpisów (${officialCount} oficjalnych, ${rumourCount} plotek).`);
  return payload;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(`file://${process.argv[1]}`));
if (isMain) {
  refresh().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
