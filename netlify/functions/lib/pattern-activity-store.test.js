import { describe, expect, it } from "vitest";
import {
  activityEventKey,
  ACTIVITY_EVENT_PREFIX,
  normalizeActivityEvent,
} from "./pattern-activity-store.js";

describe("normalizeActivityEvent", () => {
  it("normalizes an event with required fields and authoritative userId", () => {
    const result = normalizeActivityEvent(
      {
        userId: "client-claimed-id",
        eventType: "pattern_saved",
        patternSystem: "sleeveless",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      "mem_server_authoritative",
    );

    expect(result.ok).toBe(true);
    expect(result.event.userId).toBe("mem_server_authoritative");
    expect(result.event.eventType).toBe("pattern_saved");
    expect(result.event.patternSystem).toBe("sleeveless");
    expect(typeof result.event.id).toBe("string");
  });

  it("keeps small optional metadata", () => {
    const result = normalizeActivityEvent(
      {
        eventType: "pattern_opened",
        patternSystem: "sleeveless",
        metadata: { action: "view" },
      },
      "mem_1",
    );

    expect(result.ok).toBe(true);
    expect(result.event.metadata).toEqual({ action: "view" });
  });

  it("omits missing optional fields", () => {
    const result = normalizeActivityEvent(
      { eventType: "pattern_started", patternSystem: "sleeveless" },
      "mem_1",
    );

    expect(result.ok).toBe(true);
    expect(result.event).not.toHaveProperty("userEmail");
    expect(result.event).not.toHaveProperty("patternId");
    expect(result.event).not.toHaveProperty("patternTitle");
    expect(result.event).not.toHaveProperty("metadata");
  });

  it("rejects unknown event types and missing user id", () => {
    expect(
      normalizeActivityEvent(
        { eventType: "pattern_exploded", patternSystem: "sleeveless" },
        "mem_1",
      ).ok,
    ).toBe(false);
    expect(
      normalizeActivityEvent({ eventType: "pattern_saved", patternSystem: "sleeveless" }, "").ok,
    ).toBe(false);
  });

  it("defaults patternSystem to unknown when absent", () => {
    const result = normalizeActivityEvent({ eventType: "pattern_printed" }, "mem_1");
    expect(result.ok).toBe(true);
    expect(result.event.patternSystem).toBe("unknown");
  });

  it("keeps only free or member membership values", () => {
    const kept = normalizeActivityEvent(
      {
        eventType: "pattern_generated",
        patternSystem: "hat",
        metadata: { membership: "member", extra: true },
      },
      "mem_1",
    );
    expect(kept.ok).toBe(true);
    expect(kept.event.metadata).toEqual({ membership: "member", extra: true });

    const dropped = normalizeActivityEvent(
      {
        eventType: "pattern_generated",
        patternSystem: "hat",
        metadata: { membership: "premium" },
      },
      "mem_1",
    );
    expect(dropped.ok).toBe(true);
    expect(dropped.event.metadata).toEqual({});
  });
});

describe("activityEventKey", () => {
  it("buckets the key by created date and id", () => {
    const key = activityEventKey({ id: "abc", createdAt: "2026-03-04T12:00:00.000Z" });
    expect(key).toBe(`${ACTIVITY_EVENT_PREFIX}2026-03-04/abc.json`);
  });
});
