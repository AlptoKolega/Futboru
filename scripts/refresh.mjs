import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

export const WIKIPEDIA_SOURCES = [
  {
    id: "wikipedia-england",
    label: "England transfer register",
    url: "https://en.wikipedia.org/wiki/List_of_English_football_transfers_summer_2026",
    country: "England",
    competition: "English leagues",
    competitionGender: "men",
    parser: "dated",
  },
  {
    id: "wikipedia-germany",
    label: "Germany transfer register",
    url: "https://en.wikipedia.org/wiki/List_of_German_football_transfers_summer_2026",
    country: "Germany",
    competitionGender: "men",
    parser: "clubs",
  },
  {
    id: "wikipedia-italy",
    label: "Italy transfer register",
    url: "https://en.wikipedia.org/wiki/List_of_Italian_football_transfers_summer_2026",
    country: "Italy",
    competition: "Serie A / Serie B",
    competitionGender: "men",
    parser: "dated",
  },
  {
    id: "wikipedia-france",
    label: "France transfer register",
    url: "https://en.wikipedia.org/wiki/List_of_French_football_transfers_summer_2026",
    country: "France",
    competitionGender: "men",
    parser: "clubs",
  },
  {
    id: "wikipedia-netherlands",
    label: "Netherlands transfer register",
    url: "https://en.wikipedia.org/wiki/List_of_Dutch_football_transfers_summer_2026",
    country: "Netherlands",
    competitionGender: "men",
    parser: "clubs",
  },
  {
    id: "wikipedia-poland",
    label: "Poland transfer register",
    url: "https://en.wikipedia.org/wiki/List_of_Polish_football_transfers_summer_2026",
    country: "Poland",
    competitionGender: "men",
    parser: "clubs",
  },
];

export const WIKIPEDIA_URL = WIKIPEDIA_SOURCES[0].url;
export const BBC_RSS_URL = "https://feeds.bbci.co.uk/sport/football/rss.xml";

export const RSS_SOURCES = [
  {
    id: "bbc-rss",
    label: "BBC Sport",
    url: BBC_RSS_URL,
    market: "United Kingdom",
    pattern: /\b(rumou?r|transfer|linked|target|bid|interest(?:ed)?|talks|set to|close to|poised|could join|agrees? (?:a )?deal)\b/i,
    stripPrefix: /^Football transfer (?:rumours|news):?\s*/i,
    maxItems: 8,
  },
  {
    id: "transfermarkt-de-rss",
    label: "Transfermarkt DE",
    url: "https://www.transfermarkt.de/rss/news",
    market: "Germany",
    sourceRole: "database",
    pattern: /\b(transfer|wechsel|wechselt|verpflicht\w*|leihe|ausleih\w*|verleih\w*|abgang|zugang|einig|interess\w*|deal|unterschrift)\b/i,
    excludePattern: /WM-Blog|verstorben|gestorben/i,
    maxItems: 6,
  },
  {
    id: "transfermarkt-uk-rss",
    label: "Transfermarkt UK",
    url: "https://www.transfermarkt.co.uk/rss/news",
    market: "United Kingdom",
    sourceRole: "database",
    pattern: /\b(rumou?r|transfers?|linked|target\w*|bid|interest(?:ed)?|talks|set to|close to|poised|agrees? (?:a )?deal|sign(?:s|ed|ing)?|join(?:s|ed|ing)?|move)\b/i,
    excludePattern: /transfer news live|transfer window .*all deals/i,
    descriptionFallback: "uk-completed-move",
    maxItems: 6,
  },
  {
    id: "transfermarkt-it-rss",
    label: "Transfermarkt IT",
    url: "https://www.transfermarkt.it/rss/news",
    market: "Italy",
    sourceRole: "database",
    pattern: /\b(calciomercato|trasfer\w*|ufficiale|prestito|acquist\w*|cedut\w*|accordo|trattativ\w*|firma\w*)\b/i,
    excludePattern: /formazioni|convocati|talenti|profili/i,
    maxItems: 6,
  },
  {
    id: "transfermarkt-es-rss",
    label: "Transfermarkt ES",
    url: "https://www.transfermarkt.es/rss/news",
    market: "Spain",
    sourceRole: "database",
    pattern: /\b(fichaje\w*|traspas\w*|cesi[oó]n|transfers?|transferencias?|acuerdo|firma\w*)\b|a un paso|se muda/i,
    excludePattern: /valores? de mercado|m[aá]s valios|Mundial|Golden Boy/i,
    maxItems: 6,
  },
  {
    id: "transfermarkt-nl-rss",
    label: "Transfermarkt NL",
    url: "https://www.transfermarkt.nl/rss/news",
    market: "Netherlands",
    sourceRole: "database",
    pattern: /\b(transfers?|vertrek\w*|vertrekt|tekent|huur\w*|aantrekken|versterk\w*|overstap|haalt|verruilt)\b/i,
    excludePattern: /op Transfermarkt|meest waardevolle|WK|ranglijst/i,
    excludeOverridePattern: /\bhaalt\b.+\bbinnen\b/i,
    maxItems: 6,
  },
  {
    id: "transfermarkt-pl-rss",
    label: "Transfermarkt PL",
    url: "https://www.transfermarkt.pl/rss/news",
    market: "Poland",
    sourceRole: "database",
    pattern: /\b(transfer(?:y|u|em|[oó]w|owy|owe|owa|ze|ach)?|przechod\w*|podpis\w*|wypo[zż]ycz\w*|zainteres\w*|oficjalnie|pozyska\w*|sprzed\w*|kup\w*)\b|ostatniej prostej|\bza \d+(?:[.,]\d+)? (?:mln|milion)/i,
    excludePattern: /ranking|Top \d+|najdro[zż]szych/i,
    maxItems: 6,
  },
  {
    id: "transfermarkt-pt-rss",
    label: "Transfermarkt PT",
    url: "https://www.transfermarkt.pt/rss/news",
    market: "Portugal",
    sourceRole: "database",
    pattern: /\b(transfer[eê]ncias?|contrata\w*|refor[cç](?:o\w*|a)|empr[eé]stimo|acordo|assina\w*)\b/i,
    excludePattern: /[uú]ltimas do mercado|valores? de mercado|Mundial|Golden Boy|vendas dos jogadores/i,
    maxItems: 6,
  },
  {
    id: "sportschau-rss",
    label: "Sportschau",
    url: "https://www.sportschau.de/fussball/bundesliga/index~rss2.xml",
    market: "Germany",
    competitionGender: "men",
    pattern: /\b(transfer\w*|wechsel\w*|verpflicht\w*|leihe|ausleih\w*|abgang|zugang|einig|interess\w*)\b/i,
    excludePattern: /wechselb[oö]rse|[uü]bersicht der sommertransfers|transfer-ziele .* noch/i,
  },
  {
    id: "tmw-rss",
    label: "TuttomercatoWeb",
    url: "https://www.tuttomercatoweb.com/rss/",
    market: "Italy",
    pattern: /\b(calciomercato|trasfer\w*|ufficiale|prestito|acquist\w*|cedut\w*|accordo|trattativ\w*)\b/i,
    excludePattern: /calciomercato no stop|indiscrezioni|retroscena/i,
  },
  {
    id: "marca-rss",
    label: "Marca",
    url: "https://e00-marca.uecdn.es/rss/futbol/primera-division.xml",
    market: "Spain",
    competitionGender: "men",
    pattern: /\b(fichaje\w*|traspas\w*|cesi[oó]n|transfer\w*|acuerdo|firma\w*)\b|a un paso/i,
    excludePattern: /tres fichajes .* van a venir/i,
  },
  {
    id: "rmc-rss",
    label: "RMC Sport",
    url: "https://rmcsport.bfmtv.com/rss/football/",
    market: "France",
    pattern: /\b(mercato|transfert\w*|pr[eê]t|recrut\w*|signe\w*|piste|cible)\b/i,
  },
  {
    id: "vi-rss",
    label: "Voetbal International",
    url: "https://www.vi.nl/feed/news.xml",
    market: "Netherlands",
    pattern: /\b(transfer\w*|vertrek\w*|vertrekt|tekent|huur\w*|aantrekken|versterk\w*|overstap)\b/i,
    excludePattern: /alle clubs op een rij|vindt .*versterking|volgende versterking|overstap .*maakt|geen transfers|maakt transfer naar/i,
  },
  {
    id: "weszlo-rss",
    label: "Weszło",
    url: "https://weszlo.com/feed/",
    market: "Poland",
    pattern: /\b(transfer\w*|przechod\w*|podpis\w*|wypo[zż]ycz\w*|zainteres\w*|oficjalnie|pozyska\w*)\b|ostatniej prostej/i,
  },
  {
    id: "guardian-rss",
    label: "The Guardian",
    url: "https://www.theguardian.com/football/rss",
    market: "United Kingdom",
    pattern: /\b(rumou?r|transfer\w*|linked|target\w*|bid|interest(?:ed)?|talks|set to|close to|poised|agrees? (?:a )?deal|sign(?:s|ed|ing)|move)\b/i,
    excludePattern: /newsletter|sign up|transfer window .*all deals/i,
  },
  {
    id: "maisfutebol-rss",
    label: "MaisFutebol",
    url: "https://maisfutebol.iol.pt/rss",
    market: "Portugal",
    pattern: /\b(mercado|transfer\w*|contrata\w*|refor[cç]o\w*|empr[eé]stimo|acordo|assina\w*)\b/i,
  },
  {
    id: "ge-rss",
    label: "ge",
    url: "https://ge.globo.com/rss/ge/",
    market: "Brazil",
    pattern: /\b(mercado|transfer\w*|contrata\w*|refor[cç]o\w*|empr[eé]stimo|acordo|assina\w*|negocia\w*)\b/i,
    excludePattern: /ganha refor[cç]os .* contra/i,
    linkPattern: /\/futebol\//i,
  },
];

const OUTPUT_URL = new URL("../data/transfers.json", import.meta.url);
const MANUAL_RUMOURS_URL = new URL("../data/manual-rumours.json", import.meta.url);
const TRANSFERMARKT_BACKFILL_URL = new URL("../data/transfermarkt-news-backfill.json", import.meta.url);
const CURATED_OFFICIAL_SOURCES_URL = new URL("../data/official-sources.json", import.meta.url);
const CURATED_PLAYER_METADATA_URL = new URL("../data/player-metadata.json", import.meta.url);
const PREVIOUS_DEPLOYED_DATA_URL = process.env.PREVIOUS_DEPLOYED_DATA_URL || "";
const USER_AGENT = "Futboru/0.1 (+https://github.com/AlptoKolega/Futboru; public transfer-feed PoC)";
const LOOKBACK_DAYS = Number(process.env.LOOKBACK_DAYS || 14);
const TRANSFER_WINDOW_START = process.env.TRANSFER_WINDOW_START || "2026-07-01";
const MAX_OFFICIAL = Number(process.env.MAX_OFFICIAL || 300);
const MAX_OFFICIAL_PER_MARKET = Number(process.env.MAX_OFFICIAL_PER_MARKET || 60);
const MAX_RUMOURS = Number(process.env.MAX_RUMOURS || 48);
const MAX_RUMOURS_PER_SOURCE = Number(process.env.MAX_RUMOURS_PER_SOURCE || 4);
const MAX_SOURCE_PREVIEWS_PER_REFRESH = Number(process.env.MAX_SOURCE_PREVIEWS_PER_REFRESH || 24);
const SOURCE_PREVIEW_CONCURRENCY = Number(process.env.SOURCE_PREVIEW_CONCURRENCY || 4);
const SOURCE_PREVIEW_TIMEOUT_MS = Number(process.env.SOURCE_PREVIEW_TIMEOUT_MS || 8_000);
const SOURCE_PREVIEW_HEAD_BYTES = Number(process.env.SOURCE_PREVIEW_HEAD_BYTES || 196_608);
const SOURCE_PREVIEW_RETRY_HOURS = Number(process.env.SOURCE_PREVIEW_RETRY_HOURS || 24 * 7);
const COMPETITION_GENDERS = new Set(["men", "women", "unknown"]);

function normaliseCompetitionGender(value) {
  return COMPETITION_GENDERS.has(value) ? value : "unknown";
}

