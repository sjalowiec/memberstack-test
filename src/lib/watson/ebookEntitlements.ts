/**
 * Watson-native ebook entitlements (Assign ebook).
 *
 * Ownership for new grants prefers Memberstack member ID. The login email is
 * stored as a snapshot and used only as a compatibility fallback. Legacy
 * member ID is audit/profile metadata and is not the My Downloads key.
 *
 * Never writes to legacy_store_transactions or legacy_store_transaction_items.
 */
import {
  getLegacyEbookEntitlement,
  isLegacyEbookItemApproved,
  listApprovedLegacyEbookEntitlements,
  normalizeLegacyPurchaseEmail,
  toCustomerLegacyEbookEntitlement,
  type LegacyEbookCustomerEntitlement,
} from "../legacy/legacyEbookEntitlements";
import { legacyEbookEmailLookupKeys } from "../legacy/legacyEbookWatsonPurchases";
import { isMemberstackMemberId } from "./customerIdentifier";
import { queryWatson } from "./db";
import { type WatsonQueryFn } from "./memberSearch";
import { WATSON_NOTE_DEFAULT_AUTHOR } from "./watsonNotes";

export const WATSON_EBOOK_ENTITLEMENTS_TABLE = "watson_ebook_entitlements";

export const WATSON_EBOOK_GRANT_REASONS = [
  "verified_legacy_purchase",
  "subscriber_bonus",
  "included_with_product",
  "courtesy_replacement",
  "manual_correction",
] as const;

export type WatsonEbookGrantReason = (typeof WATSON_EBOOK_GRANT_REASONS)[number];

export const WATSON_EBOOK_GRANT_REASON_LABELS: Record<WatsonEbookGrantReason, string> = {
  verified_legacy_purchase: "Verified legacy purchase",
  subscriber_bonus: "Subscriber bonus",
  included_with_product: "Included with another product",
  courtesy_replacement: "Courtesy replacement",
  manual_correction: "Manual correction",
};

export const UNLINKED_MEMBERSTACK_GRANT_WARNING =
  "This customer does not have a linked Memberstack login. The ebook cannot appear in My Downloads until the customer has a login identity. A grant can be saved against the verified legacy email as a fallback, but it will not survive an email change until a Memberstack ID is stored.";

export const WATSON_EBOOK_NOTE_MAX_LENGTH = 2_000;
export const WATSON_EBOOK_AUTHOR_MAX_LENGTH = 100;

export type EbookEntitlementValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export type WatsonEbookEntitlementRow = {
  id: string;
  item_id: string;
  memberstack_id: string | null;
  entitlement_email: string;
  legacy_memberid: string | null;
  reason: string;
  note: string | null;
  source_storetransactionid: string | number | null;
  granted_by: string;
  granted_at: Date | string;
  revoked_by: string | null;
  revoked_at: Date | string | null;
};

export type WatsonEbookEntitlementDisplay = {
  id: string;
  itemId: string;
  title: string;
  downloadUrl: string;
  memberstackId: string | null;
  entitlementEmail: string;
  legacyMemberid: string | null;
  reason: WatsonEbookGrantReason;
  reasonLabel: string;
  note: string | null;
  sourceStoreTransactionId: string | null;
  grantedBy: string;
  grantedAt: string;
  revokedBy: string | null;
  revokedAt: string | null;
  active: boolean;
};

export type EbookGrantIdentity = {
  memberstackId: string | null;
  entitlementEmail: string | null;
  legacyMemberid: string | null;
  canAppearInMyDownloads: boolean;
  warning: string | null;
  refuseReason: string | null;
};

export type GrantEbookEntitlementInput = {
  itemId: unknown;
  reason: unknown;
  note?: unknown;
  sourceStoreTransactionId?: unknown;
  grantedBy?: unknown;
  identity: EbookGrantIdentity;
};

