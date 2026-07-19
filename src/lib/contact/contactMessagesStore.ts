/**
 * Netlify Blobs store for durable Contact Us messages.
 * Key layout: `messages/{id}.json` in store `contact-messages`.
 */

import { getStore, type Store } from "@netlify/blobs";
import { randomUUID } from "node:crypto";

export const CONTACT_MESSAGES_BLOB_STORE = "contact-messages";
export const CONTACT_MESSAGES_KEY_PREFIX = "messages/";

export const CONTACT_MESSAGE_STATUSES = [
  "new",
  "in_progress",
  "waiting_for_customer",
  "resolved",
] as const;

export type ContactMessageStatus = (typeof CONTACT_MESSAGE_STATUSES)[number];

export type ContactMessageAttachment = {
  blob_key: string;
  access_token: string;
  content_type?: string;
  original_filename?: string;
};

export type ContactMessage = {
  id: string;
  created_at: string;
  updated_at: string;

  name: string;
  email: string;
  subject?: string;
  category?: string;
  message: string;

  status: ContactMessageStatus;
  admin_notes?: string;

  source?: string;
  page_url?: string;

  notification_email_sent: boolean;
  notification_email_error?: string;

  attachment?: ContactMessageAttachment;
};

export type CreateContactMessageInput = {
  name: string;
  email: string;
  message: string;
  source?: string;
  page_url?: string;
  subject?: string;
  category?: string;
  attachment?: ContactMessageAttachment;
  now?: string;
  id?: string;
};

export type UpdateContactMessageInput = {
  status?: ContactMessageStatus;
  admin_notes?: string | null;
  notification_email_sent?: boolean;
  notification_email_error?: string | null;
  now?: string;
};

export type ContactMessageListFilter =
  | "all"
  | "open"
  | "new"
  | "in_progress"
  | "waiting_for_customer"
  | "resolved";

export type ContactMessageCounts = {
  new: number;
  open: number;
  older_than_48_hours: number;
};

type BlobStoreLike = Pick<Store, "get" | "setJSON" | "list">;

export function isContactMessageStatus(value: unknown): value is ContactMessageStatus {
  return (
    typeof value === "string" &&
    (CONTACT_MESSAGE_STATUSES as readonly string[]).includes(value)
  );
}

export function contactMessageBlobKey(id: string): string {
  return `${CONTACT_MESSAGES_KEY_PREFIX}${sanitizeKeySegment(id)}.json`;
}

export function sanitizeKeySegment(segment: string): string {
  return String(segment)
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
}

export function getContactMessagesStore(): Store {
  return getStore({
    name: CONTACT_MESSAGES_BLOB_STORE,
    consistency: "strong",
  });
}

export function buildContactMessage(input: CreateContactMessageInput): ContactMessage {
  const now = input.now ?? new Date().toISOString();
  const id = input.id ?? randomUUID();
  const name = String(input.name || "").trim();
  const email = String(input.email || "").trim();
  const message = String(input.message || "").trim();

  const record: ContactMessage = {
    id,
    created_at: now,
    updated_at: now,
    name,
    email,
    message,
    status: "new",
    notification_email_sent: false,
  };

  const source = input.source?.trim();
  if (source) record.source = source;

  const pageUrl = input.page_url?.trim();
  if (pageUrl) record.page_url = pageUrl;

  const subject = input.subject?.trim();
  if (subject) record.subject = subject;

  const category = input.category?.trim();
  if (category) record.category = category;

  if (input.attachment?.blob_key && input.attachment?.access_token) {
    record.attachment = {
      blob_key: input.attachment.blob_key,
      access_token: input.attachment.access_token,
      ...(input.attachment.content_type
        ? { content_type: input.attachment.content_type }
        : {}),
      ...(input.attachment.original_filename
        ? { original_filename: input.attachment.original_filename }
        : {}),
    };
  }

  return record;
}

export function normalizeContactMessage(raw: unknown): ContactMessage | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;

  const id = typeof row.id === "string" ? row.id.trim() : "";
  const email = typeof row.email === "string" ? row.email.trim() : "";
  const message = typeof row.message === "string" ? row.message.trim() : "";
  const createdAt = typeof row.created_at === "string" ? row.created_at : "";
  const updatedAt = typeof row.updated_at === "string" ? row.updated_at : createdAt;
  const status = isContactMessageStatus(row.status) ? row.status : null;

  if (!id || !email || !message || !createdAt || !status) return null;

  const record: ContactMessage = {
    id,
    created_at: createdAt,
    updated_at: updatedAt || createdAt,
    name: typeof row.name === "string" ? row.name : "",
    email,
    message,
    status,
    notification_email_sent: row.notification_email_sent === true,
  };

  if (typeof row.subject === "string" && row.subject.trim()) {
    record.subject = row.subject.trim();
  }
  if (typeof row.category === "string" && row.category.trim()) {
    record.category = row.category.trim();
  }
  if (typeof row.admin_notes === "string") {
    record.admin_notes = row.admin_notes;
  }
  if (typeof row.source === "string" && row.source.trim()) {
    record.source = row.source.trim();
  }
  if (typeof row.page_url === "string" && row.page_url.trim()) {
    record.page_url = row.page_url.trim();
  }
  if (typeof row.notification_email_error === "string" && row.notification_email_error) {
    record.notification_email_error = row.notification_email_error;
  }

  if (row.attachment && typeof row.attachment === "object" && !Array.isArray(row.attachment)) {
    const attachment = row.attachment as Record<string, unknown>;
    const blobKey = typeof attachment.blob_key === "string" ? attachment.blob_key.trim() : "";
    const accessToken =
      typeof attachment.access_token === "string" ? attachment.access_token.trim() : "";
    if (blobKey && accessToken) {
      record.attachment = {
        blob_key: blobKey,
        access_token: accessToken,
        ...(typeof attachment.content_type === "string"
          ? { content_type: attachment.content_type }
          : {}),
        ...(typeof attachment.original_filename === "string"
          ? { original_filename: attachment.original_filename }
          : {}),
      };
    }
  }

  return record;
}

