import {
  ALL_LEAGUE_IDS,
  LEAGUE_COUNTRIES,
  isLeagueId,
  transferMatchesLeagueSelection,
} from "./league-data.js";

const elements = {
  freshness: document.querySelector("#freshness"),
  feed: document.querySelector("#feed"),
  filterSummary: document.querySelector("#filter-summary"),
  themeColor: document.querySelector("#theme-color"),
  themeToggle: document.querySelector("#theme-toggle"),
  sourceDrawer: document.querySelector("#source-drawer"),
  sourceDrawerClose: document.querySelector("#source-drawer-close"),
  sourceDrawerLink: document.querySelector("#source-drawer-link"),
  sourceDrawerSource: document.querySelector("#source-drawer-source"),
  sourceDrawerTitle: document.querySelector("#source-drawer-title"),
  sourceDrawerDescription: document.querySelector("#source-drawer-description"),
  sourcePreviewMedia: document.querySelector("#source-preview-media"),
  sourcePreviewImage: document.querySelector("#source-preview-image"),
  sourcePreviewPlayer: document.querySelector("#source-preview-player"),
  sourcePreviewFrom: document.querySelector("#source-preview-from"),
  sourcePreviewTo: document.querySelector("#source-preview-to"),
  sourcePreviewSources: document.querySelector("#source-preview-sources"),
  sourcePreviewSourcesList: document.querySelector("#source-preview-sources-list"),
  leagueFilterTrigger: document.querySelector("#league-filter-trigger"),
  leagueFilterTriggerCount: document.querySelector("#league-filter-trigger-count"),
  leagueFilterPanel: document.querySelector("#league-filter-panel"),
  leagueFilterGrid: document.querySelector("#league-filter-grid"),
  leagueFilterSelectAll: document.querySelector("#league-filter-select-all"),
  leagueFilterClear: document.querySelector("#league-filter-clear"),
  leagueFilterClose: document.querySelector("#league-filter-close"),
  statusFilterGroup: document.querySelector(".status-filters"),
  statusFilterIndicator: document.querySelector(".status-filter-indicator"),
  statusFilters: [...document.querySelectorAll("[data-status-filter]")],
  genderFilters: [...document.querySelectorAll("[data-gender]")],
  counts: {
    all: document.querySelector("#count-all"),
    official: document.querySelector("#count-official"),
    rumour: document.querySelector("#count-rumour"),
  },
};

const state = {
  activeFilter: "all",
  activeGenders: new Set(["men", "women"]),
  activeLeagueIds: new Set(ALL_LEAGUE_IDS),
  transfers: [],
};

let sourceDrawerInvoker = null;
let statusFilterIndicatorFrame = 0;
let statusFilterIndicatorReady = false;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const COMPETITION_GENDERS = new Set(["men", "women", "unknown"]);

const fullDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Warsaw",
});

const updateDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Warsaw",
});

const POSITION_TITLES = {
  GK: "Goalkeeper",
  SW: "Sweeper",
  DR: "Right-back",
  DL: "Left-back",
  DC: "Centre-back",
  FB: "Full-back",
  WBR: "Right wing-back",
  WBL: "Left wing-back",
  WB: "Wing-back",
  DM: "Defensive midfielder",
  MR: "Right midfielder",
  ML: "Left midfielder",
  WM: "Wide midfielder",
  MC: "Central midfielder",
  AMR: "Right attacking midfielder",
  AML: "Left attacking midfielder",
  AMC: "Central attacking midfielder",
  AM: "Attacking midfielder",
  SS: "Second striker",
  ST: "Striker",
};

function dateHeading(dateKey) {
  return fullDate.format(new Date(`${dateKey}T12:00:00Z`));
}

function formatFreshness(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Update pending";
  return `Updated ${updateDate.format(date)}`;
}

function statusLabel(status) {
  if (status === "official") return "Official";
  if (status === "rumour") return "Rumour";
  return "Unknown status";
}

function competitionGender(transfer) {
  return COMPETITION_GENDERS.has(transfer?.competitionGender) ? transfer.competitionGender : "unknown";
}

function includedByGender(transfer) {
  const category = competitionGender(transfer);
  if (category === "unknown") return state.activeGenders.has("men") && state.activeGenders.has("women");
  return state.activeGenders.has(category);
}

function genderFilteredTransfers() {
  return state.transfers.filter(includedByGender);
}

function scopeFilteredTransfers() {
  return genderFilteredTransfers().filter((transfer) => (
    transferMatchesLeagueSelection(transfer, state.activeLeagueIds)
  ));
}

function visibleTransfers() {
  const transfers = scopeFilteredTransfers();
  return state.activeFilter === "all"
    ? transfers
    : transfers.filter((transfer) => transfer.status === state.activeFilter);
}