export type GrantEbookEntitlementResult =
  | {
      ok: true;
      created: true;
      duplicate: false;
      entitlement: WatsonEbookEntitlementDisplay;
      appearsInMyDownloads: boolean;
      warning: string | null;
    }
  | {
      ok: false;
      duplicate: true;
      error: string;
      source: "grant" | "purchase";
      entitlement?: WatsonEbookEntitlementDisplay;
      itemId: string;
    }
  | { ok: false; duplicate: false; error: string };

const ENTITLEMENT_SELECT_COLUMNS = `
  id,
  item_id,
  memberstack_id,
  entitlement_email,
  legacy_memberid,
  reason,
  note,
  source_storetransactionid,
  granted_by,
  granted_at,
  revoked_by,
  revoked_at
`;

export const WATSON_EBOOK_ENTITLEMENTS_ACTIVE_FOR_IDENTITY_SQL = `
  SELECT
    ${ENTITLEMENT_SELECT_COLUMNS}
  FROM ${WATSON_EBOOK_ENTITLEMENTS_TABLE}
  WHERE revoked_at IS NULL
    AND (
      ($1::text IS NOT NULL AND memberstack_id = $1)
      OR (
        $2::text[] IS NOT NULL
        AND cardinality($2::text[]) > 0
        AND LOWER(TRIM(entitlement_email)) = ANY($2::text[])
      )
      OR (
        $3::text IS NOT NULL AND legacy_memberid = $3
      )
    )
  ORDER BY granted_at DESC, id DESC
`;

export const WATSON_EBOOK_ENTITLEMENT_BY_ID_SQL = `
  SELECT
    ${ENTITLEMENT_SELECT_COLUMNS}
  FROM ${WATSON_EBOOK_ENTITLEMENTS_TABLE}
  WHERE id = $1
  LIMIT 1
`;

export const WATSON_EBOOK_ENTITLEMENT_INSERT_SQL = `
  INSERT INTO ${WATSON_EBOOK_ENTITLEMENTS_TABLE} (
    item_id,
    memberstack_id,
    entitlement_email,
    legacy_memberid,
    reason,
    note,
    source_storetransactionid,
    granted_by
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  RETURNING
    ${ENTITLEMENT_SELECT_COLUMNS}
`;

export const WATSON_EBOOK_ENTITLEMENT_REVOKE_SQL = `
  UPDATE ${WATSON_EBOOK_ENTITLEMENTS_TABLE}
  SET revoked_at = NOW(), revoked_by = $2
  WHERE id = $1 AND revoked_at IS NULL
  RETURNING
    ${ENTITLEMENT_SELECT_COLUMNS}
`;

export function isWatsonEbookGrantReason(value: string): value is WatsonEbookGrantReason {
  return (WATSON_EBOOK_GRANT_REASONS as readonly string[]).includes(value);
}

export function listApprovedEbookCatalogForAdmin(): Array<{
  itemId: string;
  title: string;
}> {
  return listApprovedLegacyEbookEntitlements().map((entry) => ({
    itemId: entry.itemId,
    title: entry.title,
  }));
}

export function validateEbookGrantReason(
  value: unknown,
): EbookEntitlementValidationResult<WatsonEbookGrantReason> {
  if (typeof value !== "string") {
    return { ok: false, error: "Reason is required." };
  }
  const trimmed = value.trim();
  if (!isWatsonEbookGrantReason(trimmed)) {
    return {
      ok: false,
      error: `Reason must be one of: ${WATSON_EBOOK_GRANT_REASONS.join(", ")}.`,
    };
  }
  return { ok: true, value: trimmed };
}

export function validateApprovedEbookItemId(
  value: unknown,
): EbookEntitlementValidationResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: "eBook item ID is required." };
  }
  const itemId = value.trim();
  if (!itemId) {
    return { ok: false, error: "eBook item ID is required." };
  }
  if (!isLegacyEbookItemApproved(itemId)) {
    return { ok: false, error: "Only approved redistributable ebooks can be granted." };
  }
  const entitlement = getLegacyEbookEntitlement(itemId);
  if (!entitlement || !toCustomerLegacyEbookEntitlement(entitlement)) {
    return { ok: false, error: "Only approved redistributable ebooks can be granted." };
  }
  return { ok: true, value: itemId };
}

