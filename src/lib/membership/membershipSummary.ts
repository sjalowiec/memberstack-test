import { MEMBERSHIPS, LEGACY_MEMBERSHIPS } from "../../config/memberships";

export const MEMBERSHIP_SUMMARY_MAX_PAGES = 50;
export const MEMBERSHIP_SUMMARY_PAGE_SIZE = 100;

export type PlanConnection = {
  id?: string;
  active?: boolean;
  status?: string;
  planId?: string;
  planName?: string;
  type?: string;
  payment?: Record<string, unknown> | null;
  priceId?: string;
  canceledAt?: string;
  cancelledAt?: string;
  updatedAt?: string;
  createdAt?: string;
};

export type MemberstackMember = {
  id: string;
  createdAt?: string;
  auth?: { email?: string };
  planConnections?: PlanConnection[];
};

export type MemberstackListMembersClient = {
  listMembers: (options?: {
    limit?: number;
    after?: number | string;
    order?: "ASC" | "DESC";
  }) => Promise<{
    totalCount?: number;
    endCursor?: number;
    hasNextPage?: boolean;
    data?: unknown[];
  }>;
};

type PlanInfo = { key: string; name: string; paid: boolean; legacy?: boolean };
type PriceInfo = { planKey: string; interval: "monthly" | "annual"; amount: number };

export type MembershipSummary = {
  generatedAt: string;
  totalMembersScanned: number;
  scanTruncated: boolean;
  activeMembersTotal: number;
  activeByPlan: Array<{ planKey: string; planName: string; activeMembers: number }>;
  newMembers: {
    today: number;
    last7Days: number;
    thisMonth: number;
    thisYear: number;
    sameDayLastYear: number;
  };
  canceledConnectionsTotal: number;
  canceledConnectionsThisMonth: number;
  revenue: {
    mrrEstimate: number;
    arrEstimate: number;
    unresolvedPaidConnections: number;
    note: string | null;
  };
};

export function buildPlanIndex(): Map<string, PlanInfo> {
  const index = new Map<string, PlanInfo>();
  index.set(MEMBERSHIPS.beta.memberstackPlanId, {
    key: "beta",
    name: MEMBERSHIPS.beta.name,
    paid: false,
  });
  index.set(MEMBERSHIPS.basic.memberstackPlanId, {
    key: "basic",
    name: MEMBERSHIPS.basic.name,
    paid: true,
  });
  index.set(MEMBERSHIPS.premium.memberstackPlanId, {
    key: "premium",
    name: MEMBERSHIPS.premium.name,
    paid: true,
  });
  for (const [key, plan] of Object.entries(LEGACY_MEMBERSHIPS)) {
    index.set(plan.memberstackPlanId, {
      key: `legacy_${key}`,
      name: plan.name,
      paid: true,
      legacy: true,
    });
  }
  return index;
}

export function buildPriceIndex(): Map<string, PriceInfo> {
  const index = new Map<string, PriceInfo>();
  for (const key of ["basic", "premium"] as const) {
    const plan = MEMBERSHIPS[key];
    for (const interval of ["monthly", "annual"] as const) {
      const priceEntry = plan.prices[interval];
      index.set(priceEntry.memberstackPriceId, {
        planKey: key,
        interval,
        amount: priceEntry.price,
      });
    }
  }
  return index;
}

/** Best-effort price id lookup across the field names Memberstack's paid connections might use. */
export function paidConnectionPriceId(connection: PlanConnection): string | null {
  const payment = connection.payment;
  const fromPayment =
    payment && typeof payment === "object"
      ? (payment.priceId as string | undefined) ??
        (payment.price as string | undefined) ??
        ((payment.plan as Record<string, unknown> | undefined)?.id as string | undefined)
      : undefined;
  const candidate = fromPayment ?? connection.priceId;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
}

export function isConnectionCurrentlyActive(connection: PlanConnection): boolean {
  if (connection.active === true) return true;
  const status = (connection.status || "").toUpperCase();
  return status === "ACTIVE" || status === "TRIALING";
}

export function isCanceledConnectionStatus(status: string): boolean {
  const normalized = status.toUpperCase();
  return normalized === "CANCELED" || normalized === "CANCELLED" || normalized === "EXPIRED";
}

export function connectionCanceledAt(connection: PlanConnection): Date | null {
  const raw = connection.canceledAt || connection.cancelledAt || connection.updatedAt;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function monthlyEquivalent(price: PriceInfo): number {
  return price.interval === "annual" ? price.amount / 12 : price.amount;
}

export function dayBoundariesUTC(now: Date) {
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfWeek = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const startOfPrevYear = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
  const startOfPrevYearSameDay = new Date(
    Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate()),
  );
  return {
    startOfToday,
    startOfWeek,
    startOfMonth,
    startOfYear,
    startOfPrevYear,
    startOfPrevYearSameDay,
  };
}

