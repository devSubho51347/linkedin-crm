const STORAGE_KEY = "linkedinCrmItems";

document.addEventListener("DOMContentLoaded", async () => {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const items = Object.values(data[STORAGE_KEY] || {}).filter((item) => !item.archived);
  const openItems = items.filter((item) => item.status !== "done");
  const todayQueue = openItems
    .sort((left, right) => new Date(left.lastSavedAt) - new Date(right.lastSavedAt))
    .slice(0, 3);

  document.querySelector("#totalCount").textContent = items.length;
  document.querySelector("#openCount").textContent = openItems.length;
  document.querySelector("#queue").innerHTML = todayQueue.length
    ? todayQueue.map(renderQueueItem).join("")
    : `<p class="empty">Nothing waiting. Nice and clean.</p>`;

  document.querySelector("#openDashboard").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
  });
});

function renderQueueItem(item) {
  return `
    <a class="queue-item" href="${item.url}" target="_blank" rel="noreferrer">
      <span>${item.itemType}</span>
      <strong>${new URL(item.url).pathname}</strong>
    </a>
  `;
}
