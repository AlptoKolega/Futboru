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
    parser: "dated",
  },
  {
    id: "wikipedia-germany",
    label: "Germany transfer register",
    url: "https://en.wikipedia.org/wiki/List_of_German_football_transfers_summer_2026",
    country: "Germany",
    parser: "clubs",
  },
  {
    id: "wikipedia-italy",
    label: "Italy transfer register",
    url: "https://en.wikipedia.org/wiki/List_of_Italian_football_transfers_summer_2026",
    country: "Italy",
    competition: "Serie A / Serie B",
    parser: "dated",
  },
  {
    id: "wikipedia-france",
    label: "France transfer register",
    url: "https://en.wikipedia.org/wiki/List_of_French_football_transfers_summer_2026",
    country: "France",
    parser: "clubs",
  },
  {
    id: "wikipedia-netherlands",
    label: "Netherlands transfer register",
    url: "https://en.wikipedia.org/wiki/List_of_Dutch_football_transfers_summer_2026",
    country: "Netherlands",
    parser: "clubs",
  },
  {
    id: "wikipedia-poland",
    label: "Poland transfer register",
    url: "https://en.wikipedia.org/wiki/List_of_Polish_football_transfers_summer_2026",
    country: "Poland",
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
    pattern: /\b(transfer|wechsel|wechselt|verpflicht\w*|leihe|ausleih\w*|abgang|zugang|einig|interess\w*|deal)\b/i,
  },
  {
    id: "sportschau-rss",
    label: "Sportschau",
    url: "https://www.sportschau.de/fussball/bundesliga/index~rss2.xml",
    market: "Germany",
    pattern: /\b(transfer\w*|wechsel\w*|verpflicht\w*|leihe|ausleih\w*|abgang|zugang|einig|interess\w*)\b/i,
    excludePattern: /wechselb[oö]rse|[uü]bersicht der sommertransfers/i,
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
    pattern: /\b(fichaje\w*|traspas\w*|cesi[oó]n|transfer\w*|acuerdo|firma\w*)\b|a un paso/i,
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
    linkPattern: /\/futebol\//i,
  },
];

const OUTPUT_URL = new URL("../data/transfers.json", import.meta.url);
const MANUAL_RUMOURS_URL = new URL("../data/manual-rumours.json", import.meta.url);
const USER_AGENT = "Futboru/0.1 (+https://github.com/AlptoKolega/Futboru; public transfer-feed PoC)";
const LOOKBACK_DAYS = Number(process.env.LOOKBACK_DAYS || 14);
const MAX_OFFICIAL = Number(process.env.MAX_OFFICIAL || 300);
const MAX_OFFICIAL_PER_MARKET = Number(process.env.MAX_OFFICIAL_PER_MARKET || 60);
const MAX_RUMOURS = Number(process.env.MAX_RUMOURS || 48);
const MAX_RUMOURS_PER_SOURCE = Number(process.env.MAX_RUMOURS_PER_SOURCE || 4);

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

function sourceRole(url, { allowPrimary = false } = {}) {
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
  return allowPrimary ? "primary_official" : "publication";
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
    const role = sourceRole(sourceUrl, { allowPrimary: Boolean(reference?.url) });
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
        const role = sourceRole(sourceUrl, { allowPrimary: Boolean(reference?.url) });
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

export function parseRssRumours(xml, config = RSS_SOURCES[0], now = new Date()) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const rumours = [];
  const maxItems = Number(config.maxItems || MAX_RUMOURS_PER_SOURCE);

  $("item, entry").each((_, item) => {
    if (rumours.length >= maxItems) return;
    const title = cleanText($(item).find("title").first().text());
    const linkNode = $(item).find("link").first();
    const link = cleanText(linkNode.text() || linkNode.attr("href"));
    const publishedText = cleanText($(item).find("pubDate, published, updated, dc\\:date").first().text());
    const published = new Date(publishedText);
    if (!title || !link || Number.isNaN(published.getTime()) || !config.pattern.test(title)) return;
    if (config.excludePattern?.test(title) || (config.linkPattern && !config.linkPattern.test(link))) return;
    if (now.getTime() - published.getTime() > LOOKBACK_DAYS * 86_400_000) return;

    const displayTitle = cleanText(title.replace(config.stripPrefix || /^$/, ""));
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
      market: config.market || null,
      markets: config.market ? [config.market] : [],
      competition: config.competition || null,
      sourceAdapter: config.id,
      sourceRole: config.sourceRole || "publication",
      sourceName: config.label,
      sourceUrl: link,
      sources: [sourceEvidence(config.label, link, config.sourceRole || "publication")],
      firstSeenAt: published.toISOString(),
    });
  });

  return rumours;
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
  const citizenshipIds = [...new Set(qids.flatMap((qid) => claimIds(entities[qid], "P27")))];
  const relatedEntities = await wikidataEntities([...positionIds, ...citizenshipIds], "labels");

  for (let index = 0; index < withPages.length; index += 1) {
    const transfer = withPages[index];
    const qid = pageMetadata.get(titles[index]?.toLowerCase())?.qid;
    const entity = entities[qid];
    if (!entity) continue;

    const birthTime = entity?.claims?.P569?.[0]?.mainsnak?.datavalue?.value?.time;
    const enrichedAge = ageAt(birthTime, transfer.date);
    const enrichedPosition = compactPositionCodes(claimIds(entity, "P413"), relatedEntities);
    const citizenshipId = claimIds(entity, "P27")[0];
    const enrichedNationality = relatedEntities[citizenshipId]?.labels?.en?.value || null;
    if (enrichedAge !== null) transfer.age = enrichedAge;
    if (enrichedPosition) transfer.position = enrichedPosition;
    if (!transfer.nationality && enrichedNationality) {
      transfer.nationality = enrichedNationality;
      transfer.flagCode = flagCodeFromName(enrichedNationality);
      transfer.flag = flagFromName(enrichedNationality);
    }

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
        sourceRole: item.sourceRole || (item.platform === "facebook" ? "community" : "reporter"),
        time: "—",
        ...item,
        id: item.id || createHash("sha1").update(`manual|${item.sourceUrl}`).digest("hex").slice(0, 14),
      };
      record.flagCode ||= flagCodeFromName(record.nationality);
      record.flag ||= flagFromName(record.nationality);
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

