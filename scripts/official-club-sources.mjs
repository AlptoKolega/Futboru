import * as cheerio from "cheerio";
import { fetchPublicHttps, readBoundedResponse } from "./safe-fetch.mjs";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ARTICLE_TIMEOUT_MS = 10_000;
const ARTICLE_MAX_BYTES = 2_000_000;
const PLAYER_TOKEN_STOPWORDS = new Set([
  "bin", "da", "de", "del", "della", "di", "dos", "du", "el", "ibn", "la", "le", "van", "von",
]);

const ANNOUNCEMENT_PATH_TERMS = new Map([
  ["announce", 8], ["announces", 8], ["announcement", 8], ["confirm", 8], ["confirms", 8],
  ["complete", 7], ["completes", 7], ["completed", 7], ["sign", 6], ["signs", 6],
  ["signed", 6], ["signing", 6], ["joins", 6], ["joined", 6], ["transfer", 5],
  ["transfers", 5], ["permanent", 4], ["arrival", 4], ["arrives", 4], ["loan", 4],
  ["departs", 4], ["departure", 4], ["leaves", 4], ["moves", 3], ["welcome", 3],
]);

const SECONDARY_CONTENT_PATH_TERMS = new Map([
  ["interview", -18], ["gallery", -18], ["photos", -18], ["pictures", -18],
  ["shop", -22], ["store", -22], ["training", -16], ["reaction", -14],
  ["video", -12], ["watch", -10], ["feature", -9], ["highlights", -12],
  ["shirt", -8], ["number", -7], ["quiz", -12], ["tickets", -20],
]);

const COMPLETION_PATTERNS = [
  /\b(?:has|have|had) (?:today )?(?:completed|finalised|finalized) (?:a |the )?(?:permanent |temporary |loan )?(?:transfer|move|signing)\b/,
  /\b(?:has|have) (?:today )?(?:signed (?:for|with|from)|joined|departed|left|moved to)\b/,
  /\b(?:signs for|joins|moves to|departs for|leaves for|moves on loan to)\b/,
  /\b(?:completed|confirmed|announced) (?:a |the )?(?:permanent |temporary |loan )?(?:signing|transfer|move|arrival|departure)\b/,
  /\b(?:we|the club) (?:can |is |are )?(?:pleased |delighted )?(?:to )?(?:confirm|announce)(?: that)?\b.{0,180}\b(?:signed|signing|joined|joins|completed|transfer|move|loan|departed|leaves)\b/,
];

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normaliseWords(value) {
  return cleanText(value)
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’'`]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function validIsoDate(value) {
  if (!ISO_DATE_PATTERN.test(value || "")) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function datePart(value) {
  const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})/);
  return match && validIsoDate(match[1]) ? match[1] : null;
}

function safeUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function pathTokens(url) {
  const parsed = safeUrl(url);
  if (!parsed) return [];
  let pathname = parsed.pathname;
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    // A malformed escape must not make the whole refresh fail. Its raw path
    // still cannot accidentally satisfy an exact normalised token match.
  }
  return normaliseWords(pathname).split(" ").filter(Boolean);
}

function normaliseOfficialWebsite(entry) {
  if (typeof entry === "string") return { url: entry, club: null };
  if (!entry || typeof entry !== "object") return null;
  return {
    url: entry.url || entry.website || entry.officialWebsite || null,
    club: cleanText(entry.club || entry.clubName) || null,
  };
}

function officialWebsiteEntries(items) {
  return (Array.isArray(items) ? items : [])
    .map(normaliseOfficialWebsite)
    .filter((entry) => entry?.url);
}

export function officialHostnameMatches(candidateUrl, officialWebsiteUrl) {
  const candidate = safeUrl(candidateUrl);
  const official = safeUrl(officialWebsiteUrl);
  if (!candidate || !official || candidate.protocol !== "https:" || official.protocol !== "https:") return false;
  const candidateHost = candidate.hostname.toLowerCase().replace(/^www\./, "");
  const officialHost = official.hostname.toLowerCase().replace(/^www\./, "");
  return candidateHost === officialHost || candidateHost.endsWith(`.${officialHost}`);
}

