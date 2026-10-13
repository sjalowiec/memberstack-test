import { describe, expect, it } from "vitest";

import { applyMarketingCalendarPlan } from "./applyPlan";
import type { PlannedWrite } from "./syncPlan";

function write(overrides: Partial<PlannedWrite> = {}): PlannedWrite {
  return {
    action: "update",
    campaignId: "42",
    googleEventId: "owned-1",
    title: "What's New",
    campaignName: "internal",
    status: "scheduled",
    colorId: "7",
    start: "2026-10-15T09:00:00-07:00",
    end: "2026-10-15T09:30:00-07:00",
    timeZone: "America/Los_Angeles",
    timeSource: "scheduleddate",
    timePreserved: false,
    allDay: false,
    eventAt: null,
    description: "Knit It Now marketing sync",
    adminUrl: "https://example.test/app/campaigns/42",
    reason: "status-or-time",
    ...overrides,
  };
}

describe("apply marketing calendar plan", () => {
  it("stops before changing an event that the sync does not own", async () => {
    const calls: string[] = [];
    await expect(
      applyMarketingCalendarPlan([write(), write({ action: "delete", googleEventId: "owned-2" })], {
        async getEvent() {
          calls.push("get");
          return {
            id: "owned-1",
            summary: "Manual plan",
            description: "",
            colorId: "6",
            start: null,
            startText: null,
            recurringEventId: null,
            recurring: false,
            allDay: false,
            etag: null,
            updated: null,
            privateProps: {},
          };
        },
        async insertEvent() {
          calls.push("insert");
          return { id: "new" };
        },
        async patchEvent() {
          calls.push("patch");
        },
        async deleteEvent() {
          calls.push("delete");
        },
      }),
    ).rejects.toThrow(/not owned/);
    expect(calls).toEqual(["get"]);
  });

  it("patches and deletes only after the owned-event check", async () => {
    const calls: string[] = [];
    const result = await applyMarketingCalendarPlan(
      [write(), write({ action: "delete", campaignId: "15", googleEventId: "owned-2" })],
      {
        async getEvent(eventId) {
          calls.push(`get:${eventId}`);
          return {
            id: eventId,
            summary: "Synced",
            description: "",
            colorId: "7",
            start: null,
            startText: null,
            recurringEventId: null,
            recurring: false,
            allDay: false,
            etag: null,
            updated: null,
            privateProps: {
              kinCampaignId: eventId === "owned-2" ? "15" : "42",
              kinSource: "activecampaign",
              kinSync: "kin-marketing",
            },
          };
        },
        async insertEvent() {
          throw new Error("insert was not expected");
        },
        async patchEvent(eventId) {
          calls.push(`patch:${eventId}`);
        },
        async deleteEvent(eventId) {
          calls.push(`delete:${eventId}`);
        },
      },
    );
    expect(result).toEqual({ created: 0, updated: 1, deleted: 1 });
    expect(calls).toEqual(["get:owned-1", "patch:owned-1", "get:owned-2", "delete:owned-2"]);
  });
});
