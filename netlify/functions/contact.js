import "dotenv/config";
import { getStore } from "@netlify/blobs";
import {
  getContactMessagesStore,
  saveContactMessage,
  updateContactMessage,
} from "../../src/lib/contact/contactMessagesStore.ts";
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
 * Prefer Web Request (Functions 2.0 / Blobs context on localhost).
 * Also accepts HandlerEvent when invoked that way (tests / older runtimes).
 *
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
 * Classic Lambda handler — used by unit tests and any v1 invoke path.
 * Keeps decodeEventBody() recovery for mislabeled multipart events.
 *
 * @param {import('@netlify/functions').HandlerEvent} event
 */
export async function handler(event) {
  if (!isHandlerEvent(event)) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: "Bad Request",
    };
  }

  const req = handlerEventToRequest(event);
  const response = await handleContactPost(req, event);
  return webResponseToLambdaResult(response);
}

/**
 * @param {Response} response
 */
async function webResponseToLambdaResult(response) {
  /** @type {Record<string, string>} */
  const headers = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  let body = "";
  if (response.status !== 204 && response.body != null) {
    body = await response.text();
  }

  return {
    statusCode: response.status,
    headers,
    body,
  };
}

/**
 * @typedef {object} ContactHandlerDeps
 * @property {import("@netlify/blobs").Store} [messagesStore]
 * @property {typeof fetch} [fetchImpl]
 * @property {(image: File | Blob, req: Request) => Promise<{
 *   link: string | null,
 *   warning: string | null,
 *   blobKey: string | null,
 *   accessToken: string | null,
 *   contentType: string | null,
 *   originalFilename: string | null,
 * }>} [persistImage]
 * @property {() => string} [getResendApiKey]
 * @property {() => string} [getFromAddress]
 * @property {() => string} [nowIso]
 */

/**
 * @param {Request} req
 * @param {import('@netlify/functions').HandlerEvent | null} event
 * @param {ContactHandlerDeps} [deps]
 */