export async function fetchAllMembers(
  client: MemberstackListMembersClient,
): Promise<{ members: MemberstackMember[]; truncated: boolean }> {
  const members: MemberstackMember[] = [];
  let after: number | string | undefined;
  let truncated = false;

  for (let page = 0; page < MEMBERSHIP_SUMMARY_MAX_PAGES; page++) {
    const res = await client.listMembers({
      limit: MEMBERSHIP_SUMMARY_PAGE_SIZE,
      after,
      order: "ASC",
    });
    const data = Array.isArray(res?.data) ? (res.data as MemberstackMember[]) : [];
    members.push(...data);
    if (!res?.hasNextPage || data.length === 0) {
      return { members, truncated: false };
    }
    after = res.endCursor;
    if (page === MEMBERSHIP_SUMMARY_MAX_PAGES - 1) truncated = true;
  }

  return { members, truncated };
}

export function buildRevenueNote(unresolvedPaidConnections: number): string | null {
  return unresolvedPaidConnections > 0
    ? "Some active paid plan connections could not be matched to a known price id — mrrEstimate excludes them. See the code comment at the top of admin-membership-report.ts."
    : null;
}

export function computeMembershipSummary(
  members: MemberstackMember[],
  options?: { now?: Date; truncated?: boolean },
): MembershipSummary {
  const planIndex = buildPlanIndex();
  const priceIndex = buildPriceIndex();
  const now = options?.now ?? new Date();
  const bounds = dayBoundariesUTC(now);

  const activeByPlan = new Map<string, { name: string; count: number }>();
  let activeMembersTotal = 0;
  let newToday = 0;
  let newThisWeek = 0;
  let newThisMonth = 0;
  let newThisYear = 0;
  let newSameDayLastYear = 0;
  let canceledConnectionsTotal = 0;
  let canceledConnectionsThisMonth = 0;
  let unresolvedPaidConnections = 0;
  let mrr = 0;

  for (const member of members) {
    const createdAt = member.createdAt ? new Date(member.createdAt) : null;
    if (createdAt && !Number.isNaN(createdAt.getTime())) {
      if (createdAt >= bounds.startOfToday) newToday += 1;
      if (createdAt >= bounds.startOfWeek) newThisWeek += 1;
      if (createdAt >= bounds.startOfMonth) newThisMonth += 1;
      if (createdAt >= bounds.startOfYear) newThisYear += 1;
      if (createdAt >= bounds.startOfPrevYear && createdAt < bounds.startOfYear) {
        if (createdAt <= bounds.startOfPrevYearSameDay) newSameDayLastYear += 1;
      }
    }

    const connections = Array.isArray(member.planConnections) ? member.planConnections : [];
    let memberHasActivePlan = false;

    for (const connection of connections) {
      const planId = connection.planId;
      const planInfo = planId ? planIndex.get(planId) : undefined;
      const status = connection.status || "";
      const active = isConnectionCurrentlyActive(connection);

      if (isCanceledConnectionStatus(status)) {
        canceledConnectionsTotal += 1;
        const canceledAt = connectionCanceledAt(connection);
        if (canceledAt && canceledAt >= bounds.startOfMonth) {
          canceledConnectionsThisMonth += 1;
        }
      }

      if (!active || !planInfo) continue;

      memberHasActivePlan = true;
      const bucketKey = planInfo.key;
      const bucket = activeByPlan.get(bucketKey) ?? { name: planInfo.name, count: 0 };
      bucket.count += 1;
      activeByPlan.set(bucketKey, bucket);

      if (!planInfo.paid) continue;

      const priceId = paidConnectionPriceId(connection);
      const price = priceId ? priceIndex.get(priceId) : undefined;
      if (price) {
        mrr += monthlyEquivalent(price);
      } else {
        unresolvedPaidConnections += 1;
      }
    }

    if (memberHasActivePlan) activeMembersTotal += 1;
  }

  const activeByPlanList = [...activeByPlan.entries()]
    .map(([key, value]) => ({ planKey: key, planName: value.name, activeMembers: value.count }))
    .sort((a, b) => b.activeMembers - a.activeMembers);

  const roundedMrr = Math.round(mrr * 100) / 100;

  return {
    generatedAt: now.toISOString(),
    totalMembersScanned: members.length,
    scanTruncated: options?.truncated ?? false,
    activeMembersTotal,
    activeByPlan: activeByPlanList,
    newMembers: {
      today: newToday,
      last7Days: newThisWeek,
      thisMonth: newThisMonth,
      thisYear: newThisYear,
      sameDayLastYear: newSameDayLastYear,
    },
    canceledConnectionsTotal,
    canceledConnectionsThisMonth,
    revenue: {
      mrrEstimate: roundedMrr,
      arrEstimate: Math.round(roundedMrr * 12 * 100) / 100,
      unresolvedPaidConnections,
      note: buildRevenueNote(unresolvedPaidConnections),
    },
  };
}