export function validateEbookGrantNote(
  value: unknown,
): EbookEntitlementValidationResult<string | null> {
  if (value == null || value === "") {
    return { ok: true, value: null };
  }
  if (typeof value !== "string") {
    return { ok: false, error: "Note must be a string." };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }
  if (trimmed.length > WATSON_EBOOK_NOTE_MAX_LENGTH) {
    return {
      ok: false,
      error: `Note must be ${WATSON_EBOOK_NOTE_MAX_LENGTH} characters or fewer.`,
    };
  }
  return { ok: true, value: trimmed };
}

export function validateEbookGrantAuthor(
  value: unknown,
): EbookEntitlementValidationResult<string> {
  if (value == null || value === "") {
    return { ok: true, value: WATSON_NOTE_DEFAULT_AUTHOR };
  }
  if (typeof value !== "string") {
    return { ok: false, error: "Granted by must be a string." };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true, value: WATSON_NOTE_DEFAULT_AUTHOR };
  }
  if (trimmed.length > WATSON_EBOOK_AUTHOR_MAX_LENGTH) {
    return {
      ok: false,
      error: `Granted by must be ${WATSON_EBOOK_AUTHOR_MAX_LENGTH} characters or fewer.`,
    };
  }
  return { ok: true, value: trimmed };
}

export function validateSourceStoreTransactionId(
  value: unknown,
): EbookEntitlementValidationResult<number | null> {
  if (value == null || value === "") {
    return { ok: true, value: null };
  }
  const raw =
    typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return { ok: true, value: null };
  }
  if (!/^\d+$/.test(raw)) {
    return { ok: false, error: "Legacy transaction ID must be a positive integer." };
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return { ok: false, error: "Legacy transaction ID must be a positive integer." };
  }
  return { ok: true, value: parsed };
}

export function normalizeStoredMemberstackId(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || !isMemberstackMemberId(trimmed)) {
    return null;
  }
  return trimmed;
}

export function resolveEbookGrantIdentity(input: {
  memberstackId?: string | null;
  memberstackEmail?: string | null;
  legacyMemberid?: string | null;
  legacyEmail?: string | null;
  memberstackLinkStatus?: string | null;
  legacyLinkAmbiguous?: boolean;
}): EbookGrantIdentity {
  const memberstackId = normalizeStoredMemberstackId(input.memberstackId);
  const memberstackEmail = normalizeLegacyPurchaseEmail(input.memberstackEmail);
  const legacyEmail = normalizeLegacyPurchaseEmail(input.legacyEmail);
  const legacyMemberid = input.legacyMemberid?.trim() || null;
  const linkStatus = input.memberstackLinkStatus ?? null;

  if (linkStatus === "load_error" && !memberstackId) {
    return {
      memberstackId: null,
      entitlementEmail: null,
      legacyMemberid,
      canAppearInMyDownloads: false,
      warning: null,
      refuseReason:
        "Memberstack lookup is unavailable, so this ebook cannot be granted safely.",
    };
  }

  if (memberstackId) {
    const entitlementEmail = memberstackEmail ?? legacyEmail;
    if (!entitlementEmail) {
      return {
        memberstackId,
        entitlementEmail: null,
        legacyMemberid: input.legacyLinkAmbiguous ? null : legacyMemberid,
        canAppearInMyDownloads: false,
        warning: null,
        refuseReason:
          "This Memberstack account has no email to snapshot. The ebook cannot be granted until an email is present.",
      };
    }
    return {
      memberstackId,
      entitlementEmail,
      legacyMemberid: input.legacyLinkAmbiguous ? null : legacyMemberid,
      canAppearInMyDownloads: true,
      warning: null,
      refuseReason: null,
    };
  }

  if (!legacyEmail) {
    return {
      memberstackId: null,
      entitlementEmail: null,
      legacyMemberid,
      canAppearInMyDownloads: false,
      warning: UNLINKED_MEMBERSTACK_GRANT_WARNING,
      refuseReason:
        "This customer has no linked Memberstack login and no verified unique email. Do not grant against an unverified or ambiguous email.",
    };
  }

  return {
    memberstackId: null,
    entitlementEmail: legacyEmail,
    legacyMemberid,
    canAppearInMyDownloads: false,
    warning: UNLINKED_MEMBERSTACK_GRANT_WARNING,
    refuseReason: null,
  };
}