export async function handleContactPost(req, event, deps = {}) {
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
        event?.headers?.["Content-Type"] ||
        req.headers.get("content-type") ||
        ""
      ).toLowerCase();
      const contentLength =
        event?.headers?.["content-length"] ||
        event?.headers?.["Content-Length"] ||
        req.headers.get("content-length") ||
        null;
      const parseMessage =
        parseError instanceof Error ? parseError.message : String(parseError);
      const exceptionName =
        parseError instanceof Error ? parseError.name : "Error";
      console.error("[contact] Failed to parse form body:", {
        contentType: contentType || null,
        hasBody: !!(event?.body || req.body),
        bodyLength:
          typeof event?.body === "string"
            ? event.body.length
            : contentLength,
        isBase64Encoded: !!(event && event.isBase64Encoded),
        parserStage: "parseContactFormData",
        exceptionName,
        exceptionMessage: parseMessage,
        handlerMode: event ? "HandlerEvent" : "Request",
      });
      return formParseErrorResponse();
    }

    const imageField = formData.get("images");
    const hasImage =
      imageField != null &&
      imageField !== "" &&
      typeof imageField !== "string" &&
      imageField instanceof Blob &&
      imageField.size > 0;

    console.info("[contact] Form parsed successfully", {
      hasName: !!(formData.get("name") || formData.get("firstName")),
      hasEmail: !!formData.get("email"),
      hasMessage: !!(formData.get("message") || formData.get("question")),
      hasImage,
      formSource: (formData.get("form_source") || "").toString().trim() || null,
    });

    const ip =
      req.headers.get("x-nf-client-connection-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    // --- SPAM PROTECTION #1: Honeypot ---
    // Your form already includes: <input name="bot-field" />
    // Humans never fill it. Bots often do.
    const botField = (formData.get("bot-field") || "").toString().trim();
    if (botField) {
      console.info("[contact] Honeypot triggered — returning decoy success", {
        formSource: (formData.get("form_source") || "").toString().trim() || null,
        ip,
      });
      return new Response(null, {
        status: 302,
        headers: { Location: "/contact/thanks/" },
      });
    }

    // --- SPAM PROTECTION #2: Simple rate limit by IP ---
    // Limits repeated hits from the same IP within a short window.
    // Uses a short-lived in-memory map (works well enough for small sites).

    const now = Date.now();
    globalThis.__kbmRateLimit ??= new Map(); // key: ip, value: {count, resetAt}
    const rateLimitStore = globalThis.__kbmRateLimit;

    const windowMs = 60 * 1000; // 1 minute
    const maxPerWindow = 5; // allow 5 submits per minute per IP

    const entry = rateLimitStore.get(ip);
    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(ip, { count: 1, resetAt: now + windowMs });
    } else {
      entry.count += 1;
      rateLimitStore.set(ip, entry);
      if (entry.count > maxPerWindow) {
        console.warn("[contact] Rate limit exceeded — returning decoy success", {
          ip,
          count: entry.count,
          formSource: (formData.get("form_source") || "").toString().trim() || null,
        });
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
      console.warn("[contact] Rejected — missing required email or message", {
        hasEmail: !!email,
        hasMessage: !!message,
        hasName: !!name,
        formSource: formSource || null,
        ip,
      });
      return validationErrorResponse();
    }

    // --- Optional image (contact page: field name "images") ---
    const imageResult = validateContactImage(formData.get("images"));
    if (!imageResult.ok) {
      return imageValidationErrorResponse(imageResult.error);
    }
    const submittedImage = imageResult.image;

    const persistImage = deps.persistImage || persistContactImage;
    /** @type {{
     *   link: string | null,
     *   warning: string | null,
     *   blobKey: string | null,
     *   accessToken: string | null,
     *   contentType: string | null,
     *   originalFilename: string | null,
     * }} */
    const imageStorage = submittedImage
      ? await persistImage(submittedImage, req)
      : {
          link: null,
          warning: null,
          blobKey: null,
          accessToken: null,
          contentType: null,
          originalFilename: null,
        };

    const messagesStore = deps.messagesStore || getContactMessagesStore();
    const nowIso = deps.nowIso || (() => new Date().toISOString());

    /** @type {import("../../src/lib/contact/contactMessagesStore.ts").ContactMessage} */
    let savedMessage;
    try {
      savedMessage = await saveContactMessage(messagesStore, {
        name,
        email,
        message,
        source: formSource || undefined,
        page_url: pageUrl || undefined,
        now: nowIso(),
        ...(imageStorage.blobKey && imageStorage.accessToken
          ? {
              attachment: {
                blob_key: imageStorage.blobKey,
                access_token: imageStorage.accessToken,
                ...(imageStorage.contentType
                  ? { content_type: imageStorage.contentType }
                  : {}),
                ...(imageStorage.originalFilename
                  ? { original_filename: imageStorage.originalFilename }
                  : {}),
              },
            }
          : {}),
      });
    } catch (storageError) {
      const storageMessage =
        storageError instanceof Error ? storageError.message : String(storageError);
      console.error("[contact] Failed to save contact message:", storageMessage);
      return storageFailureResponse();
    }

    console.info("[contact] Contact message saved", {
      id: savedMessage.id,
      hasAttachment: !!savedMessage.attachment,
      formSource: formSource || null,
    });

    // --- Resend notification (must not lose the saved message on failure) ---
    const fetchImpl = deps.fetchImpl || fetch;
    const getResendApiKey =
      deps.getResendApiKey || (() => (process.env.RESEND_API_KEY || "").trim());
    const getFromAddress = deps.getFromAddress || getContactFromAddress;
    const RESEND_API_KEY = getResendApiKey();
    const contactFrom = getFromAddress();

    const emailSubject =
      formSource === "help-hub"
        ? "New Help Hub Question – Knit it Now"
        : "New Contact Message – Knit it Now";
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

    const to = "sue@knititnow.com";
    let notificationSent = false;
    /** @type {string | undefined} */
    let notificationError;

    if (!RESEND_API_KEY) {
      notificationError = "Missing RESEND_API_KEY";
      console.error(
        "[contact] Missing RESEND_API_KEY — message saved; notification not sent",
        { id: savedMessage.id },
      );
    } else if (!contactFrom) {
      notificationError = "Missing CONTACT_FROM_EMAIL";
      console.error(
        "[contact] CONTACT_FROM_EMAIL is empty — message saved; notification not sent",
        { id: savedMessage.id },
      );
    } else {
      console.info("[contact] Sending email via Resend", {
        from: contactFrom,
        to,
        hasImage: !!submittedImage,
        imageStored: !!imageStorage.link,
        messageId: savedMessage.id,
      });

      try {
        const resendResp = await fetchImpl("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: contactFrom,
            to,
            subject: emailSubject,
            text: textBody,
            html: htmlBody,
            reply_to: email || undefined,
          }),
        });

        if (!resendResp.ok) {
          const errText = await resendResp.text();
          notificationError = `Resend API error ${resendResp.status}`;
          console.error("[contact] Resend API error:", resendResp.status, {
            messageId: savedMessage.id,
            // Do not log full Resend body (may include PII).
          });
          // Keep a short safe detail for the stored record only.
          if (errText && errText.length < 200) {
            notificationError = `${notificationError}: ${errText.slice(0, 180)}`;
          }
        } else {
          notificationSent = true;
          console.info("[contact] Resend email accepted", {
            to,
            messageId: savedMessage.id,
          });
        }
      } catch (sendError) {
        notificationError =
          sendError instanceof Error ? sendError.message : "Resend request failed";
        console.error("[contact] Resend request failed:", notificationError, {
          messageId: savedMessage.id,
        });
      }
    }

    try {
      await updateContactMessage(messagesStore, savedMessage.id, {
        notification_email_sent: notificationSent,
        notification_email_error: notificationSent ? null : notificationError || "Unknown error",
        now: nowIso(),
      });
    } catch (updateError) {
      const updateMessage =
        updateError instanceof Error ? updateError.message : String(updateError);
      console.error(
        "[contact] Failed to update notification status on saved message:",
        updateMessage,
        { messageId: savedMessage.id },
      );
    }

    // Visitor success whenever the message was stored, even if notification failed.
    return successRedirectResponse();
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error("[contact] Unhandled error in contact handler:", errMessage, error);
    return new Response("Internal server error", { status: 500 });
  }
}

