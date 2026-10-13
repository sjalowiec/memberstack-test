import { describe, expect, it } from "vitest";

import { titleOnlyEventResource } from "./importApproved";
import type { PlannedWrite } from "./syncPlan";

function write(): PlannedWrite {
  return {
    action: "update",
    campaignId: "2349",
    googleEventId: "event-1",
    title: "TOW - Jog-less Stripes",
    campaignName: "TOW - Jog-less Stripes",
    status: "completed",
    colorId: "10",
    start: "2026-10-03",
    end: "2026-10-04",
    timeZone: "America/Los_Angeles",
    timeSource: "sdate",
    timePreserved: false,
    allDay: true,
    eventAt: "2026-10-03T06:18:00-07:00",
    description: "Subject: Perfect Stripe Seams - every time\nCampaign ID: 2349\nExact time: 2026-10-03T06:18:00-07:00",
    adminUrl: "https://knititnow.api-us1.com/app/campaigns/2349",
    reason: "campaign-name",
  };
}

describe("title-only calendar update", () => {
  it("does not send a start or end date", () => {
    const resource = titleOnlyEventResource(write());
    expect(resource.summary).toBe("TOW - Jog-less Stripes");
    expect(resource.start).toBeUndefined();
    expect(resource.end).toBeUndefined();
    expect(resource.extendedProperties.private.kinCampaignId).toBe("2349");
    expect(resource.extendedProperties.private.kinEventAt).toBe("2026-10-03T06:18:00-07:00");
    expect(resource.description).toContain("Subject: Perfect Stripe Seams - every time");
  });
});
