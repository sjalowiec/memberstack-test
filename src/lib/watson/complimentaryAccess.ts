/**
 * Watson complimentary access-through date, keyed by Memberstack member id.
 * Does not write `legacy_members.subscriptionexpiring` or Memberstack.
 */
import { ymdFromDateOnlyValue } from "../membership/membershipStatusSummary";
import { queryWatson } from "./db";
import { validatePaidThroughYmd, formatLegacyPaidThroughDisplay } from "./legacyPaidThrough";
import type { WatsonQueryFn } from "./memberSearch";
import { createWatsonNote, WATSON_NOTE_DEFAULT_AUTHOR } from "./watsonNotes";

export const COMPLIMENTARY_ACCESS_THROUGH_LABEL = "Complimentary access through";

export const COMPLIMENTARY_ACCESS_BY_MEMBERSTACK_SQL = `
  SELECT memberstack_id, access_through
  FROM watson_complimentary_access
  WHERE memberstack_id = $1
`;

export const UPSERT_COMPLIMENTARY_ACCESS_SQL = `
  INSERT INTO watson_complimentary_access (
    memberstack_id,
    access_through,
    updated_at,
    updated_by
  )
  VALUES ($1, $2::date, NOW(), $3)
  ON CONFLICT (memberstack_id) DO UPDATE
  SET access_through = EXCLUDED.access_through,
      updated_at = NOW(),
      updated_by = EXCLUDED.updated_by
  RETURNING memberstack_id, access_through
`;

/** Every saved complimentary date. Rows without a date do not exist. */
export const ALL_COMPLIMENTARY_ACCESS_SQL = `
  SELECT memberstack_id, access_through
  FROM watson_complimentary_access
  WHERE access_through IS NOT NULL
  ORDER BY memberstack_id ASC
`;

/** Expired complimentary rows for the daily cleanup. The access-through day itself is excluded. */
export const EXPIRED_COMPLIMENTARY_ACCESS_SQL = `
  SELECT memberstack_id, access_through
  FROM watson_complimentary_access
  WHERE access_through < $1::date
  ORDER BY access_through ASC, memberstack_id ASC
`;

export interface ComplimentaryAccessRow {
  memberstack_id: string;
  access_through: Date | string;
}

export function validateComplimentaryMemberstackId(
  value: unknown,
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== "string") {
    return { ok: false, error: "Memberstack ID is required." };
  }
  const trimmed = value.trim();
  if (!/^mem_[A-Za-z0-9_]+$/.test(trimmed) || trimmed.length > 80) {
    return { ok: false, error: "Memberstack ID is invalid." };
  }
  return { ok: true, value: trimmed };
}

export function complimentaryAccessThroughYmd(
  value: Date | string | null | undefined,
): string | null {
  return ymdFromDateOnlyValue(value ?? null);
}

/**
 * Saved access-through day, or null when this member has no complimentary date.
 */
export async function loadComplimentaryAccessThroughYmd(
  memberstackId: string | null | undefined,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<string | null> {
  const id = validateComplimentaryMemberstackId(memberstackId ?? "");
  if (!id.ok) return null;
  const rows = await queryFn<ComplimentaryAccessRow>(COMPLIMENTARY_ACCESS_BY_MEMBERSTACK_SQL, [
    id.value,
  ]);
  return complimentaryAccessThroughYmd(rows[0]?.access_through ?? null);
}

export interface UpdateComplimentaryAccessResult {
  memberstackId: string;
  oldAccessThroughYmd: string | null;
  newAccessThroughYmd: string;
  oldAccessThroughDisplay: string | null;
  newAccessThroughDisplay: string;
}

/**
 * Insert or replace the complimentary access-through date and write a
 * Membership Watson note on the Memberstack member id.
 */
export async function updateComplimentaryAccessThrough(input: {
  memberstackId: string;
  accessThroughYmd: string;
  updatedBy?: string;
  queryFn?: WatsonQueryFn;
}): Promise<
  | { ok: true; value: UpdateComplimentaryAccessResult }
  | { ok: false; error: string; status: number }
> {
  const idResult = validateComplimentaryMemberstackId(input.memberstackId);
  if (!idResult.ok) {
    return { ok: false, error: idResult.error, status: 400 };
  }
  const dateResult = validatePaidThroughYmd(input.accessThroughYmd);
  if (!dateResult.ok) {
    return { ok: false, error: dateResult.error, status: 400 };
  }

  const queryFn = input.queryFn ?? queryWatson;
  const memberstackId = idResult.value;
  const newYmd = dateResult.value;
  const oldYmd = await loadComplimentaryAccessThroughYmd(memberstackId, queryFn);
  const author =
    typeof input.updatedBy === "string" && input.updatedBy.trim()
      ? input.updatedBy.trim().slice(0, 100)
      : WATSON_NOTE_DEFAULT_AUTHOR;

  if (oldYmd !== newYmd) {
    await queryFn(UPSERT_COMPLIMENTARY_ACCESS_SQL, [memberstackId, newYmd, author]);
    const oldDisplay = formatLegacyPaidThroughDisplay(oldYmd) ?? "(none)";
    const newDisplay = formatLegacyPaidThroughDisplay(newYmd) ?? newYmd;
    await createWatsonNote(
      {
        memberid: memberstackId,
        category: "Membership",
        createdBy: author,
        noteText: `Updated complimentary access-through date from ${oldDisplay} (${oldYmd ?? "none"}) to ${newDisplay} (${newYmd}).`,
      },
      queryFn,
    );
  }

  return {
    ok: true,
    value: {
      memberstackId,
      oldAccessThroughYmd: oldYmd,
      newAccessThroughYmd: newYmd,
      oldAccessThroughDisplay: formatLegacyPaidThroughDisplay(oldYmd),
      newAccessThroughDisplay: formatLegacyPaidThroughDisplay(newYmd) ?? newYmd,
    },
  };
}