function hasStructuredRoute(transfer) {
  return [transfer.player, transfer.fromClub, transfer.toClub]
    .every((value) => cleanText(value) && !/^(?:—|-|unknown)$/i.test(cleanText(value)));
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
  for (const source of [...items, ...fallback]) {
    if (!source?.url) continue;
    byUrl.set(source.url, {
      name: source.name || sourceLabel(source.url),
      url: source.url,
      role: source.role || sourceRole(source.url),
    });
  }
  return [...byUrl.values()];
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
  return ` ${headlineKey} `.includes(` ${playerKey} `);
}

export function mergeHeadlineEvidence(structuredTransfers, newsSignals) {
  const remainingSignals = [];

  for (const signal of newsSignals) {
    const matches = structuredTransfers.filter((transfer) => (
      hasStructuredRoute(transfer)
      && dayDistance(transfer.date, signal.date) <= 7
      && headlineContainsPlayer(signal.player, transfer.player)
    ));

    if (matches.length === 1) {
      mergeTransfer(matches[0], signal);
    } else {
      remainingSignals.push(signal);
    }
  }

  return remainingSignals;
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
    sourceRole: transfer.sourceRole || sourceRole(transfer.sourceUrl),
    sourceAdapters: Array.isArray(transfer.sourceAdapters)
      ? transfer.sourceAdapters
      : (transfer.sourceAdapter ? [transfer.sourceAdapter] : []),
  };
  normalized.sources = transferSources(normalized);
  return normalized;
}

function carryPreviousEnrichment(transfers, previousTransfers) {
  const previousById = new Map(previousTransfers.map((transfer) => [transfer.id, transfer]));
  for (const transfer of transfers) {
    const previous = previousById.get(transfer.id);
    if (!previous) continue;
    for (const field of ["age", "position", "nationality", "flagCode", "flag", "fromClubCrest", "toClubCrest"]) {
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

  const allSources = [...WIKIPEDIA_SOURCES, ...RSS_SOURCES];
  const results = await Promise.allSettled(allSources.map((source) => fetchText(source.url)));
  const resultById = new Map(allSources.map((source, index) => [source.id, results[index]]));
  const previousForSource = (source) => previousTransfers.filter((transfer) => (
    inLookback(transfer.date)
    && (
      transfer.sourceAdapter === source.id
      || transfer.sourceAdapters?.includes(source.id)
      || (source.id === "wikipedia-england" && transfer.sourceAdapter === "wikipedia")
    )
  ));

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
  try {
    await enrichPlayerDetails(official);
  } catch (error) {
    console.warn(`Player detail enrichment skipped: ${error.message}`);
  }

  let rumours = [];
  for (const source of RSS_SOURCES) {
    const result = resultById.get(source.id);
    let entries = [];
    let status = "ok";
    try {
      if (result.status === "rejected") throw result.reason;
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
    });
  }

  rumours = deduplicateTransfers(rumours)
    .sort((left, right) => (right.firstSeenAt || "").localeCompare(left.firstSeenAt || ""))
    .slice(0, MAX_RUMOURS);
  rumours = mergeHeadlineEvidence(official, rumours);

  const manualRumours = await readManualRumours();
  const transfers = deduplicateTransfers([...official, ...rumours, ...manualRumours]).sort((a, b) => {
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
