const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

const STATUS_COLUMNS = [
  { id: "unread", label: "Unread" },
  { id: "read_next", label: "Read Next" },
  { id: "in_progress", label: "In Progress" },
  { id: "action_needed", label: "Action Needed" },
  { id: "done", label: "Done" }
];

function boardFromTimestamp(timestamp) {
  const date = new Date(timestamp);
  const month = date.getMonth();
  const year = date.getFullYear();

  return {
    key: `${year}-${String(month + 1).padStart(2, "0")}`,
    label: `${MONTHS[month]} ${year}`
  };
}

function classifyLinkedInUrl(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();

    if (path.includes("/jobs/view/")) return "job";
    if (path.includes("/pulse/") || path.includes("/advice/")) return "article";
    if (path.includes("/feed/update/") || path.includes("/posts/")) return "post";
  } catch (error) {
    return "unknown";
  }

  return "unknown";
}

function normalizeLinkedInUrl(rawUrl) {
  const url = new URL(rawUrl);

  if (!url.hostname.endsWith("linkedin.com")) {
    throw new Error("Only LinkedIn URLs can be saved.");
  }

  url.hash = "";
  url.search = "";

  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return url.toString();
}

function createId(value) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return `li_${Math.abs(hash).toString(36)}`;
}

if (typeof module !== "undefined") {
  module.exports = {
    STATUS_COLUMNS,
    boardFromTimestamp,
    classifyLinkedInUrl,
    createId,
    normalizeLinkedInUrl
  };
}