export function distinctivePlayerTokens(player) {
  return [...new Set(normaliseWords(player).split(" "))]
    .filter((token) => token.length >= 4 && !PLAYER_TOKEN_STOPWORDS.has(token));
}

/**
 * Parse one XML sitemap urlset. Sitemap indexes are intentionally rejected:
 * callers must choose and fetch a bounded urlset before discovery begins.
 */
export function parseOfficialClubUrlset(xml) {
  if (!cleanText(xml)) return [];
  let $;
  try {
    $ = cheerio.load(xml, { xmlMode: true });
  } catch {
    return [];
  }

  const root = $.root().children().first();
  if (String(root[0]?.name || "").toLowerCase() !== "urlset") return [];

  const byUrl = new Map();
  root.children("url").each((_, element) => {
    const loc = cleanText($(element).children("loc").first().text());
    if (!loc || byUrl.has(loc)) return;
    byUrl.set(loc, {
      url: loc,
      lastmod: cleanText($(element).children("lastmod").first().text()) || null,
    });
  });
  return [...byUrl.values()];
}

// Concise alias for callers that already know they are handling a club urlset.
export const parseUrlset = parseOfficialClubUrlset;

function officialMatch(candidateUrl, transfer, options = {}) {
  if (typeof options.isOfficialUrl === "function") {
    const result = options.isOfficialUrl(candidateUrl, transfer);
    if (result === true) return { url: candidateUrl, club: cleanText(options.publisherClub) || null };
    if (result && typeof result === "object") {
      return {
        url: result.url || result.website || candidateUrl,
        club: cleanText(result.club || result.clubName || options.publisherClub) || null,
      };
    }
    return null;
  }

  const matcher = options.matchesOfficialWebsite || officialHostnameMatches;
  for (const website of officialWebsiteEntries(options.officialWebsites)) {
    if (matcher(candidateUrl, website.url)) {
      return { ...website, club: website.club || cleanText(options.publisherClub) || null };
    }
  }
  return null;
}

function candidateDetails(entry, transfer, options = {}) {
  if (!entry || !transfer || !validIsoDate(transfer.date)) return null;
  const parsed = safeUrl(entry.url);
  if (!parsed || parsed.protocol !== "https:") return null;
  if (datePart(entry.lastmod) !== transfer.date) return null;

  const match = officialMatch(parsed.href, transfer, options);
  if (!match) return null;

  const playerTokens = distinctivePlayerTokens(transfer.player);
  if (!playerTokens.length) return null;
  const candidateTokens = new Set(pathTokens(parsed.href));
  const matchedPlayerTokens = playerTokens.filter((token) => candidateTokens.has(token));
  if (!matchedPlayerTokens.length) return null;

  return {
    url: parsed.href,
    lastmod: entry.lastmod,
    officialWebsite: match.url,
    publisherClub: match.club,
    matchedPlayerTokens,
  };
}

export function isOfficialSitemapCandidate(entry, transfer, options = {}) {
  return Boolean(candidateDetails(entry, transfer, options));
}

export function rankOfficialSourceCandidate(candidate) {
  const tokens = pathTokens(candidate?.url || candidate);
  let score = 0;
  for (const token of tokens) {
    score += ANNOUNCEMENT_PATH_TERMS.get(token) || 0;
    score += SECONDARY_CONTENT_PATH_TERMS.get(token) || 0;
  }
  return score;
}

export function rankOfficialSitemapCandidates(entries, transfer, options = {}) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => candidateDetails(entry, transfer, options))
    .filter(Boolean)
    .map((candidate) => ({
      ...candidate,
      score: rankOfficialSourceCandidate(candidate),
    }))
    .sort((left, right) => (
      right.score - left.score
      || right.matchedPlayerTokens.length - left.matchedPlayerTokens.length
      || left.url.localeCompare(right.url)
    ));
}

