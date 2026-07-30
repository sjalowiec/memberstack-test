import { getMemberCourses, type MemberCourseDisplay } from "./memberCourses";
import { getMemberPdfPurchaseCount } from "./memberPdfPurchases";
import {
  buildLegacyCustomerProfileUrl,
  buildLegacyMemberDetailUrl,
  buildMemberstackCustomerProfileUrl,
  emailsMatchForLegacyLink,
  resolveCustomerByMemberid,
  resolveLegacyLinkByMemberstackEmail,
  type CustomerProfileRouteType,
  type LegacyEmailLinkResult,
} from "./customerIdentifier";
import type { MemberstackMember } from "../membership/membershipSummary";
import {
  buildCustomerMemberstackSummary,
  formatCustomerDisplayName,
  loadCustomerMemberstackMemberById,
  MEMBERSTACK_LOOKUP_UNAVAILABLE_LABEL,
  MEMBERSTACK_NOT_FOUND_FOR_EMAIL_LABEL,
  resolveMemberstackMemberByExactEmail,
  type CustomerMemberstackSummary,
} from "./customerMemberstack";
import {
  buildCustomerTimeline,
  resolveLastActivityDate,
  resolveLegacyAccessThroughDate,
  type CustomerTimelineEvent,
} from "./customerTimeline";
import { hasDisplayValue, type LegacyMemberDetailRow } from "./memberDetail";
import { getMemberMemberships, type MemberMembershipDisplay } from "./memberMembership";
import {
  formatLegacyMoney,
  getMemberOrders,
  parseLegacyMoneyAmount,
  type MemberOrderDisplay,
} from "./memberOrders";
import { getMemberLegacySupportNoteCount } from "./memberSupportNotes";
import { formatMemberDisplayName, formatMemberJoinedDateDisplay } from "./memberSearch";
import {
  formatLegacyPaidThroughDisplay,
  legacyPaidThroughYmd,
} from "./legacyPaidThrough";
import {
  buildWatsonCustomerCurrentMembership,
  watsonLegacyContextFromPaidThrough,
  type WatsonCustomerCurrentMembership,
  type WatsonMembershipSource,
} from "./watsonCustomerCurrentMembership";
import {
  getCustomerWatsonNoteCount,
  getCustomerWatsonNotes,
  type WatsonNoteDisplay,
} from "./watsonNotes";

/** Snapshot / header label for Watson `subscriptionexpiring` (historical record). */
export const LEGACY_RECORD_PAID_THROUGH_LABEL = "Legacy record paid-through";

export type MemberstackLinkStatus =
  | "linked"
  | "not_found"
  | "load_error"
  | "ambiguous"
  | "not_applicable";

export interface CustomerHeaderField {
  label: string;
  value: string;
  source?: "legacy" | "memberstack";
}

export interface CustomerProfileAction {
  label: string;
  href: string;
  description?: string;
}

export type CustomerMembershipStatusTone = "active" | "inactive" | "unknown" | "not_linked";

export interface CustomerProfileHeaderView {
  displayName: string;
  email: string | null;
  membershipStatus: string | null;
  membershipStatusTone: CustomerMembershipStatusTone;
  /** Current plan label (paid Monthly/Annual, Legacy Membership, or prior plan). */
  currentPlan: string | null;
  /** "Next renewal" | "Active through" | "Paid through" when a primary date applies. */
  primaryDateLabel: string | null;
  primaryDateValue: string | null;
  membershipSource: WatsonMembershipSource | null;
  legacyMemberid: string | null;
  memberstackId: string | null;
  joinDate: string | null;
  /** Newest non-expiration timeline event date (orders, notes, plan changes, etc.). */
  lastActivityDate: string | null;
  /**
   * Watson authoritative legacy paid-through date display (historical record).
   * Prefers `legacy_members.subscriptionexpiring`; falls back to the newest
   * `legacy_subscriptions.expirationdate` timeline event when unset.
   * Never deleted when a paid Memberstack plan is current — only relabeled in UI.
   */
  legacyAccessThroughDate: string | null;
  /** YYYY-MM-DD for the editable paid-through date input (null when unset). */
  legacyPaidThroughYmd: string | null;
  /** True when this profile has a legacy member row that can be edited. */
  canEditLegacyPaidThrough: boolean;
}

export interface CustomerSnapshotMetric {
  label: string;
  value: string;
  unavailable?: boolean;
}

