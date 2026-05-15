import "dotenv/config";
import { getStore } from "@netlify/blobs";
import {
  handlerEventToRequest,
  isHandlerEvent,
  parseContactFormData,
} from "./lib/parse-contact-body.js";

const CONTACT_UPLOADS_STORE = "contact-uploads";

/** Production default; override with CONTACT_FROM_EMAIL (e.g. Resend sandbox for local). */
const DEFAULT_CONTACT_FROM_EMAIL = "Knit It Now <hello@knititnow.com>";

function getContactFromAddress() {
  const configured = (process.env.CONTACT_FROM_EMAIL || "").trim();
  return configured || DEFAULT_CONTACT_FROM_EMAIL;
}

/**
 * Prefer Web Request (full body stream). Legacy HandlerEvent only when needed.
 * @param {Request | import('@netlify/functions').HandlerEvent} reqOrEvent
 */
export default async (reqOrEvent) => {
  if (reqOrEvent instanceof Request) {
    return handleContactPost(reqOrEvent, null);
  }
  if (isHandlerEvent(reqOrEvent)) {
    const req = handlerEventToRequest(reqOrEvent);
    return handleContactPost(req, reqOrEvent);
  }
  return new Response("Bad Request", { status: 400 });
};

/**
 * @param {Request} req
 * @param {import('@netlify/functions').HandlerEvent | null} event
 */
async function handleContactPost(req, event) {
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    let formData;
    try {
      formData = await parseContactFormData(req, event);
    } catch (parseError) {
      const contentType = (
        event?.headers?.["content-type"] ||
        req.headers.get("content-type") ||
        ""
      ).toLowerCase();
      console.error("Failed to parse contact form body:", parseError, {
        contentType,
        boundaryFound: /boundary=/i.test(contentType),
        hasEventBody: !!(event && event.body),
        isBase64Encoded: !!(event && event.isBase64Encoded),
      });
      return formParseErrorResponse();
    }

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
    const name = (
      formData.get("name") ||
      formData.get("firstName") ||
      ""
    )
      .toString()
      .trim();
    const email = (formData.get("email") || "").toString().trim();
    const message = (
      formData.get("message") ||
      formData.get("question") ||
      ""
    )
      .toString()
      .trim();
    const pageUrl = (formData.get("page_url") || "").toString().trim();
    const submittedAt = (formData.get("submitted_at") || "").toString().trim();
    const formSource = (formData.get("form_source") || "").toString().trim();

    if (!email || !message) {
      // Don’t give attackers feedback
      return new Response(null, {
        status: 302,
        headers: { Location: "/contact/thanks/" },
      });
    }

    // --- Optional image (contact page: field name "images") ---
    const imageResult = validateContactImage(formData.get("images"));
    if (!imageResult.ok) {
      return imageValidationErrorResponse(imageResult.error);
    }
    const submittedImage = imageResult.image;

    /** @type {{ link: string | null, warning: string | null }} */
    const imageStorage = submittedImage
      ? await persistContactImage(submittedImage, req)
      : { link: null, warning: null };

    // --- Resend send ---
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    console.log("RESEND key found?", !!process.env.RESEND_API_KEY);
    if (!RESEND_API_KEY) {
      console.error("Missing RESEND_API_KEY env var");
      return new Response("Server configuration error", { status: 500 });
    }

    const subject = "New Contact Message – Knit it Now";
    const textBody =
`New contact form submission

Name: ${name}
Email: ${email}
Source: ${formSource}
IP: ${ip}
Page: ${pageUrl}
Submitted: ${submittedAt}

Message:
${message}
${submittedImage ? imageTextSection(submittedImage, imageStorage) : ""}
`;

    const htmlBody = `
      <h2>New contact form submission</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      ${formSource ? `<p><strong>Source:</strong> ${escapeHtml(formSource)}</p>` : ""}
      <p><strong>IP:</strong> ${escapeHtml(ip)}</p>
      ${pageUrl ? `<p><strong>Page:</strong> ${escapeHtml(pageUrl)}</p>` : ""}
      ${submittedAt ? `<p><strong>Submitted:</strong> ${escapeHtml(submittedAt)}</p>` : ""}
      <hr />
      <p style="white-space:pre-wrap;">${escapeHtml(message)}</p>
      ${submittedImage ? imageHtmlSection(submittedImage, imageStorage) : ""}
    `;

    const from = getContactFromAddress();
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
      return Response.redirect(new URL("/contact/thanks/", req.url), 303);
    }

    // Redirect user to thank-you page
    return new Response(`
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Redirecting...</title>
    <meta http-equiv="refresh" content="0;url=/contact/thanks/" />
    <script>window.location.href = "/contact/thanks/";</script>
  </head>
  <body>
    <p>Redirecting...</p>
  </body>
</html>
`, {
  status: 200,
  headers: { "Content-Type": "text/html; charset=utf-8" },
});
  } catch (error) {
    console.error("Error in contact form handler:", error);
    return new Response("Internal server error", { status: 500 });
  }
}