const COUNTRY_FLAG_CODES = new Map([
  ["albania", "al"], ["algeria", "dz"], ["argentina", "ar"], ["australia", "au"],
  ["austria", "at"], ["belgium", "be"], ["bosnia and herzegovina", "ba"], ["bosnia & herzegovina", "ba"],
  ["brazil", "br"], ["bulgaria", "bg"], ["cameroon", "cm"], ["canada", "ca"], ["chile", "cl"],
  ["colombia", "co"], ["comoros", "km"], ["costa rica", "cr"], ["croatia", "hr"], ["curacao", "cw"],
  ["cyprus", "cy"], ["czech republic", "cz"], ["czechia", "cz"], ["denmark", "dk"], ["ecuador", "ec"],
  ["england", "gb-eng"], ["estonia", "ee"], ["finland", "fi"], ["france", "fr"], ["gabon", "ga"],
  ["gambia", "gm"], ["the gambia", "gm"], ["georgia", "ge"], ["germany", "de"], ["ghana", "gh"],
  ["greece", "gr"], ["guyana", "gy"], ["guinea", "gn"], ["hungary", "hu"], ["iceland", "is"],
  ["indonesia", "id"], ["iran", "ir"], ["ireland", "ie"], ["republic of ireland", "ie"],
  ["israel", "il"], ["italy", "it"],
  ["ivory coast", "ci"], ["cote d'ivoire", "ci"], ["jamaica", "jm"], ["japan", "jp"], ["kenya", "ke"],
  ["kosovo", "xk"], ["mali", "ml"], ["mexico", "mx"], ["morocco", "ma"], ["netherlands", "nl"],
  ["new zealand", "nz"], ["nigeria", "ng"], ["north macedonia", "mk"], ["northern ireland", "gb-nir"],
  ["norway", "no"], ["paraguay", "py"], ["peru", "pe"], ["poland", "pl"], ["portugal", "pt"],
  ["romania", "ro"], ["russia", "ru"], ["scotland", "gb-sct"], ["senegal", "sn"],
  ["serbia", "rs"], ["sierra leone", "sl"],
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
  ["luxembourg", "lu"], ["suriname", "sr"], ["syria", "sy"], ["montenegro", "me"],
  ["angola", "ao"], ["benin", "bj"], ["martinique", "mq"], ["sri lanka", "lk"],
  ["armenia", "am"], ["saudi arabia", "sa"], ["burkina faso", "bf"], ["bonaire", "bq"],
  ["honduras", "hn"], ["madagascar", "mg"], ["azerbaijan", "az"], ["belarus", "by"],
  ["cuba", "cu"], ["grenada", "gd"], ["burundi", "bi"], ["montserrat", "ms"],
  ["lithuania", "lt"], ["latvia", "lv"], ["guadeloupe", "gp"], ["malta", "mt"],
  ["ulster banner", "gb-nir"], ["guinea bissau", "gw"],
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
  const rollingCutoff = new Date(now);
  rollingCutoff.setUTCDate(rollingCutoff.getUTCDate() - LOOKBACK_DAYS);
  const windowCutoff = new Date(`${TRANSFER_WINDOW_START}T00:00:00Z`);
  const usesCurrentWindow = !Number.isNaN(windowCutoff.getTime())
    && windowCutoff.getUTCFullYear() === now.getUTCFullYear()
    && windowCutoff <= now;
  const cutoff = usesCurrentWindow ? windowCutoff : rollingCutoff;
  return date >= cutoff && date <= new Date(now.getTime() + 86_400_000);
}

function normaliseCountryName(name) {
  return cleanText(name)
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/^(?:war )?flag of (?:the )?/, "")
    .replace(/^the /, "")
    .replace(/\s*\([^)]*\)$/, "")
    .replace(/\s+/g, " ")
    .trim();
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
      "bundesliga.com": "Bundesliga",
      "e00-marca.uecdn.es": "Marca",
      "ekstraklasa.org": "Ekstraklasa",
      "feeds.bbci.co.uk": "BBC Sport",
      "ge.globo.com": "ge",
      "legaseriea.it": "Lega Serie A",
      "maisfutebol.iol.pt": "MaisFutebol",
      "marca.com": "Marca",
      "premierleague.com": "Premier League",
      "rmcsport.bfmtv.com": "RMC Sport",
      "sportschau.de": "Sportschau",
      "theguardian.com": "The Guardian",
      "transfermarkt.de": "Transfermarkt DE",
      "tuttomercatoweb.com": "TuttomercatoWeb",
      "vi.nl": "Voetbal International",
      "weszlo.com": "Weszło",
      "arsenal.com": "Arsenal.com",
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

function referenceIndex($) {
  const references = new Map();
  $('[id^="cite_note-"]').each((_, element) => {
    references.set($(element).attr("id"), $(element));
  });
  return references;
}

function firstReference($, container, references = referenceIndex($)) {
  let fallback = null;
  const hrefs = container.find('sup.reference a[href^="#"]')
    .map((_, anchor) => $(anchor).attr("href"))
    .get();

  for (const href of hrefs) {
    const id = decodeURIComponent(href.slice(1));
    const reference = references.get(id);
    if (!reference?.length) continue;

    const external = reference
      .find('cite.citation a.external[href^="http"], a.external[href^="http"], a[rel~="mw:ExtLink"][href^="http"]')
      .first();
    const coins = new URLSearchParams(
      String(reference.find(".Z3988").first().attr("title") || "").replaceAll("&amp;", "&"),
    );
    const rawDate = coins.get("rft.date");
    const date = /^\d{4}-\d{2}-\d{2}/.test(rawDate || "")
      ? rawDate.slice(0, 10)
      : isoDate(rawDate);
    const metadata = {
      url: coins.get("rft_id") || external.attr("href") || null,
      title: cleanText(coins.get("rft.atitle") || reference.text()),
      publication: cleanText(coins.get("rft.jtitle")),
      date,
    };
    fallback ||= metadata;
    if (metadata.url) return metadata;
  }

  return fallback;
}

function statusFromReference(reference) {
  if (!reference) return "official";
  const uncertainty = /\b(set (?:for|to)|close to|poised to|expected to|in talks|target(?:s|ing)?|linked|bid for|could join|agrees? (?:a )?deal)\b/i;
  return uncertainty.test(reference.title) ? "rumour" : "official";
}

function sourceRole(url) {
  if (!url) return "aggregator";
  let hostname = "";
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "publication";
  }
  if (hostname.includes("transfermarkt.")) return "database";
  if (hostname.includes("wikipedia.org")) return "aggregator";
  const socialDomains = [
    "facebook.com", "fb.com", "instagram.com", "threads.net", "tiktok.com",
    "twitter.com", "x.com", "youtube.com", "youtu.be",
  ];
  if (socialDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) return "community";
  const publicationDomains = [
    "bbc.", "theguardian.", "marca.", "sportschau.", "rmcsport.", "footmercato.",
    "tuttomercatoweb.", "vi.nl", "voetbalprimeur.", "weszlo.", "meczyki.",
    "skysports.", "espn.", "reuters.", "lequipe.", "kicker.", "globo.",
  ];
  if (publicationDomains.some((domain) => hostname.includes(domain))) return "publication";
  return "publication";
}

function sourceEvidence(name, url, role = sourceRole(url)) {
  return { name, url, role };
}

function countryFromFlag($, container) {
  const flagImage = container.find(".flagicon img, img").first();
  if (!flagImage.length) return null;
  const resource = String(flagImage.attr("resource") || "");
  let resourceName = "";
  if (resource.includes("File:")) {
    try {
      resourceName = decodeURIComponent(resource.split("File:").pop())
        .replace(/\.(?:svg|png)$/i, "")
        .replaceAll("_", " ");
    } catch {
      resourceName = resource.split("File:").pop().replace(/\.(?:svg|png)$/i, "").replaceAll("_", " ");
    }
  }
  let country = cleanText(
    flagImage.attr("alt")
    || flagImage.closest("a").attr("title")
    || flagImage.attr("title")
    || resourceName,
  );
  country = country
    .replace(/[-_]/g, " ")
    .replace(/^(?:War )?Flag of (?:the )?/i, "")
    .replace(/\s*\([^)]*\)$/, "")
    .trim();
  if (/^Ulster Banner$/i.test(country)) return "Northern Ireland";
  return country || null;
}

function transferId(date, player, fromClub, toClub) {
  return createHash("sha1")
    .update(`${date}|${player}|${fromClub}|${toClub}`)
    .digest("hex")
    .slice(0, 14);
}

function datedTransferTable($) {
  return $("table.wikitable").filter((_, table) => {
    const headers = $(table).find("tr").first().children("th, td")
      .map((__, cell) => cleanText($(cell).text()).toLowerCase())
      .get();
    return headers[0] === "date"
      && headers.some((header) => header === "player" || header === "name")
      && headers.some((header) => header === "moving from" || header === "from")
      && headers.some((header) => header === "moving to" || header === "to")
      && headers.includes("fee");
  }).first();
}

export function parseWikipediaDatedTransfers(html, config = WIKIPEDIA_SOURCES[0], now = new Date()) {
  const $ = cheerio.load(html);
  const table = datedTransferTable($);
  if (!table.length) throw new Error("Wikipedia: transfer table not found");

  const references = referenceIndex($);
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

    const country = countryFromFlag($, playerCell) || (!playerAnchor ? config.country : null);
    const reference = firstReference($, feeCell, references) || firstReference($, $(row), references);
    const sourceUrl = reference?.url || config.url;
    const sourceName = sourceLabel(sourceUrl);
    const role = sourceRole(sourceUrl);
    const fromClub = cleanText(fromCell.text());
    const toClub = cleanText(toCell.text());
    const fee = cleanText(feeCell.clone().children("sup").remove().end().text()) || "Undisclosed";

    transfers.push({
      id: transferId(currentDate, player, fromClub, toClub),
      date: currentDate,
      time: "—",
      player,
      playerUrl: absoluteWikipediaUrl(playerAnchor ? $(playerAnchor).attr("href") : null),
      age: null,
      position: null,
      nationality: country,
      flagCode: flagCodeFromName(country),
      flag: flagFromName(country),
      fromClub,
      fromClubUrl: absoluteWikipediaUrl(fromClubAnchor ? $(fromClubAnchor).attr("href") : null),
      fromClubCrest: null,
      toClub,
      toClubUrl: absoluteWikipediaUrl(toClubAnchor ? $(toClubAnchor).attr("href") : null),
      toClubCrest: null,
      fee,
      status: statusFromReference(reference),
      market: config.country,
      markets: [config.country],
      competition: config.competition || null,
      competitionGender: normaliseCompetitionGender(config.competitionGender),
      competitionGenderSource: normaliseCompetitionGender(config.competitionGender) !== "unknown" ? "source-register" : null,
      sourceAdapter: config.id,
      sourceRole: role,
      sourceName,
      sourceUrl,
      sources: [sourceEvidence(sourceName, sourceUrl, role)],
      firstSeenAt: `${currentDate}T12:00:00.000Z`,
    });
  });

  return transfers;
}

function movementClubLink($, playerCell) {
  return playerCell.find("i a").toArray().find((anchor) => (
    !$(anchor).closest(".flagicon").length && cleanText($(anchor).text())
  ));
}

function movementClubName(value) {
  return cleanText(value)
    .replace(/^\(|\)$/g, "")
    .replace(/^(?:on loan |loan return )?(?:from|to)\s+/i, "")
    .replace(/,\s*(?:previously|currently|formerly).*$/i, "")
    .trim();
}