export interface CustomerProfileData {
  profileType: CustomerProfileRouteType;
  notesWriteId: string;
  memberstackId: string | null;
  legacyMemberid: string | null;
  displayName: string;
  member: LegacyMemberDetailRow | null;
  hasLegacyHistory: boolean;
  hasLiveMembership: boolean;
  memberstackLinkStatus: MemberstackLinkStatus;
  legacyLinkAmbiguous: boolean;
  ambiguousLegacyMemberids: string[];
  memberstack: CustomerMemberstackSummary;
  headerFields: CustomerHeaderField[];
  headerView: CustomerProfileHeaderView;
  snapshot: CustomerSnapshotMetric[];
  actions: CustomerProfileAction[];
  courses: MemberCourseDisplay[];
  orders: MemberOrderDisplay[];
  memberships: MemberMembershipDisplay[];
  pdfPurchaseCount: number | null;
  watsonNotes: WatsonNoteDisplay[];
  legacyNoteCount: number;
  watsonNoteCount: number;
  timeline: CustomerTimelineEvent[];
}

export type CustomerProfileLoadResult =
  | { ok: true; profile: CustomerProfileData }
  | { ok: false; reason: "not_found"; identifier: string; profileType: CustomerProfileRouteType }
  | { ok: false; reason: "error"; message: string; profileType: CustomerProfileRouteType };

function pushHeaderField(
  fields: CustomerHeaderField[],
  label: string,
  value: string | null | undefined,
  source?: CustomerHeaderField["source"],
): void {
  if (!hasDisplayValue(value)) {
    return;
  }
  fields.push({ label, value: String(value).trim(), source });
}

export function buildCustomerHeaderFields(
  member: LegacyMemberDetailRow | null,
  memberstack: CustomerMemberstackSummary,
  options?: {
    memberstackLinkStatus?: MemberstackLinkStatus;
  },
): CustomerHeaderField[] {
  const fields: CustomerHeaderField[] = [];
  const linkStatus = options?.memberstackLinkStatus ?? "not_applicable";

  const displayName = member
    ? formatMemberDisplayName(member)
    : (memberstack.displayName ?? memberstack.email);
  if (hasDisplayValue(displayName) && displayName.replace(/\u2014/g, "").replace(/-/g, "").trim()) {
    pushHeaderField(fields, "Name", displayName, member ? "legacy" : "memberstack");
  }

  pushHeaderField(
    fields,
    "Email",
    memberstack.email ?? member?.email,
    memberstack.email ? "memberstack" : "legacy",
  );
  pushHeaderField(fields, "Legacy member ID", member?.memberid, "legacy");
  pushHeaderField(fields, "Memberstack member ID", memberstack.memberstackId || null, "memberstack");

  if (linkStatus === "not_found") {
    pushHeaderField(fields, "Current membership status", MEMBERSTACK_NOT_FOUND_FOR_EMAIL_LABEL, "legacy");
  } else if (linkStatus === "load_error") {
    pushHeaderField(fields, "Current membership status", MEMBERSTACK_LOOKUP_UNAVAILABLE_LABEL, "legacy");
  } else if (memberstack.configured && !memberstack.loadError && memberstack.memberstackId) {
    pushHeaderField(
      fields,
      "Current membership status",
      memberstack.membershipStatusLabel,
      "memberstack",
    );

    const paidActivePlans = memberstack.connections
      .filter(
        (connection) => connection.activeLabel === "Active" && connection.isPaidPlan === true,
      )
      .map((connection) => connection.planName)
      .filter(Boolean);
    const activePlans =
      paidActivePlans.length > 0
        ? paidActivePlans
        : memberstack.connections
            .filter((connection) => connection.activeLabel === "Active")
            .map((connection) => connection.planName)
            .filter(Boolean);
    if (activePlans.length > 0) {
      pushHeaderField(fields, "Current plan", activePlans.join(", "), "memberstack");
    }
  }

  pushHeaderField(
    fields,
    "Account created",
    memberstack.accountCreatedAt ??
      (member?.datejoined ? formatMemberJoinedDateDisplay(member.datejoined) : null),
    memberstack.accountCreatedAt ? "memberstack" : "legacy",
  );

  if (member?.datejoined && !memberstack.accountCreatedAt) {
    pushHeaderField(
      fields,
      "Legacy account created",
      formatMemberJoinedDateDisplay(member.datejoined),
      "legacy",
    );
  }

  return fields;
}

const NOT_AVAILABLE_YET = "Not available yet";

function resolveMembershipStatusTone(
  memberstackLinkStatus: MemberstackLinkStatus,
  memberstack: CustomerMemberstackSummary,
): CustomerMembershipStatusTone {
  if (memberstackLinkStatus === "not_found") {
    return "not_linked";
  }
  if (
    memberstackLinkStatus === "load_error" ||
    !memberstack.configured ||
    memberstack.loadError ||
    !memberstack.memberstackId
  ) {
    return "unknown";
  }
  if (memberstack.hasActiveConnection) {
    return "active";
  }
  if (memberstack.membershipStatusLabel === "No Plan") {
    return "unknown";
  }
  if (memberstack.membershipStatusLabel) {
    return "inactive";
  }
  return "unknown";
}