function articleContentFromHtml(html) {
  if (!cleanText(html)) return { text: "", fragments: [] };
  let $;
  try {
    $ = cheerio.load(html);
  } catch {
    return { text: "", fragments: [] };
  }

  const metadata = [
    $("title").first().text(),
    $('meta[property="og:title"]').attr("content"),
    $('meta[property="og:description"]').attr("content"),
    $('meta[name="description"]').attr("content"),
  ];
  const embeddedData = $("script")
    .toArray()
    .map((element) => $(element).text())
    .filter((value) => cleanText(value));
  $("script, style, noscript, template, svg").remove();
  const container = $("article").first().length
    ? $("article").first()
    : ($("main").first().length ? $("main").first() : $("body"));
  const blocks = container.find("h1, h2, h3, p, li, figcaption")
    .toArray()
    .map((element) => $(element).text())
    .filter((value) => cleanText(value));
  if (!blocks.length) blocks.push(container.text());

  const rawParts = [...metadata, ...blocks, ...embeddedData].filter((value) => cleanText(value));
  const fragments = rawParts
    .flatMap((value) => String(value).split(/(?:[.!?]+\s+|[\r\n]+|[{}]+|","|":"?)/))
    .flatMap((value) => {
      const cleaned = cleanText(value);
      if (cleaned.length <= 600) return [cleaned];
      const chunks = [];
      for (let offset = 0; offset < cleaned.length; offset += 600) chunks.push(cleaned.slice(offset, offset + 600));
      return chunks;
    })
    .map(normaliseWords)
    .filter(Boolean);
  return {
    text: normaliseWords(rawParts.join(" ").slice(0, 1_500_000)),
    fragments,
  };
}

function containsPhrase(text, phrase) {
  const needle = normaliseWords(phrase);
  if (!needle) return false;
  return ` ${text} `.includes(` ${needle} `);
}

