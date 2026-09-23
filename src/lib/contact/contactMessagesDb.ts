import { randomUUID } from "node:crypto";

import type { WatsonQueryFn } from "../watson/memberSearch";
import { queryWatson } from "../watson/db";
import {
  clipNotificationError,
  nextStatusTimestamps,
  validateContactMessageId,
  type ContactMessageAttachment,
  type ContactMessageFilter,
  type ContactMessageStatus,
  type NormalizedContactSubmission,
} from "./contactMessageRecord";

export const CONTACT_MESSAGE_SELECT_COLUMNS = `
  id,
  created_at,
  name,
  email,
  subject,
  message,
  source,
  page_url,
  status,
  responded_at,
  closed_at,
  internal_notes,
  notification_email_sent,
  notification_email_error,
  notification_attempted_at,
  attachment_blob_key,
  attachment_access_token,
  attachment_content_type,
  attachment_filename,
  updated_at
`;

export const CONTACT_MESSAGE_LIST_SQL = `
  SELECT ${CONTACT_MESSAGE_SELECT_COLUMNS}
  FROM watson_contact_messages
  WHERE ($1::text = 'all' OR status = $1)
  ORDER BY created_at DESC, id DESC
`;

export const CONTACT_MESSAGE_BY_ID_SQL = `
  SELECT ${CONTACT_MESSAGE_SELECT_COLUMNS}
  FROM watson_contact_messages
  WHERE id = $1
  LIMIT 1
`;

export const CONTACT_MESSAGE_COUNT_NEW_SQL = `
  SELECT COUNT(*)::int AS count
  FROM watson_contact_messages
  WHERE status = 'new'
`;

export const CONTACT_MESSAGE_INSERT_SQL = `
  INSERT INTO watson_contact_messages (
    id,
    created_at,
    name,
    email,
    subject,
    message,
    source,
    page_url,
    status,
    notification_email_sent,
    attachment_blob_key,
    attachment_access_token,
    attachment_content_type,
    attachment_filename,
    updated_at
  ) VALUES (
    $1,
    $2::timestamptz,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    'new',
    FALSE,
    $9,
    $10,
    $11,
    $12,
    $2::timestamptz
  )
  RETURNING ${CONTACT_MESSAGE_SELECT_COLUMNS}
`;

export type ContactMessageRow = {
  id: string;
  created_at: Date | string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  source: string | null;
  page_url: string | null;
  status: string;
  responded_at: Date | string | null;
  closed_at: Date | string | null;
  internal_notes: string | null;
  notification_email_sent: boolean;
  notification_email_error: string | null;
  notification_attempted_at: Date | string | null;
  attachment_blob_key: string | null;
  attachment_access_token: string | null;
  attachment_content_type: string | null;
  attachment_filename: string | null;
  updated_at: Date | string;
};

export type ContactMessageRecord = {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  source: string | null;
  pageUrl: string | null;
  status: ContactMessageStatus;
  respondedAt: string | null;
  closedAt: string | null;
  internalNotes: string | null;
  notificationEmailSent: boolean;
  notificationEmailError: string | null;
  notificationAttemptedAt: string | null;
  attachment: ContactMessageAttachment | null;
  updatedAt: string;
};

export type InsertContactMessageInput = NormalizedContactSubmission & {
  now?: string;
  id?: string;
  attachment?: ContactMessageAttachment | null;
};

export type ContactMessageWriteResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; status: number };

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function requireIso(value: Date | string | null | undefined): string {
  return toIso(value) ?? new Date(0).toISOString();
}

export function mapContactMessageRow(row: ContactMessageRow): ContactMessageRecord | null {
  if (row.status !== "new" && row.status !== "responded" && row.status !== "closed") {
    return null;
  }
  const blobKey = row.attachment_blob_key?.trim() || "";
  const accessToken = row.attachment_access_token?.trim() || "";
  return {
    id: row.id,
    createdAt: requireIso(row.created_at),
    name: row.name || "",
    email: row.email,
    subject: row.subject?.trim() || null,
    message: row.message,
    source: row.source?.trim() || null,
    pageUrl: row.page_url?.trim() || null,
    status: row.status,
    respondedAt: toIso(row.responded_at),
    closedAt: toIso(row.closed_at),
    internalNotes: row.internal_notes?.trim() ? row.internal_notes : null,
    notificationEmailSent: row.notification_email_sent === true,
    notificationEmailError: row.notification_email_error?.trim() || null,
    notificationAttemptedAt: toIso(row.notification_attempted_at),
    attachment:
      blobKey && accessToken
        ? {
            blobKey,
            accessToken,
            contentType: row.attachment_content_type?.trim() || null,
            filename: row.attachment_filename?.trim() || null,
          }
        : null,
    updatedAt: requireIso(row.updated_at || row.created_at),
  };
}

