importScripts("shared.js");

const STORAGE_KEY = "linkedinCrmItems";
const SETTINGS_KEY = "linkedinCrmSettings";

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.alarms.create("linkedin-crm-daily-review", {
    periodInMinutes: 24 * 60
  });

  const settings = await chrome.storage.local.get(SETTINGS_KEY);
  if (!settings[SETTINGS_KEY]) {
    await chrome.storage.local.set({
      [SETTINGS_KEY]: {
        dailyReminder: true,
        reviewCount: 3
      }
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "LINKEDIN_CRM_SAVE_DETECTED") return false;

  saveLinkedInItem(message.payload)
    .then((item) => sendResponse({ ok: true, item }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "linkedin-crm-daily-review") return;

  const { [SETTINGS_KEY]: settings } = await chrome.storage.local.get(SETTINGS_KEY);
  if (settings?.dailyReminder === false) return;

  const items = await getItems();
  const unreadCount = Object.values(items).filter((item) => item.status !== "done").length;
  if (!unreadCount) return;

  chrome.notifications.create("linkedin-crm-review", {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "LinkedIn CRM review",
    message: `You have ${unreadCount} saved item${unreadCount === 1 ? "" : "s"} waiting.`
  });
});

async function saveLinkedInItem(payload) {
  const now = payload.capturedAt || new Date().toISOString();
  const url = normalizeLinkedInUrl(payload.url);
  const id = createId(url);
  const board = boardFromTimestamp(now);
  const itemType = payload.itemType || classifyLinkedInUrl(url);
  const items = await getItems();
  const existing = items[id];

  const item = existing
    ? {
        ...existing,
        lastSavedAt: now,
        saveCount: (existing.saveCount || 1) + 1
      }
    : {
        id,
        url,
        itemType,
        source: "linkedin",
        status: "unread",
        boardKey: board.key,
        boardLabel: board.label,
        firstSavedAt: now,
        lastSavedAt: now,
        saveCount: 1,
        tags: [],
        note: "",
        archived: false
      };

  items[id] = item;
  await chrome.storage.local.set({ [STORAGE_KEY]: items });

  return item;
}

async function getItems() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return data[STORAGE_KEY] || {};
}
