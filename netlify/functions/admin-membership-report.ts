/**
 * Admin-only membership + revenue snapshot report.
 *
 * GET only, gated by {@link requireAdmin} (verified Memberstack session token, not a trusted
 * client header — see netlify/functions/lib/admin-auth.js).
 *
 * Data source: Memberstack Admin REST `listMembers`, paginated (see the "snapshot approach" in
 * docs/admin-reporting-architecture.md). This is a live point-in-time snapshot — active members by
 * plan, new members by period, and an MRR estimate — not a historical event log. There is no local
 * database of Stripe/membership events to query yet, since Stripe lives entirely inside
 * Memberstack (see the architecture doc). Plan/price identity is resolved against
 * src/config/memberships.ts, the single source of truth already used for checkout, rather than
 * trusting whatever shape Memberstack's `payment` sub-object turns out to have.
 *
 * KNOWN GAP (flagged deliberately, not guessed around): Memberstack's public docs show the
 * `planConnections[].payment` field is `null` for free connections but do not document its shape
 * for paid (Stripe-backed) connections. This code tries several plausible field names
 * (`payment.priceId`, `priceId`, `payment.plan.id`) to identify the exact price/interval for MRR.
 * Any active paid connection where none of those resolve is counted in `activeByPlan` but excluded
 * from `mrr` and instead tallied in `unresolvedPaidConnections` — so the report stays honest about
 * gaps instead of presenting a possibly-wrong dollar figure with false confidence. If
 * `unresolvedPaidConnections > 0` in practice, inspect one real paid member's `planConnections` via
 * the Memberstack dashboard or a one-off API call to learn the real field name, then extend
 * `paidConnectionPriceId()` below.
 */
import { requireAdmin } from "./lib/admin-auth.js";
import { getMemberstackAdminClient } from "./lib/memberstack-admin.js";
import { jsonResponse, withCors } from "./lib/custom-pattern-projects-store.js";
import {
  MEMBERSHIPS,
  LEGACY_MEMBERSHIPS,
} from "../../src/config/memberships";

const MAX_PAGES = 50; // 50 * 100 = 5,000 members safety cap, mirrors MAX_EVENTS_SCANNED elsewhere.
const PAGE_SIZE = 100;

type PlanConnection = {
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

type MemberstackMember = {
  id: string;
  createdAt?: string;
  auth?: { email?: string };
  planConnections?: PlanConnection[];
};

type PlanInfo = { key: string; name: string; paid: boolean; legacy?: boolean };
type PriceInfo = { planKey: string; interval: "monthly" | "annual"; amount: number };

function buildPlanIndex(): Map<string, PlanInfo> {
  const index = new Map<string, PlanInfo>();
  index.set(MEMBERSHIPS.beta.memberstackPlanId, { key: "beta", name: MEMBERSHIPS.beta.name, paid: false });
  index.set(MEMBERSHIPS.basic.memberstackPlanId, { key: "basic", name: MEMBERSHIPS.basic.name, paid: true });
  index.set(MEMBERSHIPS.premium.memberstackPlanId, { key: "premium", name: MEMBERSHIPS.premium.name, paid: true });
  for (const [key, plan] of Object.entries(LEGACY_MEMBERSHIPS)) {
    index.set(plan.memberstackPlanId, { key: `legacy_${key}`, name: plan.name, paid: true, legacy: true });
  }
  return index;
}

function buildPriceIndex(): Map<string, PriceInfo> {
  const index = new Map<string, PriceInfo>();
  for (const key of ["basic", "premium"] as const) {
    const plan = MEMBERSHIPS[key];
    for (const interval of ["monthly", "annual"] as const) {
      const priceEntry = plan.prices[interval];
      index.set(priceEntry.memberstackPriceId, { planKey: key, interval, amount: priceEntry.price });
    }
  }
  return index;
}

/** Best-effort price id lookup across the field names Memberstack's paid connections might use. */
function paidConnectionPriceId(connection: PlanConnection): string | null {
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

function isConnectionCurrentlyActive(connection: PlanConnection): boolean {
  if (connection.active === true) return true;
  const status = (connection.status || "").toUpperCase();
  return status === "ACTIVE" || status === "TRIALING";
}

function monthlyEquivalent(price: PriceInfo): number {
  return price.interval === "annual" ? price.amount / 12 : price.amount;
}

function dayBoundariesUTC(now: Date) {
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfWeek = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const startOfPrevYear = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
  const startOfPrevYearSameDay = new Date(
    Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate()),
  );
  return { startOfToday, startOfWeek, startOfMonth, startOfYear, startOfPrevYear, startOfPrevYearSameDay };
}

async function fetchAllMembers(
  client: NonNullable<ReturnType<typeof getMemberstackAdminClient>>,
): Promise<{ members: MemberstackMember[]; truncated: boolean }> {
  const members: MemberstackMember[] = [];
  let after: number | string | undefined;
  let truncated = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await client.listMembers({ limit: PAGE_SIZE, after, order: "ASC" });
    const data = Array.isArray(res?.data) ? (res.data as MemberstackMember[]) : [];
    members.push(...data);
    if (!res?.hasNextPage || data.length === 0) {
      return { members, truncated: false };
    }
    after = res.endCursor;
    if (page === MAX_PAGES - 1) truncated = true;
  }

  return { members, truncated };
}

