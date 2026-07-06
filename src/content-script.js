(function initLinkedInCrmCapture() {
  const SAVE_WORDS = ["save", "save job", "save post"];
  const NEGATIVE_WORDS = ["saved", "unsave", "remove", "discard"];

  function textFor(element) {
    return [
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.innerText,
      element.textContent
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function isLikelySaveControl(element) {
    const control = element.closest("button, [role='button']");
    if (!control) return null;

    const text = textFor(control);
    if (!text) return null;

    const hasSaveWord = SAVE_WORDS.some((word) => text.includes(word));
    const hasNegativeWord = NEGATIVE_WORDS.some((word) => text.includes(word));

    return hasSaveWord && !hasNegativeWord ? control : null;
  }

  function linkedInItemUrlNear(control) {
    const scopes = [
      control.closest("article"),
      control.closest("[data-urn]"),
      control.closest("[data-id]"),
      control.closest("[data-job-id]"),
      document
    ].filter(Boolean);

    for (const scope of scopes) {
      const generatedUrl = urlFromDataAttributes(scope);
      if (generatedUrl) return generatedUrl;

      const link = scope.querySelector(
        "a[href*='/feed/update/'], a[href*='/posts/'], a[href*='/jobs/view/'], a[href*='/pulse/'], a[href*='/advice/']"
      );

      if (link && link.href) {
        return link.href;
      }
    }

    const canonical = document.querySelector("link[rel='canonical']");
    return canonical?.href || window.location.href;
  }

  function urlFromDataAttributes(scope) {
    const urnElement = scope.matches?.("[data-urn]")
      ? scope
      : scope.querySelector?.("[data-urn]");
    const urn = urnElement?.getAttribute("data-urn");

    if (urn?.startsWith("urn:li:activity:")) {
      return `https://www.linkedin.com/feed/update/${urn}/`;
    }

    const jobElement = scope.matches?.("[data-job-id]")
      ? scope
      : scope.querySelector?.("[data-job-id]");
    const jobId = jobElement?.getAttribute("data-job-id");

    if (jobId) {
      return `https://www.linkedin.com/jobs/view/${jobId}/`;
    }

    return "";
  }

  function inferType(url) {
    const path = new URL(url).pathname.toLowerCase();

    if (path.includes("/jobs/view/")) return "job";
    if (path.includes("/pulse/") || path.includes("/advice/")) return "article";
    if (path.includes("/feed/update/") || path.includes("/posts/")) return "post";
    return "unknown";
  }

  document.addEventListener(
    "click",
    (event) => {
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
    },
    true
  );
})();
