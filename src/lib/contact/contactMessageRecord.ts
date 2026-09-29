import { isValidEmailAddress } from "../email/validateEmailAddress";

export const CONTACT_MESSAGE_STATUSES = ["new", "responded", "closed"] as const;
export type ContactMessageStatus = (typeof CONTACT_MESSAGE_STATUSES)[number];

export const CONTACT_MESSAGE_FILTERS = ["new", "responded", "closed", "all"] as const;
export type ContactMessageFilter = (typeof CONTACT_MESSAGE_FILTERS)[number];
export const CONTACT_MESSAGE_DEFAULT_FILTER: ContactMessageFilter = "new";

export const CONTACT_NAME_MAX_LENGTH = 200;
export const CONTACT_EMAIL_MAX_LENGTH = 320;
export const CONTACT_SUBJECT_MAX_LENGTH = 200;
export const CONTACT_MESSAGE_MAX_LENGTH = 20_000;
export const CONTACT_SOURCE_MAX_LENGTH = 120;
export const CONTACT_PAGE_URL_MAX_LENGTH = 2_000;
export const CONTACT_NOTES_MAX_LENGTH = 10_000;
export const CONTACT_NOTIFICATION_ERROR_MAX_LENGTH = 500;
export const CONTACT_MESSAGE_ID_MAX_LENGTH = 64;
export const CONTACT_MESSAGE_BULK_DELETE_MAX = 500;
export const CONTACT_MESSAGE_PAGE_MAX = 10_000;

export type ContactMessageAttachment = {
  blobKey: string;
  accessToken: string;
  contentType: string | null;
  filename: string | null;
};

export type NormalizedContactSubmission = {
  name: string;
  email: string;
  subject: string | null;
  message: string;
  source: string | null;
  pageUrl: string | null;
};

export type ContactSubmissionInput = {
  name?: unknown;
  email?: unknown;
  subject?: unknown;
  message?: unknown;
  source?: unknown;
  pageUrl?: unknown;
};

export type ContactValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function isContactMessageStatus(value: unknown): value is ContactMessageStatus {
  return (
    typeof value === "string" &&
    (CONTACT_MESSAGE_STATUSES as readonly string[]).includes(value)
  );
}

export function parseContactMessageFilter(value: string | null | undefined): ContactMessageFilter {
  if (value && (CONTACT_MESSAGE_FILTERS as readonly string[]).includes(value)) {
    return value as ContactMessageFilter;
  }
  return CONTACT_MESSAGE_DEFAULT_FILTER;
}

export type ContactMessageListLocation = {
  filter: ContactMessageFilter;
  page: number | null;
};

/** Page 1 is the default and is omitted from links. */
export function parseContactMessagePage(value: string | null | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const page = Number(value);
  if (!Number.isSafeInteger(page) || page <= 1 || page > CONTACT_MESSAGE_PAGE_MAX) return null;
  return page;
}

export function readContactMessageListLocation(
  searchParams: URLSearchParams,
): ContactMessageListLocation {
  return {
    filter: parseContactMessageFilter(searchParams.get("filter")),
    page: parseContactMessagePage(searchParams.get("page")),
  };
}

export function contactMessageListSearch(location: ContactMessageListLocation): string {
  const params = new URLSearchParams();
  params.set("filter", location.filter);
  if (location.page) params.set("page", String(location.page));
  return params.toString();
}

export function contactMessageListHref(location: ContactMessageListLocation): string {
  return `/watson/contact-messages?${contactMessageListSearch(location)}`;
}

export function contactMessageDetailHref(
  id: string,
  location: ContactMessageListLocation,
): string {
  return `/watson/contact-messages/${encodeURIComponent(id)}?${contactMessageListSearch(location)}`;
}

/** New and Closed lists omit responded messages. All and Responded keep them. */
export function contactFilterHidesResponded(filter: ContactMessageFilter): boolean {
  return filter === "new" || filter === "closed";
}

export const RESPONDED_CONTACT_MESSAGE_NOTICE = "Marked as responded.";

export type RespondedContactNoticeLinks = {
  viewMessageHref: string;
  viewRespondedHref: string;
};

