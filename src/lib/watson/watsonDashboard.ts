import { formatMemberDisplayName, formatMemberJoinedDateDisplay, type WatsonQueryFn } from "./memberSearch";
import { formatLegacyMoney } from "./memberOrders";
import { queryWatson } from "./db";
import { buildSavedPatternName, WATSON_LEGACY_GARMENTS_TABLE } from "./memberSavedPatterns";

export const DASHBOARD_RECENT_ACTIVITY_LIMIT = 5;

export const DASHBOARD_COUNT_MEMBERS_SQL = `
  SELECT COUNT(*)::text AS count
  FROM legacy_members
`;

export const DASHBOARD_COUNT_SUBSCRIPTIONS_SQL = `
  SELECT COUNT(*)::text AS count
  FROM legacy_subscriptions
`;

export const DASHBOARD_COUNT_STORE_ORDERS_SQL = `
  SELECT COUNT(*)::text AS count
  FROM legacy_store_transactions
`;

export const DASHBOARD_STORE_REVENUE_SQL = `
  SELECT COALESCE(SUM(totalcost), 0)::text AS total
  FROM legacy_store_transactions
`;

export const DASHBOARD_COUNT_COURSE_ENROLLMENTS_SQL = `
  SELECT COUNT(*)::text AS count
  FROM legacy_course_member_library
`;

export const DASHBOARD_COUNT_SAVED_PATTERNS_SQL = `
  SELECT COUNT(*)::text AS count
  FROM legacy_member_pattern_details
`;

export const DASHBOARD_COUNT_PDF_PURCHASES_SQL = `
  SELECT COUNT(*)::text AS count
  FROM legacy_pattern_library_purchases
`;

export const DASHBOARD_COUNT_MEMBERS_WITH_NOTES_SQL = `
  SELECT COUNT(*)::text AS count
  FROM legacy_members
  WHERE notes IS NOT NULL
    AND BTRIM(notes) <> ''
`;

export const DASHBOARD_RECENT_STORE_ORDERS_SQL = `
  SELECT
    st.storetransactionid,
    st.transactionid,
    st.memberid_fk,
    st.purchasedate,
    st.totalcost,
    m.fristname,
    m.lastname
  FROM legacy_store_transactions st
  LEFT JOIN legacy_members m ON m.memberid = st.memberid_fk
  WHERE st.purchasedate IS NOT NULL
  ORDER BY st.purchasedate DESC NULLS LAST, st.storetransactionid DESC
  LIMIT ${DASHBOARD_RECENT_ACTIVITY_LIMIT}
`;

export const DASHBOARD_RECENT_COURSE_ENROLLMENTS_SQL = `
  SELECT
    c.homestudy_libraryid,
    c.memberid_fk,
    c.homestudy_courseid_fk,
    c.dateadded,
    m.fristname,
    m.lastname
  FROM legacy_course_member_library c
  LEFT JOIN legacy_members m ON m.memberid = c.memberid_fk
  WHERE c.dateadded IS NOT NULL
  ORDER BY c.dateadded DESC NULLS LAST, c.homestudy_libraryid DESC
  LIMIT ${DASHBOARD_RECENT_ACTIVITY_LIMIT}
`;

export const DASHBOARD_RECENT_SAVED_PATTERNS_SQL = `
  SELECT
    p.detailid,
    p.member_fk,
    p.builddate,
    p.customname,
    p.challengepatternname,
    g.garment_title,
    m.fristname,
    m.lastname
  FROM legacy_member_pattern_details p
  LEFT JOIN ${WATSON_LEGACY_GARMENTS_TABLE} g ON g.garment_id = p.garmentid_fk
  LEFT JOIN legacy_members m ON m.memberid = p.member_fk
  WHERE p.builddate IS NOT NULL
  ORDER BY p.builddate DESC NULLS LAST, p.detailid DESC
  LIMIT ${DASHBOARD_RECENT_ACTIVITY_LIMIT}
`;

export type DashboardMetric<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export interface WatsonDashboardSummary {
  totalMembers: DashboardMetric<number>;
  subscriptionRecords: DashboardMetric<number>;
  storeOrders: DashboardMetric<number>;
  storeRevenue: DashboardMetric<string>;
  courseEnrollments: DashboardMetric<number>;
  savedPatternRecords: DashboardMetric<number>;
  pdfPurchases: DashboardMetric<number>;
  membersWithSupportNotes: DashboardMetric<number>;
}

export interface RecentStoreOrderActivity {
  storeTransactionId: string;
  transactionId: string;
  memberId: string;
  memberLabel: string;
  memberHref: string;
  activityDate: string;
  orderTotal: string | null;
  summary: string;
}

export interface RecentCourseEnrollmentActivity {
  libraryRecordId: string;
  memberId: string;
  memberLabel: string;
  memberHref: string;
  activityDate: string;
  courseId: string;
  summary: string;
}

export interface RecentSavedPatternActivity {
  detailId: string;
  memberId: string;
  memberLabel: string;
  memberHref: string;
  activityDate: string;
  patternLabel: string;
  summary: string;
}

