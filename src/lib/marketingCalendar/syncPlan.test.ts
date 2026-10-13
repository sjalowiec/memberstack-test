import { describe, expect, it } from "vitest";

import { decideCampaign, type CampaignSnapshot } from "./campaignPlan";
import { EVENT_COLOR } from "./constants";
import { buildSyncPlan, findPossibleConflicts, type OwnedCalendarEvent } from "./syncPlan";

function campaign(overrides: Partial<CampaignSnapshot> = {}): CampaignSnapshot {
  return {
    id: "42",
    name: "October What's New",
    type: "single",
    status: "1",
    seriesId: null,
    automation: null,
    scheduledDate: "2026-10-15T09:00:00-07:00",
    sendDate: null,
    lastSendDate: null,
    messageId: "9",
    ...overrides,
  };
}

function owned(overrides: Partial<OwnedCalendarEvent> = {}): OwnedCalendarEvent {
  return {
    id: "google-1",
    summary: "Old title",
    description: "old",
    colorId: EVENT_COLOR.scheduled,
    start: new Date("2026-10-15T16:00:00.000Z"),
    startText: "2026-10-15T09:00:00-07:00",
    campaignId: "42",
    source: "activecampaign",
    sync: "kin-marketing",
    ...overrides,
  };
}

function planFor(
  snapshots: CampaignSnapshot[],
  ownedEvents: OwnedCalendarEvent[] = [],
  subjects: Record<string, string | null> = { "9": "What's New — October" },
) {
  return buildSyncPlan({
    decisions: snapshots.map((snapshot) => decideCampaign(snapshot, "America/Los_Angeles")),
    subjects: new Map(Object.entries(subjects)),
    ownedEvents,
    baseUrl: "https://knitbymachine.activehosted.com",
    calendarTimeZone: "America/Los_Angeles",
  });
}

describe("sync plan", () => {
  it("creates one event per new in-window campaign and uses the campaign name as the title", () => {
    const plan = planFor([campaign()]);
    expect(plan.counts.create).toBe(1);
    expect(plan.writes[0]).toMatchObject({
      action: "create",
      title: "October What's New",
      colorId: EVENT_COLOR.scheduled,
      timeSource: "scheduleddate",
    });
    expect(plan.writes[0]?.description).toContain("Subject: What's New — October");
    expect(plan.writes[0]?.description).toContain("Campaign ID: 42");
    expect(plan.writes[0]?.description).toContain(
      "https://knitbymachine.activehosted.com/app/campaigns/42",
    );
    expect(plan.writes[0]).toMatchObject({
      allDay: true,
      start: "2026-10-15",
      end: "2026-10-16",
      eventAt: "2026-10-15T09:00:00-07:00",
    });
    expect(plan.writes[0]?.description).toContain("Exact time: 2026-10-15T09:00:00-07:00");
    expect(plan.writes[0]?.description).toContain("Scheduled or sent: 2026-10-15 9:00:00 AM Pacific");
  });

  it("renames an imported event to the campaign name instead of creating a duplicate", () => {
    const plan = planFor([campaign()], [owned({ summary: "What's New — October" })]);
    expect(plan.counts).toMatchObject({ create: 0, update: 1, delete: 0, conflict: 0 });
    expect(plan.writes[0]).toMatchObject({
      action: "update",
      googleEventId: "google-1",
      title: "October What's New",
    });
    expect(plan.rows.find((row) => row.action === "update")).toMatchObject({
      previousTitle: "What's New — October",
      emailSubject: "What's New — October",
      reason: "campaign-name",
    });
    expect(plan.writes[0]?.description).toContain("Subject: What's New — October");
    expect(plan.writes[0]?.description).toContain("Campaign ID: 42");
    expect(plan.writes[0]?.description).toContain("Status: Scheduled");
    expect(plan.writes[0]?.description).toContain("Exact time: 2026-10-15T09:00:00-07:00");
  });

  it("updates an owned event when the status changes and does not create a second one", () => {
    const plan = planFor([campaign({ status: "5", scheduledDate: null, sendDate: "2026-10-16T09:00:00-07:00" })], [
      owned(),
    ]);
    expect(plan.counts.create).toBe(0);
    expect(plan.counts.update).toBe(1);
    expect(plan.writes[0]).toMatchObject({
      action: "update",
      googleEventId: "google-1",
      colorId: EVENT_COLOR.completed,
      timePreserved: false,
    });
  });

  it("removes a synced event when the schedule is cleared and keeps incomplete sent history", () => {
    const cleared = planFor(
      [campaign({ id: "15", status: "0", scheduledDate: null, messageId: null })],
      [owned({ id: "draft-event", campaignId: "15", colorId: EVENT_COLOR.draft })],
    );
    expect(cleared.writes).toEqual([
      expect.objectContaining({ action: "delete", googleEventId: "draft-event", campaignId: "15" }),
    ]);

    const incomplete = planFor(
      [campaign({ id: "16", status: "5", scheduledDate: "2026-10-03T09:00:00-07:00", sendDate: null, messageId: null })],
      [owned({ id: "sent-event", campaignId: "16", summary: "October What's New", colorId: EVENT_COLOR.completed })],
    );
    expect(incomplete.counts.delete).toBe(0);
    expect(incomplete.writes.every((write) => write.timePreserved)).toBe(true);
    expect(incomplete.rows.some((row) => row.action === "delete")).toBe(false);
  });

  it("does not touch a duplicate owned pair or an event whose campaign was not returned", () => {
    const plan = planFor(
      [campaign()],
      [owned({ id: "a" }), owned({ id: "b" }), owned({ id: "missing", campaignId: "99" })],
    );
    expect(plan.counts.create).toBe(0);
    expect(plan.counts.update).toBe(0);
    expect(plan.counts.delete).toBe(0);
    expect(plan.rows.map((row) => row.reason)).toEqual(
      expect.arrayContaining(["duplicate-owned-events", "owned-event-campaign-missing"]),
    );
  });

  it("flags a manual event with the same start time and never selects it for a write", () => {
    const plan = planFor([campaign()]);
    const conflicts = findPossibleConflicts(plan.rows, [
      {
        id: "manual-1",
        summary: "Tuesday reminder",
        start: new Date("2026-10-15T16:00:00.000Z"),
        startText: "2026-10-15T09:00:00-07:00",
        recurringEventId: "series-1",
        recurring: true,
        campaignId: null,
      },
    ]);
    expect(conflicts).toEqual([
      expect.objectContaining({ manualEventId: "manual-1", reason: "start-time" }),
    ]);
    expect(plan.writes.map((write) => write.googleEventId)).not.toContain("manual-1");
  });

  it("does not create an event for a completed campaign when the send date is missing", () => {
    const plan = planFor([
      campaign({
        status: "5",
        scheduledDate: "2026-10-02T08:00:00-07:00",
        sendDate: null,
        lastSendDate: null,
        messageId: null,
      }),
    ]);
    expect(plan.counts.create).toBe(0);
    expect(plan.counts.delete).toBe(0);
    expect(plan.skipReasons["send-date-missing"]).toBe(1);
  });

  it("skips a campaign before October 1 when no synced event exists", () => {
    const plan = planFor([
      campaign({ scheduledDate: "2026-09-15T09:00:00-07:00" }),
    ]);
    expect(plan.counts.create).toBe(0);
    expect(plan.skipReasons["before-window"]).toBe(1);
  });
});