export function readRespondedContactMessageId(value: string | null | undefined): string | null {
  if (!value) return null;
  const id = validateContactMessageId(value);
  return id.ok ? id.value : null;
}

/** Shown when the current list filter no longer includes the message just marked responded. */
export function respondedContactNoticeLinks(
  messageId: string,
  location: ContactMessageListLocation,
): RespondedContactNoticeLinks | null {
  if (!contactFilterHidesResponded(location.filter)) return null;
  const id = readRespondedContactMessageId(messageId);
  if (!id) return null;
  return {
    viewMessageHref: contactMessageDetailHref(id, location),
    viewRespondedHref: contactMessageListHref({ filter: "responded", page: null }),
  };
}

/** Return to the same list filter and page. Add a notice id only when that filter hides the message. */
export function contactListHrefAfterRespond(
  messageId: string,
  location: ContactMessageListLocation,
): string {
  const params = new URLSearchParams(contactMessageListSearch(location));
  const id = readRespondedContactMessageId(messageId);
  if (id && contactFilterHidesResponded(location.filter)) {
    params.set("responded", id);
  }
  return `/watson/contact-messages?${params.toString()}`;
}

const CONTACT_CUSTOMER_RETURN_PATH =
  /^\/watson\/customers\/(?:legacy|memberstack)\/[A-Za-z0-9_-]+$/;

/** Customer profile path carried on a message opened from that record. Rejects other URLs. */
export function readContactCustomerReturnPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!CONTACT_CUSTOMER_RETURN_PATH.test(trimmed)) return null;
  return trimmed;
}

export function contactMessageCustomerHref(
  messageId: string,
  customerPath: string,
): string | null {
  const id = readRespondedContactMessageId(messageId);
  const path = readContactCustomerReturnPath(customerPath);
  if (!id || !path) return null;
  const params = new URLSearchParams();
  params.set("customer", path);
  return `/watson/contact-messages/${encodeURIComponent(id)}?${params.toString()}`;
}

export function parseDeletedContactMessageCount(value: string | null | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const count = Number(value);
  if (
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count > CONTACT_MESSAGE_BULK_DELETE_MAX
  ) {
    return null;
  }
  return count;
}

export function deletedContactMessagesNotice(count: number): string {
  const n = Math.max(0, Math.trunc(count));
  return `Deleted ${n} contact ${n === 1 ? "message" : "messages"}.`;
}

export function statusLabel(status: ContactMessageStatus): string {
  switch (status) {
    case "new":
      return "New";
    case "responded":
      return "Responded";
    case "closed":
      return "Closed";
    default:
      return status;
  }
}

export function messagePreview(message: string, maxLength = 140): string {
  const trimmed = String(message || "").replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export function listPreview(subject: string | null, message: string): string {
  const trimmedSubject = subject?.trim();
  if (trimmedSubject) return trimmedSubject;
  return messagePreview(message);
}

export function isSafeHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^https?:\/\//i.test(value.trim());
}

export function buildContactAttachmentUrl(
  origin: string,
  attachment: ContactMessageAttachment,
): string {
  const base = origin.replace(/\/$/, "");
  const params = new URLSearchParams({
    id: attachment.blobKey,
    token: attachment.accessToken,
  });
  return `${base}/.netlify/functions/contact-image?${params.toString()}`;
}

export function formatContactTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Los_Angeles",
  }).format(new Date(ms));
}

export function validateContactMessageId(id: string): ContactValidationResult<string> {
  const trimmed = id.trim();
  if (!trimmed || trimmed.length > CONTACT_MESSAGE_ID_MAX_LENGTH) {
    return { ok: false, error: "Message id is required." };
  }
  if (!/^[A-Za-z0-9-]+$/.test(trimmed)) {
    return { ok: false, error: "Message id is invalid." };
  }
  return { ok: true, value: trimmed };
}

