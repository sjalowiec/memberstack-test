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
  updatedAt: string;
};

type StatusRow = {
  stripe_charge_id: string;
  video_sent_at: Date | string | null;
  card_sent_at: Date | string | null;
  updated_at: Date | string;
};

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
    updatedAt,
  };
}

export function thankYouStatusUpdateSql(field: ThankYouStatusField): string {
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
    RETURNING stripe_charge_id, video_sent_at, card_sent_at, updated_at
  `;
}

export async function listThankYouStatuses(
  chargeIds: string[],
  queryFn: WatsonQueryFn = queryWatson,
): Promise<ThankYouStatusRecord[]> {
  const ids = [...new Set(chargeIds.map((id) => id.trim()).filter(isValidThankYouChargeId))];
  if (ids.length === 0) return [];
  const rows = await queryFn<StatusRow>(
    `
      SELECT stripe_charge_id, video_sent_at, card_sent_at, updated_at
      FROM ${MEMBER_THANK_YOU_TABLE}
      WHERE stripe_charge_id = ANY($1::text[])
    `,
    [ids],
  );
  return rows.flatMap((row) => {
    const mapped = mapThankYouStatusRow(row);
    return mapped ? [mapped] : [];
  });
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
  const rows = await queryFn<StatusRow>(thankYouStatusUpdateSql(input.field), [
    stripeChargeId,
    sentAt,
  ]);
  const mapped = rows[0] ? mapThankYouStatusRow(rows[0]) : null;
  if (!mapped) {
    throw new MemberThankYouStoreError("Thank-you status could not be saved.");
  }
  return mapped;
}
