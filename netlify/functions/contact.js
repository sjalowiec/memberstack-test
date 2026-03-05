export default async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const formData = await req.formData();

    const name = (formData.get("name") || "").toString();
    const email = (formData.get("email") || "").toString();
    const message = (formData.get("message") || "").toString();
    const pageUrl = (formData.get("page_url") || "").toString();
    const submittedAt = (formData.get("submitted_at") || "").toString();

    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (!RESEND_API_KEY) {
      console.error("Missing RESEND_API_KEY env var");
      return new Response("Server configuration error", { status: 500 });
    }

    const subject = `New Contact Message – Knit it Now`;
    const textBody =
`New contact form submission

Name: ${name}
Email: ${email}
Page: ${pageUrl}
Submitted: ${submittedAt}

Message:
${message}
`;

    const htmlBody = `
      <h2>New contact form submission</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      ${pageUrl ? `<p><strong>Page:</strong> ${escapeHtml(pageUrl)}</p>` : ""}
      ${submittedAt ? `<p><strong>Submitted:</strong> ${escapeHtml(submittedAt)}</p>` : ""}
      <hr />
      <p style="white-space:pre-wrap;">${escapeHtml(message)}</p>
    `;

    // IMPORTANT:
    // Update "from" once you have a verified sending domain in Resend.
    // For now we use Resend's onboarding sender.
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
      return new Response("Email send failed", { status: 500 });
    }

    // Redirect user to thank-you page
    return new Response(null, {
      status: 302,
      headers: { Location: "/contact/thanks/" },
    });

  } catch (error) {
    console.error(error);
    return new Response("Server error", { status: 500 });
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