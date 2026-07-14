const elements = {
  freshness: document.querySelector("#freshness"),
  feed: document.querySelector("#feed"),
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

const updateTime = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
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
  return `Updated ${updateDate.format(date)}, ${updateTime.format(date)}`;
}

function statusLabel(status) {
  return status === "official" ? "Official" : "Rumour";
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

function detailsElement(transfer) {
  const details = document.createElement("span");
  details.className = "row-details";

  details.append(textCell("fee", transfer.fee));
  details.append(textCell(`status status-${transfer.status}`, statusLabel(transfer.status)));

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

  if (transfer.time && transfer.time !== "—") {
    const divider = document.createElement("span");
    divider.className = "source-divider";
    divider.textContent = "·";
    divider.setAttribute("aria-hidden", "true");
    sourceCell.append(divider, textCell("time", transfer.time));
  }

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
