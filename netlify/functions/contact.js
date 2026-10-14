import "dotenv/config";
import { getStore } from "@netlify/blobs";
import { normalizeContactSubmission } from "../../src/lib/contact/contactMessageRecord.ts";
import {
  insertContactMessage,
  updateContactMessageNotification,
} from "../../src/lib/contact/contactMessagesDb.ts";
import {
  handlerEventToRequest,
  isHandlerEvent,
  parseContactFormData,
} from "./lib/parse-contact-body.js";
import {
  getTurnstileSecretKey,
  verifyTurnstileToken,
} from "./lib/turnstile.js";
import {
  contactImageTypeError,
  validateContactImageBatch,
} from "../../src/lib/contact/contactImages.ts";

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
export async function handler(event, deps) {
  if (!isHandlerEvent(event)) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: "Bad Request",
    };
  }

  const req = handlerEventToRequest(event);
  const response = await handleContactPost(req, event, deps || {});
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
 * @property {(input: object) => Promise<{ id: string }>} [persistMessage]
 * @property {(id: string, patch: {
 *   notificationEmailSent: boolean,
 *   notificationEmailError?: string | null,
 *   now?: string,
 * }) => Promise<void>} [recordNotification]
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
 * @property {() => string} [getTurnstileSecretKey]
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

    const imageEntryCount = formData.getAll("images").filter((value) => {
      return (
        value != null &&
        value !== "" &&
        typeof value !== "string" &&
        value instanceof Blob &&
        value.size > 0
      );
    }).length;

    console.info("[contact] Form parsed successfully", {
      hasName: !!(formData.get("name") || formData.get("firstName")),
      hasEmail: !!formData.get("email"),
      hasMessage: !!(formData.get("message") || formData.get("question")),
      imageCount: imageEntryCount,
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

    // --- Validate and normalize required fields (prevents empty spam) ---
    const submittedAt = (formData.get("submitted_at") || "").toString().trim();
    const submission = normalizeContactSubmission({
      name: formData.get("name") || formData.get("firstName") || "",
      email: formData.get("email") || "",
      subject: formData.get("subject") || "",
      message: formData.get("message") || formData.get("question") || "",
      source: formData.get("form_source") || formData.get("form-name") || "",
      pageUrl: formData.get("page_url") || "",
    });

    if (!submission.ok) {
      console.warn("[contact] Rejected submission", {
        error: submission.error,
        ip,
      });
      return validationErrorResponse(submission.error);
    }

    const { name, email, message, subject, source: formSource, pageUrl } = submission.value;

    // --- SPAM PROTECTION #3: Cloudflare Turnstile ---
    // After honeypot / rate-limit / field checks; before Watson storage and Resend.
    const fetchImpl = deps.fetchImpl || fetch;
    const resolveTurnstileSecret =
      deps.getTurnstileSecretKey || (() => getTurnstileSecretKey());
    const turnstileToken = formData.get("cf-turnstile-response")?.toString();
    const turnstile = await verifyTurnstileToken(turnstileToken, ip, {
      secret: resolveTurnstileSecret(),
      fetchImpl,
    });
    if (!turnstile.ok) {
      if (turnstile.reason === "missing_secret") {
        console.error("[contact] Missing TURNSTILE_SECRET_KEY");
        return new Response(
          "We couldn't send your message right now. Please try again later or email us directly.",
          {
            status: 500,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          },
        );
      }

      console.warn("[contact] Turnstile verification failed:", turnstile.reason, {
        errorCodes: turnstile.errorCodes || null,
        ip,
        formSource: formSource || null,
      });
      return validationErrorResponse(
        "We couldn't verify this submission. Please wait a moment and try again.",
      );
    }

    // --- Optional images (contact page and Contact Sue modal: field name "images") ---
    const imageResult = collectSubmittedImages(formData);
    if (!imageResult.ok) {
      return validationErrorResponse(imageResult.error);
    }
    const submittedImages = imageResult.images;

    const persistImage = deps.persistImage || persistContactImage;
    const emptyImageStorage = {
      link: null,
      warning: null,
      blobKey: null,
      accessToken: null,
      contentType: null,
      originalFilename: null,
    };
    // The message table stores one attachment. Save the first image for Watson
    // and attach every accepted image to the notification email.
    const imageStorages = submittedImages.length
      ? [await persistImage(submittedImages[0], req)]
      : [];
    for (let index = 1; index < submittedImages.length; index += 1) {
      imageStorages.push({ ...emptyImageStorage });
    }
    const storedAttachment =
      imageStorages.find((item) => item.blobKey && item.accessToken) || null;

    const persistMessage = deps.persistMessage || insertContactMessage;
    const recordNotification =
      deps.recordNotification ||
      ((id, patch) => updateContactMessageNotification(id, patch));
    const nowIso = deps.nowIso || (() => new Date().toISOString());

    /** @type {{ id: string }} */
    let savedMessage;
    try {
      savedMessage = await persistMessage({
        name,
        email,
        subject,
        message,
        source: formSource,
        pageUrl,
        now: nowIso(),
        ...(storedAttachment
          ? {
              attachment: {
                blobKey: storedAttachment.blobKey,
                accessToken: storedAttachment.accessToken,
                contentType: storedAttachment.contentType,
                filename: storedAttachment.originalFilename,
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
      hasAttachment: !!storedAttachment,
      imageCount: submittedImages.length,
      formSource: formSource || null,
    });

    // --- Resend notification (must not lose the saved message on failure) ---
    const getResendApiKey =
      deps.getResendApiKey || (() => (process.env.RESEND_API_KEY || "").trim());
    const getFromAddress = deps.getFromAddress || getContactFromAddress;
    const RESEND_API_KEY = getResendApiKey();
    const contactFrom = getFromAddress();

    const emailSubject =
      formSource === "help-hub"
        ? "New Help Hub Question – Knit it Now"
        : "New Contact Message – Knit it Now";
    const attachmentNames = uniqueAttachmentFilenames(submittedImages);
    const textBody =
`New contact form submission

Name: ${name}
Email: ${email}
Subject: ${subject || ""}
Source: ${formSource || ""}
IP: ${ip}
Page: ${pageUrl || ""}
Submitted: ${submittedAt}

Message:
${message}
${submittedImages.length > 0 ? imagesTextSection(submittedImages, imageStorages, attachmentNames) : ""}
`;

    const htmlBody = `
      <h2>New contact form submission</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      ${subject ? `<p><strong>Subject:</strong> ${escapeHtml(subject)}</p>` : ""}
      ${formSource ? `<p><strong>Source:</strong> ${escapeHtml(formSource)}</p>` : ""}
      <p><strong>IP:</strong> ${escapeHtml(ip)}</p>
      ${pageUrl ? `<p><strong>Page:</strong> ${escapeHtml(pageUrl)}</p>` : ""}
      ${submittedAt ? `<p><strong>Submitted:</strong> ${escapeHtml(submittedAt)}</p>` : ""}
      <hr />
      <p style="white-space:pre-wrap;">${escapeHtml(message)}</p>
      ${submittedImages.length > 0 ? imagesHtmlSection(submittedImages, imageStorages, attachmentNames) : ""}
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
      let emailAttachments = [];
      let attachmentsReady = submittedImages.length === 0;
      try {
        emailAttachments = await buildContactEmailAttachments(submittedImages, attachmentNames);
        attachmentsReady = emailAttachments.length === submittedImages.length;
      } catch (attachmentError) {
        const attachmentMessage =
          attachmentError instanceof Error
            ? attachmentError.message
            : "Could not prepare attachments";
        console.error("[contact] Could not prepare email attachments:", attachmentMessage, {
          messageId: savedMessage.id,
        });
      }

      if (!attachmentsReady) {
        notificationError = "Could not attach every image";
        console.error("[contact] Refusing to send without every image attached", {
          messageId: savedMessage.id,
          imageCount: submittedImages.length,
          attachmentCount: emailAttachments.length,
        });
      } else {
        console.info("[contact] Sending email via Resend", {
          from: contactFrom,
          to,
          imageCount: submittedImages.length,
          attachmentCount: emailAttachments.length,
          messageId: savedMessage.id,
        });

        try {
          /** @type {Record<string, unknown>} */
          const emailPayload = {
            from: contactFrom,
            to,
            subject: emailSubject,
            text: textBody,
            html: htmlBody,
            reply_to: email || undefined,
          };
          if (emailAttachments.length > 0) {
            emailPayload.attachments = emailAttachments;
          }

          const resendResp = await fetchImpl("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(emailPayload),
          });

          if (!resendResp.ok) {
            const errText = await resendResp.text();
            notificationError = `Resend API error ${resendResp.status}`;
            console.error("[contact] Resend API error:", resendResp.status, {
              messageId: savedMessage.id,
            });
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
    }

    try {
      await recordNotification(savedMessage.id, {
        notificationEmailSent: notificationSent,
        notificationEmailError: notificationSent ? null : notificationError || "Unknown error",
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

    if (!notificationSent) {
      return emailDeliveryFailureResponse();
    }

    return successRedirectResponse();
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error("[contact] Unhandled error in contact handler:", errMessage, error);
    return new Response("Internal server error", { status: 500 });
  }
}

function emailDeliveryFailureResponse() {
  return new Response(
    "We couldn't send your message right now. Please try again in a moment.",
    {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    },
  );
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

function validationErrorResponse(message) {
  return new Response(
    message ||
      "We couldn't read your message. Please check your email and message, then try again.",
    {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    },
  );
}

/**
 * Read every `images` part. Empty parts are ignored. A non-file value is rejected.
 * @param {FormData} formData
 * @returns {{ ok: true, images: File[] } | { ok: false, error: string }}
 */
function collectSubmittedImages(formData) {
  /** @type {File[]} */
  const files = [];
  for (const value of formData.getAll("images")) {
    if (value == null || value === "") continue;
    if (typeof value === "string" || !(value instanceof Blob)) {
      return { ok: false, error: contactImageTypeError() };
    }
    if (value.size === 0) continue;
    files.push(
      value instanceof File
        ? value
        : new File([value], "upload", { type: value.type }),
    );
  }

  // TODO: Verify file content with magic-byte checks, not only Content-Type.
  return validateContactImageBatch(files);
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
 * @param {File[]} images
 * @returns {string[]}
 */
function uniqueAttachmentFilenames(images) {
  /** @type {Set<string>} */
  const usedNames = new Set();
  return images.map((image) => uniqueAttachmentFilename(image.name, usedNames));
}

/**
 * @param {File[]} images
 * @param {string[]} filenames
 * @returns {Promise<{ filename: string, content: string, content_type: string }[]>}
 */
async function buildContactEmailAttachments(images, filenames) {
  /** @type {{ filename: string, content: string, content_type: string }[]} */
  const attachments = [];
  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const bytes = Buffer.from(await image.arrayBuffer());
    attachments.push({
      filename: filenames[index] || sanitizeOriginalFilename(image.name),
      content: bytes.toString("base64"),
      content_type: image.type,
    });
  }
  return attachments;
}

/**
 * @param {string | undefined} name
 * @param {Set<string>} usedNames
 */
function uniqueAttachmentFilename(name, usedNames) {
  const safe = sanitizeOriginalFilename(name);
  if (!usedNames.has(safe.toLowerCase())) {
    usedNames.add(safe.toLowerCase());
    return safe;
  }
  const dot = safe.lastIndexOf(".");
  const base = dot > 0 ? safe.slice(0, dot) : safe;
  const ext = dot > 0 ? safe.slice(dot) : "";
  let count = 2;
  let candidate = `${base}-${count}${ext}`;
  while (usedNames.has(candidate.toLowerCase())) {
    count += 1;
    candidate = `${base}-${count}${ext}`;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

/**
 * @param {File[]} images
 * @param {{ link: string | null, warning: string | null }[]} storages
 * @param {string[]} filenames
 */
function imagesTextSection(images, storages, filenames) {
  let section = "\nImages submitted:";
  images.forEach((image, index) => {
    const storage = storages[index] || { link: null, warning: null };
    const filename = filenames[index] || sanitizeOriginalFilename(image.name);
    section += `\n- ${filename} (${image.type}, ${formatImageSize(image.size)})`;
    if (storage.link) {
      section += `\n  View: ${storage.link}`;
    }
    if (storage.warning) {
      section += `\n  Note: ${storage.warning}`;
    }
  });
  return `${section}\n`;
}

/**
 * @param {File[]} images
 * @param {{ link: string | null, warning: string | null }[]} storages
 * @param {string[]} filenames
 */
function imagesHtmlSection(images, storages, filenames) {
  const items = images
    .map((image, index) => {
      const storage = storages[index] || { link: null, warning: null };
      const filename = filenames[index] || sanitizeOriginalFilename(image.name);
      const linkRow = storage.link
        ? `<li><a href="${escapeHtml(storage.link)}">View image</a></li>`
        : "";
      const warningBlock = storage.warning
        ? `<li>${escapeHtml(storage.warning)}</li>`
        : "";
      return `
        <li>
          <p>${escapeHtml(filename)} (${escapeHtml(image.type)}, ${escapeHtml(formatImageSize(image.size))})</p>
          <ul>
            ${linkRow}
            ${warningBlock}
          </ul>
        </li>`;
    })
    .join("");
  return `
      <hr />
      <p><strong>Images submitted:</strong></p>
      <ul>
        ${items}
      </ul>
    `;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