function activeLeagueLabel() {
  if (state.activeLeagueIds.size === ALL_LEAGUE_IDS.length) return "all tracked leagues";
  if (state.activeLeagueIds.size === 1) return "1 selected league";
  return `${state.activeLeagueIds.size} selected leagues`;
}

function activeGenderLabel() {
  if (state.activeGenders.size === 0) return "the selected categories";
  if (state.activeGenders.size === 2) return "men's and women's football";
  return state.activeGenders.has("women") ? "women's football" : "men's football";
}

function resultLabel(count) {
  if (state.activeFilter === "official") return count === 1 ? "official transfer" : "official transfers";
  if (state.activeFilter === "rumour") return count === 1 ? "rumour" : "rumours";
  return count === 1 ? "transfer" : "transfers";
}

function leagueCheckboxId(competitionId) {
  return `league-${competitionId.replace(/[^a-z0-9]+/gi, "-")}`;
}

function updateLeagueFilterControls() {
  for (const country of LEAGUE_COUNTRIES) {
    const leagueIds = country.leagues.map((league) => league.id);
    const selectedCount = leagueIds.filter((id) => state.activeLeagueIds.has(id)).length;
    const countryInput = elements.leagueFilterGrid.querySelector(`[data-country-id="${country.id}"]`);
    if (countryInput) {
      countryInput.checked = selectedCount === leagueIds.length;
      countryInput.indeterminate = selectedCount > 0 && selectedCount < leagueIds.length;
    }
    for (const competitionId of leagueIds) {
      const leagueInput = elements.leagueFilterGrid.querySelector(`[data-league-id="${competitionId}"]`);
      if (leagueInput) leagueInput.checked = state.activeLeagueIds.has(competitionId);
    }
  }

  const selectedCount = state.activeLeagueIds.size;
  const allSelected = selectedCount === ALL_LEAGUE_IDS.length;
  const countLabel = allSelected ? "All" : (selectedCount ? `${selectedCount}/${ALL_LEAGUE_IDS.length}` : "None");
  elements.leagueFilterTriggerCount.textContent = countLabel;
  elements.leagueFilterTrigger.setAttribute(
    "aria-label",
    allSelected ? "Leagues, all selected" : `Leagues, ${selectedCount} of ${ALL_LEAGUE_IDS.length} selected`,
  );
  elements.leagueFilterTrigger.classList.toggle("is-active", !allSelected);
  elements.leagueFilterSelectAll.disabled = allSelected;
  elements.leagueFilterClear.disabled = selectedCount === 0;
}

function applyLeagueSelection() {
  updateLeagueFilterControls();
  updateCounts();
  render();
}

function setCountryLeagues(country, checked) {
  for (const league of country.leagues) {
    if (checked) state.activeLeagueIds.add(league.id);
    else state.activeLeagueIds.delete(league.id);
  }
  applyLeagueSelection();
}

function setLeague(competitionId, checked) {
  if (checked) state.activeLeagueIds.add(competitionId);
  else state.activeLeagueIds.delete(competitionId);
  applyLeagueSelection();
}

function buildLeagueFilter() {
  const fragment = document.createDocumentFragment();

  for (const country of LEAGUE_COUNTRIES) {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "league-filter-country";

    const legend = document.createElement("legend");
    legend.className = "league-filter-country-heading";
    const countryLabel = document.createElement("label");
    countryLabel.className = "league-filter-country-toggle";
    const countryInput = document.createElement("input");
    countryInput.className = "league-filter-checkbox";
    countryInput.type = "checkbox";
    countryInput.checked = true;
    countryInput.dataset.countryId = country.id;
    countryInput.addEventListener("change", () => setCountryLeagues(country, countryInput.checked));
    const countryTitle = document.createElement("span");
    countryTitle.className = "league-filter-country-title";
    const countryFlag = document.createElement("span");
    countryFlag.className = "league-filter-country-flag";
    countryFlag.setAttribute("aria-hidden", "true");
    const countryFlagImage = document.createElement("img");
    countryFlagImage.className = "league-filter-country-flag-image";
    countryFlagImage.src = `./assets/flags/${country.flagCode}.svg`;
    countryFlagImage.alt = "";
    countryFlagImage.addEventListener("error", () => {
      countryFlag.classList.add("is-missing");
    }, { once: true });
    countryFlag.append(countryFlagImage);
    const countryName = document.createElement("span");
    countryName.className = "league-filter-country-name";
    countryName.textContent = country.name;
    countryTitle.append(countryFlag, countryName);
    countryLabel.append(countryInput, countryTitle);
    legend.append(countryLabel);
    fieldset.append(legend);

    const list = document.createElement("ul");
    list.className = "league-filter-list";
    for (const league of country.leagues) {
      const item = document.createElement("li");
      const label = document.createElement("label");
      label.className = "league-filter-option";
      label.htmlFor = leagueCheckboxId(league.id);
      const input = document.createElement("input");
      input.className = "league-filter-checkbox";
      input.id = leagueCheckboxId(league.id);
      input.type = "checkbox";
      input.checked = true;
      input.dataset.leagueId = league.id;
      input.addEventListener("change", () => setLeague(league.id, input.checked));
      const name = document.createElement("span");
      name.className = "league-filter-option-label";
      name.textContent = league.name;
      label.append(input, name);
      item.append(label);
      list.append(item);
    }
    fieldset.append(list);
    fragment.append(fieldset);
  }

  elements.leagueFilterGrid.replaceChildren(fragment);
  updateLeagueFilterControls();
}

