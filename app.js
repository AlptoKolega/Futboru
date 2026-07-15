const elements = {
  freshness: document.querySelector("#freshness"),
  feed: document.querySelector("#feed"),
  themeColor: document.querySelector("#theme-color"),
  themeToggle: document.querySelector("#theme-toggle"),
  filters: [...document.querySelectorAll("[data-filter]")],
  counts: {
    all: document.querySelector("#count-all"),
    official: document.querySelector("#count-official"),
    rumour: document.querySelector("#count-rumour"),
  },
};

const state = {
  activeFilter: "all",
  transfers: [],
};

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

  if (/^free(?: transfer)?$/i.test(rawValue)) {
    wrapper.classList.add("fee-free");
    wrapper.title = "Free transfer";
    accessibleLabel.textContent = "Fee: Free transfer";

    const visibleValue = document.createElement("span");
    visibleValue.textContent = "0";
    visibleValue.setAttribute("aria-hidden", "true");
    wrapper.append(accessibleLabel, visibleValue);
    return wrapper;
  }

  if (/^undisclosed$/i.test(rawValue)) {
    wrapper.classList.add("fee-undisclosed");
    wrapper.title = "Undisclosed fee";
    accessibleLabel.textContent = "Fee: Undisclosed";

    const icon = svgNode("svg", {
      class: "fee-icon",
      viewBox: "0 0 24 24",
      "aria-hidden": "true",
      focusable: "false",
    });
    icon.append(
      svgNode("path", { d: "m2 2 20 20" }),
      svgNode("path", { d: "M6.71 6.71C4.5 8.04 3 10 2 12c1.73 3.45 5.33 6 10 6 1.41 0 2.69-.23 3.84-.65" }),
      svgNode("path", { d: "M10.73 5.08A10.85 10.85 0 0 1 12 5c4.67 0 8.27 2.55 10 7a11.6 11.6 0 0 1-1.55 2.47" }),
      svgNode("path", { d: "M14.12 14.12A3 3 0 0 1 9.88 9.88" }),
    );

    wrapper.append(accessibleLabel, icon);
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
  const visible = state.activeFilter === "all"
    ? state.transfers
    : state.transfers.filter((transfer) => transfer.status === state.activeFilter);

  elements.feed.replaceChildren();

  if (!visible.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = state.activeFilter === "all"
      ? "No entries in the current window. Check again after the next update."
      : "There are no entries in this filter yet.";
    elements.feed.append(empty);
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
}

function updateCounts() {
  const official = state.transfers.filter((transfer) => transfer.status === "official").length;
  const rumour = state.transfers.filter((transfer) => transfer.status === "rumour").length;
  elements.counts.all.textContent = String(state.transfers.length);
  elements.counts.official.textContent = String(official);
  elements.counts.rumour.textContent = String(rumour);
}

function setFilter(filter) {
  state.activeFilter = filter;
  for (const button of elements.filters) {
    const active = button.dataset.filter === filter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
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
  const response = await fetch(`./data/transfers.json?v=${cacheWindow}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload.transfers)) throw new Error("Invalid data format");

  state.transfers = payload.transfers;
  elements.freshness.textContent = formatFreshness(payload.generatedAt);
  updateCounts();
  render();
  elements.feed.setAttribute("aria-busy", "false");
}

for (const filter of elements.filters) {
  filter.addEventListener("click", () => setFilter(filter.dataset.filter));
}

elements.themeToggle.addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true);
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
  elements.freshness.textContent = "Update temporarily unavailable";
});
