/**
 * Saved video and card status for Member Thank-Yous.
 * One row per Stripe charge. Each update writes only the checkbox that changed.
 */

import { queryWatson } from "./db";
import type { WatsonQueryFn } from "./memberSearch";
import { isValidThankYouChargeId } from "./memberThankYouRules";

export const MEMBER_THANK_YOU_TABLE = "watson_member_thank_yous";

export type ThankYouStatusField = "video" | "card";

export type ThankYouStatusRecord = {
  stripeChargeId: string;
  videoSentAt: string | null;
  cardSentAt: string | null;
  videoReplyId: string | null;
  completedAt: string | null;
  updatedAt: string;
};

type StatusRow = {
  stripe_charge_id: string;
  video_sent_at: Date | string | null;
  card_sent_at: Date | string | null;
  video_reply_id?: string | null;
  completed_at?: Date | string | null;
  updated_at: Date | string;
};

const STATUS_RETURNING =
  "stripe_charge_id, video_sent_at, card_sent_at, video_reply_id, completed_at, updated_at";
const LEGACY_STATUS_RETURNING = "stripe_charge_id, video_sent_at, card_sent_at, updated_at";

export class MemberThankYouStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemberThankYouStoreError";
  }
}

export function isMissingThankYouTable(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      (error as { code?: string }).code === "42P01",
  );
}

export function isMissingThankYouColumn(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      (error as { code?: string }).code === "42703",
  );
}

function videoReplyId(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 120 || !/^[A-Za-z0-9._-]+$/.test(trimmed)) return null;
  return trimmed;
}

function isoTimestamp(value: Date | string | null | undefined): string | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function mapThankYouStatusRow(row: StatusRow): ThankYouStatusRecord | null {
  const stripeChargeId = row.stripe_charge_id?.trim() ?? "";
  const updatedAt = isoTimestamp(row.updated_at);
  if (!isValidThankYouChargeId(stripeChargeId) || !updatedAt) return null;
  return {
    stripeChargeId,
    videoSentAt: isoTimestamp(row.video_sent_at),
    cardSentAt: isoTimestamp(row.card_sent_at),
    videoReplyId: videoReplyId(row.video_reply_id),
    completedAt: isoTimestamp(row.completed_at),
    updatedAt,
  };
}

export function thankYouStatusUpdateSql(
  field: ThankYouStatusField,
  returning = STATUS_RETURNING,
): string {
  const column = field === "video" ? "video_sent_at" : "card_sent_at";
  return `
    INSERT INTO ${MEMBER_THANK_YOU_TABLE} (
      stripe_charge_id,
      ${column},
      updated_at
    ) VALUES ($1, $2, NOW())
    ON CONFLICT (stripe_charge_id) DO UPDATE
    SET ${column} = EXCLUDED.${column},
        updated_at = NOW()
    RETURNING ${returning}
  `;
}

export function thankYouVideoLinkSql(): string {
  return `
    INSERT INTO ${MEMBER_THANK_YOU_TABLE} (
      stripe_charge_id,
      video_reply_id,
      updated_at
    ) VALUES ($1, $2, NOW())
    ON CONFLICT (stripe_charge_id) DO UPDATE
    SET video_reply_id = COALESCE(${MEMBER_THANK_YOU_TABLE}.video_reply_id, EXCLUDED.video_reply_id),
        updated_at = NOW()
    RETURNING ${STATUS_RETURNING}
  `;
}

export function thankYouCompletionSql(): string {
  return `
    INSERT INTO ${MEMBER_THANK_YOU_TABLE} (
      stripe_charge_id,
      completed_at,
      updated_at
    ) VALUES ($1, $2, NOW())
    ON CONFLICT (stripe_charge_id) DO UPDATE
    SET completed_at = EXCLUDED.completed_at,
        updated_at = NOW()
    RETURNING ${STATUS_RETURNING}
  `;
}

const STATUS_LIST_SQL = `
  SELECT ${STATUS_RETURNING}
  FROM ${MEMBER_THANK_YOU_TABLE}
  WHERE stripe_charge_id = ANY($1::text[])
`;

const LEGACY_STATUS_LIST_SQL = `
  SELECT ${LEGACY_STATUS_RETURNING}
  FROM ${MEMBER_THANK_YOU_TABLE}
  WHERE stripe_charge_id = ANY($1::text[])
`;

const STATUS_ONE_SQL = `
  SELECT ${STATUS_RETURNING}
  FROM ${MEMBER_THANK_YOU_TABLE}
  WHERE stripe_charge_id = $1
`;