function parseFeeMillions(value) {
  const normalized = String(value ?? "").trim().replaceAll("\u00a0", " ");
  const match = normalized.match(
    /(?:[£€$]\s*)?(\d+(?:[.,]\d+)?)\s*(billion|million|thousand|bn|m|k|b)\b/i,
  );
  if (!match) return null;

  const amount = Number(match[1].replace(",", "."));
  if (!Number.isFinite(amount)) return null;

  const unit = match[2].toLowerCase();
  if (unit === "bn" || unit === "b" || unit === "billion") return amount * 1000;
  if (unit === "k" || unit === "thousand") return amount / 1000;
  return amount;
}

function feeTier(amount) {
  if (amount >= 70) return "blockbuster";
  if (amount >= 40) return "major";
  if (amount >= 20) return "notable";
  return "standard";
}

function safeText(value, fallback = "—") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function safeHttpsLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function previewSourceFor(transfer) {
  const url = safeHttpsLink(transfer?.sourceUrl);
  if (transfer?.status !== "official" || !url) return null;
  const isPrimaryOfficial = transfer.sourceRole === "primary_official";
  return {
    name: safeText(transfer.sourceName, "Source"),
    url,
    isPrimaryOfficial,
    preview: isPrimaryOfficial && transfer.sourcePreview && typeof transfer.sourcePreview === "object"
      ? transfer.sourcePreview
      : null,
  };
}

function additionalSourcesFor(transfer, preferredUrl) {
  const preferred = safeHttpsLink(preferredUrl);
  const seen = new Set(preferred ? [preferred] : []);
  const sources = Array.isArray(transfer?.sources) ? transfer.sources : [];
  const additional = [];

  for (const source of sources) {
    const url = safeHttpsLink(source?.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    additional.push({
      name: safeText(source?.name, "Source"),
      url,
    });
  }

  return additional;
}

function closeSourceDrawer() {
  if (elements.sourceDrawer.open) elements.sourceDrawer.close();
}

function openSourceDrawer(transfer, source, trigger) {
  sourceDrawerInvoker = trigger;
  const preview = source.preview;
  const previewImage = safeHttpsLink(preview?.imageUrl);
  const fallbackTitle = `${safeText(transfer.player)}: ${safeText(transfer.fromClub)} → ${safeText(transfer.toClub)}`;
  const sourceType = source.isPrimaryOfficial ? "Official source" : "Cited source";
  const fallbackDescription = source.isPrimaryOfficial
    ? "A short preview is not available yet. Read the complete official announcement at the source above."
    : "A verified club announcement is not available for this transfer yet. Open the cited report above.";

  elements.sourceDrawerLink.href = source.url;
  elements.sourceDrawerLink.setAttribute("aria-label", `Open the ${sourceType.toLowerCase()} from ${source.name} in a new tab`);
  elements.sourceDrawerSource.textContent = `${sourceType} · ${source.name}`;
  elements.sourceDrawerTitle.textContent = safeText(preview?.title, fallbackTitle);
  elements.sourceDrawerDescription.textContent = safeText(preview?.description, fallbackDescription);
  if (preview?.language) elements.sourceDrawerDescription.lang = preview.language;
  else elements.sourceDrawerDescription.removeAttribute("lang");

  elements.sourcePreviewPlayer.textContent = safeText(transfer.player);
  elements.sourcePreviewFrom.textContent = safeText(transfer.fromClub);
  elements.sourcePreviewTo.textContent = safeText(transfer.toClub);

  const additionalSources = additionalSourcesFor(transfer, source.url);
  elements.sourcePreviewSourcesList.replaceChildren();
  for (const additionalSource of additionalSources) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    const label = document.createElement("span");
    link.className = "source-preview-source-link";
    link.href = additionalSource.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", `${additionalSource.name} — opens in a new tab`);
    label.textContent = additionalSource.name;
    link.append(label, externalLinkIcon());
    item.append(link);
    elements.sourcePreviewSourcesList.append(item);
  }
  elements.sourcePreviewSources.hidden = additionalSources.length === 0;

  elements.sourcePreviewImage.removeAttribute("src");
  elements.sourcePreviewMedia.hidden = !previewImage;
  if (previewImage) elements.sourcePreviewImage.src = previewImage;

  document.documentElement.classList.add("drawer-open");
  if (!elements.sourceDrawer.open) elements.sourceDrawer.showModal();
  elements.sourceDrawerClose.focus({ preventScroll: true });
}

