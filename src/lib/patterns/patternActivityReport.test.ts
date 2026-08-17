import { describe, expect, it } from "vitest";
import type { PatternActivityEvent } from "./patternActivityLog";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  activityMembershipDisplay,
  dateRangeForPreset,
  filterPatternActivityEvents,
  PATTERN_ACTIVITY_FILTER_SYSTEMS,
  patternActivitySystemFilterOptions,
  sortPatternActivityEvents,
} from "./patternActivityReport";

function event(
  overrides: Partial<PatternActivityEvent> & Pick<PatternActivityEvent, "id" | "createdAt">,
): PatternActivityEvent {
  return {
    userId: "u",
    eventType: "pattern_generated",
    patternSystem: "sleeveless",
    ...overrides,
  };
}

const events: PatternActivityEvent[] = [
  event({
    id: "1",
    createdAt: "2026-08-17T15:00:00.000Z",
    userEmail: "b@example.com",
    patternSystem: "hat",
    patternTitle: "Beanie",
    eventType: "pattern_generated",
    metadata: { membership: "free" },
  }),
  event({
    id: "2",
    createdAt: "2026-08-16T15:00:00.000Z",
    userEmail: "a@example.com",
    patternSystem: "sleeveless",
    patternTitle: "Tank",
    eventType: "pattern_saved",
    metadata: { membership: "member" },
  }),
  event({
    id: "3",
    createdAt: "2026-08-10T15:00:00.000Z",
    userEmail: "c@example.com",
    patternSystem: "drop-shoulder",
    patternTitle: "Drop",
    eventType: "pattern_opened",
  }),
];

describe("patternActivityReport", () => {
  it("builds today / week / month ranges from a local now", () => {
    const now = new Date(2026, 7, 17, 12, 0, 0);
    const today = dateRangeForPreset("today", now);
    expect(today.fromIso).toBe(new Date(2026, 7, 17, 0, 0, 0, 0).toISOString());
    expect(today.toIso).toBe(new Date(2026, 7, 17, 23, 59, 59, 999).toISOString());

    const week = dateRangeForPreset("week", now);
    expect(week.fromIso).toBe(new Date(2026, 7, 16, 0, 0, 0, 0).toISOString());

    const month = dateRangeForPreset("month", now);
    expect(month.fromIso).toBe(new Date(2026, 7, 1, 0, 0, 0, 0).toISOString());

    expect(dateRangeForPreset("all", now)).toEqual({});
  });

  it("supports a custom date range", () => {
    const range = dateRangeForPreset("custom", new Date(), {
      from: "2026-08-01",
      to: "2026-08-17",
    });
    expect(range.fromIso).toBe(new Date(2026, 7, 1, 0, 0, 0, 0).toISOString());
    expect(range.toIso).toBe(new Date(2026, 7, 17, 23, 59, 59, 999).toISOString());
  });

  it("filters by date, pattern system, membership, and event type", () => {
    const now = new Date(2026, 7, 17, 12, 0, 0);
    const weekHat = filterPatternActivityEvents(
      events,
      {
        datePreset: "week",
        patternSystem: "hat",
        membership: "all",
        eventType: "",
      },
      now,
    );
    expect(weekHat.map((row) => row.id)).toEqual(["1"]);

    const members = filterPatternActivityEvents(events, {
      datePreset: "all",
      patternSystem: "",
      membership: "member",
      eventType: "",
    });
    expect(members.map((row) => row.id)).toEqual(["2"]);

    const unknown = filterPatternActivityEvents(events, {
      datePreset: "all",
      patternSystem: "",
      membership: "unknown",
      eventType: "",
    });
    expect(unknown.map((row) => row.id)).toEqual(["3"]);

    const generated = filterPatternActivityEvents(events, {
      datePreset: "all",
      patternSystem: "",
      membership: "all",
      eventType: "pattern_generated",
    });
    expect(generated.map((row) => row.id)).toEqual(["1"]);
  });

  it("sorts by created, email, membership, event, system, and title", () => {
    expect(sortPatternActivityEvents(events, "createdAt", "desc").map((row) => row.id)).toEqual([
      "1",
      "2",
      "3",
    ]);
    expect(sortPatternActivityEvents(events, "userEmail", "asc").map((row) => row.id)).toEqual([
      "2",
      "1",
      "3",
    ]);
    expect(sortPatternActivityEvents(events, "membership", "asc").map((row) => row.id)).toEqual([
      "1",
      "2",
      "3",
    ]);
    expect(sortPatternActivityEvents(events, "patternSystem", "asc").map((row) => row.id)).toEqual([
      "3",
      "1",
      "2",
    ]);
    expect(sortPatternActivityEvents(events, "patternTitle", "asc").map((row) => row.id)).toEqual([
      "1",
      "3",
      "2",
    ]);
    expect(sortPatternActivityEvents(events, "eventType", "asc").map((row) => row.id)).toEqual([
      "1",
      "3",
      "2",
    ]);
  });

  it("always offers Hat, Sleeveless, and Drop Shoulder even when events are sleeveless-only", () => {
    const sleevelessOnly = events.filter((row) => row.patternSystem === "sleeveless");
    expect(PATTERN_ACTIVITY_FILTER_SYSTEMS).toEqual(["hat", "sleeveless", "drop-shoulder"]);
    expect(patternActivitySystemFilterOptions(sleevelessOnly).map((row) => row.value)).toEqual([
      "drop-shoulder",
      "hat",
      "sleeveless",
    ]);
    expect(patternActivitySystemFilterOptions([]).map((row) => row.label)).toEqual([
      "Drop Shoulder",
      "Hat",
      "Sleeveless",
    ]);
    const adminPage = readFileSync(resolve("src/pages/admin/index.astro"), "utf8");
    expect(adminPage).toContain('value="hat"');
    expect(adminPage).toContain('value="sleeveless"');
    expect(adminPage).toContain('value="drop-shoulder"');
    expect(adminPage).toContain("patternActivitySystemFilterOptions");
  });

  it("displays historical membership as Unknown", () => {
    expect(activityMembershipDisplay(events[2])).toBe("Unknown");
    expect(activityMembershipDisplay(events[0])).toBe("Free");
    expect(activityMembershipDisplay(events[1])).toBe("Member");
  });
});
