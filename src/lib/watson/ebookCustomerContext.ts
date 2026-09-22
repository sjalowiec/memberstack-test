import { getLegacyMemberById } from "./memberDetail";
import {
  loadCustomerMemberstackMemberById,
  resolveMemberstackMemberByExactEmail,
} from "./customerMemberstack";
import { resolveLegacyLinkByMemberstackEmail } from "./customerIdentifier";
import { getWatsonPool, queryWatson } from "./db";
import { applyWatsonEbookEntitlementsSchema } from "./schema";
import { type WatsonQueryFn } from "./memberSearch";

export type EbookCustomerContext = {
  memberstackId: string | null;
  memberstackEmail: string | null;
  legacyMemberid: string | null;
  legacyEmail: string | null;
  memberstackLinkStatus: string;
  legacyLinkAmbiguous: boolean;
};

export type EbookCustomerContextResult =
  | { ok: true; context: EbookCustomerContext }
  | { ok: false; status: 404 | 500; error: string };

let schemaEnsured = false;

export async function ensureWatsonEbookEntitlementsTable(): Promise<void> {
  if (schemaEnsured) return;
  const pool = await getWatsonPool();
  await applyWatsonEbookEntitlementsSchema(pool);
  schemaEnsured = true;
}

export function resetWatsonEbookEntitlementsSchemaGuard(): void {
  schemaEnsured = false;
}

export async function resolveEbookCustomerContextFromLegacyMember(
  memberid: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<EbookCustomerContextResult> {
  const member = await getLegacyMemberById(memberid, queryFn);
  if (!member) {
    return { ok: false, status: 404, error: "Legacy customer not found." };
  }

  const memberstackLookup = await resolveMemberstackMemberByExactEmail(member.email);
  const memberstackId = memberstackLookup.ok ? memberstackLookup.member.id : null;
  const memberstackEmail = memberstackLookup.ok
    ? memberstackLookup.member.auth?.email ?? null
    : null;
  const memberstackLinkStatus = memberstackLookup.ok
    ? "linked"
    : memberstackLookup.status;

  return {
    ok: true,
    context: {
      memberstackId,
      memberstackEmail,
      legacyMemberid: member.memberid,
      legacyEmail: member.email,
      memberstackLinkStatus,
      legacyLinkAmbiguous: false,
    },
  };
}

export async function resolveEbookCustomerContextFromMemberstack(
  memberstackId: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<EbookCustomerContextResult> {
  const memberstackResult = await loadCustomerMemberstackMemberById(memberstackId);
  if (!memberstackResult.ok) {
    if (memberstackResult.status === "not_found") {
      return { ok: false, status: 404, error: "Memberstack customer not found." };
    }
    return { ok: false, status: 500, error: memberstackResult.error };
  }

  const memberstackEmail = memberstackResult.member.auth?.email ?? null;
  const legacyLink = await resolveLegacyLinkByMemberstackEmail(memberstackEmail, queryFn);
  const legacyLinkAmbiguous = legacyLink.status === "ambiguous";
  const legacyMember = legacyLink.status === "unique" ? legacyLink.member : null;

  return {
    ok: true,
    context: {
      memberstackId: memberstackResult.member.id,
      memberstackEmail,
      legacyMemberid: legacyMember?.memberid ?? null,
      legacyEmail: legacyMember?.email ?? null,
      memberstackLinkStatus: "linked",
      legacyLinkAmbiguous,
    },
  };
}
