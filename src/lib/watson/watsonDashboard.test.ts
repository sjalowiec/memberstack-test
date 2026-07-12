import { describe, expect, it, vi } from "vitest";

import { searchLegacyMembers } from "./memberSearch";
import {
  buildDashboardSummaryCards,
  buildWatsonMemberDetailHref,
  DASHBOARD_COUNT_COURSE_ENROLLMENTS_SQL,
  DASHBOARD_COUNT_MEMBERS_SQL,
  DASHBOARD_COUNT_MEMBERS_WITH_NOTES_SQL,
  DASHBOARD_COUNT_PDF_PURCHASES_SQL,
  DASHBOARD_COUNT_SAVED_PATTERNS_SQL,
  DASHBOARD_COUNT_STORE_ORDERS_SQL,
  DASHBOARD_COUNT_SUBSCRIPTIONS_SQL,
  DASHBOARD_RECENT_ACTIVITY_LIMIT,
  DASHBOARD_RECENT_COURSE_ENROLLMENTS_SQL,
  DASHBOARD_RECENT_SAVED_PATTERNS_SQL,
  DASHBOARD_RECENT_STORE_ORDERS_SQL,
  DASHBOARD_STORE_REVENUE_SQL,
  formatDashboardMetricDisplay,
  formatDashboardStoreRevenue,
  loadWatsonDashboard,
  loadWatsonDashboardRecentActivity,
  loadWatsonDashboardSummary,
  parseDashboardCount,
  parseDashboardNumericTotal,
} from "./watsonDashboard";