function clubIdentity(value) {
  return normaliseWords(value)
    .replace(/\b(?:association football club|football club|futbol club|fc|afc|cf|sc)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function counterpartClubs(transfer, publisherClub) {
  const fromIdentity = clubIdentity(transfer?.fromClub);
  const toIdentity = clubIdentity(transfer?.toClub);
  const publisherIdentity = clubIdentity(publisherClub);
  if (publisherIdentity && publisherIdentity === fromIdentity) return [transfer.toClub];
  if (publisherIdentity && publisherIdentity === toIdentity) return [transfer.fromClub];
  // Without a trustworthy club-to-domain mapping, require both ends. This is
  // intentionally stricter than accepting the official site's own masthead.
  return [transfer?.fromClub, transfer?.toClub];
}

function regexPhrase(value) {
  return normaliseWords(value)
    .split(" ")
    .filter(Boolean)
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
}

function hasDirectionalTransferEvidence(fragments, transfer, publisherClub) {
  const player = regexPhrase(transfer?.player);
  const fromClub = regexPhrase(clubIdentity(transfer?.fromClub));
  const toClub = regexPhrase(clubIdentity(transfer?.toClub));
  if (!player || !fromClub || !toClub) return false;

  const publisher = clubIdentity(publisherClub);
  const fromPublisher = publisher && publisher === clubIdentity(transfer?.fromClub);
  const toPublisher = publisher && publisher === clubIdentity(transfer?.toClub);
  const gap = ".{0,180}";
  const playerExpr = `\\b${player}\\b`;
  const fromExpr = `\\b${fromClub}\\b`;
  const toExpr = `\\b${toClub}\\b`;
  const destinationMovement = "(?:completed|finalised|finalized|joins|joined|signs|signed|moves|moved|transfers|transferred|loaned|departs|departed|leaves|left)";
  const originMovement = "(?:joins|joined|signs|signed|arrives|arrived|moves|moved|transfers|transferred|loaned|acquired)";
  const destinationSigning = "(?:signs?|signed|signing|completes?|completed|recruits?|recruited|acquires?|acquired|welcomes?|welcome)";
  const sellerMovement = "(?:sells?|sold|transfers?|transferred|loans?|loaned|releases?|released)";

  const fromClubPatterns = [
    new RegExp(`${playerExpr}${gap}${destinationMovement}${gap}\\b(?:to|for|with|at)\\s+${toClub}\\b`),
    new RegExp(`${playerExpr}${gap}\\b(?:joins?|joined)\\s+${toClub}\\b`),
    new RegExp(`${toExpr}${gap}${destinationSigning}${gap}${playerExpr}`),
  ];
  const toClubPatterns = [
    new RegExp(`${playerExpr}${gap}${originMovement}${gap}\\bfrom\\s+${fromClub}\\b`),
    new RegExp(`${fromExpr}${gap}${sellerMovement}${gap}${playerExpr}`),
  ];
  const explicitRoutePatterns = [
    new RegExp(`${fromExpr}${gap}${sellerMovement}${gap}${playerExpr}${gap}\\bto\\s+${toClub}\\b`),
    new RegExp(`${playerExpr}${gap}\\bfrom\\s+${fromClub}\\b${gap}\\b(?:to|joins?|joined|signs?|signed)\\b${gap}${toExpr}`),
    new RegExp(`${playerExpr}${gap}\\b(?:to|joins?|joined|signs?|signed)\\b${gap}${toExpr}${gap}\\bfrom\\s+${fromClub}\\b`),
  ];

  return fragments.some((fragment) => {
    if (!containsPhrase(fragment, transfer?.player)) return false;
    if (/\b(?:renewed|renews|extended|extends|extension|renewal)\b.{0,80}\bcontract\b/.test(fragment)) return false;
    if (/\b(?:linked|possible|could|may|might|reportedly|interested|expected|likely)\b/.test(fragment)) return false;
    const patterns = fromPublisher
      ? fromClubPatterns
      : (toPublisher ? toClubPatterns : explicitRoutePatterns);
    return patterns.some((pattern) => pattern.test(fragment));
  });
}

export function inspectOfficialTransferArticle(html, transfer, options = {}) {
  const { text, fragments } = articleContentFromHtml(html);
  const fullPlayerIdentity = Boolean(text) && containsPhrase(text, transfer?.player);
  const contractRenewalEvidence = fullPlayerIdentity && fragments.some((fragment) => (
    (
      /\b(?:renewed|renews|extended|extends|extension|renewal)\b.{0,100}\bcontract\b/.test(fragment)
      || /\bcontract\b.{0,100}\b(?:renewed|renews|extended|extends|extension|renewal)\b/.test(fragment)
    )
  ));
  const directionalTransferEvidence = !contractRenewalEvidence
    && hasDirectionalTransferEvidence(fragments, transfer, options.publisherClub);
  const completionLanguage = directionalTransferEvidence
    || COMPLETION_PATTERNS.some((pattern) => pattern.test(text));
  const counterparts = counterpartClubs(transfer, options.publisherClub).filter(cleanText);
  const counterpartEvidence = counterparts.length > 0
    && counterparts.every((club) => containsPhrase(text, clubIdentity(club)));

  const reasons = [];
  if (!fullPlayerIdentity) reasons.push("missing-full-player-identity");
  if (!completionLanguage) reasons.push("missing-completion-language");
  if (!counterpartEvidence) reasons.push("missing-route-counterpart");
  if (fullPlayerIdentity && completionLanguage && counterpartEvidence && !directionalTransferEvidence) {
    reasons.push("missing-directional-transfer-evidence");
  }

  return {
    valid: reasons.length === 0,
    reasons,
    evidence: {
      fullPlayerIdentity,
      completionLanguage,
      counterpartEvidence,
      directionalTransferEvidence,
    },
  };
}

export function validateOfficialTransferArticle(html, transfer, options = {}) {
  return inspectOfficialTransferArticle(html, transfer, options).valid;
}

export function eflPublicArticleApiUrl(html, pageUrl) {
  const apiMatch = String(html || "").match(
    /VUE_APP_NEWSAPI:"(https:\/\/news\.cms\.admin\.gc\.[^"/]+\/v2)"/i,
  );
  if (!apiMatch) return null;
  try {
    const adminApi = new URL(apiMatch[1]);
    if (!adminApi.hostname.toLowerCase().startsWith("news.cms.admin.gc.")) return null;
    const publicApi = new URL(adminApi.href.replace(".admin.", ".web.").replace(/\/v2\/?$/, "/v1/byslug"));
    publicApi.searchParams.set("postSlug", new URL(pageUrl).pathname);
    return publicApi.href;
  } catch {
    return null;
  }
}

