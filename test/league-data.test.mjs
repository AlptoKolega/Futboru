import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ALL_LEAGUE_IDS,
  LEAGUE_COUNTRIES,
  buildSeasonClubIndex,
  enrichLeagueMemberships,
  transferMatchesLeagueSelection,
} from "../league-data.js";

const clubCatalog = JSON.parse(
  await readFile(new URL("../data/competition-clubs.json", import.meta.url), "utf8"),
);

test("league filter exposes 11 countries and the 26 tracked competitions", () => {
  assert.equal(LEAGUE_COUNTRIES.length, 11);
  assert.equal(ALL_LEAGUE_IDS.length, 26);
  assert.deepEqual(
    LEAGUE_COUNTRIES.map(({ flagCode }) => flagCode),
    ["gb-eng", "de", "it", "fr", "nl", "pl", "gb-sct", "dk", "ch", "no", "se"],
  );
  assert.equal(new Set(ALL_LEAGUE_IDS).size, 26);
});

test("season club catalog rejects a club assigned to two leagues", () => {
  assert.throws(() => buildSeasonClubIndex({
    season: "2026-27",
    competitions: {
      "eng.premier-league": ["Example FC"],
      "eng.championship": ["Example FC"],
    },
  }), /assigned to multiple leagues/i);
});

test("a transfer between covered English tiers matches either endpoint league", () => {
  const [transfer] = enrichLeagueMemberships([{
    fromClub: "Burnley",
    toClub: "Manchester City",
    competitionIds: [],
  }], clubCatalog);

  assert.deepEqual(transfer.competitionIds, ["eng.premier-league", "eng.championship"]);
  assert.equal(transferMatchesLeagueSelection(transfer, new Set(["eng.premier-league"])), true);
  assert.equal(transferMatchesLeagueSelection(transfer, new Set(["eng.championship"])), true);
  assert.equal(transferMatchesLeagueSelection(transfer, new Set(["ger.bundesliga"])), false);
});

test("publisher market never creates a league assignment", () => {
  const [transfer] = enrichLeagueMemberships([{
    player: "Jeremy Monga",
    fromClub: "Leicester City",
    toClub: "Toronto FC",
    market: "Netherlands",
    markets: ["Netherlands"],
    competitionIds: [],
  }], clubCatalog);

  assert.deepEqual(transfer.competitionIds, ["eng.league-one"]);
  assert.equal(transfer.competitionIds.includes("ned.eredivisie"), false);
});

test("Scottish lower-division endpoints remain filterable", () => {
  const [transfer] = enrichLeagueMemberships([{
    fromClub: "Hamilton Academical",
    toClub: "Airdrieonians",
  }], clubCatalog);

  assert.deepEqual(transfer.competitionIds, ["sco.league-one"]);
  assert.equal(transfer.leagueMemberships.length, 2);
});

test("second-tier endpoints outside the original register section remain filterable", () => {
  const transfers = enrichLeagueMemberships([
    { fromClub: "Vitesse", toClub: "Ajax" },
    { fromClub: "Odra Opole", toClub: "Legia Warsaw" },
    { fromClub: "FC Winterthur", toClub: "FC Basel" },
  ], clubCatalog);

  assert.equal(transfers[0].competitionIds.includes("ned.eerste-divisie"), true);
  assert.equal(transfers[1].competitionIds.includes("pol.i-liga"), true);
  assert.equal(transfers[2].competitionIds.includes("sui.challenge-league"), true);
});

test("register-section memberships survive enrichment and combine across two tiers", () => {
  const [transfer] = enrichLeagueMemberships([{
    fromClub: "Mainz 05",
    toClub: "Greuther Fürth",
    competition: "Bundesliga",
    competitions: ["Bundesliga", "2. Bundesliga"],
    leagueMemberships: [
      { side: "from", competitionId: "ger.bundesliga", season: "2026-27", provenance: "register-section" },
      { side: "to", competitionId: "ger.2-bundesliga", season: "2026-27", provenance: "register-section" },
    ],
  }], clubCatalog);

  assert.deepEqual(transfer.competitionIds, ["ger.bundesliga", "ger.2-bundesliga"]);
  assert.equal(transfer.leagueMemberships.length, 2);
});

test("register memberships seed name matching for rumours from the same club", () => {
  const transfers = enrichLeagueMemberships([
    {
      fromClub: "Olympique Lyonnais",
      toClub: "Rennes",
      leagueMemberships: [
        { side: "from", competitionId: "fra.ligue-1", season: "2026-27", provenance: "register-section" },
      ],
    },
    {
      fromClub: "Olympique Lyonnais",
      toClub: "New England Revolution",
      status: "rumour",
    },
  ], clubCatalog);

  assert.deepEqual(transfers[1].competitionIds, ["fra.ligue-1"]);
  assert.equal(transfers[1].leagueMemberships[0].provenance, "season-club-map");
});

test("all leagues preserve unclassified rows while a narrowed selection hides them", () => {
  const transfer = { competitionIds: [] };
  assert.equal(transferMatchesLeagueSelection(transfer, new Set(ALL_LEAGUE_IDS)), true);
  assert.equal(transferMatchesLeagueSelection(transfer, new Set(["eng.premier-league"])), false);
  assert.equal(transferMatchesLeagueSelection(transfer, new Set()), false);
});
