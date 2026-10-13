import { describe, expect, it, vi } from "vitest";

import { applySyncActions, planSyncActions, scheduledSyncIsLive } from "./runSync";
import type { PlannedWrite } from "./syncPlan";
import type { ListedEvent } from "./googleCalendarClient";

function write(overrides: Partial<PlannedWrite> = {}): PlannedWrite {
  return {
    action: "create",
    campaignId: "42",
    googleEventId: null,
    title: "October What's New",
    campaignName: "October What's New",
    status: "scheduled",
    colorId: "7",
    start: "2026-10-15",
    end: "2026-10-16",
    timeZone: "America/Los_Angeles",
    timeSource: "scheduleddate",
    timePreserved: false,
    allDay: true,
    eventAt: "2026-10-15T09:00:00-07:00",
    description: "Subject: What's New\nCampaign ID: 42",
    adminUrl: "https://example.test/app/campaigns/42",
    reason: "new-campaign",
    ...overrides,
  };
}

function listed(campaignId: string | null): ListedEvent {
  return {
    id: "google-1",
    summary: "Manual plan",
    description: "",
    colorId: "6",
    start: null,
    startText: "2026-10-20",
    recurringEventId: null,
    recurring: false,
    allDay: true,
    etag: null,
    updated: null,
    privateProps: campaignId
      ? { kinCampaignId: campaignId, kinSource: "activecampaign", kinSync: "kin-marketing" }
      : {},
  };
}

describe("marketing calendar sync actions", () => {
  it("applies creates and updates and only reports deletions", () => {
    const planned = planSyncActions({
      writes: [
        write(),
        write({ action: "update", campaignId: "43", googleEventId: "owned-1", reason: "campaign-name" }),
        write({ action: "delete", campaignId: "44", googleEventId: "owned-2", reason: "schedule-cleared" }),
      ],
      conflicts: [],
    });
    expect(planned.apply.map((item) => item.action)).toEqual(["create", "update"]);
    expect(planned.proposedDeletions).toEqual([
      expect.objectContaining({ campaignId: "44", googleEventId: "owned-2", reason: "schedule-cleared" }),
    ]);
  });

  it("does not create a second event when a manual event already matches", () => {
    const planned = planSyncActions({
      writes: [write(), write({ action: "update", campaignId: "43", googleEventId: "owned-1" })],
      conflicts: [
        {
          campaignId: "42",
          plannedTitle: "October What's New",
          plannedStart: "2026-10-15T09:00:00-07:00",
          manualEventId: "manual-1",
          manualSummary: "October What's New",
          manualStart: "2026-10-15",
          reason: "title",
        },
      ],
    });
    expect(planned.apply.map((item) => item.campaignId)).toEqual(["43"]);
    expect(planned.skippedConflicts).toEqual([
      expect.objectContaining({ campaignId: "42", manualSummary: "October What's New", reason: "title" }),
    ]);
  });

  it("refuses to change a manual event and does not insert anything first", async () => {
    const insertEvent = vi.fn(async () => ({ id: "new" }));
    const patchEvent = vi.fn(async () => undefined);
    await expect(
      applySyncActions(
        [
          write(),
          write({ action: "update", campaignId: "43", googleEventId: "manual-1" }),
        ],
        {
          getEvent: async () => listed(null),
          insertEvent,
          patchEvent,
        },
      ),
    ).rejects.toThrow(/not owned/);
    expect(insertEvent).not.toHaveBeenCalled();
    expect(patchEvent).not.toHaveBeenCalled();
  });

  it("updates an owned event and never deletes", async () => {
    const patchEvent = vi.fn(async () => undefined);
    const changes = await applySyncActions(
      [write({ action: "update", googleEventId: "google-1" })],
      {
        getEvent: async () => listed("42"),
        insertEvent: async () => ({ id: "new" }),
        patchEvent,
      },
    );
    expect(changes).toEqual([expect.objectContaining({ action: "update", campaignId: "42" })]);
    expect(patchEvent).toHaveBeenCalledOnce();
    const resource = patchEvent.mock.calls[0][1];
    expect(resource.start).toEqual({ date: "2026-10-15" });
    expect(resource.end).toEqual({ date: "2026-10-16" });
    expect(resource.summary).toBe("October What's New");
  });

  it("keeps the production schedule from writing until it is explicitly enabled", () => {
    expect(scheduledSyncIsLive({})).toBe(false);
    expect(scheduledSyncIsLive({ MARKETING_CALENDAR_SYNC_LIVE_ENABLED: "false" })).toBe(false);
    expect(scheduledSyncIsLive({ MARKETING_CALENDAR_SYNC_LIVE_ENABLED: "true" })).toBe(true);
  });
});