export function parseContactMessageIds(value: unknown): ContactValidationResult<string[]> {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, error: "Select at least one message." };
  }
  if (value.length > CONTACT_MESSAGE_BULK_DELETE_MAX) {
    return {
      ok: false,
      error: `Select at most ${CONTACT_MESSAGE_BULK_DELETE_MAX} messages.`,
    };
  }

  const unique: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      return { ok: false, error: "Message id is invalid." };
    }
    const validated = validateContactMessageId(item);
    if (!validated.ok) return validated;
    if (!unique.includes(validated.value)) unique.push(validated.value);
  }

  if (unique.length === 0) {
    return { ok: false, error: "Select at least one message." };
  }
  return { ok: true, value: unique };
}

function asTrimmedText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\u0000/g, "").trim() : "";
}

function optionalText(
  value: unknown,
  maxLength: number,
  label: string,
): ContactValidationResult<string | null> {
  const trimmed = asTrimmedText(value);
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.length > maxLength) {
    return { ok: false, error: `${label} must be at most ${maxLength} characters.` };
  }
  return { ok: true, value: trimmed };
}

export function normalizeContactSubmission(
  input: ContactSubmissionInput,
): ContactValidationResult<NormalizedContactSubmission> {
  const name = asTrimmedText(input.name);
  if (name.length > CONTACT_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Name must be at most ${CONTACT_NAME_MAX_LENGTH} characters.`,
    };
  }

  const email = asTrimmedText(input.email);
  if (!email) {
    return { ok: false, error: "Email is required." };
  }
  if (email.length > CONTACT_EMAIL_MAX_LENGTH || !isValidEmailAddress(email)) {
    return { ok: false, error: "Email must be a valid email address." };
  }

  const message = asTrimmedText(input.message);
  if (!message) {
    return { ok: false, error: "Message is required." };
  }
  if (message.length > CONTACT_MESSAGE_MAX_LENGTH) {
    return {
      ok: false,
      error: `Message must be at most ${CONTACT_MESSAGE_MAX_LENGTH} characters.`,
    };
  }

  const subject = optionalText(input.subject, CONTACT_SUBJECT_MAX_LENGTH, "Subject");
  if (!subject.ok) return subject;
  const source = optionalText(input.source, CONTACT_SOURCE_MAX_LENGTH, "Source");
  if (!source.ok) return source;
  const pageUrl = optionalText(input.pageUrl, CONTACT_PAGE_URL_MAX_LENGTH, "Page URL");
  if (!pageUrl.ok) return pageUrl;

  return {
    ok: true,
    value: {
      name,
      email,
      subject: subject.value,
      message,
      source: source.value,
      pageUrl: pageUrl.value,
    },
  };
}

export function normalizeInternalNotes(value: unknown): ContactValidationResult<string | null> {
  if (value === null) return { ok: true, value: null };
  if (typeof value !== "string") {
    return { ok: false, error: "Internal notes must be text." };
  }
  const trimmed = value.replace(/\u0000/g, "").trim();
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.length > CONTACT_NOTES_MAX_LENGTH) {
    return {
      ok: false,
      error: `Internal notes must be at most ${CONTACT_NOTES_MAX_LENGTH} characters.`,
    };
  }
  return { ok: true, value: trimmed };
}

export function clipNotificationError(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.replace(/\u0000/g, "").trim() : "";
  if (!trimmed) return null;
  return trimmed.slice(0, CONTACT_NOTIFICATION_ERROR_MAX_LENGTH);
}

export type StatusTimestampState = {
  status: ContactMessageStatus;
  respondedAt: string | null;
  closedAt: string | null;
};

/**
 * Mark Responded records responded_at and clears closed_at.
 * Close records closed_at and keeps an existing responded_at.
 * Reopening as New clears both timestamps.
 */
export function nextStatusTimestamps(
  current: StatusTimestampState,
  nextStatus: ContactMessageStatus,
  now: string,
): StatusTimestampState {
  if (nextStatus === "new") {
    return { status: "new", respondedAt: null, closedAt: null };
  }
  if (nextStatus === "responded") {
    return {
      status: "responded",
      respondedAt: current.respondedAt ?? now,
      closedAt: null,
    };
  }
  return {
    status: "closed",
    respondedAt: current.respondedAt,
    closedAt: current.closedAt ?? now,
  };
}
