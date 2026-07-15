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
  transfers: [],
};

let sourceDrawerInvoker = null;

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

function visibleTransfers() {
  const transfers = genderFilteredTransfers();
  return state.activeFilter === "all"
    ? transfers
    : transfers.filter((transfer) => transfer.status === state.activeFilter);
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

function primaryOfficialSource(transfer) {
  const url = safeHttpsLink(transfer?.sourceUrl);
  if (transfer?.status !== "official" || transfer?.sourceRole !== "primary_official" || !url) return null;
  return {
    name: safeText(transfer.sourceName, "Official source"),
    url,
    preview: transfer.sourcePreview && typeof transfer.sourcePreview === "object"
      ? transfer.sourcePreview
      : null,
  };
}

function closeSourceDrawer() {
  if (elements.sourceDrawer.open) elements.sourceDrawer.close();
}

function openSourceDrawer(transfer, source, trigger) {
  sourceDrawerInvoker = trigger;
  const preview = source.preview;
  const previewImage = safeHttpsLink(preview?.imageUrl);
  const fallbackTitle = `${safeText(transfer.player)}: ${safeText(transfer.fromClub)} → ${safeText(transfer.toClub)}`;

  elements.sourceDrawerLink.href = source.url;
  elements.sourceDrawerLink.setAttribute("aria-label", `Open the official announcement from ${source.name} in a new tab`);
  elements.sourceDrawerSource.textContent = `Official source · ${source.name}`;
  elements.sourceDrawerTitle.textContent = safeText(preview?.title, fallbackTitle);
  elements.sourceDrawerDescription.textContent = safeText(
    preview?.description,
    "A short preview is not available yet. Read the complete official announcement at the source above.",
  );
  if (preview?.language) elements.sourceDrawerDescription.lang = preview.language;
  else elements.sourceDrawerDescription.removeAttribute("lang");

  elements.sourcePreviewPlayer.textContent = safeText(transfer.player);
  elements.sourcePreviewFrom.textContent = safeText(transfer.fromClub);
  elements.sourcePreviewTo.textContent = safeText(transfer.toClub);

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

  if (/^free(?: transfer)?$/i.test(rawValue) || /^0(?:[.,]0+)?$/.test(rawValue)) {
    wrapper.classList.add("fee-free");
    wrapper.title = "Free transfer";
    accessibleLabel.textContent = "Fee: Free transfer";

    const visibleValue = document.createElement("span");
    visibleValue.textContent = "Free";
    visibleValue.setAttribute("aria-hidden", "true");
    wrapper.append(accessibleLabel, visibleValue);
    return wrapper;
  }

  if (/^undisclosed$/i.test(rawValue)) {
    wrapper.classList.add("fee-undisclosed");
    wrapper.title = "Undisclosed fee";
    accessibleLabel.textContent = "Fee: Undisclosed";

    const code = document.createElement("span");
    code.className = "fee-code";
    code.textContent = "UND";
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
  source.textContent = safeText(transfer.sourceName, "Source");
  if (transfer.sourceUrl) {
    source.href = transfer.sourceUrl;
    source.target = "_blank";
    source.rel = "noreferrer";
    source.setAttribute("aria-label", `${safeText(transfer.sourceName, "Source")} — opens in a new tab`);
  }
  sourceCell.append(source);

  details.append(sourceCell);
  return details;
}

function transferRow(transfer) {
  const item = document.createElement("li");
  item.className = "transfer-row";
  item.dataset.status = transfer.status;
  item.dataset.competitionGender = competitionGender(transfer);

  const officialSource = primaryOfficialSource(transfer);
  if (officialSource) {
    item.classList.add("is-previewable");
    const trigger = document.createElement("button");
    trigger.className = "row-preview-trigger";
    trigger.type = "button";
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-controls", "source-drawer");
    trigger.setAttribute(
      "aria-label",
      `Preview official source for ${safeText(transfer.player)}: ${safeText(transfer.fromClub)} to ${safeText(transfer.toClub)}`,
    );
    trigger.addEventListener("click", () => openSourceDrawer(transfer, officialSource, trigger));
    item.addEventListener("click", (event) => {
      if (event.target.closest("a, button")) return;
      openSourceDrawer(transfer, officialSource, trigger);
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

  if (!visible.length) {
    const status = resultLabel(0);
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = `There are no ${status} in ${activeGenderLabel()} yet.`;
    elements.feed.append(empty);
    elements.filterSummary.textContent = `Showing 0 ${status} in ${activeGenderLabel()}.`;
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
  elements.filterSummary.textContent = `Showing ${visible.length} ${status} in ${activeGenderLabel()}.`;
}

function updateCounts() {
  const transfers = genderFilteredTransfers();
  const official = transfers.filter((transfer) => transfer.status === "official").length;
  const rumour = transfers.filter((transfer) => transfer.status === "rumour").length;
  elements.counts.all.textContent = String(transfers.length);
  elements.counts.official.textContent = String(official);
  elements.counts.rumour.textContent = String(rumour);
}

function setFilter(filter) {
  state.activeFilter = filter;
  for (const button of elements.statusFilters) {
    const active = button.dataset.statusFilter === filter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
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
    .map((transfer) => ({ ...transfer, competitionGender: competitionGender(transfer) }));
  elements.freshness.textContent = formatFreshness(payload.generatedAt);
  updateCounts();
  render();
  elements.feed.setAttribute("aria-busy", "false");
}

for (const filter of elements.statusFilters) {
  filter.addEventListener("click", () => setFilter(filter.dataset.statusFilter));
}

for (const filter of elements.genderFilters) {
  filter.addEventListener("click", () => toggleGender(filter.dataset.gender));
}

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
