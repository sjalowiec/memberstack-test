/**
 * Current Business - live platform reporting.
 *
 * This module is intentionally separate from legacy Watson reporting:
 * - Legacy dashboard/reports use `queryWatson()` against imported Postgres tables.
 * - Current business pulls from live platform APIs (Memberstack, Stripe, etc.).
 *
 * Do not import legacy query helpers here. Loaders in sibling modules call
 * external services only.
 */

import { formatUsd } from "../admin/reportRenderer";
import type { MembershipSummary } from "../membership/membershipSummary";

export type CurrentBusinessSummaryCard = {
  id: string;
  label: string;
};

export type CurrentBusinessSummaryCardView = {
  id: string;
  label: string;
  displayValue: string;
  note?: string;
  isLive: boolean;
};

export type CurrentBusinessSection = {
  id: string;
  title: string;
  futureDataSources: string[];
  futureExamples?: string[];
};

export const CURRENT_BUSINESS_SUMMARY_CARDS: CurrentBusinessSummaryCard[] = [
  { id: "active-memberships", label: "Active memberships" },
  { id: "mrr", label: "Monthly recurring revenue" },
  { id: "arr", label: "Annual recurring revenue" },
  { id: "new-members", label: "New members this month" },
  { id: "cancellations", label: "Cancellations this month" },
  { id: "shopify-sales", label: "Shopify sales" },
  { id: "course-sales", label: "Course sales" },
  { id: "quick-help-sales", label: "Quick Help sales" },
];

export const CURRENT_BUSINESS_SECTIONS: CurrentBusinessSection[] = [
  {
    id: "memberships",
    title: "Memberships",
    futureDataSources: ["Memberstack", "Stripe"],
  },
  {
    id: "sales",
    title: "Sales",
    futureDataSources: ["Shopify", "Stripe"],
  },
  {
    id: "courses",
    title: "Courses",
    futureDataSources: ["Learn DesignaKnit", "Knit It Now"],
  },
  {
    id: "customer-activity",
    title: "Customer Activity",
    futureDataSources: ["Memberstack", "Site activity"],
  },
  {
    id: "alerts",
    title: "Alerts",
    futureDataSources: [],
    futureExamples: [
      "Upcoming renewals",
      "Failed payments",
      "High-value customers",
      "Recent cancellations",
    ],
  },
];

export const CURRENT_BUSINESS_PLACEHOLDER = "Coming soon";

const LIVE_MEMBERSHIP_CARD_IDS = new Set([
  "active-memberships",
  "mrr",
  "arr",
  "new-members",
  "cancellations",
]);

export function formatCurrentBusinessAsOf(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

export function buildCurrentBusinessSummaryCardViews(
  summary: MembershipSummary | null,
): CurrentBusinessSummaryCardView[] {
  return CURRENT_BUSINESS_SUMMARY_CARDS.map((card) => {
    if (card.id === "shopify-sales") {
      return {
        id: card.id,
        label: card.label,
        displayValue: "Open Recent Sales",
        note: "Live Shopify orders at /watson/sales (Sync Shopify Orders).",
        isLive: true,
      };
    }

    if (!LIVE_MEMBERSHIP_CARD_IDS.has(card.id) || !summary) {
      return {
        id: card.id,
        label: card.label,
        displayValue: CURRENT_BUSINESS_PLACEHOLDER,
        isLive: false,
      };
    }

    switch (card.id) {
      case "active-memberships":
        return {
          id: card.id,
          label: card.label,
          displayValue: String(summary.activeMembersTotal),
          isLive: true,
        };
      case "mrr":
        return {
          id: card.id,
          label: card.label,
          displayValue: `${formatUsd(summary.revenue.mrrEstimate)} (estimate)`,
          note: summary.revenue.note ?? undefined,
          isLive: true,
        };
      case "arr":
        return {
          id: card.id,
          label: card.label,
          displayValue: `${formatUsd(summary.revenue.arrEstimate)} (estimate)`,
          note: summary.revenue.note ?? undefined,
          isLive: true,
        };
      case "new-members":
        return {
          id: card.id,
          label: card.label,
          displayValue: String(summary.newMembers.thisMonth),
          note: "Memberstack accounts created since the first day of this month (UTC).",
          isLive: true,
        };
      case "cancellations":
        return {
          id: card.id,
          label: card.label,
          displayValue: String(summary.canceledConnectionsThisMonth),
          note:
            "Plan connections with canceled/expired status and a cancellation timestamp this month (UTC).",
          isLive: true,
        };
      default:
        return {
          id: card.id,
          label: card.label,
          displayValue: CURRENT_BUSINESS_PLACEHOLDER,
          isLive: false,
        };
    }
  });
}

export function buildCurrentBusinessSummaryNotes(summary: MembershipSummary): string[] {
  const notes: string[] = [];
  if (summary.revenue.note) notes.push(summary.revenue.note);
  if (summary.scanTruncated) {
    notes.push(
      `Member list is larger than the report safety cap (${summary.totalMembersScanned} scanned) - numbers are a partial snapshot.`,
    );
  }
  return notes;
}