function entityKey(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isStructuredMovement(transfer) {
  const entitiesArePresent = [transfer?.player, transfer?.fromClub, transfer?.toClub].every((value) => {
    const entity = String(value ?? "").trim();
    return entity && !/^(?:—|-|unknown)$/i.test(entity);
  });
  if (!entitiesArePresent) return false;

  const headline = transfer?.headline || transfer?.sourceHeadline;
  return !headline || entityKey(headline) !== entityKey(transfer.player);
}

function appendText(element, value) {
  element.append(document.createTextNode(value));
}

function positionElement(position) {
  const fragment = document.createDocumentFragment();
  const codes = String(position ?? "")
    .split("/")
    .map((code) => code.trim())
    .filter(Boolean);

  codes.forEach((code, index) => {
    if (index) fragment.append(document.createTextNode(" / "));
    const abbreviation = document.createElement("abbr");
    abbreviation.textContent = code;
    abbreviation.title = POSITION_TITLES[code] || code;
    abbreviation.setAttribute("aria-label", `Position: ${POSITION_TITLES[code] || code}`);
    fragment.append(abbreviation);
  });

  return fragment;
}

function playerElement(transfer) {
  const wrapper = document.createElement("span");
  wrapper.className = "player-cell";

  const player = transfer.playerUrl ? document.createElement("a") : document.createElement("span");
  player.className = transfer.playerUrl ? "player-link" : "player-name";
  player.textContent = safeText(transfer.player);
  if (transfer.playerUrl) {
    player.href = transfer.playerUrl;
    player.target = "_blank";
    player.rel = "noreferrer";
    player.setAttribute("aria-label", `${transfer.player} on Wikipedia — opens in a new tab`);
  }
  wrapper.append(player);

  const hasAge = transfer.age !== null
    && transfer.age !== undefined
    && String(transfer.age).trim() !== ""
    && Number.isFinite(Number(transfer.age));
  const hasPosition = Boolean(String(transfer.position ?? "").trim());
  if (hasAge || hasPosition) {
    const metadata = document.createElement("span");
    metadata.className = "player-meta";

    const identityDivider = document.createElement("span");
    identityDivider.className = "meta-divider";
    identityDivider.textContent = "·";
    identityDivider.setAttribute("aria-hidden", "true");
    metadata.append(identityDivider);

    if (hasAge) {
      const age = document.createElement("span");
      const ageLabel = document.createElement("span");
      ageLabel.className = "sr-only";
      ageLabel.textContent = "Age ";
      age.append(ageLabel, document.createTextNode(String(transfer.age)));
      metadata.append(age);
    }

    if (hasAge && hasPosition) {
      const divider = document.createElement("span");
      divider.className = "meta-divider";
      divider.textContent = "·";
      divider.setAttribute("aria-hidden", "true");
      metadata.append(divider);
    }

    if (hasPosition) metadata.append(positionElement(transfer.position));
    wrapper.append(metadata);
  }

  return wrapper;
}

function clubElement(transfer, direction) {
  const isFrom = direction === "from";
  const name = safeText(isFrom ? transfer.fromClub : transfer.toClub);
  const url = isFrom ? transfer.fromClubUrl : transfer.toClubUrl;
  const crestUrl = isFrom ? transfer.fromClubCrest : transfer.toClubCrest;

  const club = document.createElement("span");
  club.className = `club ${direction}-club`;

  const crestSlot = document.createElement("span");
  crestSlot.className = "club-crest-slot";
  crestSlot.setAttribute("aria-hidden", "true");
  if (crestUrl) {
    crestSlot.classList.add("has-crest");
    const crest = document.createElement("img");
    crest.className = "club-crest";
    crest.src = crestUrl;
    crest.alt = "";
    crest.width = 24;
    crest.height = 24;
    crest.loading = "lazy";
    crest.decoding = "async";
    crest.addEventListener("error", () => crest.remove(), { once: true });
    crestSlot.append(crest);
  }
  club.append(crestSlot);

  const label = url ? document.createElement("a") : document.createElement("span");
  label.className = "club-name";
  label.textContent = name;
  if (url) {
    label.href = url;
    label.target = "_blank";
    label.rel = "noreferrer";
    label.setAttribute("aria-label", `${name} on Wikipedia — opens in a new tab`);
  }
  club.append(label);
  return club;
}

function textCell(className, value) {
  const cell = document.createElement("span");
  cell.className = className;
  cell.textContent = safeText(value);
  return cell;
}

function svgNode(name, attributes) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [attribute, value] of Object.entries(attributes)) node.setAttribute(attribute, value);
  return node;
}