export function entitlementMatchesCustomerIdentity(
  row: Pick<WatsonEbookEntitlementRow, "memberstack_id" | "entitlement_email" | "legacy_memberid">,
  identity: {
    memberstackId?: string | null;
    emailKeys?: string[];
    legacyMemberid?: string | null;
  },
): boolean {
  const memberstackId = normalizeStoredMemberstackId(identity.memberstackId);
  if (memberstackId && row.memberstack_id === memberstackId) {
    return true;
  }
  const emailKeys = identity.emailKeys ?? [];
  const rowEmail = normalizeLegacyPurchaseEmail(row.entitlement_email);
  if (rowEmail && emailKeys.includes(rowEmail)) {
    return true;
  }
  const legacyMemberid = identity.legacyMemberid?.trim() || null;
  if (legacyMemberid && row.legacy_memberid === legacyMemberid) {
    return true;
  }
  return false;
}

export function findDuplicateActiveGrant(
  rows: WatsonEbookEntitlementRow[],
  itemId: string,
  identity: {
    memberstackId?: string | null;
    emailKeys?: string[];
  },
): WatsonEbookEntitlementRow | null {
  const wanted = itemId.trim();
  for (const row of rows) {
    if (row.revoked_at != null) continue;
    if (String(row.item_id).trim() !== wanted) continue;
    if (
      entitlementMatchesCustomerIdentity(row, {
        memberstackId: identity.memberstackId,
        emailKeys: identity.emailKeys,
      })
    ) {
      return row;
    }
  }
  return null;
}