export interface WatsonDashboardRecentActivity {
  storeOrders: RecentStoreOrderActivity[];
  courseEnrollments: RecentCourseEnrollmentActivity[];
  savedPatterns: RecentSavedPatternActivity[];
}

export interface WatsonDashboardData {
  summary: WatsonDashboardSummary;
  recentActivity: WatsonDashboardRecentActivity;
}

export interface DashboardSummaryCard {
  key: string;
  label: string;
  explanation: string;
  metric: DashboardMetric<number | string>;
  displayValue: string;
  href?: string;
}

export function parseDashboardCount(value: string | undefined): number {
  const count = Number.parseInt(value ?? "0", 10);
  return Number.isNaN(count) ? 0 : count;
}

export function parseDashboardNumericTotal(value: string | number | null | undefined): number | null {
  if (value == null || value === "") {
    return null;
  }
  const amount = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isNaN(amount) ? null : amount;
}

export function formatDashboardStoreRevenue(value: string | number | null | undefined): string {
  const formatted = formatLegacyMoney(parseDashboardNumericTotal(value));
  return formatted ?? "$0.00";
}

export function formatDashboardMetricError(metric: DashboardMetric<unknown>): string | null {
  return metric.ok ? null : metric.error;
}

export function formatDashboardMetricDisplay(metric: DashboardMetric<number | string>): string {
  if (!metric.ok) {
    return "Unavailable";
  }
  if (typeof metric.value === "number") {
    return metric.value.toLocaleString("en-US");
  }
  return metric.value;
}

export function buildWatsonMemberDetailHref(memberid: string): string {
  return `/watson/members/${encodeURIComponent(memberid)}`;
}

function buildPatternActivityLabel(
  customname: string | null,
  challengepatternname: string | null,
  garmentTitle: string | null,
): string {
  return buildSavedPatternName({
    customname,
    challengepatternname,
    garment_title: garmentTitle,
  });
}

async function loadDashboardMetric<T>(loader: () => Promise<T>): Promise<DashboardMetric<T>> {
  try {
    return { ok: true, value: await loader() };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Dashboard query failed.",
    };
  }
}

async function loadDashboardCount(
  sql: string,
  queryFn: WatsonQueryFn,
): Promise<DashboardMetric<number>> {
  return loadDashboardMetric(async () => {
    const rows = await queryFn<{ count: string }>(sql);
    return parseDashboardCount(rows[0]?.count);
  });
}

export async function loadWatsonDashboardSummary(
  queryFn: WatsonQueryFn = queryWatson,
): Promise<WatsonDashboardSummary> {
  const [
    totalMembers,
    subscriptionRecords,
    storeOrders,
    storeRevenue,
    courseEnrollments,
    savedPatternRecords,
    pdfPurchases,
    membersWithSupportNotes,
  ] = await Promise.all([
    loadDashboardCount(DASHBOARD_COUNT_MEMBERS_SQL, queryFn),
    loadDashboardCount(DASHBOARD_COUNT_SUBSCRIPTIONS_SQL, queryFn),
    loadDashboardCount(DASHBOARD_COUNT_STORE_ORDERS_SQL, queryFn),
    loadDashboardMetric(async () => {
      const rows = await queryFn<{ total: string }>(DASHBOARD_STORE_REVENUE_SQL);
      return formatDashboardStoreRevenue(rows[0]?.total);
    }),
    loadDashboardCount(DASHBOARD_COUNT_COURSE_ENROLLMENTS_SQL, queryFn),
    loadDashboardCount(DASHBOARD_COUNT_SAVED_PATTERNS_SQL, queryFn),
    loadDashboardCount(DASHBOARD_COUNT_PDF_PURCHASES_SQL, queryFn),
    loadDashboardCount(DASHBOARD_COUNT_MEMBERS_WITH_NOTES_SQL, queryFn),
  ]);

  return {
    totalMembers,
    subscriptionRecords,
    storeOrders,
    storeRevenue,
    courseEnrollments,
    savedPatternRecords,
    pdfPurchases,
    membersWithSupportNotes,
  };
}