function formParseErrorResponse() {
  return new Response(
    "We couldn't read the form submission. Please try again.",
    {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    },
  );
}

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * @param {FormDataEntryValue | null} value
 * @returns {{ ok: true, image: File | null } | { ok: false, error: string }}
 */
function validateContactImage(value) {
  if (value == null || value === "") {
    return { ok: true, image: null };
  }

  if (typeof value === "string") {
    return {
      ok: false,
      error: "Please choose a JPG, PNG, or WEBP image.",
    };
  }

  if (!(value instanceof File) && !(value instanceof Blob)) {
    return {
      ok: false,
      error: "Please choose a JPG, PNG, or WEBP image.",
    };
  }

  if (value.size === 0) {
    return { ok: true, image: null };
  }

  if (!ALLOWED_IMAGE_TYPES.has(value.type)) {
    return {
      ok: false,
      error: "Please choose a JPG, PNG, or WEBP image.",
    };
  }

  // TODO: Verify file content with magic-byte checks, not only Content-Type.

  if (value.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: "Please choose an image smaller than 5MB.",
    };
  }

  return { ok: true, image: value };
}

function formatImageSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * @param {File | Blob} image
 * @param {Request} req
 * @returns {Promise<{ link: string | null, warning: string | null }>}
 */
async function persistContactImage(image, req) {
  try {
    const ext = extensionFromMime(image.type);
    if (!ext) {
      throw new Error(`Unsupported MIME type: ${image.type}`);
    }

    const blobKey = `contact/${crypto.randomUUID()}.${ext}`;
    const accessToken = crypto.randomUUID();
    const bytes = await image.arrayBuffer();

    const store = getStore({
      name: CONTACT_UPLOADS_STORE,
      consistency: "strong",
    });

    await store.set(blobKey, bytes, {
      metadata: {
        accessToken,
        contentType: image.type,
        originalFilename: sanitizeOriginalFilename(image.name),
        uploadedAt: new Date().toISOString(),
      },
    });

    const link = buildContactImageUrl(req, blobKey, accessToken);
    return { link, warning: null };
  } catch (error) {
    console.error("Failed to store contact image:", error);
    return {
      link: null,
      warning:
        "An image was attached but could not be saved for viewing. Please ask the sender to resend the photo if needed.",
    };
  }
}

/**
 * @param {Request} req
 * @param {string} blobKey
 * @param {string} accessToken
 */
function buildContactImageUrl(req, blobKey, accessToken) {
  const origin = resolveSiteOrigin(req);
  const params = new URLSearchParams({
    id: blobKey,
    token: accessToken,
  });
  return `${origin}/.netlify/functions/contact-image?${params.toString()}`;
}

/**
 * @param {Request} req
 */
function resolveSiteOrigin(req) {
  const envUrl =
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.SITE_URL ||
    "";
  if (envUrl) {
    try {
      return new URL(envUrl).origin;
    } catch {
      // fall through
    }
  }
  return new URL(req.url).origin;
}

/**
 * @param {string} mime
 */
function extensionFromMime(mime) {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}

/**
 * @param {string | undefined} name
 */
function sanitizeOriginalFilename(name) {
  if (!name || typeof name !== "string") {
    return "upload";
  }
  const base = name.split(/[/\\]/).pop() || "upload";
  const cleaned = base.replace(/[^\w.\-() ]+/g, "_").trim();
  return cleaned.slice(0, 120) || "upload";
}

/**
 * @param {File | Blob} image
 * @param {{ link: string | null, warning: string | null }} storage
 */
function imageTextSection(image, storage) {
  const filename = sanitizeOriginalFilename(image.name);
  let section = `
Image submitted:
- ${filename}
- ${image.type}
- ${formatImageSize(image.size)}`;
  if (storage.link) {
    section += `\n- View: ${storage.link}`;
  }
  if (storage.warning) {
    section += `\n\nNote: ${storage.warning}`;
  }
  return `${section}\n`;
}

/**
 * @param {File | Blob} image
 * @param {{ link: string | null, warning: string | null }} storage
 */
function imageHtmlSection(image, storage) {
  const filename = sanitizeOriginalFilename(image.name);
  const linkRow = storage.link
    ? `<li><a href="${escapeHtml(storage.link)}">View image</a></li>`
    : "";
  const warningBlock = storage.warning
    ? `<p><strong>Note:</strong> ${escapeHtml(storage.warning)}</p>`
    : "";
  return `
      <hr />
      <p><strong>Image submitted:</strong></p>
      <ul>
        <li>${escapeHtml(filename)}</li>
        <li>${escapeHtml(image.type)}</li>
        <li>${escapeHtml(formatImageSize(image.size))}</li>
        ${linkRow}
      </ul>
      ${warningBlock}
    `;
}

function imageValidationErrorResponse(message) {
  const safeMessage = escapeHtml(message);
  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Image could not be sent</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.5; color: #1f2937; }
      h1 { font-size: 1.25rem; }
      a { color: #52682d; }
    </style>
  </head>
  <body>
    <h1>We couldn’t send your message</h1>
    <p>${safeMessage}</p>
    <p><a href="/contact/">← Back to Contact</a></p>
  </body>
</html>`,
    {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}