function feeFromMovement(value) {
  const movement = cleanText(value).toLowerCase();
  if (/^\(loan return\b/.test(movement)) return "Loan return";
  if (/^\((?:on )?loan\b/.test(movement)) return "Loan";
  if (/\b(free agent|without a club|without club|out of contract|released)\b/.test(movement)) return "Free";
  if (/\b(retired|retirement)\b/.test(movement)) return "—";
  return "Undisclosed";
}

function clubHeadingUrl($, heading) {
  const link = heading.find("a[rel~='mw:WikiLink']").first().attr("href");
  if (link) return absoluteWikipediaUrl(link);
  const id = heading.find("h3").first().attr("id");
  return id ? absoluteWikipediaUrl(`./${id}`) : null;
}

export function parseWikipediaClubTransfers(html, config, now = new Date()) {
  const $ = cheerio.load(html);
  const clubSections = $("section").filter((_, section) => (
    $(section).find(":scope > .mw-heading3 h3").length
    && $(section).find("table.wikitable.football-squad").length
  ));
  if (!clubSections.length) throw new Error("Wikipedia: club transfer tables not found");

  const references = referenceIndex($);
  const transfers = [];

  clubSections.each((_, section) => {
    const clubSection = $(section);
    const heading = clubSection.find(":scope > .mw-heading3").first();
    const clubName = cleanText(heading.find("h3").first().text());
    if (!clubName) return;
    const clubUrl = clubHeadingUrl($, heading);
    const leagueSection = clubSection.parents("section").first();
    const competition = cleanText(leagueSection.find(":scope > .mw-heading2 h2").first().text()) || null;

    clubSection.find("table.wikitable.football-squad").each((tableIndex, table) => {
      const incoming = tableIndex === 0;
      $(table).find("tr").each((__, row) => {
        const cells = $(row).children("td");
        if (cells.length < 4) return;
        const playerCell = $(cells[cells.length - 1]);
        const playerAnchor = playerCell.find(".fn a[rel~='mw:WikiLink'], .fn a[href]").first();
        const player = cleanText(playerAnchor.text() || playerCell.clone().children("i, sup").remove().end().text());
        if (!player) return;

        const reference = firstReference($, playerCell, references);
        const date = reference?.date;
        if (!date || !inLookback(date, now)) return;

        const movement = cleanText(playerCell.find("i").first().text());
        const otherClubAnchor = movementClubLink($, playerCell);
        const otherClub = cleanText(otherClubAnchor ? $(otherClubAnchor).text() : movementClubName(movement));
        if (!otherClub) return;
        const otherClubUrl = absoluteWikipediaUrl(otherClubAnchor ? $(otherClubAnchor).attr("href") : null);
        const fromClub = incoming ? otherClub : clubName;
        const toClub = incoming ? clubName : otherClub;
        const sourceUrl = reference?.url || config.url;
        const sourceName = sourceLabel(sourceUrl);
        const role = sourceRole(sourceUrl);
        const country = countryFromFlag($, $(cells[cells.length - 2]));
        const rawPosition = cleanText($(cells[1]).find("abbr").attr("title") || $(cells[1]).text());
        const shortPosition = ({ GK: "GK", DF: "DC", MF: "MC", FW: "ST" })[cleanText($(cells[1]).text())]
          || positionCode(rawPosition);

        transfers.push({
          id: transferId(date, player, fromClub, toClub),
          date,
          time: "—",
          player,
          playerUrl: absoluteWikipediaUrl(playerAnchor.attr("href")),
          age: null,
          position: shortPosition,
          nationality: country,
          flagCode: flagCodeFromName(country),
          flag: flagFromName(country),
          fromClub,
          fromClubUrl: incoming ? otherClubUrl : clubUrl,
          fromClubCrest: null,
          toClub,
          toClubUrl: incoming ? clubUrl : otherClubUrl,
          toClubCrest: null,
          fee: feeFromMovement(movement),
          status: statusFromReference(reference),
          market: config.country,
          markets: [config.country],
          competition,
          competitionGender: normaliseCompetitionGender(config.competitionGender),
          competitionGenderSource: normaliseCompetitionGender(config.competitionGender) !== "unknown" ? "source-register" : null,
          sourceAdapter: config.id,
          sourceRole: role,
          sourceName,
          sourceUrl,
          sources: [sourceEvidence(sourceName, sourceUrl, role)],
          firstSeenAt: `${date}T12:00:00.000Z`,
        });
      });
    });
  });

  return transfers;
}

export function parseWikipediaTransfers(html, now = new Date()) {
  return parseWikipediaDatedTransfers(html, WIKIPEDIA_SOURCES[0], now);
}

const RUMOUR_CLUB_ALIASES = new Map([
  ["barca", "Barcelona"],
  ["barcelona", "Barcelona"],
  ["besiktas", "Beşiktaş"],
  ["besitkas", "Beşiktaş"],
  ["celta", "Celta Vigo"],
  ["fenerbahce", "Fenerbahçe"],
  ["lazio rom", "Lazio"],
  ["leeds", "Leeds United"],
  ["man city", "Manchester City"],
  ["man utd", "Manchester United"],
  ["new york city", "New York City FC"],
  ["om", "Marseille"],
  ["olympique de marseille", "Marseille"],
]);

const RUMOUR_PLAYER_ALIAS_RULES = [
  { key: "adeyemi", name: "Karim Adeyemi", toClub: "Barcelona" },
  { key: "doekhi", name: "Danilho Doekhi", toClub: "Lazio" },
  { key: "greenwood", name: "Mason Greenwood", fromClub: "Marseille", toClub: "Fenerbahçe" },
  { key: "muharemovic", name: "Tarik Muharemović", toClub: "Leeds United" },
  { key: "ter stegen", name: "Marc-André ter Stegen", fromClub: "Barcelona", toClub: "Ajax" },
];

const AMBIGUOUS_RUMOUR_PLAYER_KEYS = new Set(["greenwood"]);

function trimRumourEntity(value) {
  return cleanText(value)
    .replace(/^["'“”‘’„]+|["'“”‘’„:,.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normaliseRumourPlayer(value) {
  return trimRumourEntity(value)
    .replace(/^(?:atacante|zagueiro|goleiro|meio-campista|lateral|forward|midfielder|defender)\s+/i, "")
    .replace(/\s+(?:por|for)\s+[£€$]?\d.*$/i, "")
    .trim() || null;
}

function normaliseRumourClub(value) {
  const club = trimRumourEntity(value)
    .replace(/^l['’]\s*/i, "")
    .replace(/^(?:the|el|o|a|le|der|die|das)\s+/i, "")
    .trim();
  return RUMOUR_CLUB_ALIASES.get(canonicalIdentity(club)) || club || null;
}

function rumourPlayerKey(value) {
  const key = canonicalIdentity(value);
  const alias = RUMOUR_PLAYER_ALIAS_RULES.find((rule) => (
    rule.key === key || canonicalIdentity(rule.name) === key
  ));
  return alias?.key || key;
}

function resolveRumourPlayerAlias(player, fromClub, toClub) {
  const key = rumourPlayerKey(player);
  const alias = RUMOUR_PLAYER_ALIAS_RULES.find((rule) => (
    rule.key === key
    && (!rule.fromClub || canonicalIdentity(rule.fromClub) === canonicalIdentity(fromClub))
    && (!rule.toClub || canonicalIdentity(rule.toClub) === canonicalIdentity(toClub))
  ));
  return alias?.name || player;
}

function normaliseRumourFee(value, fallback = "—") {
  const fee = trimRumourEntity(value);
  if (!fee) return fallback;

  const euroMillions = fee.match(/(\d+(?:[.,]\d+)?)\s+milh[oõ]es?\s+de\s+euros?/i);
  if (euroMillions) return `€${euroMillions[1].replace(",", ".")}m`;

  const polishEuroMillions = fee.match(/(\d+(?:[.,]\d+)?)\s+(?:mln|milion(?:a|[oó]w)?)\s+euro/i);
  if (polishEuroMillions) return `€${polishEuroMillions[1].replace(",", ".")}m`;

  const compact = fee.match(/([£€$])\s*(\d+(?:[.,]\d+)?)\s*(?:million|m)\b/i);
  if (compact) return `${compact[1]}${compact[2].replace(",", ".")}m`;
  return fallback;
}

const RUMOUR_CLAIM_RULES = [
  {
    markets: ["Portugal"],
    pattern: /^(?<player>[\p{L}\p{M}.'’ -]+?\s+[\p{L}\p{M}.'’ -]+?) [ée] refor[cç]o do (?<to>[^:]+):.*?por empr[eé]stimo do (?<from>.+)$/iu,
    fee: "Loan",
  },
  {
    markets: ["Portugal"],
    pattern: /^(?<player>[\p{L}\p{M}.'’ -]+?\s+[\p{L}\p{M}.'’ -]+?) refor[cç]a (?<to>.+?)(?:\s+e\b.*)?$/iu,
  },
  {
    markets: ["Portugal"],
    pattern: /^(?<player>[\p{L}\p{M}.'’-]+) refor[cç]a (?<to>.+?)(?:\s+e\b.*)?$/iu,
  },
  {
    markets: ["Brazil", "Portugal"],
    pattern: /^(?<from>.+?) negocia (?:o )?empr[eé]stimo de (?<player>.+?) para (?:o |a )?(?<to>.+)$/iu,
    fee: "Loan",
  },
  {
    markets: ["Brazil", "Portugal"],
    pattern: /^(?<to>.+?) negocia (?:a )?contrata[cç][aã]o (?:d[oa] )?(?:(?:atacante|zagueiro|goleiro|meio-campista|lateral)\s+)?(?<player>.+?), que pertence (?:ao|à|a) (?<from>.+)$/iu,
  },
  {
    markets: ["Brazil", "Portugal"],
    pattern: /^(?:OFICIAL:\s*)?(?<to>.+?) contrata (?<player>.+?)(?: por (?<fee>\d+(?:[.,]\d+)?\s+milh[oõ]es?\s+de\s+euros?))?$/iu,
  },
  {
    markets: ["Brazil", "Portugal"],
    pattern: /^(?<to>.+?) encaminha contrata[cç][aã]o de (?<player>.+)$/iu,
  },
  {
    markets: ["France"],
    pattern: /^(?:DIRECT\.\s*)?(?:Mercato:\s*)?(?<to>.+?) officialise l['’]arriv[eé]e de (?<player>.+)$/iu,
  },
  {
    markets: ["France"],
    pattern: /^(?:Mercato:\s*)?(?:c['’]est officiel,\s*)?(?<from>(?:l['’])?.+?) vend (?<player>.+?)(?: (?:à|au) (?<to>.+?))?(?: et .*)?$/iu,
  },
  {
    markets: ["Germany"],
    pattern: /^(?![^:]+:\s*Ex-Profi\b)(?<from>[^:]+):\s*(?<player>[\p{L}\p{M}.'’ -]+?\s+[\p{L}\p{M}.'’ -]+?) wechselt(?:\s+nach\s+.+?)?\s+zu (?<to>.+)$/iu,
  },
  {
    markets: ["Germany"],
    pattern: /^(?<to>[^:]+):\s*(?<player>[\p{L}\p{M}.'’ -]+?\s+[\p{L}\p{M}.'’ -]+?) vom (?<from>.+?) vor Unterschrift(?:\s+[–—-].*)?$/iu,
  },
  {
    markets: ["Germany"],
    pattern: /^(?<to>.+?) arbeitet an (?:einer\s+)?Leihe von (?<from>[\p{L}\p{M}.'’ &-]+?)-(?:Innenverteidiger|Verteidiger|St[uü]rmer|Torh[uü]ter|Mittelfeldspieler) (?<player>[\p{L}\p{M}.'’ -]+?\s+[\p{L}\p{M}.'’ -]+)$/iu,
    fee: "Loan",
  },
  {
    markets: ["Germany"],
    pattern: /^(?<from>.+?) verleiht (?<player>[\p{L}\p{M}.'’ -]+?\s+[\p{L}\p{M}.'’ -]+?) an (?<to>.+?)(?:\s+in (?:die )?\d+\. Liga)?(?:\s+[–—-].*)?$/iu,
    fee: "Loan",
  },
  {
    markets: ["Germany"],
    pattern: /^(?<to>.+?) meldet (?<player>.+?)-(?:Deal|Transfer|Wechsel)(?:\s*[–—-].*)?$/iu,
  },
  {
    markets: ["Germany"],
    pattern: /^(?<to>.+?) vor (?<player>.+?)-(?:Transfer|Wechsel)(?:\s*[–—-].*)?$/iu,
  },
  {
    markets: ["Germany"],
    pattern: /^(?<to>.+?)-Pr[aä]sident .*? best[aä]tigt (?<player>.+?)-(?:Wechsel|Transfer)$/iu,
  },
  {
    markets: ["Germany"],
    pattern: /^(?<to>.+?) best[aä]tigt (?<player>.+?)-(?:Wechsel|Transfer)$/iu,
  },
  {
    markets: ["Germany"],
    pattern: /^(?<player>[\p{L}\p{M}.'’ -]+?) zu (?<to>.+?)(?:\s+[–—-]\s+.*)?$/u,
  },
  {
    markets: ["Netherlands"],
    pattern: /^(?<player>[\p{L}\p{M}.'’ -]+?\s+[\p{L}\p{M}.'’ -]+?) verruilt (?<from>.+?) voor (?<to>.+?)(?:\s+[–—-]\s+.*)?$/iu,
  },
  {
    markets: ["Netherlands"],
    pattern: /^(?<to>.+?) haalt (?<player>[\p{L}\p{M}.'’ -]+?\s+[\p{L}\p{M}.'’ -]+?) binnen(?:\s+[–—-]\s+.*)?$/iu,
  },
  {
    markets: ["Netherlands"],
    pattern: /^Transfers? (?<to>[^:]+):\s*['“]?(?<from>.+?) geeft groen licht voor transfer (?<player>.+?)['”]?$/iu,
  },
  {
    markets: ["United Kingdom"],
    pattern: /^(?<player>[\p{L}\p{M}.'’ -]+?\s+[\p{L}\p{M}.'’ -]+?) (?:is )?set to join (?<to>.+?) from (?<from>.+?)(?:\s+(?:in|for)\b.*)?(?:\s+[–—-]\s+.*)?$/iu,
  },
  {
    markets: ["United Kingdom"],
    pattern: /^(?<from>.+?) close to agreeing(?: .*?)? sale of (?<player>.+?) to (?<to>.+)$/iu,
  },
  {
    markets: ["United Kingdom"],
    pattern: /^(?<fee>[£€$]\s*\d+(?:[.,]\d+)?m)\s+package\s+[–—-]\s+(?<to>.+?)\s+signs?\s+(?<player>.+?)\s+from\s+(?<from>.+)$/iu,
  },
  {
    markets: ["United Kingdom"],
    pattern: /^(?<to>.+?) (?:signs?|agrees to sign) (?<player>.+?) from (?<from>.+)$/iu,
  },
  {
    markets: ["United Kingdom"],
    pattern: /^(?<player>.+?) joins (?<to>.+?) from (?<from>.+)$/iu,
  },
  {
    markets: ["United Kingdom"],
    pattern: /^(?<player>[\p{L}\p{M}.'’ -]+?\s+[\p{L}\p{M}.'’ -]+?) joins (?<to>.+?)(?: for (?<fee>[£€$]\s*\d+(?:[.,]\d+)?m)(?:\s+package)?)?(?:\s+as\b.*)?$/iu,
  },
  {
    markets: ["United Kingdom"],
    pattern: /^(?<player>[\p{L}\p{M}.'’ -]+?\s+[\p{L}\p{M}.'’ -]+?) has completed (?:his|her|their) move to (?<to>.+?) from (?<from>.+?)(?:\s+(?:with|after)\b|[.!?]|$)/iu,
  },
  {
    markets: ["United Kingdom"],
    pattern: /^(?<to>.+?) set sights on signing (?:[\p{L}-]+[’']s\s+)?(?<player>.+?)(?: for (?<fee>[£€$].+))?$/iu,
  },
  {
    markets: ["United Kingdom"],
    pattern: /^(?<to>.+?) linked with (?<player>.+)$/iu,
  },
  {
    markets: ["Spain"],
    pattern: /^(?<player>[\p{L}\p{M}.'’ -]+?\s+[\p{L}\p{M}.'’ -]+?) se muda (?:a|al|a la) (?<to>.+?)(?:\s+como\b.*)?(?:\s+[–—-]\s+.*)?$/iu,
  },
  {
    markets: ["Spain"],
    pattern: /^(?:El|La)\s+(?<from>.+?) a un paso de .*? (?:cesi[oó]n|traspaso) de (?<player>.+?) (?:al|a la) (?<to>.+)$/iu,
    fee: "Loan",
  },
  {
    markets: ["Spain"],
    pattern: /^(?<player>.+?), el fichaje .*? del (?<to>.+?) a sus \d+ a[nñ]os.*$/iu,
  },
  {
    markets: ["Spain"],
    pattern: /^(?<player>.+?), cerca de ser .*? fichaje del (?<to>.+)$/iu,
  },
  {
    markets: ["Italy"],
    pattern: /^(?:UFFICIALE:?\s*)?(?<to>.+?) (?:acquista|ingaggia|ufficializza) (?<player>.+?) (?:dal|dalla) (?<from>.+)$/iu,
  },
  {
    markets: ["Italy"],
    pattern: /^(?:UFFICIALE:?\s*)?(?<from>.+?) cede (?<player>.+?) (?:al|alla) (?<to>.+)$/iu,
  },
  {
    markets: ["Italy"],
    pattern: /^(?:UFFICIALE:?\s*)?(?<player>.+?) passa (?:dal|dalla) (?<from>.+?) (?:al|alla) (?<to>.+)$/iu,
  },
  {
    markets: ["Poland"],
    pattern: /^(?<player>[\p{L}\p{M}.'’ -]+?) za (?<fee>\d+(?:[.,]\d+)?\s+(?:mln|milion(?:a|[oó]w)?)\s+euro) do (?<to>.+?)(?:\s+[–—-]\s+.*)?$/iu,
  },
  {
    markets: ["Poland"],
    pattern: /^(?<player>.+?) przechodzi z (?<from>.+?) do (?<to>.+)$/iu,
  },
  {
    markets: ["Poland"],
    pattern: /^(?<to>.+?) pozyska[łl] (?<player>.+?) z (?<from>.+)$/iu,
  },
  {
    markets: ["Poland"],
    pattern: /^(?<from>.+?) wypo[zż]ycza (?<player>.+?) do (?<to>.+)$/iu,
    fee: "Loan",
  },
];

function extractionStatus(player, fromClub, toClub) {
  if (player && fromClub && toClub) return "complete";
  if (player && (fromClub || toClub)) return "partial";
  return "unresolved";
}

export function extractRumourMovement(headline, config = {}) {
  const title = cleanText(headline).replace(config.stripPrefix || /^$/, "").trim();

  for (const rule of RUMOUR_CLAIM_RULES) {
    if (rule.markets && !rule.markets.includes(config.market)) continue;
    const match = title.match(rule.pattern);
    if (!match?.groups) continue;

    const fromClub = normaliseRumourClub(match.groups.from);
    const toClub = normaliseRumourClub(match.groups.to);
    const player = resolveRumourPlayerAlias(
      normaliseRumourPlayer(match.groups.player),
      fromClub,
      toClub,
    );
    return {
      player,
      fromClub,
      toClub,
      fee: normaliseRumourFee(match.groups.fee, rule.fee || "—"),
      extractionStatus: extractionStatus(player, fromClub, toClub),
    };
  }

  return {
    player: null,
    fromClub: null,
    toClub: null,
    fee: "—",
    extractionStatus: "unresolved",
  };
}

function mergeMovementDetails(primary, fallback) {
  const compatible = ["player", "fromClub", "toClub"].every((field) => (
    !meaningful(primary[field])
    || !meaningful(fallback[field])
    || canonicalIdentity(primary[field]) === canonicalIdentity(fallback[field])
  ));
  if (!compatible) return primary;

  const player = primary.player || fallback.player;
  const fromClub = primary.fromClub || fallback.fromClub;
  const toClub = primary.toClub || fallback.toClub;
  return {
    player,
    fromClub,
    toClub,
    fee: meaningful(primary.fee) ? primary.fee : fallback.fee,
    extractionStatus: extractionStatus(player, fromClub, toClub),
  };
}

export function inspectRssPayload(xml) {
  const $ = cheerio.load(typeof xml === "string" ? xml : "", { xmlMode: true });
  const documentRoot = $.root().children().toArray().find((node) => node.type === "tag");
  const qualifiedRootName = String(documentRoot?.name || "").toLowerCase();
  const rootName = qualifiedRootName.split(":").at(-1) || null;
  return {
    rootName,
    isFeedRoot: rootName === "rss" || rootName === "feed",
    observedCount: $("item, entry").length,
  };
}

export function validateRssPayload(xml, config = {}) {
  const inspection = inspectRssPayload(xml);
  if (!inspection.isFeedRoot) {
    throw new Error(`${config.label || config.id || "RSS source"}: response is not an RSS or Atom feed`);
  }
  if (String(config.id || "").startsWith("transfermarkt-") && inspection.observedCount === 0) {
    throw new Error(`${config.label || config.id}: feed contained no items`);
  }
  return inspection;
}

export function parseRssRumours(xml, config = RSS_SOURCES[0], now = new Date()) {
  validateRssPayload(xml, config);
  const $ = cheerio.load(xml, { xmlMode: true });
  const rumours = [];
  const maxItems = Number(config.maxItems || MAX_RUMOURS_PER_SOURCE);

  $("item, entry").each((_, item) => {
    const title = cleanText($(item).find("title").first().text());
    const linkNode = $(item).find("link").first();
    const link = cleanText(linkNode.text() || linkNode.attr("href"));
    const publishedText = cleanText($(item).find("pubDate, published, updated, dc\\:date").first().text());
    const published = new Date(publishedText);
    if (!title || !link || Number.isNaN(published.getTime()) || !config.pattern.test(title)) return;
    const excluded = config.excludePattern?.test(title) && !config.excludeOverridePattern?.test(title);
    if (excluded || (config.linkPattern && !config.linkPattern.test(link))) return;
    const date = published.toISOString().slice(0, 10);
    if (!inLookback(date, now)) return;

    const displayTitle = cleanText(title.replace(config.stripPrefix || /^$/, ""));
    let movement = extractRumourMovement(displayTitle, config);
    if (config.descriptionFallback && movement.extractionStatus === "partial") {
      const description = cleanText($(item).find("description, summary, content").first().text());
      if (description) {
        movement = mergeMovementDetails(movement, extractRumourMovement(description, config));
      }
    }
    const time = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Warsaw",
    }).format(published);

    rumours.push({
      id: createHash("sha1").update(`rumour|${link}`).digest("hex").slice(0, 14),
      date,
      time,
      headline: displayTitle,
      player: movement.player,
      playerUrl: null,
      age: null,
      position: null,
      nationality: null,
      flagCode: null,
      flag: "",
      fromClub: movement.fromClub,
      fromClubUrl: null,
      fromClubCrest: null,
      toClub: movement.toClub,
      toClubUrl: null,
      toClubCrest: null,
      fee: movement.fee,
      status: "rumour",
      extractionStatus: movement.extractionStatus,
      market: config.market || null,
      markets: config.market ? [config.market] : [],
      competition: config.competition || null,
      competitionGender: normaliseCompetitionGender(config.competitionGender),
      competitionGenderSource: normaliseCompetitionGender(config.competitionGender) !== "unknown" ? "source-feed" : null,
      sourceAdapter: config.id,
      sourceRole: config.sourceRole || "publication",
      sourceName: config.label,
      sourceUrl: link,
      sources: [sourceEvidence(config.label, link, config.sourceRole || "publication")],
      firstSeenAt: published.toISOString(),
    });
  });

  const extractionRank = { complete: 2, partial: 1, unresolved: 0 };
  return rumours
    .sort((left, right) => (
      (extractionRank[right.extractionStatus] || 0) - (extractionRank[left.extractionStatus] || 0)
      || (right.firstSeenAt || "").localeCompare(left.firstSeenAt || "")
    ))
    .slice(0, maxItems);
}

export function parseBbcRumours(xml, now = new Date()) {
  return parseRssRumours(xml, RSS_SOURCES[0], now);
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

function safeHttpsUrl(value, baseUrl = undefined) {
  try {
    const url = new URL(value, baseUrl);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function previewText(value, maximumLength) {
  const text = cleanText(value)
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200d\ufeff]/g, "")
    .trim();
  if (!text || text.length <= maximumLength) return text || null;

  const candidate = text.slice(0, maximumLength - 1);
  const boundary = candidate.lastIndexOf(" ");
  const clipped = boundary >= Math.floor(maximumLength * 0.65)
    ? candidate.slice(0, boundary)
    : candidate;
  return `${clipped.trimEnd()}…`;
}

function normalisePreviewDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalisePreviewLanguage(value) {
  const language = cleanText(value).replaceAll("_", "-").split("-").slice(0, 2).join("-");
  return /^[a-z]{2,3}(?:-[A-Za-z]{2})?$/.test(language) ? language : null;
}

export function parseSourcePreviewHtml(html, context = {}) {
  const sourceUrl = safeHttpsUrl(context.sourceUrl);
  if (!sourceUrl) return null;

  const $ = cheerio.load(String(html || ""));
  const meta = (...selectors) => {
    for (const selector of selectors) {
      const content = $(selector).first().attr("content");
      if (cleanText(content)) return content;
    }
    return null;
  };

  const title = previewText(
    meta('meta[property="og:title"]', 'meta[name="twitter:title"]', 'meta[property="twitter:title"]')
      || $("title").first().text(),
    180,
  );
  if (!title) return null;

  const description = previewText(
    meta(
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
      'meta[property="twitter:description"]',
      'meta[name="description"]',
    ),
    360,
  );
  const rawImageUrl = meta(
    'meta[property="og:image:secure_url"]',
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
    'meta[property="twitter:image"]',
  );
  const imageUrl = rawImageUrl ? safeHttpsUrl(rawImageUrl, sourceUrl) : null;
  const siteName = previewText(
    meta('meta[property="og:site_name"]', 'meta[name="application-name"]') || context.sourceName,
    80,
  );
  const publishedAt = normalisePreviewDate(meta(
    'meta[property="article:published_time"]',
    'meta[name="article:published_time"]',
    'meta[name="date"]',
  ));
  const language = normalisePreviewLanguage(
    $("html").first().attr("lang") || meta('meta[property="og:locale"]'),
  );

  return {
    version: 1,
    sourceUrl,
    title,
    description: description && description !== title ? description : null,
    imageUrl,
    siteName,
    publishedAt,
    language,
    fetchedAt: normalisePreviewDate(context.fetchedAt || new Date()) || new Date().toISOString(),
  };
}

function isOfficialPreviewEligible(transfer) {
  return transfer?.status === "official"
    && transfer?.sourceRole === "primary_official"
    && Boolean(safeHttpsUrl(transfer?.sourceUrl));
}

export function normaliseSourcePreview(preview, transfer = {}) {
  if (!preview || preview.version !== 1 || !isOfficialPreviewEligible(transfer)) return null;
  const sourceUrl = safeHttpsUrl(preview.sourceUrl);
  if (!sourceUrl || sourceUrl !== safeHttpsUrl(transfer.sourceUrl)) return null;

  const title = previewText(preview.title, 180);
  const fetchedAt = normalisePreviewDate(preview.fetchedAt);
  if (!title || !fetchedAt) return null;

  return {
    version: 1,
    sourceUrl,
    title,
    description: previewText(preview.description, 360),
    imageUrl: safeHttpsUrl(preview.imageUrl, sourceUrl),
    siteName: previewText(preview.siteName, 80),
    publishedAt: normalisePreviewDate(preview.publishedAt),
    language: normalisePreviewLanguage(preview.language),
    fetchedAt,
  };
}

async function fetchSourcePreviewHead(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml;q=0.9",
      "User-Agent": USER_AGENT,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(SOURCE_PREVIEW_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!/\b(?:text\/html|application\/xhtml\+xml)\b/i.test(response.headers.get("content-type") || "")) {
    throw new Error("non-HTML response");
  }

  const requestedRoot = new URL("/", url).href;
  if (!matchesOfficialWebsite(response.url || url, requestedRoot)) throw new Error("redirected outside verified club domain");
  if (!response.body) throw new Error("empty response");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let html = "";

  try {
    while (bytesRead < SOURCE_PREVIEW_HEAD_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > SOURCE_PREVIEW_HEAD_BYTES) throw new Error("HTML head exceeds preview limit");
      html += decoder.decode(value, { stream: true });
      const endOfHead = html.search(/<\/head\s*>/i);
      if (endOfHead !== -1) {
        html = html.slice(0, endOfHead + html.slice(endOfHead).match(/^<\/head\s*>/i)[0].length);
        await reader.cancel();
        break;
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {}
  }

  return html;
}

export function carryPreviousSourcePreviews(transfers, previousTransfers) {
  const previousByUrl = new Map();
  for (const previous of previousTransfers || []) {
    if (!isOfficialPreviewEligible(previous)) continue;
    previousByUrl.set(safeHttpsUrl(previous.sourceUrl), previous);
  }

  for (const transfer of transfers) {
    if (!isOfficialPreviewEligible(transfer)) {
      delete transfer.sourcePreview;
      delete transfer.sourcePreviewCheckedAt;
      continue;
    }
    const previous = previousByUrl.get(safeHttpsUrl(transfer.sourceUrl));
    if (!previous) continue;
    const preview = normaliseSourcePreview(previous.sourcePreview, transfer);
    if (preview) transfer.sourcePreview = preview;
    const checkedAt = normalisePreviewDate(previous.sourcePreviewCheckedAt);
    if (checkedAt) transfer.sourcePreviewCheckedAt = checkedAt;
  }
  return transfers;
}

function sourcePreviewHost(transfer) {
  try {
    return new URL(transfer.sourceUrl).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function roundRobinByHost(entries) {
  const byHost = new Map();
  for (const entry of entries) {
    const hostEntries = byHost.get(entry.host) || [];
    hostEntries.push(entry);
    byHost.set(entry.host, hostEntries);
  }

  const ordered = [];
  while (byHost.size) {
    for (const [host, hostEntries] of byHost) {
      ordered.push(hostEntries.shift());
      if (!hostEntries.length) byHost.delete(host);
    }
  }
  return ordered;
}

export async function enrichOfficialSourcePreviews(transfers, previousTransfers = [], options = {}) {
  carryPreviousSourcePreviews(transfers, previousTransfers);
  const now = normalisePreviewDate(options.now || new Date()) || new Date().toISOString();
  const retryThreshold = Date.parse(now) - SOURCE_PREVIEW_RETRY_HOURS * 3_600_000;
  const loadHtml = options.fetchHtml || fetchSourcePreviewHead;
  const maxItems = Math.max(0, Number(options.maxItems ?? MAX_SOURCE_PREVIEWS_PER_REFRESH));
  const concurrency = Math.max(1, Number(options.concurrency ?? SOURCE_PREVIEW_CONCURRENCY));

  const byUrl = new Map();
  for (const transfer of transfers) {
    if (!isOfficialPreviewEligible(transfer)) continue;
    const checkedAt = Date.parse(transfer.sourcePreviewCheckedAt || "");
    if (Number.isFinite(checkedAt) && checkedAt >= retryThreshold) continue;
    const sourceUrl = safeHttpsUrl(transfer.sourceUrl);
    const entry = byUrl.get(sourceUrl) || {
      sourceUrl,
      sourceName: transfer.sourceName,
      host: sourcePreviewHost(transfer),
      transfers: [],
    };
    entry.transfers.push(transfer);
    byUrl.set(sourceUrl, entry);
  }

  const queue = roundRobinByHost([...byUrl.values()]).slice(0, maxItems);
  let ready = 0;
  let unavailable = 0;
  let failed = 0;

  while (queue.length) {
    const batch = [];
    const hosts = new Set();
    for (let index = 0; index < queue.length && batch.length < concurrency;) {
      const entry = queue[index];
      if (!hosts.has(entry.host)) {
        hosts.add(entry.host);
        batch.push(entry);
        queue.splice(index, 1);
      } else {
        index += 1;
      }
    }
    if (!batch.length) batch.push(queue.shift());

    await Promise.all(batch.map(async (entry) => {
      try {
        const html = await loadHtml(entry.sourceUrl);
        const preview = parseSourcePreviewHtml(html, {
          sourceUrl: entry.sourceUrl,
          sourceName: entry.sourceName,
          fetchedAt: now,
        });
        for (const transfer of entry.transfers) {
          transfer.sourcePreviewCheckedAt = now;
          if (preview) transfer.sourcePreview = preview;
        }
        if (preview) ready += 1;
        else unavailable += 1;
      } catch {
        for (const transfer of entry.transfers) transfer.sourcePreviewCheckedAt = now;
        failed += 1;
      }
    }));
  }

  if (ready || unavailable || failed) {
    console.log(`Source previews: ${ready} ready, ${unavailable} unavailable, ${failed} failed.`);
  }
  return transfers;
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
          title: page.title,
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

function activeClaims(entity, property) {
  const claims = (entity?.claims?.[property] || []).filter((claim) => claim?.rank !== "deprecated");
  const preferred = claims.filter((claim) => claim?.rank === "preferred");
  return preferred.length ? preferred : claims;
}

const COMPETITION_GENDER_BY_P21 = new Map([
  ["Q6581097", "men"],
  ["Q6581072", "women"],
]);

const TRUSTED_REFERENCE_PROPERTIES = new Set(["P143", "P248", "P4656", "P854"]);

function isValidCompetitionGenderEvidence(evidence, competitionGender) {
  return evidence?.property === "P21"
    && COMPETITION_GENDER_BY_P21.get(evidence?.valueId) === competitionGender
    && TRUSTED_REFERENCE_PROPERTIES.has(evidence?.referenceProperty)
    && meaningful(evidence?.referenceValue);
}

function trustedReference(claim) {
  for (const reference of claim?.references || []) {
    for (const [property, snaks] of Object.entries(reference?.snaks || {})) {
      if (!TRUSTED_REFERENCE_PROPERTIES.has(property)) continue;
      const snak = (snaks || []).find((item) => (
        item?.snaktype === "value" && item?.datavalue?.value !== undefined && item?.datavalue?.value !== null
      ));
      if (!snak) continue;
      const rawValue = snak.datavalue.value;
      const value = typeof rawValue === "object" ? (rawValue.id || JSON.stringify(rawValue)) : String(rawValue);
      if (meaningful(value)) return { property, value };
    }
  }
  return null;
}

function competitionGenderResultFromEntity(entity) {
  const claims = activeClaims(entity, "P21");
  if (!claims.length) return { competitionGender: "unknown", evidence: null };

  const values = claims.map((claim) => {
    const valueId = claim?.mainsnak?.datavalue?.value?.id;
    const reference = trustedReference(claim);
    return {
      competitionGender: COMPETITION_GENDER_BY_P21.get(valueId) || "unknown",
      valueId,
      reference,
    };
  });
  if (values.some((value) => value.competitionGender === "unknown" || !value.reference)) {
    return { competitionGender: "unknown", evidence: null };
  }

  const categories = new Set(values.map((value) => value.competitionGender));
  if (categories.size !== 1) return { competitionGender: "unknown", evidence: null };
  return {
    competitionGender: values[0].competitionGender,
    evidence: {
      property: "P21",
      valueId: values[0].valueId,
      referenceProperty: values[0].reference.property,
      referenceValue: values[0].reference.value,
    },
  };
}

export function competitionGenderFromEntity(entity) {
  return competitionGenderResultFromEntity(entity).competitionGender;
}

function isFootballPlayerEntity(entity) {
  const description = entity?.descriptions?.en?.value || "";
  return claimIds(entity, "P31").includes("Q5")
    && claimIds(entity, "P106").includes("Q937857")
    && /\bfootballer\b|\b(?:association )?football player\b|\bsoccer player\b/i.test(description);
}

function footballClubKey(value) {
  return canonicalIdentity(value)
    .replace(/\b(?:women|women s|ladies|feminine|feminin|femenino|femenina|femminile|frauen|a f c|w f c|f c|s c|a c|c f|f k|k s|s k)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clubNamesMatch(left, right) {
  const leftKey = footballClubKey(left);
  const rightKey = footballClubKey(right);
  return Boolean(leftKey && rightKey && leftKey === rightKey);
}

function entityMatchesTransferClub(transfer, entity, clubEntities) {
  const transferClubs = [transfer.fromClub, transfer.toClub].filter(Boolean);
  return claimIds(entity, "P54").some((clubId) => {
    const label = clubEntities[clubId]?.labels?.en?.value;
    return label && transferClubs.some((club) => clubNamesMatch(label, club));
  });
}

export async function enrichCompetitionGenders(transfers, loaders = {}) {
  const unresolved = transfers.filter((transfer) => (
    normaliseCompetitionGender(transfer.competitionGender) === "unknown" && cleanText(transfer.player)
  ));
  if (!unresolved.length) return transfers;

  const titles = unresolved.map((transfer) => wikipediaTitle(transfer.playerUrl) || cleanText(transfer.player));
  const loadPageMetadata = loaders.wikipediaPageMetadata || wikipediaPageMetadata;
  const loadEntities = loaders.wikidataEntities || wikidataEntities;
  const pageMetadata = await loadPageMetadata(titles);
  const qids = [...new Set([...pageMetadata.values()].map((page) => page?.qid).filter(Boolean))];
  if (!qids.length) return transfers;
  const entities = await loadEntities(qids);
  const clubIds = [...new Set(qids.flatMap((qid) => claimIds(entities[qid], "P54")))];
  const clubEntities = clubIds.length ? await loadEntities(clubIds, "labels") : {};

  unresolved.forEach((transfer, index) => {
    const qid = pageMetadata.get(titles[index]?.toLowerCase())?.qid;
    const entity = entities[qid];
    if (!entity) return;
    if (!transfer.playerUrl && (
      !isFootballPlayerEntity(entity) || !entityMatchesTransferClub(transfer, entity, clubEntities)
    )) return;
    const { competitionGender, evidence } = competitionGenderResultFromEntity(entity);
    if (competitionGender === "unknown") return;
    transfer.competitionGender = competitionGender;
    transfer.competitionGenderSource = "wikidata-p21";
    transfer.competitionGenderEvidence = evidence;
    transfer.playerQid = qid;
  });

  return transfers;
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

function compactPositionCodeList(items) {
  let codes = [...new Set(items.filter(Boolean))];
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

function compactPositionCodes(positionIds, positionEntities) {
  return compactPositionCodeList(positionIds
    .map((positionId) => positionCode(positionEntities[positionId]?.labels?.en?.value, positionId)));
}

export function positionCodesFromText(value) {
  const cleaned = cleanText(String(value || "")
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>|<ref\b[^>]*\/>/gi, " ")
    .replace(/\[\[[^\]|]+\|([^\]]+)]]/g, "$1")
    .replace(/\[\[([^\]]+)]]/g, "$1")
    .replace(/\{\{(?:ubl|unbulleted list|flatlist|plainlist)\s*\|/gi, "")
    .replace(/\{\{[^|{}]+\|([^{}]+)}}/g, "$1")
    .replace(/[{}'*]/g, " "));
  const labels = cleaned.split(/\s*(?:[,;/|]|\bor\b|\band\b)\s*/i).filter(Boolean);
  const codes = labels.map((label) => positionCode(label)).filter(Boolean);
  return compactPositionCodeList(codes.length ? codes : [positionCode(cleaned)]);
}

function wikipediaInfoboxPosition(wikitext) {
  const start = String(wikitext || "").search(/\{\{\s*Infobox football biography\b/i);
  if (start < 0) return null;
  const infoboxHead = String(wikitext).slice(start, start + 16_384);
  const match = infoboxHead.match(/^\|\s*position\s*=\s*([\s\S]*?)(?=^\|\s*[a-z][a-z0-9_ ]*\s*=|^}})/im);
  return positionCodesFromText(match?.[1]);
}

async function wikipediaPlayerPositions(titles) {
  const uniqueTitles = [...new Set(titles.filter(Boolean))];
  const positions = new Map();

  for (const titleBatch of batches(uniqueTitles, 25)) {
    const queryUrl = new URL("https://en.wikipedia.org/w/api.php");
    queryUrl.search = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      prop: "revisions",
      redirects: "1",
      rvprop: "content",
      rvslots: "main",
      titles: titleBatch.join("|"),
    });
    const response = await fetch(queryUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Wikipedia player positions: HTTP ${response.status}`);
    const payload = await response.json();
    if (payload?.error) throw new Error(`Wikipedia player positions: ${payload.error.code || "unknown error"}`);

    const aliases = new Map();
    for (const item of [...(payload?.query?.normalized || []), ...(payload?.query?.redirects || [])]) {
      if (item?.from && item?.to) aliases.set(item.from.toLowerCase(), item.to.toLowerCase());
    }
    const pages = new Map((payload?.query?.pages || [])
      .filter((page) => page?.title)
      .map((page) => [page.title.toLowerCase(), page]));

    for (const originalTitle of titleBatch) {
      let resolvedTitle = originalTitle.toLowerCase();
      const visited = new Set();
      while (aliases.has(resolvedTitle) && !visited.has(resolvedTitle)) {
        visited.add(resolvedTitle);
        resolvedTitle = aliases.get(resolvedTitle);
      }
      const page = pages.get(resolvedTitle) || pages.get(originalTitle.toLowerCase());
      const wikitext = page?.revisions?.[0]?.slots?.main?.content;
      const position = wikipediaInfoboxPosition(wikitext);
      if (position) positions.set(originalTitle.toLowerCase(), position);
    }
  }

  return positions;
}

export async function enrichPlayerDetails(transfers, loaders = {}) {
  const unresolved = transfers.filter((transfer) => (
    cleanText(transfer.player)
    && (!meaningful(transfer.nationality) || !meaningful(transfer.position) || transfer.age == null)
  ));
  if (!unresolved.length) return transfers;

  const titles = unresolved.map((transfer) => wikipediaTitle(transfer.playerUrl) || cleanText(transfer.player));
  const loadPageMetadata = loaders.wikipediaPageMetadata || wikipediaPageMetadata;
  const loadEntities = loaders.wikidataEntities || wikidataEntities;
  const loadPlayerPositions = loaders.wikipediaPlayerPositions || wikipediaPlayerPositions;
  const pageMetadata = await loadPageMetadata(titles);
  const qids = [...new Set([...pageMetadata.values()].map((page) => page.qid).filter(Boolean))];
  if (!qids.length) return transfers;
  const entities = await loadEntities(qids);
  const clubIds = [...new Set(qids.flatMap((qid) => claimIds(entities[qid], "P54")))];
  const clubEntities = clubIds.length ? await loadEntities(clubIds, "labels") : {};
  const positionIds = [...new Set(qids.flatMap((qid) => claimIds(entities[qid], "P413")))];
  const sportCountryIds = [...new Set(qids.flatMap((qid) => claimIds(entities[qid], "P1532")))];
  const citizenshipIds = [...new Set(qids.flatMap((qid) => claimIds(entities[qid], "P27")))];
  const relatedEntities = await loadEntities([...positionIds, ...sportCountryIds, ...citizenshipIds], "labels");

  for (let index = 0; index < unresolved.length; index += 1) {
    const transfer = unresolved[index];
    const metadata = pageMetadata.get(titles[index]?.toLowerCase());
    const qid = metadata?.qid;
    const entity = entities[qid];
    if (!entity) continue;
    if (!transfer.playerUrl && (
      !isFootballPlayerEntity(entity) || !entityMatchesTransferClub(transfer, entity, clubEntities)
    )) continue;

    const birthTime = entity?.claims?.P569?.[0]?.mainsnak?.datavalue?.value?.time;
    const enrichedAge = ageAt(birthTime, transfer.date);
    const enrichedPosition = compactPositionCodes(claimIds(entity, "P413"), relatedEntities);
    const nationalityId = claimIds(entity, "P1532")[0] || claimIds(entity, "P27")[0];
    const enrichedNationality = relatedEntities[nationalityId]?.labels?.en?.value || null;
    if (transfer.age == null && enrichedAge !== null) transfer.age = enrichedAge;
    if (!meaningful(transfer.position) && enrichedPosition) transfer.position = enrichedPosition;
    if (!transfer.nationality && enrichedNationality) {
      transfer.nationality = enrichedNationality;
      transfer.flagCode = flagCodeFromName(enrichedNationality);
      transfer.flag = flagFromName(enrichedNationality);
    }
    if (!transfer.playerUrl && metadata?.title) {
      transfer.playerUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(metadata.title.replaceAll(" ", "_"))}`;
    }
  }

  const withoutPosition = unresolved.filter((transfer) => !meaningful(transfer.position) && transfer.playerUrl);
  if (withoutPosition.length) {
    const positionTitles = withoutPosition.map((transfer) => wikipediaTitle(transfer.playerUrl));
    const positions = await loadPlayerPositions(positionTitles);
    withoutPosition.forEach((transfer, index) => {
      const position = positions.get(positionTitles[index]?.toLowerCase());
      if (position) {
        transfer.position = position;
        transfer.playerMetadataSourceUrl ||= transfer.playerUrl;
      }
    });
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
    && hasStructuredRoute(item)
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
        competitionGender: "unknown",
        competitionGenderSource: null,
        sourceAdapter: "manual",
        sourceRole: item.sourceRole || (item.platform === "facebook" ? "community" : "reporter"),
        time: "—",
        ...item,
        id: item.id || createHash("sha1").update(`manual|${item.sourceUrl}`).digest("hex").slice(0, 14),
      };
      record.flagCode ||= flagCodeFromName(record.nationality);
      record.flag ||= flagFromName(record.nationality);
      record.competitionGender = normaliseCompetitionGender(record.competitionGender);
      record.competitionGenderSource = record.competitionGender !== "unknown" ? "manual" : null;
      record.competitionGenderEvidence = null;
      record.playerQid = null;
      record.market ||= null;
      record.markets = Array.isArray(record.markets) ? record.markets : (record.market ? [record.market] : []);
      record.sources = Array.isArray(record.sources) && record.sources.length
        ? record.sources
        : [sourceEvidence(record.sourceName || sourceLabel(record.sourceUrl), record.sourceUrl, record.sourceRole)];
      return record;
    });
  } catch {
    return [];
  }
}

function validateTransfermarktBackfill(item) {
  if (!item || typeof item !== "object") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date || "") || !hasStructuredRoute(item)) return false;
  if (!/^Transfermarkt\b/.test(cleanText(item.sourceName))) return false;
  const hostname = sourceHostname(item.sourceUrl);
  const pathname = sourcePathname(item.sourceUrl);
  return /^(?:transfermarkt\.(?:de|it|es|nl|pl|pt)|transfermarkt\.co\.uk)$/.test(hostname || "")
    && /\/view\/news\/\d+$/.test(pathname || "");
}

export function transfermarktBackfillRecords(items) {
  return (Array.isArray(items) ? items : [])
    .filter(validateTransfermarktBackfill)
    .map((item) => {
      const competitionGender = normaliseCompetitionGender(item.competitionGender);
      return {
        id: item.id || createHash("sha1").update(`transfermarkt-archive|${item.sourceUrl}`).digest("hex").slice(0, 14),
        date: item.date,
        player: cleanText(item.player),
        playerUrl: null,
        age: null,
        position: null,
        nationality: null,
        flagCode: null,
        flag: "",
        fromClub: cleanText(item.fromClub),
        fromClubUrl: null,
        fromClubCrest: null,
        toClub: cleanText(item.toClub),
        toClubUrl: null,
        toClubCrest: null,
        fee: cleanText(item.fee) || "—",
        status: "rumour",
        competitionGender,
        competitionGenderSource: competitionGender === "unknown" ? null : "manual",
        competitionGenderEvidence: null,
        playerQid: null,
        sourceAdapter: "transfermarkt-archive",
        sourceRole: "database",
        sourceName: cleanText(item.sourceName),
        sourceUrl: item.sourceUrl,
        sources: [sourceEvidence(cleanText(item.sourceName), item.sourceUrl, "database")],
        market: cleanText(item.market) || null,
        markets: cleanText(item.market) ? [cleanText(item.market)] : [],
        time: "—",
        firstSeenAt: `${item.date}T12:00:00.000Z`,
      };
    });
}

async function readTransfermarktBackfill() {
  try {
    return transfermarktBackfillRecords(JSON.parse(await readFile(TRANSFERMARKT_BACKFILL_URL, "utf8")));
  } catch {
    return [];
  }
}

const PLAYER_POSITION_PATTERN = /^(?:GK|SW|DC|DR|DL|FB|WB|WBR|WBL|DM|MC|MR|ML|WM|AMC|AMR|AML|AM|SS|ST)(?: \/ (?:GK|SW|DC|DR|DL|FB|WB|WBR|WBL|DM|MC|MR|ML|WM|AMC|AMR|AML|AM|SS|ST))*$/;

function validateCuratedPlayerMetadata(item) {
  return item
    && typeof item === "object"
    && /^\d{4}-\d{2}-\d{2}$/.test(item.date || "")
    && hasStructuredRoute(item)
    && meaningful(item.nationality)
    && PLAYER_POSITION_PATTERN.test(cleanText(item.position))
    && /^https:\/\//.test(item.sourceUrl || "")
    && /^https:\/\//.test(item.playerUrl || "")
    && (!item.playerQid || /^Q\d+$/.test(item.playerQid));
}

export function applyCuratedPlayerMetadata(transfers, payload) {
  const records = Array.isArray(payload) ? payload : payload?.records;
  const byIdentity = new Map(
    transfers.map((transfer) => [`${transfer.date}|${claimIdentity(transfer)}`, transfer]),
  );

  for (const item of Array.isArray(records) ? records : []) {
    if (!validateCuratedPlayerMetadata(item)) continue;
    const target = byIdentity.get(`${item.date}|${claimIdentity(item)}`);
    if (!target) continue;
    if (!meaningful(target.nationality)) {
      target.nationality = cleanText(item.nationality);
      target.flagCode = flagCodeFromName(target.nationality);
      target.flag = flagFromName(target.nationality);
    }
    if (!meaningful(target.position)) target.position = cleanText(item.position);
    if (!target.playerUrl) target.playerUrl = item.playerUrl;
    target.playerQid ||= item.playerQid || null;
    target.playerMetadataSourceUrl = item.sourceUrl;
  }

  return transfers;
}

async function readCuratedPlayerMetadata() {
  try {
    return JSON.parse(await readFile(CURATED_PLAYER_METADATA_URL, "utf8"));
  } catch {
    return { schemaVersion: 1, records: [] };
  }
}

export function hasCompletePlayerMetadata(transfer) {
  return meaningful(transfer?.nationality) && PLAYER_POSITION_PATTERN.test(cleanText(transfer?.position));
}

function canonicalIdentity(value) {
  return cleanText(value)
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’'`]/g, "")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/\b(?:football club|futbol club|fussball club|societa sportiva|sporting club|fc|afc|cf|sc|ac|fk|ks|sk)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function hasStructuredRoute(transfer) {
  const entitiesArePresent = [transfer.player, transfer.fromClub, transfer.toClub]
    .every((value) => cleanText(value) && !/^(?:—|-|unknown)$/i.test(cleanText(value)));
  if (!entitiesArePresent) return false;

  const playerKey = canonicalIdentity(transfer.player);
  const headlineKey = canonicalIdentity(transfer.headline || transfer.sourceHeadline);
  if (headlineKey && headlineKey === playerKey) return false;
  return !AMBIGUOUS_RUMOUR_PLAYER_KEYS.has(playerKey);
}

function claimIdentity(transfer) {
  if (!hasStructuredRoute(transfer)) return null;
  return [transfer.player, transfer.fromClub, transfer.toClub].map(canonicalIdentity).join("|");
}

function dayDistance(left, right) {
  const leftDate = new Date(`${left}T12:00:00Z`);
  const rightDate = new Date(`${right}T12:00:00Z`);
  if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) return Infinity;
  return Math.abs(leftDate.getTime() - rightDate.getTime()) / 86_400_000;
}

function meaningful(value) {
  const text = cleanText(value);
  return text && !/^(?:—|-|undisclosed)$/i.test(text);
}

function sourcePriority(source) {
  return ({
    primary_official: 5,
    publication: 4,
    reporter: 3,
    database: 2,
    community: 1,
    aggregator: 0,
  })[source?.role] ?? 0;
}

function transferSources(transfer) {
  const items = Array.isArray(transfer.sources) ? transfer.sources : [];
  const fallback = transfer.sourceUrl
    ? [sourceEvidence(transfer.sourceName || sourceLabel(transfer.sourceUrl), transfer.sourceUrl, transfer.sourceRole)]
    : [];
  const byUrl = new Map();
  for (const source of [...fallback, ...items]) {
    if (!source?.url) continue;
    byUrl.set(source.url, {
      name: source.name || sourceLabel(source.url),
      url: source.url,
      role: source.role || sourceRole(source.url),
    });
  }
  return [...byUrl.values()];
}

function stringClaimValues(entity, property) {
  return activeClaims(entity, property)
    .map((claim) => claim?.mainsnak?.datavalue?.value)
    .filter((value) => typeof value === "string" && value.trim());
}

function sourceHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function sourcePathname(url) {
  try {
    return new URL(url).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return null;
  }
}

export function matchesOfficialWebsite(sourceUrl, officialWebsiteUrl) {
  const sourceHost = sourceHostname(sourceUrl);
  const officialHost = sourceHostname(officialWebsiteUrl);
  if (!sourceHost || !officialHost) return false;
  const hostMatches = sourceHost === officialHost || sourceHost.endsWith(`.${officialHost}`);
  if (!hostMatches) return false;
  const officialPath = sourcePathname(officialWebsiteUrl);
  const sourcePath = sourcePathname(sourceUrl);
  if (!officialPath || !sourcePath) return false;
  return officialPath === "/"
    || sourcePath === officialPath
    || sourcePath.startsWith(`${officialPath}/`);
}

const GENERIC_CLUB_ENTITY_TYPES = new Set(["Q847017"]);

function isFootballClubEntity(entity) {
  const entityTypes = claimIds(entity, "P31");
  if (entityTypes.includes("Q476028")) return true;
  return entityTypes.some((qid) => GENERIC_CLUB_ENTITY_TYPES.has(qid))
    && claimIds(entity, "P641").includes("Q2736");
}

const OFFICIAL_CLUB_WEBSITE_OVERRIDES = new Map([
  [["AS Monaco", "Monaco"], "https://www.asmonaco.com"],
  [["AZ", "AZ Alkmaar"], "https://www.az.nl"],
  [["Empoli", "Empoli FC"], "https://www.empolifc.it"],
  [["FC Groningen", "Groningen"], "https://www.fcgroningen.nl"],
  [["FC Twente", "Twente"], "https://www.fctwente.nl"],
  [["Heerenveen", "SC Heerenveen"], "https://www.sc-heerenveen.nl"],
  [["Hamburger SV", "HSV"], "https://www.hsv.de"],
  [["Intercity", "CF Intercity"], "https://cfintercity.com"],
  [["Legia Warsaw"], "https://legia.com"],
  [["Lille", "LOSC Lille"], "https://www.losc.fr"],
  [["Lyon", "Olympique Lyonnais"], "https://www.ol.fr"],
  [["Piast Gliwice"], "https://piast-gliwice.eu"],
  [["Pogoń Grodzisk Mazowiecki"], "https://pogongrodzisk.pl"],
  [["PSV", "PSV Eindhoven"], "https://www.psv.nl"],
  [["Radomiak Radom"], "https://rksradomiak.pl"],
  [["Rennes", "Stade Rennais"], "https://www.staderennais.com"],
  [["Strasbourg", "RC Strasbourg"], "https://www.rcstrasbourgalsace.fr"],
  [["Warta Sieradz"], "https://wartasieradz.com"],
  [["Wisła Kraków"], "https://wislakrakow.com"],
].flatMap(([aliases, website]) => aliases.map((alias) => [footballClubKey(alias), website])));

function selectPreferredSource(transfer) {
  const preferredSource = [...transferSources(transfer)]
    .sort((left, right) => sourcePriority(right) - sourcePriority(left))[0];
  if (!preferredSource) return;
  transfer.sourceName = preferredSource.name;
  transfer.sourceUrl = preferredSource.url;
  transfer.sourceRole = preferredSource.role;
}

function validateCuratedOfficialSource(item) {
  if (!item || typeof item !== "object") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date || "")) return false;
  if (!hasStructuredRoute(item) || !cleanText(item.club)) return false;
  if (!/^https:\/\//.test(item.sourceUrl || "") || !/^https:\/\//.test(item.officialWebsite || "")) return false;
  const routeClubs = [item.fromClub, item.toClub].map(canonicalIdentity);
  if (!routeClubs.includes(canonicalIdentity(item.club))) return false;
  return matchesOfficialWebsite(item.sourceUrl, item.officialWebsite);
}

export function applyCuratedOfficialSources(transfers, items) {
  const transferByIdentity = new Map(
    transfers
      .filter((transfer) => transfer.status === "official")
      .map((transfer) => [`${transfer.date}|${claimIdentity(transfer)}`, transfer]),
  );

  for (const item of Array.isArray(items) ? items : []) {
    if (!validateCuratedOfficialSource(item)) continue;
    const target = transferByIdentity.get(`${item.date}|${claimIdentity(item)}`);
    if (!target) continue;
    target.sources = transferSources({
      sources: [
        ...transferSources(target),
        sourceEvidence(cleanText(item.club), item.sourceUrl, "primary_official"),
      ],
    });
    selectPreferredSource(target);
  }

  return transfers;
}

async function readCuratedOfficialSources() {
  try {
    const items = JSON.parse(await readFile(CURATED_OFFICIAL_SOURCES_URL, "utf8"));
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export async function verifyOfficialClubSources(transfers, loaders = {}) {
  for (const transfer of transfers) {
    transfer.sources = transferSources(transfer).map((source) => (
      source.role === "primary_official"
        ? { ...source, role: sourceRole(source.url) }
        : source
    ));
    selectPreferredSource(transfer);
  }

  const clubTitles = transfers.flatMap((transfer) => [
    wikipediaTitle(transfer.fromClubUrl),
    wikipediaTitle(transfer.toClubUrl),
  ]).filter(Boolean);
  if (!clubTitles.length) return transfers;

  const loadPageMetadata = loaders.wikipediaPageMetadata || wikipediaPageMetadata;
  const loadEntities = loaders.wikidataEntities || wikidataEntities;
  const pageMetadata = await loadPageMetadata(clubTitles);
  const clubQids = [...new Set([...pageMetadata.values()].map((page) => page?.qid).filter(Boolean))];
  if (!clubQids.length) return transfers;
  const clubEntities = await loadEntities(clubQids, "claims");

  for (const transfer of transfers) {
    const clubs = [
      { name: transfer.fromClub, title: wikipediaTitle(transfer.fromClubUrl) },
      { name: transfer.toClub, title: wikipediaTitle(transfer.toClubUrl) },
    ].filter((club) => club.name && club.title)
      .map((club) => {
        const qid = pageMetadata.get(club.title.toLowerCase())?.qid;
        const entity = clubEntities[qid];
        const overrideWebsite = OFFICIAL_CLUB_WEBSITE_OVERRIDES.get(footballClubKey(club.name));
        return {
          ...club,
          officialWebsites: [
            ...(isFootballClubEntity(entity) ? stringClaimValues(entity, "P856") : []),
            ...(overrideWebsite ? [overrideWebsite] : []),
          ],
        };
      });

    transfer.sources = transferSources(transfer).map((source) => {
      const verifiedClub = clubs.find((club) => club.officialWebsites.some((website) => (
        matchesOfficialWebsite(source.url, website)
      )));
      if (verifiedClub) {
        return { ...source, name: verifiedClub.name, role: "primary_official" };
      }
      return source;
    });
    selectPreferredSource(transfer);
  }

  return transfers;
}

function competitionGenderAuditRecord(transfer) {
  const competitionGender = normaliseCompetitionGender(transfer.competitionGender);
  if (competitionGender === "unknown") return null;
  return {
    competitionGender,
    competitionGenderSource: transfer.competitionGenderSource || null,
    sourceAdapter: transfer.sourceAdapter || null,
    playerQid: transfer.playerQid || null,
    evidence: transfer.competitionGenderEvidence || null,
  };
}

function appendCompetitionGenderConflicts(target, ...transfers) {
  const entries = [
    ...(Array.isArray(target.competitionGenderConflicts) ? target.competitionGenderConflicts : []),
    ...transfers.map(competitionGenderAuditRecord).filter(Boolean),
  ];
  target.competitionGenderConflicts = [...new Map(entries.map((entry) => [JSON.stringify(entry), entry])).values()];
}

function mergeCompetitionGender(target, incoming) {
  const current = normaliseCompetitionGender(target.competitionGender);
  const next = normaliseCompetitionGender(incoming.competitionGender);
  if (target.competitionGenderSource === "conflict") {
    if (next !== "unknown") appendCompetitionGenderConflicts(target, incoming);
    return;
  }
  if (next === "unknown") return;
  if (current === "unknown") {
    target.competitionGender = next;
    target.competitionGenderSource = incoming.competitionGenderSource || null;
    target.competitionGenderEvidence = incoming.competitionGenderEvidence || null;
    target.playerQid = incoming.playerQid || null;
    return;
  }
  if (current === next) {
    target.competitionGenderEvidence ||= incoming.competitionGenderEvidence || null;
    target.playerQid ||= incoming.playerQid || null;
    return;
  }
  if (current !== next) {
    appendCompetitionGenderConflicts(target, target, incoming);
    target.competitionGender = "unknown";
    target.competitionGenderSource = "conflict";
    target.competitionGenderEvidence = null;
    target.playerQid = null;
  }
}

function mergeTransfer(target, incoming) {
  const targetSources = transferSources(target);
  const incomingSources = transferSources(incoming);
  target.sources = transferSources({ sources: [...targetSources, ...incomingSources] });

  const preferredSource = [...target.sources].sort((left, right) => sourcePriority(right) - sourcePriority(left))[0];
  if (preferredSource) {
    target.sourceName = preferredSource.name;
    target.sourceUrl = preferredSource.url;
    target.sourceRole = preferredSource.role;
  }

  if (incoming.status === "official") target.status = "official";
  mergeCompetitionGender(target, incoming);
  for (const field of [
    "playerUrl", "age", "position", "nationality", "flagCode", "flag",
    "fromClubUrl", "fromClubCrest", "toClubUrl", "toClubCrest",
  ]) {
    if (!meaningful(target[field]) && meaningful(incoming[field])) target[field] = incoming[field];
  }
  if (!meaningful(target.fee) && meaningful(incoming.fee)) target.fee = incoming.fee;

  const markets = [...(target.markets || []), target.market, ...(incoming.markets || []), incoming.market].filter(Boolean);
  target.markets = [...new Set(markets)];
  target.market ||= target.markets[0] || null;
  const competitions = [...(target.competitions || []), target.competition, ...(incoming.competitions || []), incoming.competition].filter(Boolean);
  target.competitions = [...new Set(competitions)];
  target.competition ||= target.competitions[0] || null;
  target.sourceAdapters = [...new Set([
    ...(target.sourceAdapters || []), target.sourceAdapter,
    ...(incoming.sourceAdapters || []), incoming.sourceAdapter,
  ].filter(Boolean))];
  if (incoming.firstSeenAt && (!target.firstSeenAt || incoming.firstSeenAt < target.firstSeenAt)) {
    target.firstSeenAt = incoming.firstSeenAt;
  }
  return target;
}

export function deduplicateTransfers(transfers) {
  const merged = [];
  const byId = new Map();
  const byEvidence = new Map();
  const byClaim = new Map();

  for (const transfer of transfers) {
    const evidenceKey = transfer.sourceUrl || null;
    const claimKey = claimIdentity(transfer);
    const claimCandidates = claimKey ? (byClaim.get(claimKey) || []) : [];
    const candidateIndex = byId.get(transfer.id)
      ?? (!claimKey && evidenceKey ? byEvidence.get(evidenceKey) : undefined)
      ?? claimCandidates.find((index) => dayDistance(merged[index].date, transfer.date) <= 3);

    if (candidateIndex !== undefined) {
      mergeTransfer(merged[candidateIndex], transfer);
      continue;
    }

    const index = merged.length;
    transfer.sources = transferSources(transfer);
    transfer.markets = [...new Set([...(transfer.markets || []), transfer.market].filter(Boolean))];
    transfer.competitions = [...new Set([...(transfer.competitions || []), transfer.competition].filter(Boolean))];
    transfer.sourceAdapters = [...new Set([...(transfer.sourceAdapters || []), transfer.sourceAdapter].filter(Boolean))];
    merged.push(transfer);
    if (transfer.id) byId.set(transfer.id, index);
    if (evidenceKey) byEvidence.set(evidenceKey, index);
    if (claimKey) byClaim.set(claimKey, [...claimCandidates, index]);
  }

  return merged;
}

function headlineContainsPlayer(headline, player) {
  const headlineKey = canonicalIdentity(headline);
  const playerKey = canonicalIdentity(player);
  if (playerKey.length < 5) return false;
  if (` ${headlineKey} `.includes(` ${playerKey} `)) return true;

  const surname = playerKey.split(" ").at(-1);
  return surname?.length >= 5 && ` ${headlineKey} `.includes(` ${surname} `);
}

function evidenceRouteMatches(signal, transfer) {
  return ["fromClub", "toClub"].every((field) => (
    !meaningful(signal[field])
    || !meaningful(transfer[field])
    || canonicalIdentity(signal[field]) === canonicalIdentity(transfer[field])
  ));
}

export function mergeHeadlineEvidence(structuredTransfers, newsSignals) {
  const remainingSignals = [];

  for (const signal of newsSignals) {
    const matches = structuredTransfers.filter((transfer) => (
      hasStructuredRoute(transfer)
      && dayDistance(transfer.date, signal.date) <= 7
      && headlineContainsPlayer(signal.headline || signal.player, transfer.player)
      && evidenceRouteMatches(signal, transfer)
    ));

    if (matches.length === 1) {
      mergeTransfer(matches[0], signal);
    } else {
      remainingSignals.push(signal);
    }
  }

  return remainingSignals;
}

function compatibleRumourFragments(left, right) {
  if (!left.player || !right.player) return false;
  if (rumourPlayerKey(left.player) !== rumourPlayerKey(right.player)) return false;
  if (dayDistance(left.date, right.date) > 3) return false;

  return ["fromClub", "toClub"].every((field) => (
    !meaningful(left[field])
    || !meaningful(right[field])
    || canonicalIdentity(left[field]) === canonicalIdentity(right[field])
  ));
}

export function mergeRumourFragments(signals) {
  const merged = [];

  for (const signal of signals) {
    const target = merged.find((candidate) => compatibleRumourFragments(candidate, signal));
    if (!target) {
      merged.push({ ...signal });
      continue;
    }

    if (!meaningful(target.fromClub) && meaningful(signal.fromClub)) target.fromClub = signal.fromClub;
    if (!meaningful(target.toClub) && meaningful(signal.toClub)) target.toClub = signal.toClub;
    mergeTransfer(target, signal);
    target.player = resolveRumourPlayerAlias(target.player, target.fromClub, target.toClub);
    target.extractionStatus = extractionStatus(target.player, target.fromClub, target.toClub);
    if (hasStructuredRoute(target)) {
      target.id = transferId(target.date, target.player, target.fromClub, target.toClub);
    }
  }

  return merged;
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

function configuredCompetitionGenderSource(transfer) {
  const adapters = new Set([...(transfer.sourceAdapters || []), transfer.sourceAdapter].filter(Boolean));
  if (adapters.has("wikipedia")) return WIKIPEDIA_SOURCES[0];
  return [...WIKIPEDIA_SOURCES, ...RSS_SOURCES].find((source) => adapters.has(source.id));
}

function configuredCompetitionGenderProvenance(transfer, competitionGender) {
  if (competitionGender === "unknown") return null;
  const source = configuredCompetitionGenderSource(transfer);
  if (normaliseCompetitionGender(source?.competitionGender) !== competitionGender) return null;
  return WIKIPEDIA_SOURCES.includes(source) ? "source-register" : "source-feed";
}

function hasAdapter(transfer, adapterId) {
  return [transfer.sourceAdapter, ...(transfer.sourceAdapters || [])].includes(adapterId);
}

function hasVerifiableCompetitionGender(transfer, competitionGender, competitionGenderSource) {
  if (competitionGender === "unknown") return false;
  if (competitionGenderSource === "source-register" || competitionGenderSource === "source-feed") {
    return configuredCompetitionGenderProvenance(transfer, competitionGender) === competitionGenderSource;
  }
  if (competitionGenderSource === "manual") {
    return hasAdapter(transfer, "manual") || hasAdapter(transfer, "transfermarkt-archive");
  }
  if (competitionGenderSource === "wikidata-p21") {
    return /^Q\d+$/.test(transfer.playerQid || "")
      && isValidCompetitionGenderEvidence(transfer.competitionGenderEvidence, competitionGender);
  }
  return false;
}

export function normaliseStoredTransfer(transfer) {
  const position = LEGACY_POSITIONS.has(transfer.position) ? LEGACY_POSITIONS.get(transfer.position) : transfer.position;
  const nationality = LEGACY_NATIONALITIES.get(transfer.nationality) || transfer.nationality || null;
  const configuredGenderSource = configuredCompetitionGenderSource(transfer);
  const storedGender = normaliseCompetitionGender(transfer.competitionGender);
  const hasStoredGender = Object.prototype.hasOwnProperty.call(transfer, "competitionGender");
  let competitionGender = hasStoredGender
    ? storedGender
    : normaliseCompetitionGender(configuredGenderSource?.competitionGender);
  let competitionGenderSource = transfer.competitionGenderSource
    || configuredCompetitionGenderProvenance(transfer, competitionGender);
  if (competitionGenderSource === "conflict") {
    competitionGender = "unknown";
  } else if (!hasVerifiableCompetitionGender(transfer, competitionGender, competitionGenderSource)) {
    competitionGender = "unknown";
    competitionGenderSource = null;
  }
  const hasWikidataEvidence = competitionGenderSource === "wikidata-p21";
  const fee = String(transfer.fee ?? "")
    .replace(/^nieujawniona$/i, "Undisclosed")
    .replace(/^bez odstępnego$/i, "Free")
    .replace(/^wypożyczenie$/i, "Loan") || "—";
  const normalized = {
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
    market: transfer.market || null,
    markets: Array.isArray(transfer.markets) ? transfer.markets : (transfer.market ? [transfer.market] : []),
    competition: transfer.competition || null,
    competitions: Array.isArray(transfer.competitions) ? transfer.competitions : (transfer.competition ? [transfer.competition] : []),
    competitionGender,
    competitionGenderSource,
    competitionGenderEvidence: hasWikidataEvidence ? transfer.competitionGenderEvidence : null,
    playerQid: hasWikidataEvidence ? transfer.playerQid : null,
    sourceRole: transfer.sourceRole || sourceRole(transfer.sourceUrl),
    sourceAdapters: Array.isArray(transfer.sourceAdapters)
      ? transfer.sourceAdapters
      : (transfer.sourceAdapter ? [transfer.sourceAdapter] : []),
  };
  normalized.sources = transferSources(normalized);
  const sourcePreview = normaliseSourcePreview(transfer.sourcePreview, normalized);
  const sourcePreviewCheckedAt = isOfficialPreviewEligible(normalized)
    ? normalisePreviewDate(transfer.sourcePreviewCheckedAt)
    : null;
  if (sourcePreview) normalized.sourcePreview = sourcePreview;
  else delete normalized.sourcePreview;
  if (sourcePreviewCheckedAt) normalized.sourcePreviewCheckedAt = sourcePreviewCheckedAt;
  else delete normalized.sourcePreviewCheckedAt;
  if (!hasWikidataEvidence) {
    delete normalized.competitionGenderEvidence;
    delete normalized.playerQid;
  }
  if (!Array.isArray(normalized.competitionGenderConflicts) || !normalized.competitionGenderConflicts.length) {
    delete normalized.competitionGenderConflicts;
  }
  return normalized;
}

export function carryPreviousEnrichment(transfers, previousTransfers) {
  const previousById = new Map(previousTransfers.map((transfer) => [transfer.id, transfer]));
  for (const transfer of transfers) {
    const previous = previousById.get(transfer.id);
    if (previous) {
      for (const field of ["age", "position", "nationality", "flagCode", "flag", "fromClubCrest", "toClubCrest"]) {
        if (!transfer[field] && previous[field]) transfer[field] = previous[field];
      }
    }
    const previousCategory = previous;
    const previousCompetitionGender = normaliseCompetitionGender(previousCategory?.competitionGender);
    const categoryIsVerifiable = hasVerifiableCompetitionGender(
      previousCategory || {},
      previousCompetitionGender,
      previousCategory?.competitionGenderSource,
    );
    if (
      normaliseCompetitionGender(transfer.competitionGender) === "unknown"
      && previousCompetitionGender !== "unknown"
      && categoryIsVerifiable
    ) {
      transfer.competitionGender = previousCategory.competitionGender;
      transfer.competitionGenderSource = previousCategory.competitionGenderSource || "previous-snapshot";
      transfer.competitionGenderEvidence = previousCategory.competitionGenderEvidence || null;
      transfer.playerQid ||= previousCategory.playerQid || null;
    }
  }
  return transfers;
}

export function newestPreviousTransfers(payloads) {
  const latest = payloads
    .filter((payload) => Array.isArray(payload?.transfers))
    .sort((left, right) => (
      (Date.parse(right.generatedAt || "") || 0) - (Date.parse(left.generatedAt || "") || 0)
    ))[0];
  return latest ? latest.transfers.map(normaliseStoredTransfer) : [];
}

function transferUsesSource(transfer, sourceId) {
  const adapters = new Set([transfer.sourceAdapter, ...(transfer.sourceAdapters || [])].filter(Boolean));
  return adapters.has(sourceId) || (sourceId === "wikipedia-england" && adapters.has("wikipedia"));
}

export function previousTransfersForSource(payloads, sourceId) {
  const snapshots = payloads
    .filter((payload) => Array.isArray(payload?.transfers))
    .sort((left, right) => (
      (Date.parse(right.generatedAt || "") || 0) - (Date.parse(left.generatedAt || "") || 0)
    ));

  for (const payload of snapshots) {
    const report = Array.isArray(payload.sources)
      ? payload.sources.find((source) => source?.id === sourceId)
      : null;
    const observedCount = Number.isFinite(report?.observedCount) ? report.observedCount : null;
    const entries = payload.transfers
      .map(normaliseStoredTransfer)
      .filter((transfer) => transferUsesSource(transfer, sourceId));

    if (observedCount !== null && observedCount > 0) {
      return Number(report?.count || 0) === 0 ? [] : entries;
    }
    if (entries.length) return entries;
  }

  return [];
}

async function readPreviousPayloads() {
  const snapshots = [];
  try {
    snapshots.push(JSON.parse(await readFile(OUTPUT_URL, "utf8")));
  } catch {}

  if (PREVIOUS_DEPLOYED_DATA_URL) {
    try {
      snapshots.push(JSON.parse(await fetchText(PREVIOUS_DEPLOYED_DATA_URL)));
    } catch (error) {
      console.warn(`Previous deployment snapshot unavailable: ${error.message}`);
    }
  }

  return snapshots;
}

export async function refresh() {
  const generatedAt = new Date().toISOString();
  const sourceReports = [];
  const previousPayloads = await readPreviousPayloads();
  const previousTransfers = newestPreviousTransfers(previousPayloads);

  const allSources = [...WIKIPEDIA_SOURCES, ...RSS_SOURCES];
  const results = await Promise.allSettled(allSources.map((source) => fetchText(source.url)));
  const resultById = new Map(allSources.map((source, index) => [source.id, results[index]]));
  const previousForSource = (source) => previousTransfersForSource(previousPayloads, source.id)
    .filter((transfer) => inLookback(transfer.date));

  let official = [];
  for (const source of WIKIPEDIA_SOURCES) {
    const result = resultById.get(source.id);
    let entries = [];
    let status = "ok";
    try {
      if (result.status === "rejected") throw result.reason;
      entries = source.parser === "clubs"
        ? parseWikipediaClubTransfers(result.value, source)
        : parseWikipediaDatedTransfers(result.value, source);
      entries.sort((left, right) => (
        right.date.localeCompare(left.date)
        || (right.firstSeenAt || "").localeCompare(left.firstSeenAt || "")
      ));
      entries = entries.slice(0, MAX_OFFICIAL_PER_MARKET);
    } catch (error) {
      status = "stale";
      entries = previousForSource(source);
      console.error(`${source.label}: ${error?.message || error}`);
    }
    official.push(...entries);
    sourceReports.push({
      id: source.id,
      label: source.label,
      url: source.url,
      market: source.country,
      kind: "transfer-register",
      status,
      count: entries.length,
    });
  }

  official = deduplicateTransfers(official)
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, MAX_OFFICIAL);
  carryPreviousEnrichment(official, previousTransfers);
  try {
    await enrichClubCrests(official);
  } catch (error) {
    console.warn(`Club crest enrichment skipped: ${error.message}`);
  }
  let rumours = [];
  for (const source of RSS_SOURCES) {
    const result = resultById.get(source.id);
    let entries = [];
    let status = "ok";
    let observedCount = null;
    try {
      if (result.status === "rejected") throw result.reason;
      observedCount = inspectRssPayload(result.value).observedCount;
      entries = parseRssRumours(result.value, source);
    } catch (error) {
      status = "stale";
      entries = previousForSource(source);
      console.error(`${source.label}: ${error?.message || error}`);
    }
    rumours.push(...entries);
    sourceReports.push({
      id: source.id,
      label: source.label,
      url: source.url,
      market: source.market,
      kind: "news-rss",
      status,
      count: entries.length,
      observedCount,
    });
  }

  rumours = deduplicateTransfers(rumours)
    .sort((left, right) => (right.firstSeenAt || "").localeCompare(left.firstSeenAt || ""));
  rumours = mergeHeadlineEvidence(official, rumours);
  rumours = mergeRumourFragments(rumours)
    .filter(hasStructuredRoute)
    .slice(0, MAX_RUMOURS);
  carryPreviousEnrichment(rumours, previousTransfers);

  const manualRumours = await readManualRumours();
  const transfermarktBackfill = await readTransfermarktBackfill();
  carryPreviousEnrichment(manualRumours, previousTransfers);
  carryPreviousEnrichment(transfermarktBackfill, previousTransfers);
  let transfers = deduplicateTransfers([...official, ...rumours, ...manualRumours, ...transfermarktBackfill])
    .filter(hasStructuredRoute)
    .sort((a, b) => {
      const dateOrder = b.date.localeCompare(a.date);
      if (dateOrder !== 0) return dateOrder;
      if (a.status !== b.status) return a.status === "official" ? -1 : 1;
      return (b.firstSeenAt || "").localeCompare(a.firstSeenAt || "");
    });

  try {
    await enrichPlayerDetails(transfers);
  } catch (error) {
    console.warn(`Player detail enrichment skipped: ${error.message}`);
  }
  applyCuratedPlayerMetadata(transfers, await readCuratedPlayerMetadata());
  try {
    await enrichCompetitionGenders(transfers);
  } catch (error) {
    console.warn(`Competition category enrichment skipped: ${error.message}`);
  }

  try {
    await verifyOfficialClubSources(transfers);
  } catch (error) {
    console.warn(`Official club source verification skipped: ${error.message}`);
  }
  applyCuratedOfficialSources(transfers, await readCuratedOfficialSources());
  await enrichOfficialSourcePreviews(transfers, previousTransfers);
  transfers = transfers.map(normaliseStoredTransfer);

  const withheldTransfers = transfers
    .filter((transfer) => !hasCompletePlayerMetadata(transfer))
    .map((transfer) => ({
      id: transfer.id,
      date: transfer.date,
      player: transfer.player,
      missing: [
        ...(!meaningful(transfer.nationality) ? ["nationality"] : []),
        ...(!PLAYER_POSITION_PATTERN.test(cleanText(transfer.position)) ? ["position"] : []),
      ],
    }));
  if (withheldTransfers.length) {
    console.warn(`Withheld ${withheldTransfers.length} entries without complete player metadata.`);
    transfers = transfers.filter(hasCompletePlayerMetadata);
  }

  if (!transfers.length) {
    throw new Error("No source returned entries; the previous data file was left unchanged");
  }

  const payload = { generatedAt, sources: sourceReports, withheldTransfers, transfers };
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