function resolveJoinDateIso(
  member: LegacyMemberDetailRow | null,
  memberstack: CustomerMemberstackSummary,
): string | null {
  if (memberstack.accountCreatedAtSort) {
    return memberstack.accountCreatedAtSort;
  }
  if (member?.datejoined) {
    const date =
      member.datejoined instanceof Date ? member.datejoined : new Date(String(member.datejoined));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

export function formatCustomerTenure(joinDateIso: string): string | null {
  const joined = new Date(joinDateIso);
  if (Number.isNaN(joined.getTime())) {
    return null;
  }

  const now = new Date();
  let years = now.getFullYear() - joined.getFullYear();
  let months = now.getMonth() - joined.getMonth();
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (now.getDate() < joined.getDate()) {
    months -= 1;
    if (months < 0) {
      years -= 1;
      months += 12;
    }
  }

  const parts: string[] = [];
  if (years > 0) {
    parts.push(`${years} year${years === 1 ? "" : "s"}`);
  }
  if (months > 0 || parts.length === 0) {
    parts.push(`${months} month${months === 1 ? "" : "s"}`);
  }
  return parts.join(", ");
}

function resolveCurrentPlanLabel(
  memberstack: CustomerMemberstackSummary,
  memberstackLinkStatus: MemberstackLinkStatus,
  currentMembership?: WatsonCustomerCurrentMembership | null,
): string {
  if (currentMembership?.currentPlan) {
    return currentMembership.currentPlan;
  }
  if (memberstackLinkStatus === "not_found") {
    return MEMBERSTACK_NOT_FOUND_FOR_EMAIL_LABEL;
  }
  if (memberstackLinkStatus === "load_error") {
    return MEMBERSTACK_LOOKUP_UNAVAILABLE_LABEL;
  }
  if (!memberstack.configured || memberstack.loadError) {
    return NOT_AVAILABLE_YET;
  }

  const paidActivePlans = memberstack.connections
    .filter(
      (connection) => connection.activeLabel === "Active" && connection.isPaidPlan === true,
    )
    .map((connection) => connection.planName)
    .filter(Boolean);
  if (paidActivePlans.length > 0) {
    return paidActivePlans.join(", ");
  }

  const activePlans = memberstack.connections
    .filter((connection) => connection.activeLabel === "Active")
    .map((connection) => connection.planName)
    .filter(Boolean);
  if (activePlans.length > 0) {
    return activePlans.join(", ");
  }

  return memberstack.membershipStatusLabel ?? NOT_AVAILABLE_YET;
}

function resolveProfileCurrentMembership(input: {
  member: LegacyMemberDetailRow | null;
  memberstackMember: MemberstackMember | null;
  memberstack: CustomerMemberstackSummary;
  memberstackLinkStatus: MemberstackLinkStatus;
  timeline: CustomerTimelineEvent[];
  legacyLinkAmbiguous?: boolean;
  now?: Date;
}): {
  paidThroughYmd: string | null;
  paidThroughDisplay: string | null;
  currentMembership: WatsonCustomerCurrentMembership;
} {
  const paidThroughYmd = input.member
    ? legacyPaidThroughYmd(input.member.subscriptionexpiring)
    : null;
  const paidThroughDisplay = paidThroughYmd
    ? formatLegacyPaidThroughDisplay(paidThroughYmd)
    : resolveLegacyAccessThroughDate(input.timeline);

  const legacy = watsonLegacyContextFromPaidThrough({
    hasLegacyHistory: Boolean(input.member),
    legacyExpirationYmd: paidThroughYmd,
    legacyExpirationDate: paidThroughDisplay,
    ambiguous: input.legacyLinkAmbiguous,
  });

  const currentMembership = buildWatsonCustomerCurrentMembership({
    memberstackMember: input.memberstackMember,
    memberstackSummary: input.memberstack,
    memberstackLinkStatus: input.memberstackLinkStatus,
    legacy,
    legacyAccessThroughDisplay: paidThroughDisplay,
    now: input.now,
  });

  return { paidThroughYmd, paidThroughDisplay, currentMembership };
}

function sumStoreLifetimeSales(orders: MemberOrderDisplay[]): number {
  return orders.reduce((total, order) => {
    const amount = parseLegacyMoneyAmount(order.orderTotalSort || order.orderTotal);
    return total + (amount ?? 0);
  }, 0);
}

function resolveMostRecentPurchaseLabel(
  orders: MemberOrderDisplay[],
  courses: MemberCourseDisplay[],
): string | null {
  const latestOrder = orders.find((order) => order.orderDateSort);
  const latestCourse = courses.find((course) => course.dateAddedSort);

  if (!latestOrder && !latestCourse) {
    return null;
  }
  if (!latestOrder) {
    return `${latestCourse?.courseName ?? `Course ${latestCourse?.courseId}`} (${latestCourse?.dateAdded ?? latestCourse?.dateAddedSort})`;
  }
  if (!latestCourse) {
    return `${latestOrder.orderTotal ?? "Order"} on ${latestOrder.orderDate ?? latestOrder.orderDateSort}`;
  }

  const orderIsNewer = latestOrder.orderDateSort.localeCompare(latestCourse.dateAddedSort) >= 0;
  if (orderIsNewer) {
    return `${latestOrder.orderTotal ?? "Order"} on ${latestOrder.orderDate ?? latestOrder.orderDateSort}`;
  }
  return `${latestCourse.courseName ?? `Course ${latestCourse.courseId}`} (${latestCourse.dateAdded ?? latestCourse.dateAddedSort})`;
}

export function buildCustomerProfileHeaderView(input: {
  displayName: string;
  member: LegacyMemberDetailRow | null;
  memberstack: CustomerMemberstackSummary;
  memberstackLinkStatus: MemberstackLinkStatus;
  legacyMemberid: string | null;
  memberstackId: string | null;
  timeline: CustomerTimelineEvent[];
  /** Raw Memberstack member used by the shared membership-status helpers. */
  memberstackMember?: MemberstackMember | null;
  legacyLinkAmbiguous?: boolean;
  now?: Date;
}): CustomerProfileHeaderView {
  const email = input.memberstack.email ?? input.member?.email ?? null;
  const { paidThroughYmd, paidThroughDisplay, currentMembership } =
    resolveProfileCurrentMembership({
      member: input.member,
      memberstackMember: input.memberstackMember ?? null,
      memberstack: input.memberstack,
      memberstackLinkStatus: input.memberstackLinkStatus,
      timeline: input.timeline,
      legacyLinkAmbiguous: input.legacyLinkAmbiguous,
      now: input.now,
    });

  let membershipStatus: string | null = null;
  let membershipStatusTone = resolveMembershipStatusTone(
    input.memberstackLinkStatus,
    input.memberstack,
  );

  if (input.memberstackLinkStatus === "not_found") {
    // Prefer Legacy Access / Expired when Watson paid-through is the only signal.
    membershipStatus =
      currentMembership.currentStatus ?? MEMBERSTACK_NOT_FOUND_FOR_EMAIL_LABEL;
    if (currentMembership.currentStatus) {
      membershipStatusTone = currentMembership.membershipStatusTone;
    } else {
      membershipStatusTone = "not_linked";
    }
  } else if (input.memberstackLinkStatus === "load_error") {
    membershipStatus =
      currentMembership.currentStatus ?? MEMBERSTACK_LOOKUP_UNAVAILABLE_LABEL;
    if (currentMembership.currentStatus) {
      membershipStatusTone = currentMembership.membershipStatusTone;
    }
  } else if (input.memberstack.configured && !input.memberstack.loadError && input.memberstackId) {
    membershipStatus =
      currentMembership.currentStatus ??
      input.memberstack.membershipStatusLabel ??
      "Unknown";
    if (currentMembership.currentStatus) {
      membershipStatusTone = currentMembership.membershipStatusTone;
    }
  } else if (currentMembership.currentStatus) {
    membershipStatus = currentMembership.currentStatus;
    membershipStatusTone = currentMembership.membershipStatusTone;
  }

  const joinDateIso = resolveJoinDateIso(input.member, input.memberstack);
  const joinDate = joinDateIso
    ? input.memberstack.accountCreatedAt ??
      (input.member?.datejoined ? formatMemberJoinedDateDisplay(input.member.datejoined) : null)
    : null;

  return {
    displayName: input.displayName,
    email: hasDisplayValue(email) ? String(email).trim() : null,
    membershipStatus,
    membershipStatusTone,
    currentPlan: currentMembership.currentPlan,
    primaryDateLabel: currentMembership.primaryDateLabel,
    primaryDateValue: currentMembership.primaryDateValue,
    membershipSource: currentMembership.membershipSource,
    legacyMemberid: input.legacyMemberid,
    memberstackId: input.memberstackId,
    joinDate,
    lastActivityDate: resolveLastActivityDate(input.timeline),
    legacyAccessThroughDate: paidThroughDisplay,
    legacyPaidThroughYmd: paidThroughYmd,
    canEditLegacyPaidThrough: Boolean(input.legacyMemberid && input.member),
  };
}

export function buildCustomerSnapshot(input: {
  member: LegacyMemberDetailRow | null;
  memberstack: CustomerMemberstackSummary;
  memberstackLinkStatus: MemberstackLinkStatus;
  courses: MemberCourseDisplay[];
  orders: MemberOrderDisplay[];
  pdfPurchaseCount: number | null;
  timeline: CustomerTimelineEvent[];
  hasLegacyHistory: boolean;
  memberstackMember?: MemberstackMember | null;
  legacyLinkAmbiguous?: boolean;
  now?: Date;
}): CustomerSnapshotMetric[] {
  const metrics: CustomerSnapshotMetric[] = [];
  const { paidThroughDisplay, currentMembership } = resolveProfileCurrentMembership({
    member: input.member,
    memberstackMember: input.memberstackMember ?? null,
    memberstack: input.memberstack,
    memberstackLinkStatus: input.memberstackLinkStatus,
    timeline: input.timeline,
    legacyLinkAmbiguous: input.legacyLinkAmbiguous,
    now: input.now,
  });

  const currentPlanLabel = resolveCurrentPlanLabel(
    input.memberstack,
    input.memberstackLinkStatus,
    currentMembership,
  );
  metrics.push({
    label: "Current membership plan",
    value: currentPlanLabel,
    unavailable: currentPlanLabel === NOT_AVAILABLE_YET,
  });

  if (currentMembership.currentStatus) {
    metrics.push({
      label: "Current membership status",
      value: currentMembership.currentStatus,
    });
  }

  if (currentMembership.primaryDateLabel && currentMembership.primaryDateValue) {
    metrics.push({
      label: currentMembership.primaryDateLabel,
      value: currentMembership.primaryDateValue,
    });
  }

  if (currentMembership.membershipSource) {
    metrics.push({
      label: "Membership source",
      value: currentMembership.membershipSource,
    });
  }

  const joinDateIso = resolveJoinDateIso(input.member, input.memberstack);
  const tenure = joinDateIso ? formatCustomerTenure(joinDateIso) : null;
  metrics.push({
    label: "Customer since",
    value: tenure ?? NOT_AVAILABLE_YET,
    unavailable: !tenure,
  });

  if (input.hasLegacyHistory) {
    metrics.push({
      label: "Store orders",
      value: String(input.orders.length),
    });

    const lifetimeSales = sumStoreLifetimeSales(input.orders);
    metrics.push({
      label: "Store lifetime sales",
      value: formatLegacyMoney(lifetimeSales) ?? "$0.00",
    });

    metrics.push({
      label: "Learn DesignaKnit enrollments",
      value: String(input.courses.length),
    });

    metrics.push({
      label: "Pattern PDF purchases",
      value:
        input.pdfPurchaseCount == null ? NOT_AVAILABLE_YET : String(input.pdfPurchaseCount),
      unavailable: input.pdfPurchaseCount == null,
    });
  } else {
    for (const label of [
      "Store orders",
      "Store lifetime sales",
      "Learn DesignaKnit enrollments",
      "Pattern PDF purchases",
    ]) {
      metrics.push({ label, value: NOT_AVAILABLE_YET, unavailable: true });
    }
  }

  metrics.push({
    label: "Knit It Now courses owned",
    value: NOT_AVAILABLE_YET,
    unavailable: true,
  });

  const mostRecentPurchase = input.hasLegacyHistory
    ? resolveMostRecentPurchaseLabel(input.orders, input.courses)
    : null;
  metrics.push({
    label: "Most recent purchase",
    value: mostRecentPurchase ?? NOT_AVAILABLE_YET,
    unavailable: !mostRecentPurchase,
  });

  const lastActivityDate = resolveLastActivityDate(input.timeline);
  metrics.push({
    label: "Last activity",
    value: lastActivityDate ?? NOT_AVAILABLE_YET,
    unavailable: !lastActivityDate,
  });

  if (paidThroughDisplay) {
    metrics.push({
      label: LEGACY_RECORD_PAID_THROUGH_LABEL,
      value: paidThroughDisplay,
    });
  }

  return metrics;
}

export function buildCustomerProfileActions(input: {
  profileType: CustomerProfileRouteType;
  memberstackId: string | null;
  legacyMemberid: string | null;
}): CustomerProfileAction[] {
  const actions: CustomerProfileAction[] = [
    {
      label: "View store orders",
      href: "#customer-store-orders",
      description: "Jump to store order history on this page",
    },
    {
      label: "View course enrollments",
      href: "#customer-course-enrollments",
      description: "Jump to legacy course enrollments on this page",
    },
    {
      label: "Add note",
      href: "#customer-notes",
      description: "Jump to Watson notes on this page",
    },
  ];

  if (input.legacyMemberid) {
    actions.push({
      label: "Legacy member detail",
      href: buildLegacyMemberDetailUrl(input.legacyMemberid),
      description: "Open the original Watson legacy member detail page",
    });
  }

  if (input.profileType === "legacy" && input.memberstackId) {
    actions.unshift({
      label: "Memberstack customer profile",
      href: buildMemberstackCustomerProfileUrl(input.memberstackId),
      description: "Open the linked Memberstack customer profile",
    });
  }

  if (input.profileType === "memberstack" && input.legacyMemberid) {
    actions.unshift({
      label: "Legacy customer profile",
      href: buildLegacyCustomerProfileUrl(input.legacyMemberid),
      description: "Open the linked legacy customer profile",
    });
  }

  if (input.profileType === "memberstack" && input.memberstackId) {
    actions.unshift({
      label: "Current membership",
      href: "#customer-membership",
      description: `Memberstack ID: ${input.memberstackId}`,
    });
  }

  return actions;
}

export interface ProfileLegacyLinkState {
  legacyMember: LegacyMemberDetailRow | null;
  legacyMemberid: string | null;
  hasLegacyHistory: boolean;
  legacyLinkAmbiguous: boolean;
  ambiguousLegacyMemberids: string[];
  memberstackLinkStatus: MemberstackLinkStatus;
}

export function buildProfileLegacyLinkState(
  legacyLink: LegacyEmailLinkResult,
  memberstackEmail: string | null | undefined,
  options?: { requireEmailMatch?: boolean },
): ProfileLegacyLinkState {
  const requireEmailMatch = options?.requireEmailMatch ?? true;

  if (legacyLink.status === "unique") {
    const legacyMember = legacyLink.member;
    const emailMatches = requireEmailMatch
      ? emailsMatchForLegacyLink(legacyMember.email, memberstackEmail)
      : true;
    return {
      legacyMember: emailMatches ? legacyMember : null,
      legacyMemberid: emailMatches ? legacyMember.memberid : null,
      hasLegacyHistory: emailMatches,
      legacyLinkAmbiguous: false,
      ambiguousLegacyMemberids: [],
      memberstackLinkStatus: emailMatches ? "linked" : "not_applicable",
    };
  }

  if (legacyLink.status === "ambiguous") {
    return {
      legacyMember: null,
      legacyMemberid: null,
      hasLegacyHistory: false,
      legacyLinkAmbiguous: true,
      ambiguousLegacyMemberids: legacyLink.members.map((member) => member.memberid),
      memberstackLinkStatus: "ambiguous",
    };
  }

  return {
    legacyMember: null,
    legacyMemberid: null,
    hasLegacyHistory: false,
    legacyLinkAmbiguous: false,
    ambiguousLegacyMemberids: [],
    memberstackLinkStatus: "not_applicable",
  };
}

export function buildNotFoundMemberstackSummary(): CustomerMemberstackSummary {
  return {
    memberstackId: "",
    email: null,
    displayName: null,
    accountCreatedAt: null,
    accountCreatedAtSort: "",
    connections: [],
    hasActiveConnection: false,
    membershipStatusLabel: null,
    configured: true,
    loadError: null,
  };
}

export function buildLoadErrorMemberstackSummary(error: string): CustomerMemberstackSummary {
  return {
    memberstackId: "",
    email: null,
    displayName: null,
    accountCreatedAt: null,
    accountCreatedAtSort: "",
    connections: [],
    hasActiveConnection: false,
    membershipStatusLabel: null,
    configured: error !== "Memberstack admin API is not configured.",
    loadError: error,
  };
}

async function loadLegacyHistoryData(legacyMemberid: string): Promise<{
  courses: MemberCourseDisplay[];
  orders: MemberOrderDisplay[];
  memberships: MemberMembershipDisplay[];
  legacyNoteCount: number;
  pdfPurchaseCount: number;
}> {
  const [courses, orders, memberships, legacyNoteCount, pdfPurchaseCount] = await Promise.all([
    getMemberCourses(legacyMemberid),
    getMemberOrders(legacyMemberid),
    getMemberMemberships(legacyMemberid),
    getMemberLegacySupportNoteCount(legacyMemberid),
    getMemberPdfPurchaseCount(legacyMemberid),
  ]);

  return { courses, orders, memberships, legacyNoteCount, pdfPurchaseCount };
}

function resolveNotesReadIds(
  profileType: CustomerProfileRouteType,
  memberstackId: string | null,
  legacyMemberid: string | null,
  linked: boolean,
): { memberstackId: string; legacyMemberId: string | null } {
  if (profileType === "legacy") {
    return {
      memberstackId: linked && memberstackId ? memberstackId : legacyMemberid ?? "",
      legacyMemberId: legacyMemberid,
    };
  }

  return {
    memberstackId: memberstackId ?? "",
    legacyMemberId: linked ? legacyMemberid : null,
  };
}

export type CustomerProfileDeps = {
  queryFn?: import("./memberSearch").WatsonQueryFn;
  secretKey?: string | null;
  getClient?: (
    secretKey: string | null,
  ) => Promise<import("./customerMemberstack").MemberstackGetMemberClient | null>;
};

export async function loadLegacyCustomerProfile(
  memberid: string,
  deps: CustomerProfileDeps = {},
): Promise<CustomerProfileLoadResult> {
  try {
    const resolution = await resolveCustomerByMemberid(memberid, deps.queryFn);
    if (!resolution.member) {
      return {
        ok: false,
        reason: "not_found",
        identifier: memberid,
        profileType: "legacy",
      };
    }

    const member = resolution.member;
    const memberstackOptions = {
      secretKey: deps.secretKey,
      getClient: deps.getClient,
    };
    const memberstackLookup = await resolveMemberstackMemberByExactEmail(
      member.email,
      memberstackOptions,
    );
    const linkedMemberstackId = memberstackLookup.ok ? memberstackLookup.member.id : null;
    const memberstackLinkStatus: MemberstackLinkStatus = memberstackLookup.ok
      ? "linked"
      : memberstackLookup.status;
    const memberstackMember = memberstackLookup.ok ? memberstackLookup.member : null;
    const memberstack = memberstackLookup.ok
      ? buildCustomerMemberstackSummary({
          member: memberstackLookup.member,
          configured: true,
          loadError: null,
        })
      : memberstackLookup.status === "load_error"
        ? buildLoadErrorMemberstackSummary(memberstackLookup.error)
        : buildNotFoundMemberstackSummary();

    const legacyData = await loadLegacyHistoryData(member.memberid);
    const notesRead = resolveNotesReadIds(
      "legacy",
      linkedMemberstackId,
      member.memberid,
      Boolean(linkedMemberstackId),
    );
    const [watsonNotes, watsonNoteCount] = await Promise.all([
      getCustomerWatsonNotes(notesRead.memberstackId, notesRead.legacyMemberId),
      getCustomerWatsonNoteCount(notesRead.memberstackId, notesRead.legacyMemberId),
    ]);

    const timeline = buildCustomerTimeline({
      member,
      memberstack,
      memberships: legacyData.memberships,
      courses: legacyData.courses,
      orders: legacyData.orders,
      notes: watsonNotes,
    });

    const displayName = formatMemberDisplayName(member);
    const headerView = buildCustomerProfileHeaderView({
      displayName,
      member,
      memberstack,
      memberstackLinkStatus,
      legacyMemberid: member.memberid,
      memberstackId: linkedMemberstackId,
      timeline,
      memberstackMember,
    });
    const snapshot = buildCustomerSnapshot({
      member,
      memberstack,
      memberstackLinkStatus,
      courses: legacyData.courses,
      orders: legacyData.orders,
      pdfPurchaseCount: legacyData.pdfPurchaseCount,
      timeline,
      hasLegacyHistory: true,
      memberstackMember,
    });

    const profile: CustomerProfileData = {
      profileType: "legacy",
      notesWriteId: member.memberid,
      memberstackId: linkedMemberstackId,
      legacyMemberid: member.memberid,
      displayName,
      member,
      hasLegacyHistory: true,
      hasLiveMembership: Boolean(linkedMemberstackId),
      memberstackLinkStatus,
      legacyLinkAmbiguous: false,
      ambiguousLegacyMemberids: [],
      memberstack,
      headerFields: buildCustomerHeaderFields(member, memberstack, { memberstackLinkStatus }),
      headerView,
      snapshot,
      actions: buildCustomerProfileActions({
        profileType: "legacy",
        memberstackId: linkedMemberstackId,
        legacyMemberid: member.memberid,
      }),
      courses: legacyData.courses,
      orders: legacyData.orders,
      memberships: legacyData.memberships,
      pdfPurchaseCount: legacyData.pdfPurchaseCount,
      watsonNotes,
      legacyNoteCount: legacyData.legacyNoteCount,
      watsonNoteCount,
      timeline,
    };

    return { ok: true, profile };
  } catch (error) {
    return {
      ok: false,
      reason: "error",
      message: error instanceof Error ? error.message : "Unable to load legacy customer profile.",
      profileType: "legacy",
    };
  }
}

export async function loadMemberstackCustomerProfile(
  memberstackId: string,
  deps: CustomerProfileDeps = {},
): Promise<CustomerProfileLoadResult> {
  try {
    const memberstackOptions = {
      secretKey: deps.secretKey,
      getClient: deps.getClient,
    };
    const memberstackResult = await loadCustomerMemberstackMemberById(
      memberstackId,
      memberstackOptions,
    );
    if (!memberstackResult.ok) {
      if (memberstackResult.status === "not_found") {
        return {
          ok: false,
          reason: "not_found",
          identifier: memberstackId,
          profileType: "memberstack",
        };
      }
      return {
        ok: false,
        reason: "error",
        message: memberstackResult.error,
        profileType: "memberstack",
      };
    }

    const legacyLink = await resolveLegacyLinkByMemberstackEmail(
      memberstackResult.member.auth?.email,
      deps.queryFn,
    );
    const linkState = buildProfileLegacyLinkState(
      legacyLink,
      memberstackResult.member.auth?.email,
    );

    const memberstackMember = memberstackResult.member;
    const memberstack = buildCustomerMemberstackSummary({
      member: memberstackMember,
      configured: true,
      loadError: null,
    });

    const legacyMemberid = linkState.legacyMemberid;
    const legacyMember = linkState.legacyMember;
    const hasLegacyHistory = linkState.hasLegacyHistory;

    const legacyData = hasLegacyHistory && legacyMemberid
      ? await loadLegacyHistoryData(legacyMemberid)
      : {
          courses: [] as MemberCourseDisplay[],
          orders: [] as MemberOrderDisplay[],
          memberships: [] as MemberMembershipDisplay[],
          legacyNoteCount: 0,
          pdfPurchaseCount: null as number | null,
        };

    const notesRead = resolveNotesReadIds(
      "memberstack",
      memberstackId,
      legacyMemberid,
      hasLegacyHistory,
    );
    const [watsonNotes, watsonNoteCount] = await Promise.all([
      getCustomerWatsonNotes(notesRead.memberstackId, notesRead.legacyMemberId),
      getCustomerWatsonNoteCount(notesRead.memberstackId, notesRead.legacyMemberId),
    ]);

    const timeline = buildCustomerTimeline({
      member: hasLegacyHistory ? legacyMember : null,
      memberstack,
      memberships: legacyData.memberships,
      courses: legacyData.courses,
      orders: legacyData.orders,
      notes: watsonNotes,
    });

    const displayName = formatCustomerDisplayName(memberstack, legacyMember);
    const headerView = buildCustomerProfileHeaderView({
      displayName,
      member: hasLegacyHistory ? legacyMember : null,
      memberstack,
      memberstackLinkStatus: linkState.memberstackLinkStatus,
      legacyMemberid,
      memberstackId,
      timeline,
      memberstackMember,
      legacyLinkAmbiguous: linkState.legacyLinkAmbiguous,
    });
    const snapshot = buildCustomerSnapshot({
      member: hasLegacyHistory ? legacyMember : null,
      memberstack,
      memberstackLinkStatus: linkState.memberstackLinkStatus,
      courses: legacyData.courses,
      orders: legacyData.orders,
      pdfPurchaseCount: legacyData.pdfPurchaseCount,
      timeline,
      hasLegacyHistory,
      memberstackMember,
      legacyLinkAmbiguous: linkState.legacyLinkAmbiguous,
    });

    const profile: CustomerProfileData = {
      profileType: "memberstack",
      notesWriteId: memberstackId,
      memberstackId,
      legacyMemberid,
      displayName,
      member: hasLegacyHistory ? legacyMember : null,
      hasLegacyHistory,
      hasLiveMembership: true,
      memberstackLinkStatus: linkState.memberstackLinkStatus,
      legacyLinkAmbiguous: linkState.legacyLinkAmbiguous,
      ambiguousLegacyMemberids: linkState.ambiguousLegacyMemberids,
      memberstack,
      headerFields: buildCustomerHeaderFields(legacyMember, memberstack, {
        memberstackLinkStatus: linkState.memberstackLinkStatus,
      }),
      headerView,
      snapshot,
      actions: buildCustomerProfileActions({
        profileType: "memberstack",
        memberstackId,
        legacyMemberid,
      }),
      courses: legacyData.courses,
      orders: legacyData.orders,
      memberships: legacyData.memberships,
      pdfPurchaseCount: legacyData.pdfPurchaseCount,
      watsonNotes,
      legacyNoteCount: legacyData.legacyNoteCount,
      watsonNoteCount,
      timeline,
    };

    return { ok: true, profile };
  } catch (error) {
    return {
      ok: false,
      reason: "error",
      message:
        error instanceof Error ? error.message : "Unable to load Memberstack customer profile.",
      profileType: "memberstack",
    };
  }
}

export function watsonCustomerNotFoundHtml(
  identifier: string,
  profileType: CustomerProfileRouteType,
): string {
  const escaped = identifier
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const label = profileType === "legacy" ? "Legacy customer" : "Memberstack customer";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${label} not found | Watson</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 2rem; color: #243015; }
      main { max-width: 36rem; }
      h1 { font-size: 1.5rem; margin: 0 0 0.75rem; }
      p { line-height: 1.5; color: #475569; }
      a { color: #3f6212; font-weight: 600; }
    </style>
  </head>
  <body>
    <main>
      <h1>${label} not found</h1>
      <p>No ${label.toLowerCase()} matches <strong>${escaped}</strong>.</p>
      <p><a href="/watson/customers">Back to customer search</a></p>
    </main>
  </body>
</html>`;
}
