import { describe, expect, it } from "vitest";

import {
  buildCustomerTimeline,
  resolveLastActivityDate,
  resolveLegacyAccessThroughDate,
  sortCustomerTimelineEventsNewestFirst,
} from "./customerTimeline";

describe("customerTimeline", () => {
  it("sorts timeline events newest first", () => {
    const sorted = sortCustomerTimelineEventsNewestFirst([
      {
        eventType: "store_order",
        eventTypeLabel: "Store order",
        dateDisplay: "Jan 1, 2020",
        dateSort: "2020-01-01T00:00:00.000Z",
        description: "Older order",
        source: "legacy_store_transactions",
      },
      {
        eventType: "note_added",
        eventTypeLabel: "Note added",
        dateDisplay: "Jul 1, 2026",
        dateSort: "2026-07-01T00:00:00.000Z",
        description: "Newer note",
        source: "watson_notes",
      },
    ]);

    expect(sorted[0]?.description).toBe("Newer note");
    expect(sorted[1]?.description).toBe("Older order");
  });

  it("builds timeline from legacy and note sources", () => {
    const timeline = buildCustomerTimeline({
      member: {
        memberid: "M1",
        fristname: "Sue",
        lastname: "Hall",
        email: "sue@example.com",
        address: null,
        address2: null,
        city: null,
        state: null,
        postalcode: null,
        country: null,
        birthdayinfo: null,
        datejoined: "2019-05-10T00:00:00.000Z",
        active: 1,
        betaactive: null,
        currentsubscriber: null,
      },
      memberstack: buildEmptyMemberstack(),
      memberships: [],
      courses: [
        {
          libraryRecordId: "1",
          courseId: "10",
          courseIdSort: "00000010",
          courseName: "DesignaKnit Basics",
          dateAdded: "May 12, 2021",
          dateAddedSort: "2021-05-12T00:00:00.000Z",
          accessStatus: "Subscriber free",
          creditId: null,
          creditIdSort: "",
        },
      ],
      orders: [],
      notes: [
        {
          id: "note-1",
          memberid: "M1",
          noteText: "Called about renewal",
          category: "Support",
          createdBy: "Sue",
          createdAt: "Jul 10, 2026",
          createdAtSort: "2026-07-10T12:00:00.000Z",
          updatedAt: null,
          updatedAtSort: "",
        },
      ],
    });

    expect(timeline[0]?.eventType).toBe("note_added");
    expect(timeline.some((event) => event.eventType === "course_enrolled")).toBe(true);
    expect(timeline.some((event) => event.eventType === "account_created")).toBe(true);
  });

  it("treats legacy membership expiration as access-through, not last activity", () => {
    const timeline = buildCustomerTimeline({
      member: {
        memberid: "M1",
        fristname: "Terri",
        lastname: "Smith",
        email: "Thesmith@charter.net",
        address: null,
        address2: null,
        city: null,
        state: null,
        postalcode: null,
        country: null,
        birthdayinfo: null,
        datejoined: "2014-01-01T00:00:00.000Z",
        active: 1,
        betaactive: null,
        currentsubscriber: null,
      },
      memberstack: buildEmptyMemberstack(),
      memberships: [
        {
          subscriptionId: "sub-1",
          subscriptionRateId: "1",
          startDate: "Jul 30, 2025",
          startDateSort: "2025-07-30T00:00:00.000Z",
          expirationDate: "Jul 30, 2026",
          expirationDateSort: "2026-07-30T00:00:00.000Z",
          cancelDate: null,
          cancelDateSort: "",
          cancelledFlag: null,
          amount: "$79.00",
          amountSort: "79",
          renewalFlag: null,
          monthlyBillingFlag: null,
          premiumFlag: null,
          processor: null,
          transactionGuid: null,
          arbId: null,
          invoiceNumber: null,
        },
      ],
      courses: [],
      orders: [
        {
          storeTransactionId: "1",
          transactionId: "txn-1",
          orderDate: "Mar 16, 2019",
          orderDateSort: "2019-03-16T00:00:00.000Z",
          orderStatus: "Paid",
          orderTotal: "$4.99",
          orderTotalSort: "4.99",
          paymentMethod: null,
          items: [],
        },
      ],
      notes: [],
    });

    expect(timeline[0]?.description).toBe("Legacy membership expiration date");
    expect(resolveLegacyAccessThroughDate(timeline)).toBe("Jul 30, 2026");
    expect(resolveLastActivityDate(timeline)).not.toBe("Jul 30, 2026");
    expect(resolveLastActivityDate(timeline)).toBeTruthy();
  });
});

function buildEmptyMemberstack() {
  return {
    memberstackId: "",
    email: null,
    displayName: null,
    accountCreatedAt: null,
    accountCreatedAtSort: "",
    connections: [],
    hasActiveConnection: false,
    membershipStatusLabel: null,
    configured: false,
    loadError: "Memberstack admin API is not configured.",
  };
}
