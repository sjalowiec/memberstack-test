/**
 * Server lookup of verified Home Study purchases for the authenticated member.
 *
 * Identity comes from the Memberstack admin email already resolved for this
 * session. A caller-supplied legacy member id or course id is not accepted.
 * Missing and ambiguous email links grant nothing.
 *
 * Client bundles must not import this module.
 */
import {
  homeStudyPlaybackHref,
  homeStudyPlaybackTitle,
  verifiedHomeStudyPlaybackCourse,
} from "../../config/homeStudyCourseMap";
import { memberEmailFromMemberstackPayload } from "../patterns/memberstackMember";
import { queryWatson } from "../watson/db";
import { resolveLegacyLinkByMemberstackEmail } from "../watson/customerIdentifier";
import type { WatsonQueryFn } from "../watson/memberSearch";
import type { HomeStudyCreditEvidenceInput } from "./homeStudyCreditEvidence";
import {
  isVerifiedHomeStudyLibraryPurchase,
  type HomeStudyLibraryPurchaseRow,
} from "./homeStudyPurchaseEntitlement";

export const HOME_STUDY_PURCHASE_LOOKUP_SQL = `
  SELECT
    c.homestudy_courseid_fk,
    c.subscriberfree,
    c.credit_id_fk,
    e.transaction_type,
    e.dollar_amount,
    e.authorize_id,
    e.transaction_guid
  FROM legacy_course_member_library c
  LEFT JOIN legacy_homestudy_credit_evidence e
    ON e.credit_id = c.credit_id_fk
   AND c.credit_id_fk > 0
  WHERE c.memberid_fk = $1
`;

export type HomeStudyAccountCourse = {
  courseId: number;
  title: string;
  href: string | null;
  availability: "available" | "not_on_site";
};

export type HomeStudyPurchaseIdentity = "unique" | "none" | "ambiguous" | "unavailable";

export type HomeStudyPurchaseLookup = {
  identity: HomeStudyPurchaseIdentity;
  verifiedCourseIds: number[];
  accountCourses: HomeStudyAccountCourse[];
};

type PurchaseQueryRow = HomeStudyLibraryPurchaseRow & {
  transaction_type: string | null;
  dollar_amount: unknown;
  authorize_id: string | null;
  transaction_guid: string | null;
};

function evidenceFromRow(row: PurchaseQueryRow): HomeStudyCreditEvidenceInput | null {
  if (
    row.transaction_type == null &&
    row.dollar_amount == null &&
    row.authorize_id == null &&
    row.transaction_guid == null
  ) {
    return null;
  }
  return {
    transactionType: row.transaction_type,
    dollarAmount: row.dollar_amount,
    authorizeId: row.authorize_id,
    transactionGuid: row.transaction_guid,
  };
}

export function accountCourseForHomeStudyId(courseId: number): HomeStudyAccountCourse {
  const playback = verifiedHomeStudyPlaybackCourse(courseId);
  if (!playback) {
    return {
      courseId,
      title: `Home Study course ${courseId}`,
      href: null,
      availability: "not_on_site",
    };
  }
  return {
    courseId: playback.courseId,
    title: homeStudyPlaybackTitle(playback.courseId) ?? `Home Study course ${playback.courseId}`,
    href: homeStudyPlaybackHref(playback.courseId),
    availability: "available",
  };
}

export function homeStudyPurchaseLookupFromRows(rows: PurchaseQueryRow[]): {
  verifiedCourseIds: number[];
  accountCourses: HomeStudyAccountCourse[];
} {
  const verified = new Set<number>();
  for (const row of rows) {
    if (!isVerifiedHomeStudyLibraryPurchase(row, evidenceFromRow(row))) continue;
    verified.add(row.homestudy_courseid_fk);
  }
  const verifiedCourseIds = [...verified].sort((a, b) => a - b);
  return {
    verifiedCourseIds,
    accountCourses: verifiedCourseIds.map(accountCourseForHomeStudyId),
  };
}

export function playbackCourseIdsFromLookup(lookup: HomeStudyPurchaseLookup): number[] {
  return lookup.accountCourses
    .filter((course) => course.availability === "available" && course.href)
    .map((course) => course.courseId);
}

function emptyLookup(identity: HomeStudyPurchaseIdentity): HomeStudyPurchaseLookup {
  return { identity, verifiedCourseIds: [], accountCourses: [] };
}

export async function loadHomeStudyPurchasesForLegacyMemberId(
  legacyMemberId: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<HomeStudyPurchaseLookup> {
  const memberid = legacyMemberId.trim();
  if (!memberid) return emptyLookup("none");
  try {
    const rows = await queryFn<PurchaseQueryRow>(HOME_STUDY_PURCHASE_LOOKUP_SQL, [memberid]);
    return {
      identity: "unique",
      ...homeStudyPurchaseLookupFromRows(rows),
    };
  } catch {
    return emptyLookup("unavailable");
  }
}

/**
 * Resolve the signed-in member's legacy identity from their Memberstack email,
 * then load verified purchases. Ambiguous and missing links grant nothing.
 */
export async function loadHomeStudyPurchasesForMemberstackRecord(
  record: unknown,
  queryFn?: WatsonQueryFn,
): Promise<HomeStudyPurchaseLookup> {
  let link;
  try {
    link = await resolveLegacyLinkByMemberstackEmail(
      memberEmailFromMemberstackPayload(record) ?? null,
      queryFn,
    );
  } catch {
    return emptyLookup("unavailable");
  }

  if (link.status === "ambiguous") return emptyLookup("ambiguous");
  if (link.status !== "unique") return emptyLookup("none");
  return loadHomeStudyPurchasesForLegacyMemberId(link.member.memberid, queryFn);
}
