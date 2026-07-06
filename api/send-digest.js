const RESEND_API_URL = "https://api.resend.com/emails";
const MAX_ITEMS = 6;

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const digestApiToken = process.env.DIGEST_API_TOKEN;
  const from = process.env.RESEND_FROM || "LinkedIn CRM <onboarding@resend.dev>";

  if (!resendApiKey || !digestApiToken) {
    response.status(500).json({ error: "Email service is not configured." });
    return;
  }

  if (request.headers["x-digest-token"] !== digestApiToken) {
    response.status(401).json({ error: "Invalid digest token." });
    return;
  }

  const payload = parseBody(request.body);
  const to = String(payload.to || "").trim();
  const items = Array.isArray(payload.items) ? payload.items.slice(0, MAX_ITEMS) : [];

  if (!isEmail(to)) {
    response.status(400).json({ error: "A valid recipient email is required." });
    return;
  }

  if (!items.length) {
    response.status(400).json({ error: "No unread items were provided." });
    return;
  }

  const resendResponse = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject: `Your LinkedIn CRM queue: ${items.length} unread item${items.length === 1 ? "" : "s"}`,
      html: renderDigestHtml(items),
      text: renderDigestText(items)
    })
  });

  const result = await resendResponse.json().catch(() => ({}));

  if (!resendResponse.ok) {
    response.status(502).json({
      error: result.message || result.error || "Failed to send digest email."
    });
    return;
  }

  response.status(200).json({
    id: result.id,
    sent: items.length
  });
};

function parseBody(body) {
  if (!body) return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch (error) {
      return {};
    }
  }

  return body;
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function renderDigestHtml(items) {
  const rows = items
    .map((item, index) => {
      const type = escapeHtml(item.itemType || "item");
      const url = escapeHtml(item.url || "");
      const note = item.note ? `<p style="margin:6px 0 0;color:#536072;">${escapeHtml(item.note)}</p>` : "";

      return `
        <li style="margin:0 0 16px;">
          <p style="margin:0 0 4px;color:#0a66c2;font-size:12px;font-weight:700;text-transform:uppercase;">${index + 1}. ${type}</p>
          <a href="${url}" style="color:#17212f;word-break:break-all;">${url}</a>
          ${note}
        </li>
      `;
    })
    .join("");

  return `
    <div style="background:#f7f8fa;padding:24px;font-family:Arial,sans-serif;color:#17212f;">
      <div style="background:#ffffff;border:1px solid #d9dee7;border-radius:8px;margin:0 auto;max-width:640px;padding:24px;">
        <h1 style="font-size:22px;line-height:1.25;margin:0 0 8px;">Your LinkedIn CRM queue</h1>
        <p style="color:#536072;margin:0 0 20px;">Here are your latest unread saved items.</p>
        <ol style="margin:0;padding-left:22px;">${rows}</ol>
      </div>
    </div>
  `;
}

function renderDigestText(items) {
  return [
    "Your LinkedIn CRM queue",
    "",
    ...items.map((item, index) => `${index + 1}. ${item.itemType || "item"}: ${item.url}`)
  ].join("\n");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