export async function saveContactMessage(
  store: BlobStoreLike,
  input: CreateContactMessageInput,
): Promise<ContactMessage> {
  const record = buildContactMessage(input);
  await store.setJSON(contactMessageBlobKey(record.id), record);
  return record;
}

export async function getContactMessage(
  store: BlobStoreLike,
  id: string,
): Promise<ContactMessage | null> {
  const key = contactMessageBlobKey(id);
  try {
    const raw = await store.get(key, { type: "json" });
    return normalizeContactMessage(raw);
  } catch {
    return null;
  }
}

export async function listContactMessages(
  store: BlobStoreLike,
  options?: { filter?: ContactMessageListFilter },
): Promise<ContactMessage[]> {
  const filter = options?.filter ?? "all";
  const listed = await store.list({ prefix: CONTACT_MESSAGES_KEY_PREFIX });
  const keys = (listed?.blobs ?? []).map((blob) => blob.key).filter(Boolean);

  const messages: ContactMessage[] = [];
  for (const key of keys) {
    try {
      const raw = await store.get(key, { type: "json" });
      const message = normalizeContactMessage(raw);
      if (message) messages.push(message);
    } catch {
      // skip unreadable blobs
    }
  }

  messages.sort((a, b) => {
    const byCreated = b.created_at.localeCompare(a.created_at);
    if (byCreated !== 0) return byCreated;
    return b.id.localeCompare(a.id);
  });

  return messages.filter((message) => matchesListFilter(message, filter));
}

export function matchesListFilter(
  message: ContactMessage,
  filter: ContactMessageListFilter,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "open":
      return message.status !== "resolved";
    case "new":
    case "in_progress":
    case "waiting_for_customer":
    case "resolved":
      return message.status === filter;
    default:
      return true;
  }
}

export function computeContactMessageCounts(
  messages: ContactMessage[],
  nowMs = Date.now(),
): ContactMessageCounts {
  const fortyEightHoursMs = 48 * 60 * 60 * 1000;
  let newCount = 0;
  let openCount = 0;
  let olderThan48Hours = 0;

  for (const message of messages) {
    if (message.status === "new") newCount += 1;
    if (message.status !== "resolved") {
      openCount += 1;
      const createdMs = Date.parse(message.created_at);
      if (Number.isFinite(createdMs) && nowMs - createdMs > fortyEightHoursMs) {
        olderThan48Hours += 1;
      }
    }
  }

  return {
    new: newCount,
    open: openCount,
    older_than_48_hours: olderThan48Hours,
  };
}

export async function updateContactMessage(
  store: BlobStoreLike,
  id: string,
  patch: UpdateContactMessageInput,
): Promise<ContactMessage | null> {
  const existing = await getContactMessage(store, id);
  if (!existing) return null;

  const now = patch.now ?? new Date().toISOString();
  const next: ContactMessage = {
    ...existing,
    updated_at: now,
  };

  if (patch.status !== undefined) {
    if (!isContactMessageStatus(patch.status)) {
      throw new Error("Invalid status.");
    }
    next.status = patch.status;
  }

  if (patch.admin_notes !== undefined) {
    if (patch.admin_notes === null) {
      delete next.admin_notes;
    } else {
      next.admin_notes = String(patch.admin_notes);
    }
  }

  if (patch.notification_email_sent !== undefined) {
    next.notification_email_sent = patch.notification_email_sent === true;
  }

  if (patch.notification_email_error !== undefined) {
    if (patch.notification_email_error === null || patch.notification_email_error === "") {
      delete next.notification_email_error;
    } else {
      next.notification_email_error = String(patch.notification_email_error);
    }
  }

  await store.setJSON(contactMessageBlobKey(next.id), next);
  return next;
}

export function buildContactAttachmentUrl(
  origin: string,
  attachment: ContactMessageAttachment,
): string {
  const base = origin.replace(/\/$/, "");
  const params = new URLSearchParams({
    id: attachment.blob_key,
    token: attachment.access_token,
  });
  return `${base}/.netlify/functions/contact-image?${params.toString()}`;
}

export function messagePreview(message: string, maxLength = 120): string {
  const trimmed = String(message || "").replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export function statusLabel(status: ContactMessageStatus): string {
  switch (status) {
    case "new":
      return "New";
    case "in_progress":
      return "In progress";
    case "waiting_for_customer":
      return "Waiting for customer";
    case "resolved":
      return "Resolved";
    default:
      return status;
  }
}
