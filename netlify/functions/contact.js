export default async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const formData = await req.formData();

    // --- SPAM PROTECTION #1: Honeypot ---
    // Your form already includes: <input name="bot-field" />
    // Humans never fill it. Bots often do.
    const botField = (formData.get("bot-field") || "").toString().trim();
    if (botField) {
      // Pretend success so bots don't learn anything
      return new Response(null, {
        status: 302,
        headers: { Location: "/contact/thanks/" },
      });
    }

    // --- SPAM PROTECTION #2: Simple rate limit by IP ---
    // Limits repeated hits from the same IP within a short window.
    // Uses a short-lived in-memory map (works well enough for small sites).
    const ip =
      req.headers.get("x-nf-client-connection-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    const now = Date.now();
    globalThis.__kbmRateLimit ??= new Map(); // key: ip, value: {count, resetAt}
    const store = globalThis.__kbmRateLimit;

    const windowMs = 60 * 1000; // 1 minute
    const maxPerWindow = 5;     // allow 5 submits per minute per IP

    const entry = store.get(ip);
    if (!entry || now > entry.resetAt) {
      store.set(ip, { count: 1, resetAt: now + windowMs });
    } else {
      entry.count += 1;
      store.set(ip, entry);
      if (entry.count > maxPerWindow) {
        // Too many submissions - pretend success (don’t confirm block to attacker)
        return new Response(null, {
          status: 302,
          headers: { Location: "/contact/thanks/" },
        });
      }
    }

    // --- Validate required fields (prevents empty spam) ---
    const name = (formData.get("name") || "").toString().trim();
    const email = (formData.get("email") || "").toString().trim();
    const message = (formData.get("message") || "").toString().trim();
    const pageUrl = (formData.get("page_url") || "").toString().trim();
    const submittedAt = (formData.get("submitted_at") || "").toString().trim();

    if (!email || !message) {
      // Don’t give attackers feedback
      return new Response(null, {
        status: 302,
        headers: { Location: "/contact/thanks/" },
      });
    }

    // --- Resend send ---
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      console.error("Missing RESEND_API_KEY env var");
      return new Response("Server configuration error", { status: 500 });
    }

    const subject = "New Contact Message – Knit it Now";
    const textBody =
`New contact form submission

Name: ${name}
Email: ${email}
IP: ${ip}
Page: ${pageUrl}
Submitted: ${submittedAt}

Message:
${message}
`;

    const htmlBody = `
      <h2>New contact form submission</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>IP:</strong> ${escapeHtml(ip)}</p>
      ${pageUrl ? `<p><strong>Page:</strong> ${escapeHtml(pageUrl)}</p>` : ""}
      ${submittedAt ? `<p><strong>Submitted:</strong> ${escapeHtml(submittedAt)}</p>` : ""}
      <hr />
      <p style="white-space:pre-wrap;">${escapeHtml(message)}</p>
    `;

    // Keep this for now (testing mode)
    const from = "Knit it Now <onboarding@resend.dev>";
    const to = "sue@knititnow.com";

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        text: textBody,
        html: htmlBody,
        reply_to: email || undefined,
      }),
    });

    if (!resendResp.ok) {
      const errText = await resendResp.text();
      console.error("Resend error:", resendResp.status, errText);
      // Still redirect (user experience stays smooth)
      return new Response(null, {
        status: 302,
        headers: { Location: "/contact/thanks/" },
      });
    }

    // Redirect user to thank-you page
    return new Response(null, {
      status: 302,
      headers: { Location: "/contact/thanks/" },
    });

  } catch (error) {
    console.error(error);
    return new Response(null, {
      status: 302,
      headers: { Location: "/contact/thanks/" },
    });
  }
};

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}