function externalLinkIcon() {
  const icon = svgNode("svg", {
    class: "external-link-icon",
    viewBox: "0 0 12 12",
    "aria-hidden": "true",
    focusable: "false",
  });
  icon.append(
    svgNode("path", { d: "M5 2H2.75a.75.75 0 0 0-.75.75v6.5c0 .41.34.75.75.75h6.5c.41 0 .75-.34.75-.75V7" }),
    svgNode("path", { d: "M7 2h3v3M10 2 5.5 6.5" }),
  );
  return icon;
}

function statusElement(status) {
  const kind = status === "official" || status === "rumour" ? status : "unknown";
  const label = statusLabel(status);
  const wrapper = document.createElement("span");
  wrapper.className = `status status-${kind}`;
  wrapper.title = label;

  const icon = svgNode("svg", {
    class: "status-icon",
    viewBox: "0 0 16 16",
    "aria-hidden": "true",
    focusable: "false",
  });
  icon.append(svgNode("circle", { cx: "8", cy: "8", r: "6.25" }));

  if (kind === "official") {
    icon.append(svgNode("path", { d: "m5.15 8.15 1.75 1.75 4-4.15" }));
  } else {
    icon.append(
      svgNode("path", { d: "M6.25 6.15a1.9 1.9 0 1 1 2.2 2.75c-.3.15-.45.4-.45.75v.15" }),
      svgNode("circle", { cx: "8", cy: "11.35", r: ".7", fill: "currentColor", stroke: "none" }),
    );
  }

  const accessibleLabel = document.createElement("span");
  accessibleLabel.className = "sr-only";
  accessibleLabel.textContent = `Status: ${label}`;
  wrapper.append(icon, accessibleLabel);
  return wrapper;
}

function feeElement(value) {
  const rawValue = safeText(value);
  const wrapper = document.createElement("span");
  wrapper.className = "fee";

  const accessibleLabel = document.createElement("span");
  accessibleLabel.className = "sr-only";

  let shorthand = null;
  if (/^free(?: transfer)?$/i.test(rawValue) || /^0(?:[.,]0+)?$/.test(rawValue)) {
    shorthand = { kind: "free", title: "Free transfer", label: "Fee: Free transfer", code: "FREE" };
  } else if (/^loan(?: return)?$/i.test(rawValue)) {
    const isReturn = /return/i.test(rawValue);
    shorthand = {
      kind: "loan",
      title: isReturn ? "Loan return" : "Loan",
      label: isReturn ? "Fee: Loan return" : "Fee: Loan",
      code: isReturn ? "LOAN RETURN" : "LOAN",
    };
  } else if (/^undisclosed$/i.test(rawValue)) {
    shorthand = { kind: "undisclosed", title: "Undisclosed fee", label: "Fee: Undisclosed", code: "UND" };
  }

  if (shorthand) {
    wrapper.classList.add("fee-code-value", `fee-${shorthand.kind}`);
    wrapper.title = shorthand.title;
    accessibleLabel.textContent = shorthand.label;

    const code = document.createElement("span");
    code.className = "fee-code";
    code.textContent = shorthand.code;
    code.setAttribute("aria-hidden", "true");

    wrapper.append(accessibleLabel, code);
    return wrapper;
  }

  const amount = parseFeeMillions(rawValue);
  if (amount !== null) {
    const tier = feeTier(amount);
    wrapper.classList.add(`fee-tier-${tier}`);
    wrapper.dataset.feeTier = tier;
  }

  accessibleLabel.textContent = "Fee: ";
  wrapper.append(accessibleLabel, document.createTextNode(rawValue));
  return wrapper;
}

