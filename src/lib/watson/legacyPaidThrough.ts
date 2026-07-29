/**
 * Admin update for Watson's authoritative legacy paid-through date
 * (`legacy_members.subscriptionexpiring`). Does not write to Memberstack.
 */
import {
  formatMembershipCalendarDateFromYmd,
  ymdFromDateOnlyValue,
} from "../membership/membershipStatusSummary";
import { queryWatson } from "./db";
import type { LegacyMemberDetailRow } from "./memberDetail";
import { getLegacyMemberById } from "./memberDetail";
import type { WatsonQueryFn } from "./memberSearch";
import {
  createWatsonNote,
  WATSON_NOTE_DEFAULT_AUTHOR,
} from "./watsonNotes";

export const UPDATE_LEGACY_PAID_THROUGH_SQL = `
  UPDATE legacy_members
  SET subscriptionexpiring = $1::date
  WHERE memberid = $2
`;

export type LegacyPaidThroughValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function validateLegacyMemberid(
  value: unknown,
): LegacyPaidThroughValidationResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: "Member ID is required." };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, error: "Member ID is required." };
  }
  if (trimmed.length > 100) {
    return { ok: false, error: "Member ID is too long." };
  }
  return { ok: true, value: trimmed };
}

/** Accept only a real YYYY-MM-DD calendar date (rejects 2026-02-31). */
export function validatePaidThroughYmd(
  value: unknown,
): LegacyPaidThroughValidationResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: "Paid-through date must be a valid date (YYYY-MM-DD)." };
  }
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { ok: false, error: "Paid-through date must be a valid date (YYYY-MM-DD)." };
  }
  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== trimmed) {
    return { ok: false, error: "Paid-through date must be a valid date (YYYY-MM-DD)." };
  }
  return { ok: true, value: trimmed };
}

export function formatLegacyPaidThroughDisplay(
  value: Date | string | null | undefined,
): string | null {
  const ymd = ymdFromDateOnlyValue(value ?? null);
  if (!ymd) return null;
  return formatMembershipCalendarDateFromYmd(ymd);
}

export function legacyPaidThroughYmd(
  value: Date | string | null | undefined,
): string | null {
  return ymdFromDateOnlyValue(value ?? null);
}

export interface UpdateLegacyPaidThroughResult {
  memberid: string;
  oldPaidThroughYmd: string | null;
  newPaidThroughYmd: string;
  oldPaidThroughDisplay: string | null;
  newPaidThroughDisplay: string;
  member: LegacyMemberDetailRow;
}

/**
 * Update only `legacy_members.subscriptionexpiring` for the given member.
 * Records a Membership watson_note as a minimal admin audit trail.
 */
export async function updateLegacyPaidThrough(input: {
  memberid: string;
  paidThroughYmd: string;
  updatedBy?: string;
  queryFn?: WatsonQueryFn;
}): Promise<
  | { ok: true; value: UpdateLegacyPaidThroughResult }
  | { ok: false; error: string; status: number }
> {
  const memberidResult = validateLegacyMemberid(input.memberid);
  if (!memberidResult.ok) {
    return { ok: false, error: memberidResult.error, status: 400 };
  }
  const dateResult = validatePaidThroughYmd(input.paidThroughYmd);
  if (!dateResult.ok) {
    return { ok: false, error: dateResult.error, status: 400 };
  }

  const queryFn = input.queryFn ?? queryWatson;
  const existing = await getLegacyMemberById(memberidResult.value, queryFn);
  if (!existing) {
    return { ok: false, error: "Member not found.", status: 404 };
  }

  const oldYmd = legacyPaidThroughYmd(existing.subscriptionexpiring);
  const newYmd = dateResult.value;
  if (oldYmd === newYmd) {
    return {
      ok: true,
      value: {
        memberid: existing.memberid,
        oldPaidThroughYmd: oldYmd,
        newPaidThroughYmd: newYmd,
        oldPaidThroughDisplay: formatLegacyPaidThroughDisplay(oldYmd),
        newPaidThroughDisplay: formatLegacyPaidThroughDisplay(newYmd)!,
        member: existing,
      },
    };
  }

  await queryFn(UPDATE_LEGACY_PAID_THROUGH_SQL, [newYmd, memberidResult.value]);

  const updated = await getLegacyMemberById(memberidResult.value, queryFn);
  if (!updated) {
    return { ok: false, error: "Member not found after update.", status: 500 };
  }

  const oldDisplay = formatLegacyPaidThroughDisplay(oldYmd) ?? "(none)";
  const newDisplay = formatLegacyPaidThroughDisplay(newYmd)!;
  const author =
    typeof input.updatedBy === "string" && input.updatedBy.trim()
      ? input.updatedBy.trim().slice(0, 100)
      : WATSON_NOTE_DEFAULT_AUTHOR;

  await createWatsonNote(
    {
      memberid: memberidResult.value,
      category: "Membership",
      createdBy: author,
      noteText: `Updated legacy paid-through date from ${oldDisplay} (${oldYmd ?? "none"}) to ${newDisplay} (${newYmd}).`,
    },
    queryFn,
  );

  return {
    ok: true,
    value: {
      memberid: updated.memberid,
      oldPaidThroughYmd: oldYmd,
      newPaidThroughYmd: newYmd,
      oldPaidThroughDisplay: formatLegacyPaidThroughDisplay(oldYmd),
      newPaidThroughDisplay: newDisplay,
      member: updated,
    },
  };
}
