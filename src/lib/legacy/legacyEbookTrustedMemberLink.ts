/**
 * Server-only trusted legacy member ID for ebook recovery.
 *
 * Identity always starts from the verified Memberstack JWT. A stored KIN /
 * legacy member ID is used only when a trusted server source supplies it and
 * Watson still has that member. Otherwise a unique exact-email match on
 * `legacy_members` is required. Missing or ambiguous links skip recovery.
 *
 * `requireMember` currently returns `{ id, email }` only — there is no
 * Memberstack kin-id on the JWT path — so live My Downloads uses unique email
 * matching. Tests (and a future server-side link) may pass `storedLegacyMemberid`.
 */
import {
  resolveLegacyLinkByMemberstackEmail,
  type LegacyEmailLinkResult,
} from "../watson/customerIdentifier";
import { getLegacyMemberById, type LegacyMemberDetailRow } from "../watson/memberDetail";
import { queryWatson } from "../watson/db";
import { type WatsonQueryFn } from "../watson/memberSearch";
import { normalizeTrustedLegacyMemberid } from "./legacyEbookWatsonPurchases";

export type TrustedLegacyMemberLinkResult =
  | { status: "unique"; memberid: string; source: "stored" | "email" }
  | { status: "none" }
  | { status: "ambiguous" };

export type ResolveTrustedLegacyMemberIdInput = {
  email: string | null | undefined;
  /** Verified server-side KIN / legacy member ID. Never from the browser. */
  storedLegacyMemberid?: string | null;
};

export type ResolveTrustedLegacyMemberIdDeps = {
  queryFn?: WatsonQueryFn;
  getMemberById?: (
    memberid: string,
    queryFn?: WatsonQueryFn,
  ) => Promise<LegacyMemberDetailRow | null>;
  resolveByEmail?: (
    email: string | null | undefined,
    queryFn?: WatsonQueryFn,
  ) => Promise<LegacyEmailLinkResult>;
};

export async function resolveTrustedLegacyMemberIdForEbookRecovery(
  input: ResolveTrustedLegacyMemberIdInput,
  deps: ResolveTrustedLegacyMemberIdDeps = {},
): Promise<TrustedLegacyMemberLinkResult> {
  const queryFn = deps.queryFn ?? queryWatson;
  const getMemberById = deps.getMemberById ?? getLegacyMemberById;
  const resolveByEmail = deps.resolveByEmail ?? resolveLegacyLinkByMemberstackEmail;

  const stored = normalizeTrustedLegacyMemberid(input.storedLegacyMemberid);
  if (stored) {
    const member = await getMemberById(stored, queryFn);
    if (member?.memberid) {
      return { status: "unique", memberid: member.memberid, source: "stored" };
    }
  }

  const emailLink = await resolveByEmail(input.email, queryFn);
  if (emailLink.status === "unique" && emailLink.member.memberid) {
    return {
      status: "unique",
      memberid: emailLink.member.memberid,
      source: "email",
    };
  }
  if (emailLink.status === "ambiguous") {
    return { status: "ambiguous" };
  }
  return { status: "none" };
}