describe("watsonDashboard", () => {
  it("uses aggregate count queries against verified legacy tables", async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce([{ count: "50950" }])
      .mockResolvedValueOnce([{ count: "18338" }])
      .mockResolvedValueOnce([{ count: "1200" }])
      .mockResolvedValueOnce([{ total: "12345.67" }])
      .mockResolvedValueOnce([{ count: "6307" }])
      .mockResolvedValueOnce([{ count: "52561" }])
      .mockResolvedValueOnce([{ count: "4117" }])
      .mockResolvedValueOnce([{ count: "42" }]);

    const summary = await loadWatsonDashboardSummary(queryFn);

    expect(queryFn).toHaveBeenNthCalledWith(1, DASHBOARD_COUNT_MEMBERS_SQL);
    expect(queryFn).toHaveBeenNthCalledWith(2, DASHBOARD_COUNT_SUBSCRIPTIONS_SQL);
    expect(queryFn).toHaveBeenNthCalledWith(3, DASHBOARD_COUNT_STORE_ORDERS_SQL);
    expect(queryFn).toHaveBeenNthCalledWith(4, DASHBOARD_STORE_REVENUE_SQL);
    expect(queryFn).toHaveBeenNthCalledWith(5, DASHBOARD_COUNT_COURSE_ENROLLMENTS_SQL);
    expect(queryFn).toHaveBeenNthCalledWith(6, DASHBOARD_COUNT_SAVED_PATTERNS_SQL);
    expect(queryFn).toHaveBeenNthCalledWith(7, DASHBOARD_COUNT_PDF_PURCHASES_SQL);
    expect(queryFn).toHaveBeenNthCalledWith(8, DASHBOARD_COUNT_MEMBERS_WITH_NOTES_SQL);

    expect(DASHBOARD_STORE_REVENUE_SQL).toContain("SUM(totalcost)");
    expect(DASHBOARD_COUNT_MEMBERS_WITH_NOTES_SQL).toContain("BTRIM(notes) <> ''");
    expect(summary.totalMembers).toEqual({ ok: true, value: 50950 });
    expect(summary.storeRevenue).toEqual({ ok: true, value: "$12,345.67" });
  });

  it("handles null and invalid revenue totals safely", () => {
    expect(formatDashboardStoreRevenue(null)).toBe("$0.00");
    expect(formatDashboardStoreRevenue("")).toBe("$0.00");
    expect(formatDashboardStoreRevenue("not-a-number")).toBe("$0.00");
    expect(formatDashboardStoreRevenue("18.99")).toBe("$18.99");
    expect(parseDashboardNumericTotal(undefined)).toBeNull();
    expect(parseDashboardCount(undefined)).toBe(0);
  });

  it("marks failed metrics unavailable instead of returning misleading numbers", async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce([{ count: "10" }])
      .mockRejectedValueOnce(new Error("subscriptions unavailable"))
      .mockResolvedValueOnce([{ count: "3" }])
      .mockResolvedValueOnce([{ total: "0" }])
      .mockResolvedValueOnce([{ count: "1" }])
      .mockResolvedValueOnce([{ count: "2" }])
      .mockResolvedValueOnce([{ count: "4" }])
      .mockResolvedValueOnce([{ count: "5" }]);

    const summary = await loadWatsonDashboardSummary(queryFn);
    const cards = buildDashboardSummaryCards(summary);

    expect(summary.subscriptionRecords.ok).toBe(false);
    expect(formatDashboardMetricDisplay(summary.subscriptionRecords)).toBe("Unavailable");
    expect(cards.find((card) => card.key === "subscriptionRecords")?.displayValue).toBe(
      "Unavailable",
    );
  });

  it("loads recent activity with server-side limits and newest-first ordering", async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce([
        {
          storetransactionid: 99,
          transactionid: "ORDER-99",
          memberid_fk: "MEM-1",
          purchasedate: "2026-07-10T20:40:15.670Z",
          totalcost: "18.99",
          fristname: "Sue",
          lastname: "Hall",
        },
      ])
      .mockResolvedValueOnce([
        {
          homestudy_libraryid: 12,
          memberid_fk: "MEM-2",
          homestudy_courseid_fk: 3,
          dateadded: "2012-01-31T00:00:00.000Z",
          fristname: null,
          lastname: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          detailid: 6,
          member_fk: "MEM-3",
          builddate: "2009-08-24T01:36:27.193Z",
          customname: "My Vest",
          challengepatternname: null,
          fristname: "Mary",
          lastname: "Scott",
        },
      ]);

    const activity = await loadWatsonDashboardRecentActivity(queryFn);

    expect(DASHBOARD_RECENT_STORE_ORDERS_SQL).toContain(`LIMIT ${DASHBOARD_RECENT_ACTIVITY_LIMIT}`);
    expect(DASHBOARD_RECENT_STORE_ORDERS_SQL).toContain("ORDER BY st.purchasedate DESC");
    expect(DASHBOARD_RECENT_COURSE_ENROLLMENTS_SQL).toContain(
      `LIMIT ${DASHBOARD_RECENT_ACTIVITY_LIMIT}`,
    );
    expect(DASHBOARD_RECENT_SAVED_PATTERNS_SQL).toContain(
      `LIMIT ${DASHBOARD_RECENT_ACTIVITY_LIMIT}`,
    );
    expect(activity.storeOrders).toHaveLength(1);
    expect(activity.storeOrders[0]?.memberHref).toBe(buildWatsonMemberDetailHref("MEM-1"));
    expect(activity.storeOrders[0]?.memberLabel).toBe("Sue Hall");
    expect(activity.courseEnrollments[0]?.memberLabel).toBe("MEM-2");
    expect(activity.savedPatterns[0]?.patternLabel).toBe("My Vest");
  });

  it("returns empty recent activity lists when tables have no dated records", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const activity = await loadWatsonDashboardRecentActivity(queryFn);

    expect(activity.storeOrders).toEqual([]);
    expect(activity.courseEnrollments).toEqual([]);
    expect(activity.savedPatterns).toEqual([]);
  });

  it("builds member detail links for recent activity rows", () => {
    expect(buildWatsonMemberDetailHref("ABC-123")).toBe("/watson/members/ABC-123");
    expect(buildWatsonMemberDetailHref("ABC 123")).toBe("/watson/members/ABC%20123");
  });

  it("loads dashboard summary and recent activity together", async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce([{ count: "1" }])
      .mockResolvedValueOnce([{ count: "2" }])
      .mockResolvedValueOnce([{ count: "3" }])
      .mockResolvedValueOnce([{ total: "0" }])
      .mockResolvedValueOnce([{ count: "4" }])
      .mockResolvedValueOnce([{ count: "5" }])
      .mockResolvedValueOnce([{ count: "6" }])
      .mockResolvedValueOnce([{ count: "7" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const dashboard = await loadWatsonDashboard(queryFn);

    expect(dashboard.summary.totalMembers).toEqual({ ok: true, value: 1 });
    expect(dashboard.recentActivity.storeOrders).toEqual([]);
  });

  it("does not change existing member search behavior", async () => {
    const queryFn = vi.fn(async () => []);
    const result = await searchLegacyMembers("sue", queryFn);
    expect(result.rows).toEqual([]);
    expect(queryFn).toHaveBeenCalledTimes(1);
  });
});