async function defaultFetchArticle(url) {
  const fetched = await fetchPublicHttps(url, {
    timeoutMs: ARTICLE_TIMEOUT_MS,
    requestInit: {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Futboru/0.1 (+https://github.com/AlptoKolega/Futboru; official-source discovery)",
      },
    },
  });
  const { response } = fetched;
  if (!response.ok) throw new Error(`Official article returned HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
    throw new Error("Official article did not return HTML");
  }
  const html = new TextDecoder().decode(await readBoundedResponse(response, ARTICLE_MAX_BYTES));

  // EFL Digital club sites render articles client-side, but expose the
  // read-only news endpoint used by their own public frontend. It is used only
  // to validate the article metadata/body; the canonical club page remains
  // the source shown to readers.
  const publicApiUrl = eflPublicArticleApiUrl(html, fetched.url);
  if (publicApiUrl) {
    try {
      const apiFetch = await fetchPublicHttps(publicApiUrl, {
        timeoutMs: ARTICLE_TIMEOUT_MS,
        requestInit: {
          headers: { Accept: "application/json", "User-Agent": "Futboru/0.1 official-source discovery" },
        },
      });
      const apiResponse = apiFetch.response;
      if (apiResponse.ok) {
        const apiBody = await readBoundedResponse(apiResponse, ARTICLE_MAX_BYTES);
        const json = new TextDecoder().decode(apiBody);
        return { url: fetched.url, html: `<script type="application/json">${json}</script>` };
      }
    } catch {
      // Fall back to the public page. Some clubs use another frontend stack.
    }
  }

  return { url: fetched.url, html };
}

function normaliseFetchedArticle(result, fallbackUrl) {
  if (typeof result === "string") return { url: fallbackUrl, html: result };
  if (!result || typeof result !== "object") return null;
  return {
    url: result.url || fallbackUrl,
    html: result.html ?? result.body ?? "",
  };
}

/**
 * Find a verified direct announcement for one already-structured transfer.
 * Network failures and ambiguous pages are isolated per candidate and return
 * null; discovery never promotes an unverified page.
 */
export async function discoverOfficialClubSource({
  transfer,
  sitemapXml,
  officialWebsites = [],
  publisherClub = null,
  matchesOfficialWebsite,
  isOfficialUrl,
  fetchArticle = defaultFetchArticle,
  maxCandidates = 8,
} = {}) {
  const options = {
    officialWebsites,
    publisherClub,
    matchesOfficialWebsite,
    isOfficialUrl,
  };
  const candidates = rankOfficialSitemapCandidates(
    parseOfficialClubUrlset(sitemapXml),
    transfer,
    options,
  ).slice(0, Math.max(0, maxCandidates));

  for (const candidate of candidates) {
    try {
      const fetched = normaliseFetchedArticle(await fetchArticle(candidate.url), candidate.url);
      if (!fetched?.html) continue;
      // Redirects are treated as new candidates and must pass every URL gate.
      const redirected = candidateDetails({ url: fetched.url, lastmod: candidate.lastmod }, transfer, options);
      if (!redirected) continue;
      const inspection = inspectOfficialTransferArticle(fetched.html, transfer, {
        publisherClub: redirected.publisherClub || candidate.publisherClub || publisherClub,
      });
      if (!inspection.valid) continue;
      return {
        ...candidate,
        url: fetched.url,
        publisherClub: redirected.publisherClub || candidate.publisherClub || publisherClub || null,
        verification: inspection.evidence,
      };
    } catch {
      // A blocked or malformed club page must not break the remaining source
      // discovery pass. The next ranked candidate can still be evaluated.
    }
  }
  return null;
}
