import { describe, expect, it } from "vitest";
import type { PatternActivityEvent } from "./patternActivityLog";
import {
  SUE_PATTERN_ACTIVITY_EMAIL,
  SUE_PATTERN_ACTIVITY_MEMBER_ID,
  buildPatternActivityUsage,
} from "./patternActivityUsage";

function event(partial: Partial<PatternActivityEvent> & Pick<PatternActivityEvent, "eventType" | "userId">): PatternActivityEvent {
  return {
    id: partial.id ?? partial.eventType + partial.userId,
    patternSystem: partial.patternSystem ?? "hat",
    createdAt: partial.createdAt ?? "2026-09-22T15:00:00.000Z",
    ...partial,
  };
}

const NOW = new Date("2026-09-24T16:00:00.000Z");

describe("buildPatternActivityUsage", () => {
  const events = [
    event({
      eventType: "pattern_generated",
      userId: "mem_a",
      userEmail: "a@example.com",
      patternSystem: "hat",
      patternTitle: "Beanie",
      patternId: "hat-1",
    }),
    event({
      eventType: "pattern_saved",
      userId: "mem_a",
      userEmail: "a@example.com",
      patternId: "proj-a",
      patternTitle: "Beanie",
      createdAt: "2026-09-22T16:00:00.000Z",
    }),
    event({
      eventType: "pattern_saved",
      userId: "mem_b",
      patternSystem: "socks",
      patternId: "proj-b",
      patternTitle: "Crew",
    }),
    event({
      eventType: "pattern_saved",
      userId: "mem_b",
      patternSystem: "socks",
      patternId: "proj-b",
      patternTitle: "Crew",
      createdAt: "2026-09-22T17:00:00.000Z",
    }),
    event({
      eventType: "pattern_opened",
      userId: "mem_a",
      userEmail: "a@example.com",
    }),
    event({
      eventType: "pattern_updated",
      userId: "mem_b",
      patternSystem: "socks",
      patternId: "proj-b",
      patternTitle: "Crew",
    }),
    event({ eventType: "pattern_printed", userId: "mem_a", userEmail: "a@example.com" }),
    event({
      eventType: "pattern_generated",
      userId: "guest_abc123",
      userEmail: "guest@example.com",
      patternSystem: "hat",
      patternTitle: "Guest hat",
    }),
    event({
      eventType: "pattern_generated",
      userId: SUE_PATTERN_ACTIVITY_MEMBER_ID,
      userEmail: SUE_PATTERN_ACTIVITY_EMAIL,
      patternSystem: "sleeveless",
      patternId: "sue-1",
      patternTitle: "Sue sleeveless",
    }),
    event({
      eventType: "pattern_generated",
      userId: "mem_old",
      createdAt: "2026-08-01T00:00:00.000Z",
      patternSystem: "hat",
    }),
  ];

  it("counts people, generations, distinct saves, and keeps anonymous visitors separate", () => {
    const report = buildPatternActivityUsage(
      events,
      { datePreset: "all", patternSystem: "", excludeSue: false },
      NOW,
    );
    expect(report.totalGenerations).toBe(4);
    expect(report.peopleWhoGeneratedOrSaved).toBe(4);
    expect(report.distinctSavedProjects).toBe(2);
    expect(report.opens).toBe(1);
    expect(report.edits).toBe(1);
    expect(report.prints).toBe(1);
    expect(report.people.map((person) => person.label)).toEqual([
      "Member",
      "a@example.com",
      SUE_PATTERN_ACTIVITY_EMAIL,
      "Member",
    ]);
    expect(report.people.every((person) => !person.label.startsWith("guest_"))).toBe(true);
    expect(report.anonymous).toHaveLength(1);
    expect(report.anonymous[0]?.label).toBe("guest@example.com");
    expect(report.anonymous[0]?.memberId).toBeUndefined();
    expect(JSON.stringify(report.anonymous)).not.toContain("guest_abc123");
  });

  it("excludes Sue and can filter by pattern system", () => {
    const report = buildPatternActivityUsage(
      events,
      { datePreset: "week", patternSystem: "socks", excludeSue: true },
      NOW,
    );
    expect(report.totalGenerations).toBe(0);
    expect(report.distinctSavedProjects).toBe(1);
    expect(report.people).toHaveLength(1);
    expect(report.people[0]?.patterns).toEqual(["Crew"]);
    expect(report.anonymous).toHaveLength(0);
  });
});