function detailsElement(transfer) {
  const details = document.createElement("span");
  details.className = "row-details";

  details.append(feeElement(transfer.fee));
  details.append(statusElement(transfer.status));

  const sourceCell = document.createElement("span");
  sourceCell.className = "source-cell";

  const source = transfer.sourceUrl ? document.createElement("a") : document.createElement("span");
  source.className = "source-link";
  const sourceLabel = document.createElement("span");
  sourceLabel.className = "source-link-label";
  sourceLabel.textContent = safeText(transfer.sourceName, "Source");
  source.append(sourceLabel);
  if (transfer.sourceUrl) {
    source.href = transfer.sourceUrl;
    source.target = "_blank";
    source.rel = "noopener noreferrer";
    source.setAttribute("aria-label", `${safeText(transfer.sourceName, "Source")} — opens in a new tab`);
    source.append(externalLinkIcon());
  }
  sourceCell.append(source);

  const previewSource = previewSourceFor(transfer);
  if (previewSource) {
    const additionalSourceCount = additionalSourcesFor(transfer, previewSource.url).length;
    if (additionalSourceCount) {
      const count = document.createElement("span");
      count.className = "source-count";
      count.textContent = `+${additionalSourceCount}`;
      count.title = `${additionalSourceCount} additional ${additionalSourceCount === 1 ? "source" : "sources"} in details`;
      count.setAttribute(
        "aria-label",
        `${additionalSourceCount} additional ${additionalSourceCount === 1 ? "source" : "sources"} available in source details`,
      );
      sourceCell.append(count);
    }

    const indicator = document.createElement("span");
    indicator.className = "row-preview-indicator";
    indicator.title = "Open source details";
    indicator.setAttribute("aria-hidden", "true");
    const icon = svgNode("svg", {
      viewBox: "0 0 12 12",
      focusable: "false",
    });
    icon.append(svgNode("path", { d: "m4.25 2.25 3.5 3.75-3.5 3.75" }));
    indicator.append(icon);
    sourceCell.append(indicator);
  }

  details.append(sourceCell);
  return details;
}

function transferRow(transfer) {
  const item = document.createElement("li");
  item.className = "transfer-row";
  item.dataset.status = transfer.status;
  item.dataset.competitionGender = competitionGender(transfer);

  const previewSource = previewSourceFor(transfer);
  if (previewSource) {
    item.classList.add("is-previewable");
    const trigger = document.createElement("button");
    trigger.className = "row-preview-trigger";
    trigger.type = "button";
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-controls", "source-drawer");
    trigger.setAttribute(
      "aria-label",
      `Open source details for ${safeText(transfer.player)}: ${safeText(transfer.fromClub)} to ${safeText(transfer.toClub)}`,
    );
    trigger.addEventListener("click", () => openSourceDrawer(transfer, previewSource, trigger));
    item.addEventListener("click", (event) => {
      if (event.target.closest("a, button")) return;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;
      openSourceDrawer(transfer, previewSource, trigger);
    });
    item.append(trigger);
  }

  item.append(flagElement(transfer));

  item.append(playerElement(transfer));

  const route = document.createElement("span");
  route.className = "club-route";
  const fromLabel = document.createElement("span");
  fromLabel.className = "sr-only";
  fromLabel.textContent = "From ";
  route.append(fromLabel, clubElement(transfer, "from"));
  const arrow = textCell("arrow", "→");
  arrow.setAttribute("aria-hidden", "true");
  const toLabel = document.createElement("span");
  toLabel.className = "sr-only";
  toLabel.textContent = "to ";
  route.append(arrow, toLabel, clubElement(transfer, "to"));
  item.append(route);

  item.append(detailsElement(transfer));
  return item;
}

function flagElement(transfer) {
  const flag = document.createElement("span");
  const code = /^[a-z]{2}(?:-[a-z]{3})?$/.test(transfer.flagCode || "") ? transfer.flagCode : null;
  flag.className = `flag ${code ? "has-image" : transfer.flag ? "has-emoji" : "is-unknown"}`;
  flag.setAttribute("aria-label", transfer.nationality ? `Nationality: ${transfer.nationality}` : "Nationality unknown");
  flag.setAttribute("role", "img");

  if (!code) {
    flag.textContent = transfer.flag || "—";
    return flag;
  }

  const image = document.createElement("img");
  image.className = "flag-image";
  image.src = `./assets/flags/${code}.svg`;
  image.alt = "";
  image.width = 18;
  image.height = 14;
  image.loading = "lazy";
  image.decoding = "async";
  image.addEventListener("error", () => {
    flag.className = `flag ${transfer.flag ? "has-emoji" : "is-unknown"}`;
    flag.textContent = transfer.flag || "—";
  }, { once: true });
  flag.append(image);
  return flag;
}

function groupTransfers(transfers) {
  return transfers.reduce((groups, transfer) => {
    const key = transfer.date;
    const list = groups.get(key) ?? [];
    list.push(transfer);
    groups.set(key, list);
    return groups;
  }, new Map());
}

