(function initLinkedInCrmCapture() {
  const SAVE_WORDS = ["save", "save job", "save post"];
  const NEGATIVE_WORDS = ["unsave", "remove", "discard"];
  const CONTEXT_TTL_MS = 20000;
  let recentLinkedInContext = null;

  function textFor(element) {
    const target = asElement(element);
    if (!target) return "";

    return [
      target.getAttribute("aria-label"),
      target.getAttribute("title"),
      target.innerText,
      target.textContent
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function isLikelySaveControl(element) {
    const target = asElement(element);
    if (!target) return null;

    const control = target.closest("button, [role='button'], [role='menuitem'], a");
    if (!control) return null;

    const text = textFor(control);
    if (!text) return null;

    const hasSaveWord = SAVE_WORDS.some((word) => text.includes(word));
    const hasNegativeWord = NEGATIVE_WORDS.some((word) => text.includes(word));

    return hasSaveWord && !hasNegativeWord ? control : null;
  }

  function rememberLinkedInContext(element) {
    const target = asElement(element);
    if (!target) return;

    const scope = closestLinkedInItemScope(target);
    if (!scope) return;

    const url = urlFromScope(scope);
    if (!url || !isItemUrl(url)) return;

    recentLinkedInContext = {
      url,
      capturedAt: Date.now()
    };
  }

  function recentContextUrl() {
    if (!recentLinkedInContext) return "";

    const isFresh = Date.now() - recentLinkedInContext.capturedAt <= CONTEXT_TTL_MS;
    return isFresh ? recentLinkedInContext.url : "";
  }

  function linkedInItemUrlNear(control) {
    const scopes = [
      closestLinkedInItemScope(control)
    ].filter(Boolean);

    for (const scope of scopes) {
      const url = urlFromScope(scope);
      if (url) return url;
    }

    const recentUrl = recentContextUrl();
    if (recentUrl) return recentUrl;

    const canonical = document.querySelector("link[rel='canonical']");
    return canonical?.href || window.location.href;
  }

  function closestLinkedInItemScope(element) {
    const target = asElement(element);
    if (!target) return null;

    return target.closest(
      [
        "article",
        "[data-urn]",
        "[data-id]",
        "[data-job-id]",
        "[data-chameleon-result-urn]",
        ".feed-shared-update-v2",
        ".jobs-search-results__list-item",
        ".job-card-container"
      ].join(", ")
    );
  }

  function urlFromScope(scope) {
    const generatedUrl = urlFromDataAttributes(scope);
    if (generatedUrl) return generatedUrl;

    const link = scope.querySelector?.(
      [
        "a[href*='/feed/update/']",
        "a[href*='/posts/']",
        "a[href*='/jobs/view/']",
        "a[href*='/pulse/']",
        "a[href*='/advice/']"
      ].join(", ")
    );

    return link?.href || "";
  }

  function urlFromDataAttributes(scope) {
    const urn = firstAttributeValue(scope, [
      "data-urn",
      "data-id",
      "data-chameleon-result-urn"
    ]);

    if (isFeedUrn(urn)) {
      return `https://www.linkedin.com/feed/update/${urn}/`;
    }

    const jobId = firstAttributeValue(scope, ["data-job-id"]);

    if (jobId) {
      return `https://www.linkedin.com/jobs/view/${jobId}/`;
    }

    return "";
  }

  function firstAttributeValue(scope, names) {
    for (const name of names) {
      if (scope.getAttribute?.(name)) {
        return scope.getAttribute(name);
      }

      const element = scope.querySelector?.(`[${name}]`);
      const value = element?.getAttribute(name);
      if (value) return value;
    }

    return "";
  }

  function isFeedUrn(value) {
    return [
      "urn:li:activity:",
      "urn:li:share:",
      "urn:li:ugcPost:"
    ].some((prefix) => value?.startsWith(prefix));
  }

  function isItemUrl(url) {
    try {
      return inferType(url) !== "unknown";
    } catch (error) {
      return false;
    }
  }

  function asElement(target) {
    if (target?.nodeType === Node.ELEMENT_NODE) return target;
    return target?.parentElement || null;
  }

  function inferType(url) {
    const path = new URL(url).pathname.toLowerCase();

    if (path.includes("/jobs/view/")) return "job";
    if (path.includes("/pulse/") || path.includes("/advice/")) return "article";
    if (path.includes("/feed/update/") || path.includes("/posts/")) return "post";
    return "unknown";
  }

  ["pointerdown", "mousedown", "mouseover", "focusin"].forEach((eventName) => {
    document.addEventListener(
      eventName,
      (event) => rememberLinkedInContext(event.target),
      true
    );
  });

  document.addEventListener("click", handleClick, true);

  function handleClick(event) {
    rememberLinkedInContext(event.target);

    const control = isLikelySaveControl(event.target);
    if (!control) return;

    const url = linkedInItemUrlNear(control);

    chrome.runtime.sendMessage({
      type: "LINKEDIN_CRM_SAVE_DETECTED",
      payload: {
        url,
        source: "linkedin",
        itemType: inferType(url),
        capturedAt: new Date().toISOString()
      }
    });
  }
})();
