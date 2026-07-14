const elements = {
  title: document.querySelector("#page-title"),
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

const polishDate = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Warsaw",
});

const polishDay = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Warsaw",
});

const polishTime = new Intl.DateTimeFormat("pl-PL", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Warsaw",
});

function localDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Warsaw",
  }).format(date);
}

function addDays(dateKey, amount) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function dateHeading(dateKey) {
  const today = localDateKey();
  const yesterday = addDays(today, -1);
  const date = new Date(`${dateKey}T12:00:00Z`);
  const prefix = dateKey === today ? "Dzisiaj · " : dateKey === yesterday ? "Wczoraj · " : "";
  return `${prefix}${polishDay.format(date)}`;
}

function formatFreshness(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Aktualizacja oczekuje";
  return `Aktualizacja ${polishDay.format(date)}, ${polishTime.format(date)}`;
}

function statusLabel(status) {
  return status === "official" ? "Oficjalne" : "Plotka";
}

function safeText(value, fallback = "—") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function appendText(element, value) {
  element.append(document.createTextNode(value));
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
    player.setAttribute("aria-label", `${transfer.player} — Wikipedia (otwiera się w nowej karcie)`);
  }
  wrapper.append(player);

  const mobileAge = document.createElement("span");
  mobileAge.className = "mobile-age";
  mobileAge.setAttribute("aria-hidden", "true");
  mobileAge.textContent = `· ${safeText(transfer.age)}`;
  wrapper.append(mobileAge);

  return wrapper;
}

function textCell(className, value) {
  const cell = document.createElement("span");
  cell.className = className;
  cell.textContent = safeText(value);
  return cell;
}

function transferRow(transfer) {
  const item = document.createElement("li");
  item.className = "transfer-row";
  item.dataset.status = transfer.status;

  const flag = document.createElement("span");
  flag.className = `flag${transfer.flag ? "" : " is-unknown"}`;
  flag.textContent = transfer.flag || "—";
  flag.setAttribute("aria-label", transfer.nationality ? `Narodowość: ${transfer.nationality}` : "Narodowość nieustalona");
  flag.setAttribute("role", "img");
  item.append(flag);

  item.append(playerElement(transfer));
  item.append(textCell("age", transfer.age));
  item.append(textCell("position", transfer.position));
  item.append(textCell("club from-club", transfer.fromClub));

  const arrow = textCell("arrow", "→");
  arrow.setAttribute("aria-hidden", "true");
  item.append(arrow);

  item.append(textCell("club to-club", transfer.toClub));
  item.append(textCell("fee", transfer.fee));

  const status = textCell(`status status-${transfer.status}`, statusLabel(transfer.status));
  item.append(status);

  const source = document.createElement("a");
  source.className = "source-link";
  source.href = transfer.sourceUrl;
  source.target = "_blank";
  source.rel = "noreferrer";
  source.textContent = safeText(transfer.sourceName, "Źródło");
  source.setAttribute("aria-label", `${safeText(transfer.sourceName, "Źródło")} — otwiera się w nowej karcie`);
  item.append(source);

  item.append(textCell("time", transfer.time || "—"));
  return item;
}

function columnHeadings() {
  const headings = document.createElement("div");
  headings.className = "column-headings";
  headings.setAttribute("aria-hidden", "true");
  ["Nar.", "Zawodnik", "Wiek", "Pozycja", "Klub sprzedający", "", "Klub kupujący", "Opłata", "Status", "Źródło", "Godzina"].forEach(
    (label) => {
      const cell = document.createElement("span");
      cell.textContent = label;
      headings.append(cell);
    },
  );
  return headings;
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
      ? "Brak wpisów w bieżącym oknie. Spróbuj ponownie po następnej aktualizacji."
      : "W tym filtrze nie ma jeszcze wpisów.";
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
    section.append(heading, columnHeadings());

    const list = document.createElement("ol");
    list.className = "transfer-list";
    list.setAttribute("aria-label", `Transfery: ${dateHeading(date)}`);
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
  if (!Array.isArray(payload.transfers)) throw new Error("Nieprawidłowy format danych");

  state.transfers = payload.transfers;
  elements.freshness.textContent = formatFreshness(payload.generatedAt);
  updateCounts();
  render();
  elements.feed.setAttribute("aria-busy", "false");
}

for (const filter of elements.filters) {
  filter.addEventListener("click", () => setFilter(filter.dataset.filter));
}

const now = new Date();
elements.title.textContent = `Transfery — ${polishDate.format(now)}`;

loadFeed().catch((error) => {
  console.error(error);
  elements.feed.setAttribute("aria-busy", "false");
  elements.feed.replaceChildren();
  const message = document.createElement("p");
  message.className = "error";
  appendText(message, "Nie udało się pobrać najnowszej aktualizacji. Odśwież stronę za chwilę.");
  elements.feed.append(message);
  elements.freshness.textContent = "Aktualizacja chwilowo niedostępna";
});