export async function insertContactMessage(
  input: InsertContactMessageInput,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<ContactMessageRecord> {
  const now = input.now ?? new Date().toISOString();
  const id = input.id ?? randomUUID();
  const attachment = input.attachment;
  const rows = await queryFn<ContactMessageRow>(CONTACT_MESSAGE_INSERT_SQL, [
    id,
    now,
    input.name,
    input.email,
    input.subject,
    input.message,
    input.source,
    input.pageUrl,
    attachment?.blobKey ?? null,
    attachment?.accessToken ?? null,
    attachment?.contentType ?? null,
    attachment?.filename ?? null,
  ]);
  const record = rows[0] ? mapContactMessageRow(rows[0]) : null;
  if (!record) {
    throw new Error("Unable to store contact message.");
  }
  return record;
}

export async function listContactMessages(
  filter: ContactMessageFilter,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<ContactMessageRecord[]> {
  const rows = await queryFn<ContactMessageRow>(CONTACT_MESSAGE_LIST_SQL, [filter]);
  return rows.flatMap((row) => {
    const record = mapContactMessageRow(row);
    return record ? [record] : [];
  });
}

export async function getContactMessageById(
  id: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<ContactMessageRecord | null> {
  const validated = validateContactMessageId(id);
  if (!validated.ok) return null;
  const rows = await queryFn<ContactMessageRow>(CONTACT_MESSAGE_BY_ID_SQL, [validated.value]);
  return rows[0] ? mapContactMessageRow(rows[0]) : null;
}

export async function countNewContactMessages(
  queryFn: WatsonQueryFn = queryWatson,
): Promise<number> {
  const rows = await queryFn<{ count: number | string }>(CONTACT_MESSAGE_COUNT_NEW_SQL);
  const count = Number(rows[0]?.count ?? 0);
  return Number.isFinite(count) ? count : 0;
}

export async function updateContactMessageNotification(
  id: string,
  patch: {
    notificationEmailSent: boolean;
    notificationEmailError?: string | null;
    now?: string;
  },
  queryFn: WatsonQueryFn = queryWatson,
): Promise<void> {
  const now = patch.now ?? new Date().toISOString();
  const error = patch.notificationEmailSent
    ? null
    : clipNotificationError(patch.notificationEmailError) || "Unknown error";
  await queryFn(
    `
      UPDATE watson_contact_messages
      SET
        notification_email_sent = $2,
        notification_email_error = $3,
        notification_attempted_at = $4::timestamptz,
        updated_at = $4::timestamptz
      WHERE id = $1
    `,
    [id, patch.notificationEmailSent === true, error, now],
  );
}

export async function updateContactMessage(
  id: string,
  patch: {
    status?: ContactMessageStatus;
    internalNotes?: string | null;
    now?: string;
  },
  queryFn: WatsonQueryFn = queryWatson,
): Promise<ContactMessageWriteResult<ContactMessageRecord>> {
  const validatedId = validateContactMessageId(id);
  if (!validatedId.ok) {
    return { ok: false, error: validatedId.error, status: 400 };
  }

  const existing = await getContactMessageById(validatedId.value, queryFn);
  if (!existing) {
    return { ok: false, error: "Message not found.", status: 404 };
  }

  const now = patch.now ?? new Date().toISOString();
  const timestamps = patch.status
    ? nextStatusTimestamps(
        {
          status: existing.status,
          respondedAt: existing.respondedAt,
          closedAt: existing.closedAt,
        },
        patch.status,
        now,
      )
    : {
        status: existing.status,
        respondedAt: existing.respondedAt,
        closedAt: existing.closedAt,
      };
  const notes =
    patch.internalNotes === undefined ? existing.internalNotes : patch.internalNotes;

  const rows = await queryFn<ContactMessageRow>(
    `
      UPDATE watson_contact_messages
      SET
        status = $2,
        responded_at = $3::timestamptz,
        closed_at = $4::timestamptz,
        internal_notes = $5,
        updated_at = $6::timestamptz
      WHERE id = $1
      RETURNING ${CONTACT_MESSAGE_SELECT_COLUMNS}
    `,
    [
      validatedId.value,
      timestamps.status,
      timestamps.respondedAt,
      timestamps.closedAt,
      notes,
      now,
    ],
  );
  const record = rows[0] ? mapContactMessageRow(rows[0]) : null;
  if (!record) {
    return { ok: false, error: "Unable to update contact message.", status: 500 };
  }
  return { ok: true, value: record };
}