export async function loadWatsonDashboardRecentActivity(
  queryFn: WatsonQueryFn = queryWatson,
): Promise<WatsonDashboardRecentActivity> {
  const [storeOrderRows, courseRows, savedPatternRows] = await Promise.all([
    queryFn<{
      storetransactionid: string | number;
      transactionid: string;
      memberid_fk: string;
      purchasedate: Date | string;
      totalcost: string | number | null;
      fristname: string | null;
      lastname: string | null;
    }>(DASHBOARD_RECENT_STORE_ORDERS_SQL),
    queryFn<{
      homestudy_libraryid: string | number;
      memberid_fk: string;
      homestudy_courseid_fk: number;
      dateadded: Date | string;
      fristname: string | null;
      lastname: string | null;
    }>(DASHBOARD_RECENT_COURSE_ENROLLMENTS_SQL),
    queryFn<{
      detailid: string | number;
      member_fk: string;
      builddate: Date | string;
      customname: string | null;
      challengepatternname: string | null;
      garment_title: string | null;
      fristname: string | null;
      lastname: string | null;
    }>(DASHBOARD_RECENT_SAVED_PATTERNS_SQL),
  ]);

  return {
    storeOrders: storeOrderRows.map((row) => {
      const memberLabel = formatMemberDisplayName(row);
      const orderTotal = formatLegacyMoney(row.totalcost);
      return {
        storeTransactionId: String(row.storetransactionid),
        transactionId: row.transactionid,
        memberId: row.memberid_fk,
        memberLabel: memberLabel || row.memberid_fk,
        memberHref: buildWatsonMemberDetailHref(row.memberid_fk),
        activityDate: formatMemberJoinedDateDisplay(row.purchasedate) ?? "",
        orderTotal,
        summary: orderTotal
          ? `Store order ${row.transactionid} - ${orderTotal}`
          : `Store order ${row.transactionid}`,
      };
    }),
    courseEnrollments: courseRows.map((row) => ({
      libraryRecordId: String(row.homestudy_libraryid),
      memberId: row.memberid_fk,
      memberLabel: formatMemberDisplayName(row) || row.memberid_fk,
      memberHref: buildWatsonMemberDetailHref(row.memberid_fk),
      activityDate: formatMemberJoinedDateDisplay(row.dateadded) ?? "",
      courseId: String(row.homestudy_courseid_fk),
      summary: `Course enrollment - course ID ${row.homestudy_courseid_fk}`,
    })),
    savedPatterns: savedPatternRows.map((row) => {
      const patternLabel = buildPatternActivityLabel(
        row.customname,
        row.challengepatternname,
        row.garment_title,
      );
      return {
        detailId: String(row.detailid),
        memberId: row.member_fk,
        memberLabel: formatMemberDisplayName(row) || row.member_fk,
        memberHref: buildWatsonMemberDetailHref(row.member_fk),
        activityDate: formatMemberJoinedDateDisplay(row.builddate) ?? "",
        patternLabel,
        summary: `Saved pattern - ${patternLabel}`,
      };
    }),
  };
}

export async function loadWatsonDashboard(
  queryFn: WatsonQueryFn = queryWatson,
): Promise<WatsonDashboardData> {
  const [summary, recentActivity] = await Promise.all([
    loadWatsonDashboardSummary(queryFn),
    loadWatsonDashboardRecentActivity(queryFn),
  ]);

  return { summary, recentActivity };
}

export function buildDashboardSummaryCards(summary: WatsonDashboardSummary): DashboardSummaryCard[] {
  return [
    {
      key: "totalMembers",
      label: "Total legacy members",
      explanation: "Imported member profiles from legacy_members.",
      metric: summary.totalMembers,
      displayValue: formatDashboardMetricDisplay(summary.totalMembers),
    },
    {
      key: "subscriptionRecords",
      label: "Legacy subscription records",
      explanation:
        "Historical rows from legacy_subscriptions. Not current Memberstack or Stripe billing status.",
      metric: summary.subscriptionRecords,
      displayValue: formatDashboardMetricDisplay(summary.subscriptionRecords),
    },
    {
      key: "storeOrders",
      label: "Store orders",
      explanation: "Store order headers from legacy_store_transactions.",
      metric: summary.storeOrders,
      displayValue: formatDashboardMetricDisplay(summary.storeOrders),
    },
    {
      key: "storeRevenue",
      label: "Legacy store revenue",
      explanation:
        "Sum of legacy_store_transactions.totalcost. Does not include memberships, courses, or unmatched PDF purchases.",
      metric: summary.storeRevenue,
      displayValue: formatDashboardMetricDisplay(summary.storeRevenue),
    },
    {
      key: "courseEnrollments",
      label: "Course enrollments",
      explanation: "Enrollment records from legacy_course_member_library.",
      metric: summary.courseEnrollments,
      displayValue: formatDashboardMetricDisplay(summary.courseEnrollments),
    },
    {
      key: "savedPatternRecords",
      label: "Saved pattern records",
      explanation: "Saved pattern history rows from legacy_member_pattern_details.",
      metric: summary.savedPatternRecords,
      displayValue: formatDashboardMetricDisplay(summary.savedPatternRecords),
    },
    {
      key: "pdfPurchases",
      label: "PDF purchases",
      explanation: "Legacy PDF purchase rows from legacy_pattern_library_purchases.",
      metric: summary.pdfPurchases,
      displayValue: formatDashboardMetricDisplay(summary.pdfPurchases),
    },
    {
      key: "membersWithSupportNotes",
      label: "Members with legacy support notes",
      explanation: "Members with a non-empty legacy_members.notes value.",
      metric: summary.membersWithSupportNotes,
      displayValue: formatDashboardMetricDisplay(summary.membersWithSupportNotes),
    },
  ];
}

export function hasRecentActivitySection(activity: WatsonDashboardRecentActivity): boolean {
  return (
    activity.storeOrders.length > 0 ||
    activity.courseEnrollments.length > 0 ||
    activity.savedPatterns.length > 0
  );
}
