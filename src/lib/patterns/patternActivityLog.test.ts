import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./customPatternProjectAuth", () => ({
  resolveCustomPatternProjectAuth: vi.fn(),
  authHeadersForCustomPatternProjects: (auth: {
    mode: string;
    memberId?: string;
    bearerToken?: string;
  }) =>
    auth.mode === "member" && auth.bearerToken
      ? { Authorization: `Bearer ${auth.bearerToken}` }
      : {},
}));

import {
  createPatternActivityEvent,
  isPatternActivityAdminProbeOk,
  logPatternActivity,
  summarizePatternActivity,
  type PatternActivityEvent,
} from "./patternActivityLog";
import { resolveCustomPatternProjectAuth } from "./customPatternProjectAuth";

const resolveAuthMock = vi.mocked(resolveCustomPatternProjectAuth);

describe("isPatternActivityAdminProbeOk", () => {
  it("treats a clean 200 { ok: true } as admin", () => {
    expect(isPatternActivityAdminProbeOk(200, { ok: true, events: [] })).toBe(true);
  });

  it("fails closed for 403, other statuses, and malformed/non-ok bodies", () => {
    expect(isPatternActivityAdminProbeOk(403, { ok: false })).toBe(false);
    expect(isPatternActivityAdminProbeOk(500, { ok: true })).toBe(false);
    expect(isPatternActivityAdminProbeOk(200, { ok: false })).toBe(false);
    expect(isPatternActivityAdminProbeOk(200, {})).toBe(false);
    expect(isPatternActivityAdminProbeOk(200, null)).toBe(false);
  });
});

describe("createPatternActivityEvent", () => {
  it("creates an event with all required fields", () => {
    const event = createPatternActivityEvent({
      userId: "mem_123",
      eventType: "pattern_saved",
      patternSystem: "sleeveless",
    });

    expect(event.userId).toBe("mem_123");
    expect(event.eventType).toBe("pattern_saved");
    expect(event.patternSystem).toBe("sleeveless");
    expect(typeof event.id).toBe("string");
    expect(event.id.length).toBeGreaterThan(0);
    expect(typeof event.createdAt).toBe("string");
    expect(Number.isNaN(new Date(event.createdAt).getTime())).toBe(false);
  });

  it("includes optional metadata when provided", () => {
    const event = createPatternActivityEvent({
      userId: "mem_123",
      eventType: "pattern_opened",
      patternSystem: "sleeveless",
      metadata: { action: "view", source: "account" },
    });

    expect(event.metadata).toEqual({ action: "view", source: "account" });
  });

  it("omits empty metadata and missing optional fields", () => {
    const event = createPatternActivityEvent({
      userId: "mem_123",
      eventType: "pattern_started",
      patternSystem: "sleeveless",
      metadata: {},
      userEmail: "   ",
      patternTitle: "",
    });

    expect(event).not.toHaveProperty("metadata");
    expect(event).not.toHaveProperty("userEmail");
    expect(event).not.toHaveProperty("patternId");
    expect(event).not.toHaveProperty("patternTitle");
    expect(event).not.toHaveProperty("mode");
  });

  it("keeps provided optional fields (trimmed)", () => {
    const event = createPatternActivityEvent({
      userId: "mem_123",
      eventType: "pattern_generated",
      patternSystem: "sleeveless",
      userEmail: " knitter@example.com ",
      patternId: "proj_9",
      patternTitle: " My Tank ",
      mode: "express",
      sourcePage: "/patterns/sleeveless/review",
    });

    expect(event.userEmail).toBe("knitter@example.com");
    expect(event.patternId).toBe("proj_9");
    expect(event.patternTitle).toBe("My Tank");
    expect(event.mode).toBe("express");
    expect(event.sourcePage).toBe("/patterns/sleeveless/review");
  });

  it("throws when a required field is missing or eventType is unknown", () => {
    expect(() =>
      createPatternActivityEvent({
        userId: "",
        eventType: "pattern_saved",
        patternSystem: "sleeveless",
      }),
    ).toThrow();
    expect(() =>
      createPatternActivityEvent({
        userId: "mem_1",
        eventType: "pattern_saved",
        patternSystem: "",
      }),
    ).toThrow();
    expect(() =>
      createPatternActivityEvent({
        userId: "mem_1",
        // @ts-expect-error invalid event type for the test
        eventType: "pattern_exploded",
        patternSystem: "sleeveless",
      }),
    ).toThrow();
  });
});

