import assert from "node:assert/strict";
import test from "node:test";
import {
  discoverOfficialClubSource,
  eflPublicArticleApiUrl,
  inspectOfficialTransferArticle,
  isOfficialSitemapCandidate,
  parseOfficialClubUrlset,
  rankOfficialSitemapCandidates,
  rankOfficialSourceCandidate,
  validateOfficialTransferArticle,
} from "../scripts/official-club-sources.mjs";

const AMANI_TRANSFER = {
  date: "2026-07-15",
  player: "Amani Richards",
  fromClub: "Leicester City",
  toClub: "Barnsley",
};

const OFFICIAL_WEBSITES = [{ url: "https://www.lcfc.com", club: "Leicester City" }];

const LCFC_ANNOUNCEMENT_HTML = `
  <!doctype html>
  <html>
    <head>
      <title>Amani Richards Signs For Barnsley</title>
      <meta property="og:description"
        content="Young forward Amani Richards has completed a permanent move to Barnsley for an undisclosed fee, subject to league approval.">
    </head>
    <body>
      <article>
        <h1>Amani Richards Signs For Barnsley</h1>
        <p>Young forward Amani Richards has completed a permanent move to Barnsley for an undisclosed fee, subject to league approval.</p>
      </article>
    </body>
  </html>`;