function successRedirectResponse() {
  return new Response(
    `
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
`,
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

function storageFailureResponse() {
  return new Response(
    "We couldn't save your message right now. Please try again later or email us directly.",
    {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    },
  );
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

function validationErrorResponse() {
  return new Response(
    "We couldn't read your message. Please check your email and message, then try again.",
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
 * @returns {Promise<{
 *   link: string | null,
 *   warning: string | null,
 *   blobKey: string | null,
 *   accessToken: string | null,
 *   contentType: string | null,
 *   originalFilename: string | null,
 * }>}
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

    const originalFilename = sanitizeOriginalFilename(image.name);

    await store.set(blobKey, bytes, {
      metadata: {
        accessToken,
        contentType: image.type,
        originalFilename,
        uploadedAt: new Date().toISOString(),
      },
    });

    const link = buildContactImageUrl(req, blobKey, accessToken);
    return {
      link,
      warning: null,
      blobKey,
      accessToken,
      contentType: image.type,
      originalFilename,
    };
  } catch (error) {
    console.error("Failed to store contact image:", error);
    return {
      link: null,
      warning:
        "An image was attached but could not be saved for viewing. Please ask the sender to resend the photo if needed.",
      blobKey: null,
      accessToken: null,
      contentType: null,
      originalFilename: null,
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
