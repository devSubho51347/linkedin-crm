const STORAGE_KEY = "linkedinCrmItems";
const LAST_CAPTURE_KEY = "linkedinCrmLastCapture";

document.addEventListener("DOMContentLoaded", async () => {
  const data = await chrome.storage.local.get([STORAGE_KEY, LAST_CAPTURE_KEY]);
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
  document.querySelector("#lastCapture").textContent = renderLastCapture(data[LAST_CAPTURE_KEY]);

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

function renderLastCapture(capture) {
  if (!capture) return "No capture detected yet.";

  const status = capture.ok ? "Saved" : "Failed";
  const detail = capture.ok ? capture.url : capture.error || capture.url || "Unknown error";

  return `${status}: ${detail}`;
}