function sitemap(entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${entries.map(({ url, lastmod }) => `<url><loc>${url}</loc><lastmod>${lastmod}</lastmod></url>`).join("")}
    </urlset>`;
}

test("urlset parser extracts and deduplicates direct URL entries but rejects sitemap indexes", () => {
  const xml = sitemap([
    {
      url: "https://www.lcfc.com/media-article/amani-richards-signs-barnsley-transfer-leicester-city",
      lastmod: "2026-07-15T12:00:00+01:00",
    },
    {
      url: "https://www.lcfc.com/media-article/amani-richards-signs-barnsley-transfer-leicester-city",
      lastmod: "2026-07-15T13:00:00+01:00",
    },
  ]);

  assert.deepEqual(parseOfficialClubUrlset(xml), [{
    url: "https://www.lcfc.com/media-article/amani-richards-signs-barnsley-transfer-leicester-city",
    lastmod: "2026-07-15T12:00:00+01:00",
  }]);
  assert.deepEqual(parseOfficialClubUrlset(`
    <sitemapindex><sitemap><loc>https://www.lcfc.com/sitemap-news.xml</loc></sitemap></sitemapindex>
  `), []);
});

test("candidate gate requires HTTPS, exact transfer date, official host and a distinctive player path token", () => {
  const valid = {
    url: "https://www.lcfc.com/media-article/amani-richards-signs-barnsley-transfer-leicester-city",
    lastmod: "2026-07-15T12:00:00+01:00",
  };
  const options = { officialWebsites: OFFICIAL_WEBSITES };

  assert.equal(isOfficialSitemapCandidate(valid, AMANI_TRANSFER, options), true);
  assert.equal(isOfficialSitemapCandidate({ ...valid, url: valid.url.replace("https:", "http:") }, AMANI_TRANSFER, options), false);
  assert.equal(isOfficialSitemapCandidate({ ...valid, lastmod: "2026-07-14" }, AMANI_TRANSFER, options), false);
  assert.equal(isOfficialSitemapCandidate({ ...valid, url: valid.url.replace("www.lcfc.com", "news.example") }, AMANI_TRANSFER, options), false);
  assert.equal(isOfficialSitemapCandidate({ ...valid, url: "https://www.lcfc.com/media-article/barnsley-transfer" }, AMANI_TRANSFER, options), false);
});

test("announcement paths rank above interviews, galleries, shop pages and training follow-ups", () => {
  const announcement = "https://www.lcfc.com/media-article/amani-richards-signs-barnsley-transfer-leicester-city";
  const alternatives = [
    "https://www.lcfc.com/interview/amani-richards-first-interview",
    "https://www.lcfc.com/gallery/amani-richards-signing-photos",
    "https://www.lcfc.com/shop/amani-richards-shirt",
    "https://www.lcfc.com/training/amani-richards-first-session",
  ];

  assert.ok(alternatives.every((url) => (
    rankOfficialSourceCandidate(announcement) > rankOfficialSourceCandidate(url)
  )));

  const ranked = rankOfficialSitemapCandidates(
    alternatives.concat(announcement).map((url) => ({ url, lastmod: "2026-07-15" })),
    AMANI_TRANSFER,
    { officialWebsites: OFFICIAL_WEBSITES },
  );
  assert.equal(ranked[0].url, announcement);
});

test("article validator requires full identity, completion wording and the route counterpart", () => {
  assert.equal(validateOfficialTransferArticle(LCFC_ANNOUNCEMENT_HTML, AMANI_TRANSFER, {
    publisherClub: "Leicester City",
  }), true);

  const partialName = LCFC_ANNOUNCEMENT_HTML.replaceAll("Amani Richards", "Amani");
  assert.deepEqual(
    inspectOfficialTransferArticle(partialName, AMANI_TRANSFER, { publisherClub: "Leicester City" }).reasons,
    ["missing-full-player-identity"],
  );

  const rumour = `<article>Amani Richards is linked with a possible move to Barnsley.</article>`;
  assert.deepEqual(
    inspectOfficialTransferArticle(rumour, AMANI_TRANSFER, { publisherClub: "Leicester City" }).reasons,
    ["missing-completion-language"],
  );

  const missingRoute = `<article>Amani Richards has completed a permanent transfer.</article>`;
  assert.deepEqual(
    inspectOfficialTransferArticle(missingRoute, AMANI_TRANSFER, { publisherClub: "Leicester City" }).reasons,
    ["missing-route-counterpart"],
  );

  const clientRendered = `
    <html><body><div id="__nuxt"></div><script>
      window.__NUXT__={article:{title:"Amani Richards joins Barnsley",
        description:"Leicester City confirm Amani Richards has joined Barnsley on a permanent transfer."}};
    </script></body></html>`;
  assert.equal(validateOfficialTransferArticle(clientRendered, AMANI_TRANSFER, {
    publisherClub: "Leicester City",
  }), true);
});

test("EFL client configuration maps to its bounded public article endpoint", () => {
  const html = '<script>window.config={VUE_APP_NEWSAPI:"https://news.cms.admin.gc.safcservices.com/v2"}</script>';
  assert.equal(
    eflPublicArticleApiUrl(html, "https://www.safc.com/news/2026/july/15/thomas-meunier-joins-sunderland/"),
    "https://news.cms.web.gc.safcservices.com/v1/byslug?postSlug=%2Fnews%2F2026%2Fjuly%2F15%2Fthomas-meunier-joins-sunderland%2F",
  );
  assert.equal(eflPublicArticleApiUrl("VUE_APP_NEWSAPI:\"https://evil.example/v2\"", "https://club.test/news"), null);
});

test("discovery fetches ranked pages, accepts the LCFC announcement and rejects off-domain redirects", async () => {
  const announcementUrl = "https://www.lcfc.com/media-article/amani-richards-signs-barnsley-transfer-leicester-city";
  const interviewUrl = "https://www.lcfc.com/interview/amani-richards-first-interview";
  const xml = sitemap([
    { url: interviewUrl, lastmod: "2026-07-15T14:00:00Z" },
    { url: announcementUrl, lastmod: "2026-07-15T12:00:00Z" },
  ]);
  const fetched = [];

  const source = await discoverOfficialClubSource({
    transfer: AMANI_TRANSFER,
    sitemapXml: xml,
    officialWebsites: OFFICIAL_WEBSITES,
    fetchArticle: async (url) => {
      fetched.push(url);
      return { url, html: LCFC_ANNOUNCEMENT_HTML };
    },
  });

  assert.equal(source.url, announcementUrl);
  assert.deepEqual(fetched, [announcementUrl]);
  assert.deepEqual(source.verification, {
    fullPlayerIdentity: true,
    completionLanguage: true,
    counterpartEvidence: true,
    directionalTransferEvidence: true,
  });

  const redirected = await discoverOfficialClubSource({
    transfer: AMANI_TRANSFER,
    sitemapXml: sitemap([{ url: announcementUrl, lastmod: "2026-07-15" }]),
    officialWebsites: OFFICIAL_WEBSITES,
    fetchArticle: async () => ({
      url: "https://example.com/media-article/amani-richards-signs-barnsley",
      html: LCFC_ANNOUNCEMENT_HTML,
    }),
  });
  assert.equal(redirected, null);
});

test("article validation rejects contract renewals, reversed routes and unrelated evidence", () => {
  const renewal = `
    <article>
      <p>Leicester City can confirm Amani Richards has extended his long-term contract.</p>
      <p>Amani Richards originally joined the club from Barnsley as an academy player.</p>
    </article>`;
  const reverseRoute = `
    <article>Amani Richards has joined Leicester City from Barnsley on a permanent transfer.</article>`;
  const unrelated = `
    <article>
      <p>Amani Richards discusses pre-season with Leicester City.</p>
      <p>Another player has completed a permanent move to Barnsley.</p>
    </article>`;

  for (const html of [renewal, reverseRoute, unrelated]) {
    const inspection = inspectOfficialTransferArticle(html, AMANI_TRANSFER, {
      publisherClub: "Leicester City",
    });
    assert.equal(inspection.valid, false);
    assert.equal(inspection.evidence.directionalTransferEvidence, false);
  }

  const historicalTransferOnRenewalPage = `
    <article>
      <p>Amani Richards joined Barnsley from Leicester City in 2024.</p>
      <p>Amani Richards has now extended his contract until 2030.</p>
    </article>`;
  const renewalInspection = inspectOfficialTransferArticle(
    historicalTransferOnRenewalPage,
    AMANI_TRANSFER,
    { publisherClub: "Barnsley" },
  );
  assert.equal(renewalInspection.valid, false);
  assert.equal(renewalInspection.evidence.directionalTransferEvidence, false);

  const pronounRenewal = `
    <article>
      <h1>Amani Richards signs new Barnsley deal</h1>
      <p>Amani Richards joined Barnsley from Leicester City in 2024.</p>
      <p>The forward has now extended his contract until 2030.</p>
    </article>`;
  const pronounInspection = inspectOfficialTransferArticle(pronounRenewal, AMANI_TRANSFER, {
    publisherClub: "Barnsley",
  });
  assert.equal(pronounInspection.valid, false);
  assert.equal(pronounInspection.evidence.directionalTransferEvidence, false);
});
