import { describe, expect, it } from "vitest";

import { decideCampaign, normalizeCampaign, type CampaignSnapshot } from "./campaignPlan";
import { EVENT_COLOR } from "./constants";

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

describe("campaign decisions", () => {
  it("schedules a one-off campaign on its scheduled date in peacock", () => {
    const decision = decideCampaign(
      campaign({ sendDate: "2026-10-20T08:00:00-05:00" }),
      "America/Los_Angeles",
    );
    expect(decision.kind).toBe("upsert");
    if (decision.kind !== "upsert") return;
    expect(decision.colorId).toBe(EVENT_COLOR.scheduled);
    expect(decision.timeSource).toBe("scheduleddate");
    expect(decision.instant.toISOString()).toBe("2026-10-15T16:00:00.000Z");
  });

  it("uses sdate when a scheduled campaign has an empty scheduleddate", () => {
    const decision = decideCampaign(
      campaign({
        id: "2417",
        name: "TOW: Bust Darts",
        scheduledDate: null,
        sendDate: "2026-10-24T08:00:00-05:00",
      }),
      null,
    );
    expect(decision.kind).toBe("upsert");
    if (decision.kind !== "upsert") return;
    expect(decision.timeSource).toBe("sdate");
    expect(decision.instant.toISOString()).toBe("2026-10-24T13:00:00.000Z");
  });

  it("does not invent a date from cdate or mdate when both schedule fields are empty", () => {
    const normalized = normalizeCampaign({
      id: "2418",
      name: "No schedule",
      type: "single",
      status: "1",
      cdate: "2026-10-24T08:00:00-05:00",
      mdate: "2026-10-24T09:00:00-05:00",
      scheduleddate: null,
      sdate: "",
      ldate: null,
    });
    expect(normalized).toMatchObject({ scheduledDate: null, sendDate: null, lastSendDate: null });
    expect(decideCampaign(normalized!, null)).toMatchObject({
      kind: "preserve",
      reason: "scheduled-date-missing",
    });
    expect(
      decideCampaign(campaign({ scheduledDate: "2026-10-24", sendDate: "2026-10-24T08:00:00-05:00" }), null),
    ).toMatchObject({ kind: "preserve", reason: "scheduled-date-date-without-time" });
  });

  it("imports a dated draft in blue and leaves an undated draft without a date", () => {
    const dated = decideCampaign(
      campaign({ status: "0", scheduledDate: "2026-10-20T11:00:00-07:00" }),
      null,
    );
    expect(dated.kind).toBe("upsert");
    if (dated.kind === "upsert") expect(dated.colorId).toBe(EVENT_COLOR.draft);

    const undated = decideCampaign(
      campaign({ status: "0", scheduledDate: null, sendDate: null, lastSendDate: null }),
      null,
    );
    expect(undated).toMatchObject({ kind: "delete", reason: "schedule-cleared" });
  });

  it("uses the actual send date for a completed campaign and does not invent one", () => {
    const sent = decideCampaign(
      campaign({
        status: "5",
        scheduledDate: null,
        sendDate: "2026-10-02T08:15:00-07:00",
      }),
      null,
    );
    expect(sent.kind).toBe("upsert");
    if (sent.kind === "upsert") {
      expect(sent.colorId).toBe(EVENT_COLOR.completed);
      expect(sent.timeSource).toBe("sdate");
    }

    const incomplete = decideCampaign(
      campaign({ status: "5", scheduledDate: "2026-10-02T08:00:00-07:00", sendDate: null, lastSendDate: null }),
      null,
    );
    expect(incomplete).toMatchObject({ kind: "preserve", reason: "send-date-missing" });
  });

  it("shows paused and stopped campaigns as graphite instead of scheduled", () => {
    const paused = decideCampaign(campaign({ status: "3" }), null);
    expect(paused.kind).toBe("upsert");
    if (paused.kind === "upsert") expect(paused.colorId).toBe(EVENT_COLOR.paused);

    const stopped = decideCampaign(
      campaign({ status: "4", scheduledDate: null, sendDate: "2026-10-04T09:00:00-07:00" }),
      null,
    );
    expect(stopped.kind).toBe("upsert");
    if (stopped.kind === "upsert") {
      expect(stopped.colorId).toBe(EVENT_COLOR.stopped);
      expect(stopped.timeSource).toBe("sdate");
    }
  });

  it("keeps send history when a draft still has a send timestamp or an unparseable date", () => {
    expect(
      decideCampaign(campaign({ status: "0", scheduledDate: null, sendDate: "2026-10-02T08:00:00-07:00" }), null).kind,
    ).toBe("preserve");
    expect(
      decideCampaign(campaign({ status: "0", scheduledDate: "2026-10-15" }), null).kind,
    ).toBe("preserve");
    expect(
      decideCampaign(campaign({ status: "6", scheduledDate: "0000-00-00 00:00:00" }), null),
    ).toMatchObject({ kind: "delete", reason: "schedule-cleared" });
  });

  it("skips automations and campaigns before the import window are not dated from created time", () => {
    expect(decideCampaign(campaign({ type: "responder" }), null)).toMatchObject({
      kind: "skip",
      reason: "not-broadcast:responder",
    });
    expect(decideCampaign(campaign({ type: "single", seriesId: "8" }), null)).toMatchObject({
      kind: "skip",
      reason: "not-broadcast:series",
    });
    const normalized = normalizeCampaign({
      id: 7,
      name: "Old",
      type: "single",
      status: 0,
      cdate: "2026-10-15T09:00:00-07:00",
      scheduleddate: null,
      sdate: null,
      ldate: null,
    });
    expect(normalized?.id).toBe("7");
    expect(decideCampaign(normalized!, null).kind).toBe("delete");
  });
});
