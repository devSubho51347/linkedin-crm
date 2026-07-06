importScripts("shared.js");

const STORAGE_KEY = "linkedinCrmItems";
const SETTINGS_KEY = "linkedinCrmSettings";
const LAST_CAPTURE_KEY = "linkedinCrmLastCapture";
const DAILY_REVIEW_ALARM = "linkedin-crm-daily-review";
const EMAIL_DIGEST_ALARM = "linkedin-crm-email-digest";
const DEFAULT_SETTINGS = {
  dailyReminder: true,
  reviewCount: 3,
  emailDigest: {
    enabled: false,
    email: "",
    endpointUrl: "",
    authToken: "",
    frequency: "daily",
    weeklyDay: 1,
    time: "09:00",
    itemCount: 5,
    includePosts: true,
    includeJobs: true,
    lastSentAt: "",
    lastStatus: "Not scheduled yet."
  }
};

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.alarms.create(DAILY_REVIEW_ALARM, {
    periodInMinutes: 24 * 60
  });

  const settings = await ensureSettings();
  await scheduleEmailDigest(settings);
});

chrome.runtime.onStartup.addListener(async () => {
  const settings = await ensureSettings();
  await scheduleEmailDigest(settings);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[SETTINGS_KEY]) return;
  scheduleEmailDigest(mergeSettings(changes[SETTINGS_KEY].newValue));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "LINKEDIN_CRM_SEND_DIGEST_NOW") {
    sendDigestNow()
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (message?.type !== "LINKEDIN_CRM_SAVE_DETECTED") return false;

  saveLinkedInItem(message.payload)
    .then(async (item) => {
      await saveLastCapture({
        ok: true,
        url: item.url,
        itemType: item.itemType,
        capturedAt: item.lastSavedAt
      });
      sendResponse({ ok: true, item });
    })
    .catch(async (error) => {
      await saveLastCapture({
        ok: false,
        url: message.payload?.url || "",
        itemType: message.payload?.itemType || "unknown",
        capturedAt: new Date().toISOString(),
        error: error.message
      });
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === EMAIL_DIGEST_ALARM) {
    await sendScheduledEmailDigest();
    return;
  }

  if (alarm.name !== DAILY_REVIEW_ALARM) return;

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

async function saveLastCapture(capture) {
  await chrome.storage.local.set({
    [LAST_CAPTURE_KEY]: capture
  });
}

async function ensureSettings() {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  const settings = mergeSettings(data[SETTINGS_KEY]);

  await chrome.storage.local.set({
    [SETTINGS_KEY]: settings
  });

  return settings;
}

function mergeSettings(settings = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    emailDigest: {
      ...DEFAULT_SETTINGS.emailDigest,
      ...(settings.emailDigest || {})
    }
  };
}

async function scheduleEmailDigest(settings) {
  const digest = settings?.emailDigest || DEFAULT_SETTINGS.emailDigest;
  await chrome.alarms.clear(EMAIL_DIGEST_ALARM);

  if (!isDigestReady(digest)) return;

  const nextSendAt = nextDigestDate(digest, new Date());
  await chrome.alarms.create(EMAIL_DIGEST_ALARM, {
    when: nextSendAt.getTime()
  });
}

function isDigestReady(digest) {
  return Boolean(
    digest.enabled &&
      digest.email &&
      digest.endpointUrl &&
      digest.authToken &&
      digest.time
  );
}

function nextDigestDate(digest, from) {
  const [hour, minute] = String(digest.time || "09:00")
    .split(":")
    .map((part) => Number(part));

  for (let offset = 0; offset < 14; offset += 1) {
    const candidate = new Date(from);
    candidate.setDate(from.getDate() + offset);
    candidate.setHours(Number.isFinite(hour) ? hour : 9, Number.isFinite(minute) ? minute : 0, 0, 0);

    if (candidate <= from) continue;
    if (matchesFrequency(candidate, digest)) return candidate;
  }

  const fallback = new Date(from);
  fallback.setDate(from.getDate() + 1);
  fallback.setHours(9, 0, 0, 0);
  return fallback;
}

function matchesFrequency(date, digest) {
  const day = date.getDay();

  if (digest.frequency === "weekdays") {
    return day >= 1 && day <= 5;
  }

  if (digest.frequency === "weekly") {
    return day === Number(digest.weeklyDay);
  }

  return true;
}

async function sendScheduledEmailDigest() {
  await sendDigestNow();
}

async function sendDigestNow() {
  const settings = await ensureSettings();

  try {
    return await sendDigestFromSettings(settings);
  } catch (error) {
    await saveDigestStatus(settings, error.message || "Failed to send digest.");
    throw error;
  } finally {
    const latestSettings = await ensureSettings();
    await scheduleEmailDigest(latestSettings);
  }
}

async function sendDigestFromSettings(settings) {
  const digest = settings.emailDigest;

  if (!isDigestReady(digest)) {
    const status = "Digest is not fully configured.";
    await saveDigestStatus(settings, status);
    return { status };
  }

  const items = latestUnreadItems(await getItems(), digest);
  if (!items.length) {
    const status = "No unread saved items to send.";
    await saveDigestStatus(settings, status);
    return { status };
  }

  const result = await postDigest(digest, items);
  const status = `Sent ${items.length} item${items.length === 1 ? "" : "s"}.`;

  await saveDigestStatus(settings, status, {
    lastSentAt: new Date().toISOString(),
    lastResponseId: result.id || ""
  });

  return {
    status,
    sent: items.length,
    id: result.id || ""
  };
}

function latestUnreadItems(itemsById, digest) {
  const limit = Math.min(Math.max(Number(digest.itemCount) || 5, 1), 6);

  return Object.values(itemsById)
    .filter((item) => !item.archived && item.status !== "done")
    .filter((item) => {
      if (item.itemType === "job") return digest.includeJobs !== false;
      return digest.includePosts !== false;
    })
    .sort((left, right) => new Date(right.lastSavedAt) - new Date(left.lastSavedAt))
    .slice(0, limit)
    .map((item) => ({
      url: item.url,
      itemType: item.itemType,
      note: item.note || "",
      lastSavedAt: item.lastSavedAt
    }));
}

async function postDigest(digest, items) {
  const response = await fetch(digest.endpointUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-digest-token": digest.authToken
    },
    body: JSON.stringify({
      to: digest.email,
      items
    })
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || "Email digest request failed.");
  }

  return result;
}

async function saveDigestStatus(settings, status, patch = {}) {
  await chrome.storage.local.set({
    [SETTINGS_KEY]: {
      ...settings,
      emailDigest: {
        ...settings.emailDigest,
        ...patch,
        lastStatus: status
      }
    }
  });
}