function render() {
  const visible = visibleTransfers();

  elements.feed.replaceChildren();

  if (state.activeGenders.size === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Select Men or Women to show transfers.";
    elements.feed.append(empty);
    elements.filterSummary.textContent = "No competition category selected. Select Men or Women to show transfers.";
    return;
  }

  if (state.activeLeagueIds.size === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Select at least one league to show transfers.";
    elements.feed.append(empty);
    elements.filterSummary.textContent = "No league selected. Select at least one league to show transfers.";
    return;
  }

  if (!visible.length) {
    const status = resultLabel(0);
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = `There are no ${status} in ${activeLeagueLabel()} yet.`;
    elements.feed.append(empty);
    elements.filterSummary.textContent = `Showing 0 ${status} in ${activeGenderLabel()} across ${activeLeagueLabel()}.`;
    return;
  }

  for (const [date, transfers] of groupTransfers(visible)) {
    const section = document.createElement("section");
    section.className = "date-group";
    section.setAttribute("aria-labelledby", `date-${date}`);

    const heading = document.createElement("h2");
    heading.className = "date-heading";
    heading.id = `date-${date}`;
    heading.textContent = dateHeading(date);
    section.append(heading);

    const list = document.createElement("ol");
    list.className = "transfer-list";
    list.setAttribute("role", "list");
    list.setAttribute("aria-label", `Transfers on ${dateHeading(date)}`);
    transfers.forEach((transfer) => list.append(transferRow(transfer)));
    section.append(list);
    elements.feed.append(section);
  }

  const status = resultLabel(visible.length);
  elements.filterSummary.textContent = `Showing ${visible.length} ${status} in ${activeGenderLabel()} across ${activeLeagueLabel()}.`;
}

function scheduleStatusFilterIndicator() {
  cancelAnimationFrame(statusFilterIndicatorFrame);
  statusFilterIndicatorFrame = requestAnimationFrame(() => {
    statusFilterIndicatorFrame = 0;
    const active = elements.statusFilters.find((button) => button.classList.contains("is-active"));
    if (!active) return;

    const groupBounds = elements.statusFilterGroup.getBoundingClientRect();
    const activeBounds = active.getBoundingClientRect();
    elements.statusFilterGroup.style.setProperty(
      "--status-filter-indicator-x",
      `${activeBounds.left - groupBounds.left}px`,
    );
    elements.statusFilterGroup.style.setProperty(
      "--status-filter-indicator-width",
      `${activeBounds.width}px`,
    );
    elements.statusFilterGroup.classList.add("has-sliding-indicator");

    if (!statusFilterIndicatorReady) {
      statusFilterIndicatorReady = true;
      requestAnimationFrame(() => {
        elements.statusFilterGroup.classList.add("is-indicator-animated");
      });
    }
  });
}

function updateCount(element, value) {
  const nextValue = String(value);
  const valueElement = element.querySelector(".filter-count-value");
  if (!valueElement || valueElement.textContent === nextValue) return;

  if (reducedMotion.matches) {
    valueElement.textContent = nextValue;
    element.classList.remove("is-changing");
    delete element.dataset.previous;
    return;
  }

  element.dataset.previous = valueElement.textContent;
  valueElement.textContent = nextValue;
  element.classList.remove("is-changing");
  void element.offsetWidth;
  element.classList.add("is-changing");
}

function updateCounts() {
  const transfers = scopeFilteredTransfers();
  const official = transfers.filter((transfer) => transfer.status === "official").length;
  const rumour = transfers.filter((transfer) => transfer.status === "rumour").length;
  updateCount(elements.counts.all, transfers.length);
  updateCount(elements.counts.official, official);
  updateCount(elements.counts.rumour, rumour);
  scheduleStatusFilterIndicator();
}