export default async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }
  if (req.method !== "GET") {
    return withCors(jsonResponse({ ok: false, error: "Method not allowed" }, 405));
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return withCors(jsonResponse({ ok: false, error: auth.error }, auth.status));
  }

  const client = getMemberstackAdminClient();
  if (!client) {
    return withCors(jsonResponse({ ok: false, error: "Admin API is not configured." }, 500));
  }

  try {
    const planIndex = buildPlanIndex();
    const priceIndex = buildPriceIndex();
    const { members, truncated } = await fetchAllMembers(client);

    const now = new Date();
    const bounds = dayBoundariesUTC(now);

    const activeByPlan = new Map<string, { name: string; count: number }>();
    let activeMembersTotal = 0;
    let newToday = 0;
    let newThisWeek = 0;
    let newThisMonth = 0;
    let newThisYear = 0;
    let newSameDayLastYear = 0; // for a simple year-over-year comparison point
    let canceledConnectionsTotal = 0;
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
          // Members created in the same Jan1-to-today window last year, for a YoY comparison.
          if (createdAt <= bounds.startOfPrevYearSameDay) newSameDayLastYear += 1;
        }
      }

      const connections = Array.isArray(member.planConnections) ? member.planConnections : [];
      let memberHasActivePlan = false;

      for (const connection of connections) {
        const planId = connection.planId;
        const planInfo = planId ? planIndex.get(planId) : undefined;
        const status = (connection.status || "").toUpperCase();
        const active = isConnectionCurrentlyActive(connection);

        if (status === "CANCELED" || status === "CANCELLED" || status === "EXPIRED") {
          canceledConnectionsTotal += 1;
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

    return withCors(
      jsonResponse({
        ok: true,
        generatedAt: now.toISOString(),
        totalMembersScanned: members.length,
        scanTruncated: truncated,
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
        revenue: {
          mrrEstimate: Math.round(mrr * 100) / 100,
          arrEstimate: Math.round(mrr * 12 * 100) / 100,
          unresolvedPaidConnections,
          note:
            unresolvedPaidConnections > 0
              ? "Some active paid plan connections could not be matched to a known price id — mrrEstimate excludes them. See the code comment at the top of admin-membership-report.ts."
              : null,
        },
      }),
    );
  } catch (err) {
    console.error("admin-membership-report failed:", err);
    return withCors(jsonResponse({ ok: false, error: "Failed to load membership report." }, 500));
  }
};
