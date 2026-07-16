export const LEAGUE_SEASON = "2026-27";

export const LEAGUE_COUNTRIES = Object.freeze([
  {
    id: "eng",
    name: "England",
    flagCode: "gb-eng",
    leagues: [
      { id: "eng.premier-league", name: "Premier League" },
      { id: "eng.championship", name: "Championship" },
      { id: "eng.league-one", name: "League One" },
      { id: "eng.league-two", name: "League Two" },
    ],
  },
  {
    id: "ger",
    name: "Germany",
    flagCode: "de",
    leagues: [
      { id: "ger.bundesliga", name: "Bundesliga" },
      { id: "ger.2-bundesliga", name: "2. Bundesliga" },
    ],
  },
  {
    id: "ita",
    name: "Italy",
    flagCode: "it",
    leagues: [
      { id: "ita.serie-a", name: "Serie A" },
      { id: "ita.serie-b", name: "Serie B" },
    ],
  },
  {
    id: "fra",
    name: "France",
    flagCode: "fr",
    leagues: [
      { id: "fra.ligue-1", name: "Ligue 1" },
      { id: "fra.ligue-2", name: "Ligue 2" },
    ],
  },
  {
    id: "ned",
    name: "Netherlands",
    flagCode: "nl",
    leagues: [
      { id: "ned.eredivisie", name: "Eredivisie" },
      { id: "ned.eerste-divisie", name: "Eerste Divisie" },
    ],
  },
  {
    id: "pol",
    name: "Poland",
    flagCode: "pl",
    leagues: [
      { id: "pol.ekstraklasa", name: "Ekstraklasa" },
      { id: "pol.i-liga", name: "I liga" },
    ],
  },
  {
    id: "sco",
    name: "Scotland",
    flagCode: "gb-sct",
    leagues: [
      { id: "sco.premiership", name: "Premiership" },
      { id: "sco.championship", name: "Championship" },
      { id: "sco.league-one", name: "League One" },
      { id: "sco.league-two", name: "League Two" },
    ],
  },
  {
    id: "den",
    name: "Denmark",
    flagCode: "dk",
    leagues: [
      { id: "den.superliga", name: "Superliga" },
      { id: "den.1-division", name: "1st Division" },
    ],
  },
  {
    id: "sui",
    name: "Switzerland",
    flagCode: "ch",
    leagues: [
      { id: "sui.super-league", name: "Super League" },
      { id: "sui.challenge-league", name: "Challenge League" },
    ],
  },
  {
    id: "nor",
    name: "Norway",
    flagCode: "no",
    leagues: [
      { id: "nor.eliteserien", name: "Eliteserien" },
      { id: "nor.1-division", name: "First Division" },
    ],
  },
  {
    id: "swe",
    name: "Sweden",
    flagCode: "se",
    leagues: [
      { id: "swe.allsvenskan", name: "Allsvenskan" },
      { id: "swe.superettan", name: "Superettan" },
    ],
  },
]);

export const ALL_LEAGUE_IDS = Object.freeze(
  LEAGUE_COUNTRIES.flatMap((country) => country.leagues.map((league) => league.id)),
);

const LEAGUE_ID_SET = new Set(ALL_LEAGUE_IDS);

const COMPETITION_IDS = new Map([
  ["bundesliga", "ger.bundesliga"],
  ["2 bundesliga", "ger.2-bundesliga"],
  ["ligue 1", "fra.ligue-1"],
  ["ligue 2", "fra.ligue-2"],
  ["eredivisie", "ned.eredivisie"],
  ["eerste divisie", "ned.eerste-divisie"],
  ["ekstraklasa", "pol.ekstraklasa"],
  ["i liga", "pol.i-liga"],
  ["superliga", "den.superliga"],
  ["1 division", "den.1-division"],
  ["swiss super league", "sui.super-league"],
  ["challenge league", "sui.challenge-league"],
  ["swiss challenge league", "sui.challenge-league"],
  ["eliteserien", "nor.eliteserien"],
  ["1 divisjon", "nor.1-division"],
  ["allsvenskan", "swe.allsvenskan"],
  ["superettan", "swe.superettan"],
]);