function asText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function toIsoTimestamp(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function buildEbookEntitlementDisplay(
  row: WatsonEbookEntitlementRow,
): WatsonEbookEntitlementDisplay | null {
  const itemId = String(row.item_id ?? "").trim();
  const entitlement = getLegacyEbookEntitlement(itemId);
  const customer = entitlement ? toCustomerLegacyEbookEntitlement(entitlement) : null;
  if (!customer) return null;
  const reason = isWatsonEbookGrantReason(row.reason) ? row.reason : "manual_correction";
  const grantedAt = toIsoTimestamp(row.granted_at);
  if (!grantedAt) return null;

  return {
    id: String(row.id),
    itemId: customer.itemId,
    title: customer.title,
    downloadUrl: customer.downloadUrl,
    memberstackId: row.memberstack_id?.trim() || null,
    entitlementEmail: normalizeLegacyPurchaseEmail(row.entitlement_email) ?? "",
    legacyMemberid: row.legacy_memberid?.trim() || null,
    reason,
    reasonLabel: WATSON_EBOOK_GRANT_REASON_LABELS[reason],
    note: row.note?.trim() || null,
    sourceStoreTransactionId:
      row.source_storetransactionid == null
        ? null
        : asText(row.source_storetransactionid).trim() || null,
    grantedBy: row.granted_by,
    grantedAt,
    revokedBy: row.revoked_by?.trim() || null,
    revokedAt: toIsoTimestamp(row.revoked_at),
    active: row.revoked_at == null,
  };
}

export function toCustomerEntitlementFromGrant(
  row: WatsonEbookEntitlementRow,
): LegacyEbookCustomerEntitlement | null {
  if (row.revoked_at != null) return null;
  const display = buildEbookEntitlementDisplay(row);
  if (!display) return null;
  return {
    itemId: display.itemId,
    title: display.title,
    downloadUrl: display.downloadUrl,
  };
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return code === "23505";
}

export async function listActiveWatsonEbookEntitlementsForIdentity(
  identity: {
    memberstackId?: string | null;
    email?: string | null;
    legacyMemberid?: string | null;
  },
  queryFn: WatsonQueryFn = queryWatson,
): Promise<WatsonEbookEntitlementRow[]> {
  const memberstackId = normalizeStoredMemberstackId(identity.memberstackId);
  const emailKeys = legacyEbookEmailLookupKeys(identity.email);
  const legacyMemberid = identity.legacyMemberid?.trim() || null;
  if (!memberstackId && emailKeys.length === 0 && !legacyMemberid) {
    return [];
  }

  try {
    return await queryFn<WatsonEbookEntitlementRow>(
      WATSON_EBOOK_ENTITLEMENTS_ACTIVE_FOR_IDENTITY_SQL,
      [memberstackId, emailKeys.length > 0 ? emailKeys : null, legacyMemberid],
    );
  } catch (err) {
    console.error("watson-ebook-entitlements: list failed:", err);
    return [];
  }
}

export async function listActiveWatsonEbookCustomerEntitlements(
  identity: {
    memberstackId?: string | null;
    email?: string | null;
  },
  queryFn: WatsonQueryFn = queryWatson,
): Promise<LegacyEbookCustomerEntitlement[]> {
  const rows = await listActiveWatsonEbookEntitlementsForIdentity(
    {
      memberstackId: identity.memberstackId,
      email: identity.email,
      legacyMemberid: null,
    },
    queryFn,
  );
  const seen = new Set<string>();
  const entitlements: LegacyEbookCustomerEntitlement[] = [];
  for (const row of rows) {
    const customer = toCustomerEntitlementFromGrant(row);
    if (!customer || seen.has(customer.itemId)) continue;
    seen.add(customer.itemId);
    entitlements.push(customer);
  }
  entitlements.sort((a, b) => {
    const byTitle = a.title.localeCompare(b.title, "en", { sensitivity: "base" });
    if (byTitle !== 0) return byTitle;
    return a.itemId.localeCompare(b.itemId, "en");
  });
  return entitlements;
}

export async function getWatsonEbookEntitlementById(
  id: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<WatsonEbookEntitlementRow | null> {
  const trimmed = id.trim();
  if (!trimmed) return null;
  const rows = await queryFn<WatsonEbookEntitlementRow>(WATSON_EBOOK_ENTITLEMENT_BY_ID_SQL, [
    trimmed,
  ]);
  return rows[0] ?? null;
}

export async function grantEbookEntitlement(
  input: GrantEbookEntitlementInput,
  queryFn: WatsonQueryFn = queryWatson,
  options?: {
    paidItemIds?: Iterable<string>;
    existingGrants?: WatsonEbookEntitlementRow[];
  },
): Promise<GrantEbookEntitlementResult> {
  if (input.identity.refuseReason) {
    return { ok: false, duplicate: false, error: input.identity.refuseReason };
  }

  const itemId = validateApprovedEbookItemId(input.itemId);
  if (!itemId.ok) return { ok: false, duplicate: false, error: itemId.error };

  const reason = validateEbookGrantReason(input.reason);
  if (!reason.ok) return { ok: false, duplicate: false, error: reason.error };

  const note = validateEbookGrantNote(input.note);
  if (!note.ok) return { ok: false, duplicate: false, error: note.error };

  const grantedBy = validateEbookGrantAuthor(input.grantedBy);
  if (!grantedBy.ok) return { ok: false, duplicate: false, error: grantedBy.error };

  const sourceTxn = validateSourceStoreTransactionId(input.sourceStoreTransactionId);
  if (!sourceTxn.ok) return { ok: false, duplicate: false, error: sourceTxn.error };

  const email = normalizeLegacyPurchaseEmail(input.identity.entitlementEmail);
  if (!email) {
    return {
      ok: false,
      duplicate: false,
      error: "A verified email snapshot is required to grant an ebook.",
    };
  }

  const paidIds = new Set(
    [...(options?.paidItemIds ?? [])].map((id) => String(id).trim()).filter(Boolean),
  );
  if (paidIds.has(itemId.value)) {
    return {
      ok: false,
      duplicate: true,
      source: "purchase",
      error: "This customer already has this ebook from a paid purchase.",
      itemId: itemId.value,
    };
  }

  const emailKeys = legacyEbookEmailLookupKeys(email);
  const existing =
    options?.existingGrants ??
    (await listActiveWatsonEbookEntitlementsForIdentity(
      {
        memberstackId: input.identity.memberstackId,
        email,
        legacyMemberid: input.identity.legacyMemberid,
      },
      queryFn,
    ));
  const duplicate = findDuplicateActiveGrant(existing, itemId.value, {
    memberstackId: input.identity.memberstackId,
    emailKeys,
  });
  if (duplicate) {
    const display = buildEbookEntitlementDisplay(duplicate);
    return {
      ok: false,
      duplicate: true,
      source: "grant",
      error: "This customer already has an active grant for this ebook.",
      itemId: itemId.value,
      entitlement: display ?? undefined,
    };
  }

  try {
    const rows = await queryFn<WatsonEbookEntitlementRow>(WATSON_EBOOK_ENTITLEMENT_INSERT_SQL, [
      itemId.value,
      input.identity.memberstackId,
      email,
      input.identity.legacyMemberid,
      reason.value,
      note.value,
      sourceTxn.value,
      grantedBy.value,
    ]);
    const saved = rows[0];
    const display = saved ? buildEbookEntitlementDisplay(saved) : null;
    if (!display) {
      return { ok: false, duplicate: false, error: "Unable to save ebook entitlement." };
    }
    return {
      ok: true,
      created: true,
      duplicate: false,
      entitlement: display,
      appearsInMyDownloads: input.identity.canAppearInMyDownloads,
      warning: input.identity.warning,
    };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return {
        ok: false,
        duplicate: true,
        source: "grant",
        error: "This customer already has an active grant for this ebook.",
        itemId: itemId.value,
      };
    }
    throw err;
  }
}

export async function revokeEbookEntitlement(
  id: string,
  revokedBy: unknown,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<
  | { ok: true; entitlement: WatsonEbookEntitlementDisplay }
  | { ok: false; error: string; status: 400 | 404 }
> {
  const trimmed = id.trim();
  if (!trimmed) {
    return { ok: false, error: "Entitlement ID is required.", status: 400 };
  }
  const author = validateEbookGrantAuthor(revokedBy);
  if (!author.ok) {
    return { ok: false, error: author.error, status: 400 };
  }

  const existing = await getWatsonEbookEntitlementById(trimmed, queryFn);
  if (!existing) {
    return { ok: false, error: "Ebook entitlement not found.", status: 404 };
  }
  if (existing.revoked_at != null) {
    const display = buildEbookEntitlementDisplay(existing);
    if (!display) {
      return { ok: false, error: "Ebook entitlement not found.", status: 404 };
    }
    return { ok: true, entitlement: display };
  }

  const rows = await queryFn<WatsonEbookEntitlementRow>(WATSON_EBOOK_ENTITLEMENT_REVOKE_SQL, [
    trimmed,
    author.value,
  ]);
  const saved = rows[0];
  const display = saved ? buildEbookEntitlementDisplay(saved) : null;
  if (!display) {
    return { ok: false, error: "Unable to revoke ebook entitlement.", status: 400 };
  }
  return { ok: true, entitlement: display };
}