describe("summarizePatternActivity", () => {
  const events: PatternActivityEvent[] = [
    {
      id: "1",
      userId: "a",
      eventType: "pattern_saved",
      patternSystem: "sleeveless",
      createdAt: "2026-01-01T10:00:00.000Z",
    },
    {
      id: "2",
      userId: "a",
      eventType: "pattern_generated",
      patternSystem: "sleeveless",
      createdAt: "2026-01-02T10:00:00.000Z",
    },
    {
      id: "3",
      userId: "b",
      eventType: "pattern_generated",
      patternSystem: "hat",
      createdAt: "2026-01-03T10:00:00.000Z",
    },
    {
      id: "4",
      userId: "b",
      eventType: "pattern_saved",
      patternSystem: "hat",
      createdAt: "2026-01-04T10:00:00.000Z",
    },
  ];

  it("computes totals, unique users, and event-type counts", () => {
    const summary = summarizePatternActivity(events);
    expect(summary.totalEvents).toBe(4);
    expect(summary.uniqueUsers).toBe(2);
    expect(summary.generatedCount).toBe(2);
    expect(summary.savedCount).toBe(2);
  });

  it("returns recent events newest-first and honors recentLimit", () => {
    const summary = summarizePatternActivity(events, { recentLimit: 2 });
    expect(summary.recentEvents.map((e) => e.id)).toEqual(["4", "3"]);
  });

  it("ignores malformed entries", () => {
    const summary = summarizePatternActivity([
      ...events,
      null,
      { id: "x" },
      "not-an-event",
    ]);
    expect(summary.totalEvents).toBe(4);
  });
});

describe("logPatternActivity", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    resolveAuthMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("skips logging when no user is signed in", async () => {
    resolveAuthMock.mockResolvedValue({ mode: "none" });
    const sent = await logPatternActivity({
      eventType: "pattern_saved",
      patternSystem: "sleeveless",
    });
    expect(sent).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts an event for a signed-in member", async () => {
    resolveAuthMock.mockResolvedValue({
      mode: "member",
      memberId: "mem_42",
      bearerToken: "test-jwt",
    });
    fetchMock.mockResolvedValue({ ok: true });

    const sent = await logPatternActivity({
      eventType: "pattern_saved",
      patternSystem: "sleeveless",
      patternId: "proj_1",
    });

    expect(sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.userId).toBe("mem_42");
    expect(body.eventType).toBe("pattern_saved");
    expect(body.patternId).toBe("proj_1");
    expect(body.metadata.membership).toBe("free");
    expect(init.headers.Authorization).toBe("Bearer test-jwt");
    expect(init.headers["X-KBM-Member-Id"]).toBeUndefined();
  });

  it("records explicit member membership on the event", async () => {
    resolveAuthMock.mockResolvedValue({
      mode: "member",
      memberId: "mem_42",
      bearerToken: "test-jwt",
    });
    fetchMock.mockResolvedValue({ ok: true });

    await logPatternActivity({
      eventType: "pattern_generated",
      patternSystem: "hat",
      membership: "member",
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.metadata.membership).toBe("member");
  });

  it("posts a guest Hat event without a signed-in user", async () => {
    resolveAuthMock.mockResolvedValue({ mode: "none" });
    fetchMock.mockResolvedValue({ ok: true });

    const sent = await logPatternActivity({
      eventType: "pattern_generated",
      patternSystem: "hat",
      guestEmail: "guest@example.com",
      membership: "free",
    });

    expect(sent).toBe(true);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.userId).toMatch(/^guest_[a-f0-9]{16}$/);
    expect(body.userId).not.toContain("guest@example.com");
    expect(body.userEmail).toBe("guest@example.com");
    expect(body.metadata.membership).toBe("free");
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("never throws when the request fails (save/update flow keeps working)", async () => {
    resolveAuthMock.mockResolvedValue({
      mode: "member",
      memberId: "mem_42",
      bearerToken: "test-jwt",
    });
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(
      logPatternActivity({ eventType: "pattern_updated", patternSystem: "sleeveless" }),
    ).resolves.toBe(false);
  });

  it("returns false on a non-ok response without throwing", async () => {
    resolveAuthMock.mockResolvedValue({
      mode: "member",
      memberId: "mem_42",
      bearerToken: "test-jwt",
    });
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    await expect(
      logPatternActivity({ eventType: "pattern_printed", patternSystem: "sleeveless" }),
    ).resolves.toBe(false);
  });
});