function canonicalText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’'`]/g, "")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function canonicalClubName(value) {
  return canonicalText(value)
    .replace(/\b(?:football club|futbol club|fussball club|societa sportiva|sporting club|fc|afc|cf|sc|ac|fk|ks|sk)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function competitionIdFromLabel(value) {
  return COMPETITION_IDS.get(canonicalText(value)) || null;
}

export function isLeagueId(value) {
  return LEAGUE_ID_SET.has(value);
}

const CLUB_ALIASES = new Map([
  ["brighton", "brighton and hove albion"],
  ["internazionale", "inter"],
  ["inter milan", "inter"],
  ["leicester", "leicester city"],
  ["milan", "milan"],
  ["olympique de marseille", "marseille"],
  ["olympique lyonnais", "lyon"],
  ["rc lens", "lens"],
  ["rc strasbourg alsace", "strasbourg"],
  ["stade rennais", "rennes"],
  ["as monaco", "monaco"],
  ["ogc nice", "nice"],
  ["queens park", "queens park"],
  ["tottenham", "tottenham hotspur"],
  ["verona", "hellas verona"],
  ["vicenza", "l r vicenza"],
  ["west brom", "west bromwich albion"],
  ["wolves", "wolverhampton wanderers"],
]);

function aliasedClubName(value) {
  const key = canonicalClubName(value);
  return CLUB_ALIASES.get(key) || key;
}

export function buildSeasonClubIndex(catalog) {
  const index = new Map();
  const collisions = [];
  const competitions = catalog?.competitions && typeof catalog.competitions === "object"
    ? catalog.competitions
    : {};

  for (const [competitionId, clubs] of Object.entries(competitions)) {
    if (!isLeagueId(competitionId) || !Array.isArray(clubs)) continue;
    for (const club of clubs) {
      const key = aliasedClubName(club);
      if (!key) continue;
      const current = index.get(key);
      if (current && current !== competitionId) collisions.push({ club, current, competitionId });
      else index.set(key, competitionId);
    }
  }

  if (collisions.length) {
    throw new Error(`Club assigned to multiple leagues in ${catalog?.season || "the active season"}: ${collisions[0].club}`);
  }
  return index;
}

function normalizedMembership(membership) {
  if (!membership || !["from", "to"].includes(membership.side)) return null;
  if (!isLeagueId(membership.competitionId)) return null;
  return {
    side: membership.side,
    competitionId: membership.competitionId,
    season: membership.season || LEAGUE_SEASON,
    provenance: membership.provenance || "source-register",
  };
}

export function leagueMembershipsForTransfer(transfer, clubIndex) {
  const memberships = (Array.isArray(transfer?.leagueMemberships) ? transfer.leagueMemberships : [])
    .map(normalizedMembership)
    .filter(Boolean);

  for (const side of ["from", "to"]) {
    const club = transfer?.[`${side}Club`];
    const competitionId = clubIndex?.get(aliasedClubName(club));
    if (!competitionId) continue;
    memberships.push({
      side,
      competitionId,
      season: LEAGUE_SEASON,
      provenance: "season-club-map",
    });
  }

  const unique = new Map();
  for (const membership of memberships) {
    unique.set(`${membership.side}|${membership.competitionId}`, membership);
  }
  return [...unique.values()];
}

export function enrichLeagueMemberships(transfers, clubCatalog) {
  const clubIndex = buildSeasonClubIndex(clubCatalog);
  for (const transfer of transfers) {
    for (const membership of (transfer?.leagueMemberships || []).map(normalizedMembership).filter(Boolean)) {
      const club = transfer?.[`${membership.side}Club`];
      const key = aliasedClubName(club);
      if (!key) continue;
      const current = clubIndex.get(key);
      if (current && current !== membership.competitionId) {
        throw new Error(`Club assigned to multiple leagues in ${LEAGUE_SEASON}: ${club}`);
      }
      clubIndex.set(key, membership.competitionId);
    }
  }

  for (const transfer of transfers) {
    transfer.leagueMemberships = leagueMembershipsForTransfer(transfer, clubIndex);
    const ids = new Set(
      (Array.isArray(transfer.competitionIds) ? transfer.competitionIds : []).filter(isLeagueId),
    );
    for (const membership of transfer.leagueMemberships) ids.add(membership.competitionId);
    for (const label of [transfer.competition, ...(transfer.competitions || [])]) {
      const competitionId = competitionIdFromLabel(label);
      if (competitionId) ids.add(competitionId);
    }
    transfer.competitionIds = ALL_LEAGUE_IDS.filter((id) => ids.has(id));
  }
  return transfers;
}

export function transferMatchesLeagueSelection(transfer, activeLeagueIds) {
  const active = activeLeagueIds instanceof Set ? activeLeagueIds : new Set(activeLeagueIds || []);
  if (active.size === ALL_LEAGUE_IDS.length) return true;
  if (active.size === 0) return false;
  const transferIds = Array.isArray(transfer?.competitionIds) ? transfer.competitionIds : [];
  return transferIds.some((competitionId) => active.has(competitionId));
}