function setFilter(filter) {
  state.activeFilter = filter;
  for (const button of elements.statusFilters) {
    const active = button.dataset.statusFilter === filter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  scheduleStatusFilterIndicator();
  render();
}

function toggleGender(gender) {
  const active = state.activeGenders.has(gender);
  if (active) state.activeGenders.delete(gender);
  else state.activeGenders.add(gender);

  for (const button of elements.genderFilters) {
    const pressed = state.activeGenders.has(button.dataset.gender);
    button.classList.toggle("is-active", pressed);
    button.setAttribute("aria-pressed", String(pressed));
  }
  updateCounts();
  render();
}

function setTheme(theme, persist = false) {
  const nextTheme = theme === "light" ? "light" : "dark";
  const nextLabel = nextTheme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  document.documentElement.dataset.theme = nextTheme;
  document.documentElement.style.colorScheme = nextTheme;
  elements.themeColor.content = nextTheme === "dark" ? "#101214" : "#ffffff";
  elements.themeToggle.setAttribute("aria-label", nextLabel);
  elements.themeToggle.title = nextLabel;

  if (persist) {
    try {
      localStorage.setItem("futboru-theme", nextTheme);
    } catch {}
  }
}

async function loadFeed() {
  const cacheWindow = Math.floor(Date.now() / 300_000);
  const release = new URL(window.location.href).searchParams.get("release") || "live";
  const cacheKey = encodeURIComponent(`${release}-${cacheWindow}`);
  const response = await fetch(`./data/transfers.json?v=${cacheKey}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload.transfers)) throw new Error("Invalid data format");

  state.transfers = payload.transfers
    .filter(isStructuredMovement)
    .map((transfer) => ({
      ...transfer,
      competitionIds: Array.isArray(transfer.competitionIds)
        ? transfer.competitionIds.filter(isLeagueId)
        : [],
      competitionGender: competitionGender(transfer),
    }));
  elements.freshness.textContent = formatFreshness(payload.generatedAt);
  updateCounts();
  render();
  elements.feed.setAttribute("aria-busy", "false");
}

for (const filter of elements.statusFilters) {
  filter.addEventListener("click", () => setFilter(filter.dataset.statusFilter));
}

for (const count of Object.values(elements.counts)) {
  count.addEventListener("animationend", (event) => {
    if (event.animationName !== "filter-count-in") return;
    count.classList.remove("is-changing");
    delete count.dataset.previous;
    scheduleStatusFilterIndicator();
  });
}

for (const filter of elements.genderFilters) {
  filter.addEventListener("click", () => toggleGender(filter.dataset.gender));
}

elements.leagueFilterSelectAll.addEventListener("click", () => {
  state.activeLeagueIds = new Set(ALL_LEAGUE_IDS);
  applyLeagueSelection();
});

elements.leagueFilterClear.addEventListener("click", () => {
  state.activeLeagueIds.clear();
  applyLeagueSelection();
});

elements.leagueFilterClose.addEventListener("click", () => {
  elements.leagueFilterPanel.hidePopover();
  elements.leagueFilterTrigger.focus({ preventScroll: true });
});

elements.leagueFilterPanel.addEventListener("toggle", (event) => {
  const open = event.newState === "open";
  elements.leagueFilterTrigger.setAttribute("aria-expanded", String(open));
  if (open) {
    requestAnimationFrame(() => {
      elements.leagueFilterGrid.querySelector("input")?.focus({ preventScroll: true });
    });
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !elements.leagueFilterPanel.matches(":popover-open")) return;
  event.preventDefault();
  elements.leagueFilterPanel.hidePopover();
  elements.leagueFilterTrigger.focus({ preventScroll: true });
});

elements.themeToggle.addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true);
});

elements.sourceDrawerClose.addEventListener("click", closeSourceDrawer);

elements.sourceDrawer.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  event.preventDefault();
  closeSourceDrawer();
});

elements.sourceDrawer.addEventListener("pointerdown", (event) => {
  if (event.target !== elements.sourceDrawer) return;
  const bounds = elements.sourceDrawer.getBoundingClientRect();
  const outside = event.clientX < bounds.left
    || event.clientX > bounds.right
    || event.clientY < bounds.top
    || event.clientY > bounds.bottom;
  if (outside) closeSourceDrawer();
});

elements.sourceDrawer.addEventListener("close", () => {
  document.documentElement.classList.remove("drawer-open");
  const target = sourceDrawerInvoker;
  sourceDrawerInvoker = null;
  requestAnimationFrame(() => {
    if (target?.isConnected) target.focus({ preventScroll: true });
  });
});

elements.sourcePreviewImage.addEventListener("error", () => {
  elements.sourcePreviewMedia.hidden = true;
  elements.sourcePreviewImage.removeAttribute("src");
});

window.addEventListener("storage", (event) => {
  if (event.key !== "futboru-theme") return;
  setTheme(event.newValue === "light" ? "light" : "dark");
});

setTheme(document.documentElement.dataset.theme);
buildLeagueFilter();
scheduleStatusFilterIndicator();

if ("ResizeObserver" in window) {
  const statusFilterResizeObserver = new ResizeObserver(scheduleStatusFilterIndicator);
  statusFilterResizeObserver.observe(elements.statusFilterGroup);
  for (const filter of elements.statusFilters) statusFilterResizeObserver.observe(filter);
} else {
  window.addEventListener("resize", scheduleStatusFilterIndicator);
}

reducedMotion.addEventListener("change", () => {
  if (!reducedMotion.matches) return;
  for (const count of Object.values(elements.counts)) {
    count.classList.remove("is-changing");
    delete count.dataset.previous;
  }
});

document.fonts?.ready.then(scheduleStatusFilterIndicator);

loadFeed().catch((error) => {
  console.error(error);
  elements.feed.setAttribute("aria-busy", "false");
  elements.feed.replaceChildren();
  const message = document.createElement("p");
  message.className = "error";
  appendText(message, "The latest update could not be loaded. Refresh the page in a moment.");
  elements.feed.append(message);
  elements.filterSummary.textContent = message.textContent;
  elements.freshness.textContent = "Update temporarily unavailable";
});
