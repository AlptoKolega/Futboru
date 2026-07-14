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

const COUNTRY_FLAG_CODES = new Map([
  ["albania", "al"], ["algeria", "dz"], ["argentina", "ar"], ["australia", "au"],
  ["austria", "at"], ["belgium", "be"], ["bosnia and herzegovina", "ba"], ["bosnia & herzegovina", "ba"],
  ["brazil", "br"], ["bulgaria", "bg"], ["cameroon", "cm"], ["canada", "ca"], ["chile", "cl"],
  ["colombia", "co"], ["comoros", "km"], ["costa rica", "cr"], ["croatia", "hr"], ["curacao", "cw"],
  ["cyprus", "cy"], ["czech republic", "cz"], ["czechia", "cz"], ["denmark", "dk"], ["ecuador", "ec"],
  ["england", "gb-eng"], ["estonia", "ee"], ["finland", "fi"], ["france", "fr"], ["gabon", "ga"],
  ["gambia", "gm"], ["the gambia", "gm"], ["georgia", "ge"], ["germany", "de"], ["ghana", "gh"],
  ["greece", "gr"], ["guyana", "gy"], ["guinea", "gn"], ["hungary", "hu"], ["iceland", "is"],
  ["iran", "ir"], ["ireland", "ie"], ["republic of ireland", "ie"], ["israel", "il"], ["italy", "it"],
  ["ivory coast", "ci"], ["cote d'ivoire", "ci"], ["jamaica", "jm"], ["japan", "jp"], ["kenya", "ke"],
  ["kosovo", "xk"], ["mali", "ml"], ["mexico", "mx"], ["morocco", "ma"], ["netherlands", "nl"],
  ["new zealand", "nz"], ["nigeria", "ng"], ["north macedonia", "mk"], ["northern ireland", "gb-nir"],
  ["norway", "no"], ["paraguay", "py"], ["peru", "pe"], ["poland", "pl"], ["portugal", "pt"],
  ["romania", "ro"], ["scotland", "gb-sct"], ["senegal", "sn"], ["serbia", "rs"], ["sierra leone", "sl"],
  ["slovakia", "sk"], ["slovenia", "si"], ["south africa", "za"], ["south korea", "kr"],
  ["korea republic", "kr"], ["republic of korea", "kr"], ["spain", "es"], ["sweden", "se"],
  ["switzerland", "ch"], ["tunisia", "tn"], ["turkey", "tr"], ["turkiye", "tr"], ["ukraine", "ua"],
  ["united kingdom", "gb"], ["united states", "us"], ["united states of america", "us"], ["usa", "us"],
  ["uruguay", "uy"], ["venezuela", "ve"], ["wales", "gb-wls"],
  ["north korea", "kp"], ["dpr korea", "kp"], ["dr congo", "cd"],
  ["democratic republic of the congo", "cd"], ["congo", "cg"], ["republic of the congo", "cg"],
  ["cape verde", "cv"], ["cabo verde", "cv"], ["palestine", "ps"],
  ["united arab emirates", "ae"], ["uae", "ae"], ["tanzania", "tz"], ["bolivia", "bo"],
  ["moldova", "md"], ["guinea-bissau", "gw"], ["equatorial guinea", "gq"], ["trinidad and tobago", "tt"],
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

function normaliseCountryName(name) {
  return cleanText(name)
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/^flag of /, "")
    .replace(/\s*\(country\)$/, "");
}

export function flagCodeFromName(name) {
  return COUNTRY_FLAG_CODES.get(normaliseCountryName(name)) || null;
}

function flagFromName(name) {
  const code = flagCodeFromName(name)?.slice(0, 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(code || "")) return "";
  return String.fromCodePoint(...[...code].map((character) => 127397 + character.charCodeAt(0)));
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
    return "Source";
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
  if (!table.length) throw new Error("Wikipedia: transfer table not found");

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
    const fromClubAnchor = firstArticleLink($, fromCell);
    const toClubAnchor = firstArticleLink($, toCell);
    const player = cleanText(playerAnchor ? $(playerAnchor).text() : playerCell.clone().children("sup").remove().end().text());
    if (!player) return;

    const flagImage = playerCell.find("img").first();
    const country = cleanText(
      flagImage.attr("alt")
      || flagImage.closest("a").attr("title")
      || flagImage.attr("title")
      || "England",
    ) || "England";
    const reference = firstReference($, feeCell);
    const sourceUrl = reference?.url || WIKIPEDIA_URL;
    const fee = cleanText(feeCell.clone().children("sup").remove().end().text()) || "Undisclosed";

    transfers.push({
      id: createHash("sha1").update(`official|${currentDate}|${player}|${cleanText(fromCell.text())}|${cleanText(toCell.text())}`).digest("hex").slice(0, 14),
      date: currentDate,
      time: "—",
      player,
      playerUrl: absoluteWikipediaUrl(playerAnchor ? $(playerAnchor).attr("href") : null),
      age: null,
      position: null,
      nationality: country,
      flagCode: flagCodeFromName(country),
      flag: flagFromName(country),
      fromClub: cleanText(fromCell.text()),
      fromClubUrl: absoluteWikipediaUrl(fromClubAnchor ? $(fromClubAnchor).attr("href") : null),
      fromClubCrest: null,
      toClub: cleanText(toCell.text()),
      toClubUrl: absoluteWikipediaUrl(toClubAnchor ? $(toClubAnchor).attr("href") : null),
      toClubCrest: null,
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
    const time = new Intl.DateTimeFormat("en-GB", {
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
      position: null,
      nationality: null,
      flagCode: null,
      flag: "",
      fromClub: "—",
      fromClubUrl: null,
      fromClubCrest: null,
      toClub: "—",
      toClubUrl: null,
      toClubCrest: null,
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

function batches(items, size = 45) {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

function wikipediaTitle(url) {
  try {
    const path = new URL(url).pathname.replace(/^\/wiki\//, "");
    return decodeURIComponent(path).replaceAll("_", " ");
  } catch {
    return null;
  }
}

async function wikipediaPageMetadata(titles, { includeThumbnail = false } = {}) {
  const uniqueTitles = [...new Set(titles.filter(Boolean))];
  const metadata = new Map();

  for (const titleBatch of batches(uniqueTitles)) {
    const queryUrl = new URL("https://en.wikipedia.org/w/api.php");
    const parameters = {
      action: "query",
      format: "json",
      formatversion: "2",
      prop: includeThumbnail ? "pageprops|pageimages" : "pageprops",
      ppprop: "wikibase_item",
      redirects: "1",
      titles: titleBatch.join("|"),
    };
    if (includeThumbnail) {
      parameters.piprop = "thumbnail|name";
      parameters.pithumbsize = "120";
      parameters.pilicense = "any";
    }
    queryUrl.search = new URLSearchParams(parameters);

    const response = await fetch(queryUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Wikipedia API: HTTP ${response.status}`);
    const payload = await response.json();
    if (payload?.error) {
      throw new Error(`Wikipedia API: ${payload.error.code || "unknown error"} — ${payload.error.info || "request failed"}`);
    }
    const aliases = new Map();
    for (const item of [...(payload?.query?.normalized || []), ...(payload?.query?.redirects || [])]) {
      if (item?.from && item?.to) aliases.set(item.from.toLowerCase(), item.to.toLowerCase());
    }
    const pages = new Map(
      (payload?.query?.pages || [])
        .filter((page) => page?.title)
        .map((page) => [page.title.toLowerCase(), page]),
    );

    for (const originalTitle of titleBatch) {
      let resolvedTitle = originalTitle.toLowerCase();
      const visited = new Set();
      while (aliases.has(resolvedTitle) && !visited.has(resolvedTitle)) {
        visited.add(resolvedTitle);
        resolvedTitle = aliases.get(resolvedTitle);
      }
      const page = pages.get(resolvedTitle) || pages.get(originalTitle.toLowerCase());
      if (page) {
        metadata.set(originalTitle.toLowerCase(), {
          qid: page?.pageprops?.wikibase_item || null,
          thumbnail: page?.thumbnail?.source || null,
        });
      }
    }
  }

  return metadata;
}

async function wikidataEntities(ids, props = "claims|descriptions") {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const entities = {};

  for (const idBatch of batches(uniqueIds)) {
    const url = new URL("https://www.wikidata.org/w/api.php");
    url.search = new URLSearchParams({
      action: "wbgetentities",
      format: "json",
      languages: "en",
      props,
      ids: idBatch.join("|"),
    });
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Wikidata: HTTP ${response.status}`);
    const payload = await response.json();
    if (payload?.error) {
      throw new Error(`Wikidata: ${payload.error.code || "unknown error"} — ${payload.error.info || "request failed"}`);
    }
    Object.assign(entities, payload.entities || {});
  }

  return entities;
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
    .filter((claim) => claim?.rank !== "deprecated")
    .sort((left, right) => Number(right?.rank === "preferred") - Number(left?.rank === "preferred"))
    .map((claim) => claim?.mainsnak?.datavalue?.value?.id)
    .filter(Boolean);
}

const POSITION_CODES_BY_QID = new Map([
  ["Q201330", "GK"],
  ["Q268258", "DC"],
  ["Q336286", "DC"],
  ["Q90173132", "FB"],
  ["Q124650007", "DL"],
  ["Q124355618", "DR"],
  ["Q18691898", "DM"],
  ["Q193592", "MC"],
  ["Q6008848", "MC"],
  ["Q8025128", "MC"],
  ["Q90326494", "AMC"],
  ["Q114358150", "AMR"],
  ["Q114358158", "AML"],
  ["Q280658", "ST"],
  ["Q9731197", "ST"],
  ["Q1642283", "SS"],
]);

export function positionCode(label = "", qid = "") {
  if (POSITION_CODES_BY_QID.has(qid)) return POSITION_CODES_BY_QID.get(qid);
  const value = label.toLowerCase().replace(/[‐‑‒–—]/g, "-");
  if (/goalkeeper/.test(value)) return "GK";
  if (/right wing-back/.test(value)) return "WBR";
  if (/left wing-back/.test(value)) return "WBL";
  if (/wing-back/.test(value)) return "WB";
  if (/right-back|right back/.test(value)) return "DR";
  if (/left-back|left back/.test(value)) return "DL";
  if (/centre-back|center-back|central defender/.test(value)) return "DC";
  if (/full-back|full back/.test(value)) return "FB";
  if (/defensive midfielder|holding midfielder/.test(value)) return "DM";
  if (/right midfielder/.test(value)) return "MR";
  if (/left midfielder/.test(value)) return "ML";
  if (/wide midfielder/.test(value)) return "WM";
  if (/right winger/.test(value)) return "AMR";
  if (/left winger/.test(value)) return "AML";
  if (/attacking midfielder/.test(value)) return "AMC";
  if (/central midfielder|centre midfielder|wing half/.test(value)) return "MC";
  if (/second striker/.test(value)) return "SS";
  if (/centre-forward|center-forward|striker|forward/.test(value)) return "ST";
  if (/winger/.test(value)) return "AM";
  if (/midfielder/.test(value)) return "MC";
  if (/sweeper/.test(value)) return "SW";
  if (/defender/.test(value)) return "DC";
  return null;
}

function compactPositionCodes(positionIds, positionEntities) {
  let codes = [...new Set(positionIds
    .map((positionId) => positionCode(positionEntities[positionId]?.labels?.en?.value, positionId))
    .filter(Boolean))];

  const specificGroups = [
    { generic: "FB", specific: ["DR", "DL", "WBR", "WBL"] },
    { generic: "WB", specific: ["WBR", "WBL"] },
    { generic: "MC", specific: ["DM", "MR", "ML", "AMC", "AMR", "AML"] },
    { generic: "WM", specific: ["MR", "ML"] },
    { generic: "AM", specific: ["AMC", "AMR", "AML"] },
    { generic: "ST", specific: ["SS"] },
  ];
  for (const { generic, specific } of specificGroups) {
    if (specific.some((code) => codes.includes(code))) codes = codes.filter((code) => code !== generic);
  }
  return codes.slice(0, 2).join(" / ") || null;
}

async function enrichPlayerDetails(transfers) {
  const withPages = transfers.filter((transfer) => transfer.playerUrl);
  if (!withPages.length) return transfers;

  const titles = withPages.map((transfer) => wikipediaTitle(transfer.playerUrl));
  const pageMetadata = await wikipediaPageMetadata(titles);
  const qids = [...new Set([...pageMetadata.values()].map((page) => page.qid).filter(Boolean))];
  const entities = await wikidataEntities(qids);
  const positionIds = [...new Set(qids.flatMap((qid) => claimIds(entities[qid], "P413")))];
  const positionEntities = await wikidataEntities(positionIds, "labels");

  for (let index = 0; index < withPages.length; index += 1) {
    const transfer = withPages[index];
    const qid = pageMetadata.get(titles[index]?.toLowerCase())?.qid;
    const entity = entities[qid];
    if (!entity) continue;

    const birthTime = entity?.claims?.P569?.[0]?.mainsnak?.datavalue?.value?.time;
    const enrichedAge = ageAt(birthTime, transfer.date);
    const enrichedPosition = compactPositionCodes(claimIds(entity, "P413"), positionEntities);
    if (enrichedAge !== null) transfer.age = enrichedAge;
    if (enrichedPosition) transfer.position = enrichedPosition;

  }

  return transfers;
}

async function enrichClubCrests(transfers) {
  const titles = transfers.flatMap((transfer) => [
    wikipediaTitle(transfer.fromClubUrl),
    wikipediaTitle(transfer.toClubUrl),
  ]).filter(Boolean);
  if (!titles.length) return transfers;

  const pageMetadata = await wikipediaPageMetadata(titles, { includeThumbnail: true });
  for (const transfer of transfers) {
    const fromTitle = wikipediaTitle(transfer.fromClubUrl);
    const toTitle = wikipediaTitle(transfer.toClubUrl);
    transfer.fromClubCrest = pageMetadata.get(fromTitle?.toLowerCase())?.thumbnail || transfer.fromClubCrest || null;
    transfer.toClubCrest = pageMetadata.get(toTitle?.toLowerCase())?.thumbnail || transfer.toClubCrest || null;
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
    return items.filter(validateManualRumour).map((item) => {
      const record = {
        age: null,
        position: null,
        nationality: null,
        flagCode: null,
        flag: "",
        fromClub: "—",
        fromClubUrl: null,
        fromClubCrest: null,
        toClub: "—",
        toClubUrl: null,
        toClubCrest: null,
        fee: "—",
        status: "rumour",
        sourceAdapter: "manual",
        time: "—",
        ...item,
        id: item.id || createHash("sha1").update(`manual|${item.sourceUrl}`).digest("hex").slice(0, 14),
      };
      record.flagCode ||= flagCodeFromName(record.nationality);
      record.flag ||= flagFromName(record.nationality);
      return record;
    });
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

const LEGACY_POSITIONS = new Map([
  ["bramkarz", "GK"],
  ["środkowy obrońca", "DC"],
  ["boczny obrońca", "FB"],
  ["obrońca", "DC"],
  ["defensywny pomocnik", "DM"],
  ["ofensywny pomocnik", "AMC"],
  ["skrzydłowy", "AM"],
  ["pomocnik", "MC"],
  ["napastnik", "ST"],
  ["doniesienie", null],
]);

const LEGACY_NATIONALITIES = new Map([
  ["Anglia", "England"], ["Szkocja", "Scotland"], ["Walia", "Wales"],
  ["Irlandia Północna", "Northern Ireland"], ["Irlandia", "Republic of Ireland"],
  ["Wielka Brytania", "United Kingdom"], ["Niemcy", "Germany"], ["Francja", "France"],
  ["Hiszpania", "Spain"], ["Włochy", "Italy"], ["Holandia", "Netherlands"],
  ["Szwecja", "Sweden"], ["Brazylia", "Brazil"], ["Argentyna", "Argentina"],
  ["Portugalia", "Portugal"], ["Chorwacja", "Croatia"], ["Polska", "Poland"],
  ["Belgia", "Belgium"], ["Dania", "Denmark"], ["Norwegia", "Norway"],
  ["Szwajcaria", "Switzerland"], ["Stany Zjednoczone", "United States"],
  ["Wybrzeże Kości Słoniowej", "Ivory Coast"],
]);

function normaliseStoredTransfer(transfer) {
  const position = LEGACY_POSITIONS.has(transfer.position) ? LEGACY_POSITIONS.get(transfer.position) : transfer.position;
  const nationality = LEGACY_NATIONALITIES.get(transfer.nationality) || transfer.nationality || null;
  const fee = String(transfer.fee ?? "")
    .replace(/^nieujawniona$/i, "Undisclosed")
    .replace(/^bez odstępnego$/i, "Free")
    .replace(/^wypożyczenie$/i, "Loan") || "—";
  return {
    ...transfer,
    position: position || null,
    nationality,
    flagCode: transfer.flagCode || flagCodeFromName(nationality),
    flag: transfer.flag || flagFromName(nationality),
    fee,
    fromClubUrl: transfer.fromClubUrl || null,
    fromClubCrest: transfer.fromClubCrest || null,
    toClubUrl: transfer.toClubUrl || null,
    toClubCrest: transfer.toClubCrest || null,
  };
}

function carryPreviousEnrichment(transfers, previousTransfers) {
  const previousById = new Map(previousTransfers.map((transfer) => [transfer.id, transfer]));
  for (const transfer of transfers) {
    const previous = previousById.get(transfer.id);
    if (!previous) continue;
    for (const field of ["age", "position", "fromClubCrest", "toClubCrest"]) {
      if (!transfer[field] && previous[field]) transfer[field] = previous[field];
    }
  }
  return transfers;
}

export async function refresh() {
  const generatedAt = new Date().toISOString();
  const sourceReports = [];
  let previousTransfers = [];
  try {
    const previous = JSON.parse(await readFile(OUTPUT_URL, "utf8"));
    previousTransfers = Array.isArray(previous.transfers) ? previous.transfers.map(normaliseStoredTransfer) : [];
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
    carryPreviousEnrichment(official, previousTransfers);
    try {
      await enrichClubCrests(official);
    } catch (error) {
      console.warn(`Club crest enrichment skipped: ${error.message}`);
    }
    try {
      await enrichPlayerDetails(official);
    } catch (error) {
      console.warn(`Player detail enrichment skipped: ${error.message}`);
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
    throw new Error("No source returned entries; the previous data file was left unchanged");
  }

  const payload = { generatedAt, sources: sourceReports, transfers };
  await writeFile(OUTPUT_URL, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  const officialCount = transfers.filter((transfer) => transfer.status === "official").length;
  const rumourCount = transfers.filter((transfer) => transfer.status === "rumour").length;
  console.log(`Saved ${transfers.length} entries (${officialCount} official, ${rumourCount} rumours).`);
  return payload;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(`file://${process.argv[1]}`));
if (isMain) {
  refresh().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
