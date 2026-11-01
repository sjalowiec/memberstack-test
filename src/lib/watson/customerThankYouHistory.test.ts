import { describe, expect, it } from "vitest";

import {
  loadCustomerThankYouHistory,
  presentCustomerThankYouHistoryItem,
  THANK_YOU_HISTORY_NO_SEND,
  THANK_YOU_HISTORY_NOT_COMPLETE,
  THANK_YOU_HISTORY_NO_VIDEO,
  THANK_YOU_HISTORY_SEND_UNKNOWN,
} from "./customerThankYouHistory";
import type { MemberThankYouPage, MemberThankYouRow } from "./memberThankYouLoad";

function row(overrides: Partial<MemberThankYouRow> = {}): MemberThankYouRow {
  return {
    stripeChargeId: "ch_history",
    displayName: "Ada Lovelace",
    email: "ada@example.com",
    paymentYmd: "2026-10-31",
    paymentDateLabel: "Oct 31, 2026",
    planLabel: "Membership, annual",
    kind: "renewing",
    kindLabel: "Renewing",
    addressState: "usable",
    addressLabel: null,
    addressLines: null,
    addressNote: null,
    noAddressMessage: null,
    profileHref: "/watson/customers/legacy/42",
    videoSent: false,
    cardSent: false,
    videoSentAt: null,
    cardSentAt: null,
    videoSentLabel: null,
    cardSentLabel: null,
    completed: false,
    completedAt: null,
    completedLabel: null,
    videoReplyId: null,
    videoOriginalUrl: null,
    videoPublicUrl: null,
    videoLinkDisabled: false,
    emailSubject: null,
    emailMessage: null,
    ...overrides,
  };
}

function page(rows: MemberThankYouRow[], overrides: Partial<MemberThankYouPage> = {}): MemberThankYouPage {
  return {
    rows,
    totalInRange: rows.length,
    filter: "all",
    fromCivil: "2026-10-30",
    toCivil: "2026-11-01",
    todayCivil: "2026-11-01",
    statusesAvailable: true,
    videoColumnsAvailable: true,
    warnings: [],
    error: null,
    priceConfigReady: true,
    ...overrides,
  };
}

describe("customer thank-you history", () => {
  it("shows recorded sends, the saved viewing link, and completion without copying them", () => {
    const item = presentCustomerThankYouHistoryItem(
      row({
        videoSent: true,
        cardSent: true,
        videoSentAt: "2026-10-31T18:00:00.000Z",
        cardSentAt: "2026-10-31T19:00:00.000Z",
        videoSentLabel: "Sent Oct 31, 2026, 11:00 AM",
        cardSentLabel: "Sent Oct 31, 2026, 12:00 PM",
        completed: true,
        completedAt: "2026-11-01T17:00:00.000Z",
        completedLabel: "Completed Nov 1, 2026, 10:00 AM",
        videoPublicUrl: "https://kin-dev.netlify.app/video-reply/opaque-token",
      }),
      { statusesKnown: true, videoLinksKnown: true },
    );

    expect(item.reason).toBe("Renewing");
    expect(item.videoSentText).toBe("Sent Oct 31, 2026, 11:00 AM");
    expect(item.cardSentText).toBe("Sent Oct 31, 2026, 12:00 PM");
    expect(item.videoPublicUrl).toBe("https://kin-dev.netlify.app/video-reply/opaque-token");
    expect(item.completionText).toBe("Completed Nov 1, 2026, 10:00 AM");
    expect(item.videoSentText).not.toBe(item.completionText);
    expect(item.cardSentText).not.toBe(item.completionText);
  });

  it("does not treat completion as a video or card send", () => {
    const item = presentCustomerThankYouHistoryItem(
      row({
        completed: true,
        completedAt: "2026-11-01T17:00:00.000Z",
        completedLabel: "Completed Nov 1, 2026, 10:00 AM",
      }),
      { statusesKnown: true, videoLinksKnown: true },
    );

    expect(item.videoSentState).toBe("none");
    expect(item.cardSentState).toBe("none");
    expect(item.videoSentText).toBe(THANK_YOU_HISTORY_NO_SEND);
    expect(item.cardSentText).toBe(THANK_YOU_HISTORY_NO_SEND);
    expect(item.videoLinkText).toBe(THANK_YOU_HISTORY_NO_VIDEO);
    expect(item.completed).toBe(true);
    expect(item.completionText).toBe("Completed Nov 1, 2026, 10:00 AM");
  });

  it("keeps an open thank-you distinct from a recorded send", () => {
    const item = presentCustomerThankYouHistoryItem(row(), {
      statusesKnown: true,
      videoLinksKnown: true,
    });

    expect(item.completionText).toBe(THANK_YOU_HISTORY_NOT_COMPLETE);
    expect(item.videoSentText).toBe(THANK_YOU_HISTORY_NO_SEND);
    expect(item.cardSentText).toBe(THANK_YOU_HISTORY_NO_SEND);
  });

  it("does not claim no send was recorded when status could not be loaded", () => {
    const item = presentCustomerThankYouHistoryItem(row(), {
      statusesKnown: false,
      videoLinksKnown: false,
    });

    expect(item.videoSentText).toBe(THANK_YOU_HISTORY_SEND_UNKNOWN);
    expect(item.cardSentText).toBe(THANK_YOU_HISTORY_SEND_UNKNOWN);
    expect(item.videoSentText).not.toBe(THANK_YOU_HISTORY_NO_SEND);
  });

  it("keeps only this customer's thank-you rows", async () => {
    const history = await loadCustomerThankYouHistory({
      emails: ["Ada@example.com"],
      profilePaths: ["/watson/customers/memberstack/mem_ada"],
      loadPage: async () =>
        page([
          row(),
          row({
            stripeChargeId: "ch_other",
            email: "other@example.com",
            profileHref: "/watson/customers/legacy/99",
            kindLabel: "New",
          }),
          row({
            stripeChargeId: "ch_linked",
            email: "billing@example.com",
            profileHref: "/watson/customers/memberstack/mem_ada",
            kindLabel: "Returning",
          }),
        ]),
    });

    expect(history.items.map((item) => item.stripeChargeId)).toEqual(["ch_history", "ch_linked"]);
    expect(history.items.map((item) => item.reason)).toEqual(["Renewing", "Returning"]);
  });
});
