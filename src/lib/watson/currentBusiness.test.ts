import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

import { MEMBERSHIPS } from "../../config/memberships";
import { computeMembershipSummary } from "../membership/membershipSummary";
import {
  buildCurrentBusinessSummaryCardViews,
  buildCurrentBusinessSummaryNotes,
  CURRENT_BUSINESS_PLACEHOLDER,
  CURRENT_BUSINESS_SECTIONS,
  CURRENT_BUSINESS_SUMMARY_CARDS,
  formatCurrentBusinessAsOf,
} from "./currentBusiness";

describe("currentBusiness", () => {
  it("defines summary cards without static metric values", () => {
    expect(CURRENT_BUSINESS_SUMMARY_CARDS).toHaveLength(8);
    expect(CURRENT_BUSINESS_SUMMARY_CARDS.map((card) => card.label)).toEqual([
      "Active memberships",
      "Monthly recurring revenue",
      "Annual recurring revenue",
      "New members this month",
      "Cancellations this month",
      "Shopify sales",
      "Course sales",
      "Quick Help sales",
    ]);

    for (const card of CURRENT_BUSINESS_SUMMARY_CARDS) {
      expect(card).not.toHaveProperty("value");
      expect(card).not.toHaveProperty("displayValue");
    }
  });

  it("defines placeholder sections with planned data sources", () => {
    expect(CURRENT_BUSINESS_SECTIONS.map((section) => section.title)).toEqual([
      "Memberships",
      "Sales",
      "Courses",
      "Customer Activity",
      "Alerts",
    ]);

    const memberships = CURRENT_BUSINESS_SECTIONS.find(
      (section) => section.id === "memberships",
    );
    expect(memberships?.futureDataSources).toEqual(["Memberstack", "Stripe"]);

    const alerts = CURRENT_BUSINESS_SECTIONS.find((section) => section.id === "alerts");
    expect(alerts?.futureExamples).toContain("Failed payments");
  });

  it("uses a single coming-soon placeholder for cards without live data", () => {
    const cards = buildCurrentBusinessSummaryCardViews(null);
    const shopify = cards.find((card) => card.id === "shopify-sales");
    expect(shopify).toMatchObject({
      displayValue: "Open Recent Sales",
      isLive: true,
    });
    expect(
      cards
        .filter((card) => card.id !== "shopify-sales")
        .every((card) => card.displayValue === CURRENT_BUSINESS_PLACEHOLDER),
    ).toBe(true);
  });

  it("renders live membership summary cards with labeled money estimates", () => {
    const summary = computeMembershipSummary(
      [
        {
          id: "mem_1",
          createdAt: "2026-07-01T00:00:00.000Z",
          planConnections: [
            {
              planId: MEMBERSHIPS.membership.memberstackPlanId,
              active: true,
              status: "ACTIVE",
              payment: {
                priceId: MEMBERSHIPS.membership.prices.monthly.memberstackPriceId,
              },
            },
          ],
        },
      ],
      { now: new Date("2026-07-12T12:00:00.000Z") },
    );

    const cards = buildCurrentBusinessSummaryCardViews(summary);
    const active = cards.find((card) => card.id === "active-memberships");
    const mrr = cards.find((card) => card.id === "mrr");
    const arr = cards.find((card) => card.id === "arr");
    const newMembers = cards.find((card) => card.id === "new-members");
    const shopify = cards.find((card) => card.id === "shopify-sales");

    expect(active).toMatchObject({ displayValue: "1", isLive: true });
    expect(mrr?.displayValue).toContain("(estimate)");
    expect(arr?.displayValue).toContain("(estimate)");
    expect(newMembers).toMatchObject({ displayValue: "1", isLive: true });
    expect(shopify).toMatchObject({
      displayValue: "Open Recent Sales",
      isLive: true,
    });
  });

  it("formats the as-of timestamp in UTC", () => {
    expect(formatCurrentBusinessAsOf("2026-07-12T15:30:00.000Z")).toContain("2026");
  });

  it("builds summary notes for unresolved revenue and truncation", () => {
    const notes = buildCurrentBusinessSummaryNotes({
      generatedAt: "2026-07-12T15:30:00.000Z",
      totalMembersScanned: 5000,
      scanTruncated: true,
      activeMembersTotal: 1,
      activeByPlan: [],
      newMembers: {
        today: 0,
        last7Days: 0,
        thisMonth: 0,
        thisYear: 0,
        sameDayLastYear: 0,
      },
      canceledConnectionsTotal: 0,
      canceledConnectionsThisMonth: 0,
      revenue: {
        mrrEstimate: 0,
        arrEstimate: 0,
        unresolvedPaidConnections: 1,
        note: "Some active paid plan connections could not be matched to a known price id.",
      },
    });

    expect(notes).toHaveLength(2);
    expect(notes[0]).toContain("could not be matched");
    expect(notes[1]).toContain("partial snapshot");
  });

  it("documents separation from legacy Watson in module comments", () => {
    const source = fs.readFileSync(
      path.resolve("src/lib/watson/currentBusiness.ts"),
      "utf8",
    );

    expect(source).toContain("separate from legacy Watson");
    expect(source).toContain("queryWatson()");
    expect(source).not.toContain("legacy_members");
  });
});