function mapStatusRows(rows: StatusRow[]): ThankYouStatusRecord[] {
  return rows.flatMap((row) => {
    const mapped = mapThankYouStatusRow(row);
    return mapped ? [mapped] : [];
  });
}

export async function listThankYouStatuses(
  chargeIds: string[],
  queryFn: WatsonQueryFn = queryWatson,
): Promise<{ rows: ThankYouStatusRecord[]; videoColumnsAvailable: boolean }> {
  const ids = [...new Set(chargeIds.map((id) => id.trim()).filter(isValidThankYouChargeId))];
  if (ids.length === 0) return { rows: [], videoColumnsAvailable: true };
  try {
    const rows = await queryFn<StatusRow>(STATUS_LIST_SQL, [ids]);
    return { rows: mapStatusRows(rows), videoColumnsAvailable: true };
  } catch (error) {
    if (!isMissingThankYouColumn(error)) throw error;
    const rows = await queryFn<StatusRow>(LEGACY_STATUS_LIST_SQL, [ids]);
    return { rows: mapStatusRows(rows), videoColumnsAvailable: false };
  }
}

export async function setThankYouStatus(
  input: {
    stripeChargeId: string;
    field: ThankYouStatusField;
    sent: boolean;
    sentAt?: string | null;
  },
  queryFn: WatsonQueryFn = queryWatson,
): Promise<ThankYouStatusRecord> {
  const stripeChargeId = input.stripeChargeId.trim();
  if (!isValidThankYouChargeId(stripeChargeId)) {
    throw new MemberThankYouStoreError("Stripe charge id is invalid.");
  }
  if (input.field !== "video" && input.field !== "card") {
    throw new MemberThankYouStoreError("Thank-you field is invalid.");
  }
  const sentAt = input.sent ? input.sentAt?.trim() || new Date().toISOString() : null;
  let rows: StatusRow[];
  try {
    rows = await queryFn<StatusRow>(thankYouStatusUpdateSql(input.field), [stripeChargeId, sentAt]);
  } catch (error) {
    if (!isMissingThankYouColumn(error)) throw error;
    rows = await queryFn<StatusRow>(thankYouStatusUpdateSql(input.field, LEGACY_STATUS_RETURNING), [
      stripeChargeId,
      sentAt,
    ]);
  }
  const mapped = rows[0] ? mapThankYouStatusRow(rows[0]) : null;
  if (!mapped) {
    throw new MemberThankYouStoreError("Thank-you status could not be saved.");
  }
  return mapped;
}

export async function getThankYouStatus(
  stripeChargeId: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<ThankYouStatusRecord | null> {
  const id = stripeChargeId.trim();
  if (!isValidThankYouChargeId(id)) return null;
  const rows = await queryFn<StatusRow>(STATUS_ONE_SQL, [id]);
  return rows[0] ? mapThankYouStatusRow(rows[0]) : null;
}

export async function setThankYouVideoReplyId(
  input: { stripeChargeId: string; videoReplyId: string },
  queryFn: WatsonQueryFn = queryWatson,
): Promise<ThankYouStatusRecord> {
  const stripeChargeId = input.stripeChargeId.trim();
  const replyId = videoReplyId(input.videoReplyId);
  if (!isValidThankYouChargeId(stripeChargeId) || !replyId) {
    throw new MemberThankYouStoreError("Thank-you video could not be saved.");
  }
  const rows = await queryFn<StatusRow>(thankYouVideoLinkSql(), [stripeChargeId, replyId]);
  const mapped = rows[0] ? mapThankYouStatusRow(rows[0]) : null;
  if (!mapped) {
    throw new MemberThankYouStoreError("Thank-you video could not be saved.");
  }
  return mapped;
}

export async function setThankYouCompleted(
  input: { stripeChargeId: string; completed: boolean; completedAt?: string | null },
  queryFn: WatsonQueryFn = queryWatson,
): Promise<ThankYouStatusRecord> {
  const stripeChargeId = input.stripeChargeId.trim();
  if (!isValidThankYouChargeId(stripeChargeId)) {
    throw new MemberThankYouStoreError("Stripe charge id is invalid.");
  }
  const completedAt = input.completed ? input.completedAt?.trim() || new Date().toISOString() : null;
  const rows = await queryFn<StatusRow>(thankYouCompletionSql(), [stripeChargeId, completedAt]);
  const mapped = rows[0] ? mapThankYouStatusRow(rows[0]) : null;
  if (!mapped) {
    throw new MemberThankYouStoreError("Thank-you completion could not be saved.");
  }
  return mapped;
}
