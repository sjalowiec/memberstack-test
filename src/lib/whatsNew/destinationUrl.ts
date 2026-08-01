import {
  WHATS_NEW_URL_MAX_LENGTH,
  type WhatsNewValidationResult,
} from "./types";

/**
 * Allow site-relative paths (/...) or absolute https:// URLs.
 * Reject javascript:, protocol-relative //, HTML, and malformed values.
 */
export function normalizeWhatsNewDestinationUrl(
  raw: unknown,
): WhatsNewValidationResult<string | null> {
  if (raw == null) {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: "Destination URL must be a string." };
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }

  if (trimmed.length > WHATS_NEW_URL_MAX_LENGTH) {
    return {
      ok: false,
      error: `Destination URL must be ${WHATS_NEW_URL_MAX_LENGTH} characters or fewer.`,
    };
  }

  if (/[<>"']/.test(trimmed) || /<iframe/i.test(trimmed) || /javascript:/i.test(trimmed)) {
    return { ok: false, error: "Destination URL contains unsupported or unsafe content." };
  }

  if (trimmed.startsWith("//")) {
    return { ok: false, error: "Protocol-relative URLs are not allowed." };
  }

  if (trimmed.startsWith("/")) {
    if (trimmed.startsWith("//") || trimmed.includes("://") || /\s/.test(trimmed)) {
      return { ok: false, error: "Site-relative URL is malformed." };
    }
    // Single leading slash path; reject backslashes and control chars.
    if (trimmed.includes("\\") || /[\u0000-\u001f]/.test(trimmed)) {
      return { ok: false, error: "Site-relative URL is malformed." };
    }
    return { ok: true, value: trimmed };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: "Destination URL is malformed." };
  }

  if (url.protocol !== "https:") {
    return { ok: false, error: "Absolute destination URLs must use https://" };
  }

  if (!url.hostname) {
    return { ok: false, error: "Destination URL is malformed." };
  }

  return { ok: true, value: url.toString() };
}

export function isValidWhatsNewDestinationUrl(raw: unknown): boolean {
  return normalizeWhatsNewDestinationUrl(raw).ok;
}
