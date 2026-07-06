const STORAGE_KEY = "linkedinCrmItems";
const SETTINGS_KEY = "linkedinCrmSettings";

const STATUS_COLUMNS = [
  { id: "unread", label: "Unread" },
  { id: "read_next", label: "Read Next" },
  { id: "in_progress", label: "In Progress" },
  { id: "action_needed", label: "Action Needed" },
  { id: "done", label: "Done" }
];

const state = {
  items: {},
  boardKey: "all",
  search: "",
  type: "all"
};

document.addEventListener("DOMContentLoaded", async () => {
  bindControls();
  await loadAndRender();
});

function bindControls() {
  document.querySelector("#boardFilter").addEventListener("change", (event) => {
    state.boardKey = event.target.value;
    render();
  });

  document.querySelector("#typeFilter").addEventListener("change", (event) => {
    state.type = event.target.value;
    render();
  });

  document.querySelector("#search").addEventListener("input", (event) => {
    state.search = event.target.value.toLowerCase();
    render();
  });

  document.querySelector("#exportJson").addEventListener("click", exportJson);
  document.querySelector("#deleteDone").addEventListener("click", deleteDoneItems);
}

async function loadAndRender() {
  const data = await chrome.storage.local.get([STORAGE_KEY, SETTINGS_KEY]);
  state.items = data[STORAGE_KEY] || {};
  render();
}

function render() {
  const items = visibleItems();
  renderStats(items);
  renderBoardFilter();
  renderColumns(items);
}

function visibleItems() {
  return Object.values(state.items)
    .filter((item) => !item.archived)
    .filter((item) => state.boardKey === "all" || item.boardKey === state.boardKey)
    .filter((item) => state.type === "all" || item.itemType === state.type)
    .filter((item) => {
      if (!state.search) return true;
      return [item.url, item.itemType, item.note, ...(item.tags || [])]
        .join(" ")
        .toLowerCase()
        .includes(state.search);
    })
    .sort((left, right) => new Date(right.lastSavedAt) - new Date(left.lastSavedAt));
}

function renderStats(items) {
  const total = Object.values(state.items).filter((item) => !item.archived).length;
  const open = Object.values(state.items).filter(
    (item) => !item.archived && item.status !== "done"
  ).length;
  const done = Object.values(state.items).filter(
    (item) => !item.archived && item.status === "done"
  ).length;

  document.querySelector("#totalCount").textContent = total;
  document.querySelector("#openCount").textContent = open;
  document.querySelector("#doneCount").textContent = done;
  document.querySelector("#visibleCount").textContent = items.length;
}

function renderBoardFilter() {
  const select = document.querySelector("#boardFilter");
  const current = select.value || state.boardKey;
  const boards = [...new Map(Object.values(state.items).map((item) => [item.boardKey, item.boardLabel]))]
    .sort((left, right) => right[0].localeCompare(left[0]));

  select.innerHTML = `<option value="all">All months</option>`;

  for (const [key, label] of boards) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = label;
    select.append(option);
  }

  select.value = [...boards.map(([key]) => key), "all"].includes(current) ? current : "all";
  state.boardKey = select.value;
}

function renderColumns(items) {
  const board = document.querySelector("#board");
  board.innerHTML = "";

  for (const column of STATUS_COLUMNS) {
    const columnItems = items.filter((item) => item.status === column.id);
    const element = document.createElement("section");
    element.className = "column";
    element.dataset.status = column.id;
    element.innerHTML = `
      <header class="column-header">
        <h2>${column.label}</h2>
        <span>${columnItems.length}</span>
      </header>
      <div class="cards"></div>
    `;

    const cards = element.querySelector(".cards");
    for (const item of columnItems) {
      cards.append(renderCard(item));
    }

    board.append(element);
  }
}

function renderCard(item) {
  const card = document.createElement("article");
  card.className = "card";
  card.innerHTML = `
    <div class="card-topline">
      <span class="pill">${item.itemType}</span>
      <span>${formatDate(item.lastSavedAt)}</span>
    </div>
    <a class="card-link" href="${item.url}" target="_blank" rel="noreferrer">${item.url}</a>
    <textarea placeholder="Add note or takeaway">${escapeHtml(item.note || "")}</textarea>
    <div class="card-actions">
      <select aria-label="Status">
        ${STATUS_COLUMNS.map(
          (column) => `<option value="${column.id}" ${item.status === column.id ? "selected" : ""}>${column.label}</option>`
        ).join("")}
      </select>
      <button type="button" data-action="archive">Archive</button>
    </div>
  `;

  card.querySelector("select").addEventListener("change", async (event) => {
    await updateItem(item.id, { status: event.target.value });
  });

  card.querySelector("textarea").addEventListener("change", async (event) => {
    await updateItem(item.id, { note: event.target.value.trim() });
  });

  card.querySelector("[data-action='archive']").addEventListener("click", async () => {
    await updateItem(item.id, { archived: true });
  });

  return card;
}

async function updateItem(id, patch) {
  state.items[id] = {
    ...state.items[id],
    ...patch,
    updatedAt: new Date().toISOString()
  };

  await chrome.storage.local.set({ [STORAGE_KEY]: state.items });
  render();
}

async function deleteDoneItems() {
  const confirmed = window.confirm("Delete all Done items? This cannot be undone.");
  if (!confirmed) return;

  for (const [id, item] of Object.entries(state.items)) {
    if (item.status === "done") {
      delete state.items[id];
    }
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: state.items });
  render();
}

function exportJson() {
  const blob = new Blob([JSON.stringify(Object.values(state.items), null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `linkedin-crm-export-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
