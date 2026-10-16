import { describe, expect, it } from "vitest";
import type { PatternActivityEvent } from "./patternActivityLog";
import {
  SUE_PATTERN_ACTIVITY_EMAIL,
  SUE_PATTERN_ACTIVITY_MEMBER_ID,
  buildPatternActivityUsage,
  buildWatsonPatternActivityReport,
  excludeSuePatternActivity,
  isSuePatternActivityEvent,
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

  it("excludes Sue by verified account id before every total, not by display name or email", () => {
    const rows = [
      event({
        eventType: "pattern_generated",
        userId: SUE_PATTERN_ACTIVITY_MEMBER_ID,
        userEmail: "Owner",
        patternTitle: "Owner tank",
        patternId: "sue-gen",
      }),
      event({
        eventType: "pattern_saved",
        userId: SUE_PATTERN_ACTIVITY_MEMBER_ID,
        patternId: "sue-proj",
        patternTitle: "Owner tank",
      }),
      event({ eventType: "pattern_opened", userId: SUE_PATTERN_ACTIVITY_MEMBER_ID }),
      event({ eventType: "pattern_updated", userId: SUE_PATTERN_ACTIVITY_MEMBER_ID }),
      event({ eventType: "pattern_printed", userId: SUE_PATTERN_ACTIVITY_MEMBER_ID }),
      event({
        eventType: "pattern_generated",
        userId: "mem_stamped",
        userEmail: "not-sue@example.com",
        metadata: { memberId: SUE_PATTERN_ACTIVITY_MEMBER_ID },
        patternId: "stamped",
      }),
      event({
        eventType: "pattern_generated",
        userId: "mem_named_sue",
        userEmail: "Sue",
        patternTitle: "Sue",
        patternId: "named",
      }),
      event({
        eventType: "pattern_saved",
        userId: "mem_named_sue",
        userEmail: SUE_PATTERN_ACTIVITY_EMAIL,
        patternId: "named-proj",
        patternTitle: "Sue",
      }),
      event({
        eventType: "pattern_opened",
        userId: "mem_named_sue",
        userEmail: "Sue",
      }),
    ];

    expect(isSuePatternActivityEvent(rows[0]!)).toBe(true);
    expect(isSuePatternActivityEvent(rows[5]!)).toBe(true);
    expect(isSuePatternActivityEvent(rows[6]!)).toBe(false);
    expect(excludeSuePatternActivity(false)).toBe(true);
    expect(excludeSuePatternActivity(true)).toBe(false);

    const excluded = buildPatternActivityUsage(
      rows,
      { datePreset: "all", patternSystem: "", excludeSue: excludeSuePatternActivity(false) },
      NOW,
    );
    expect(excluded.totalGenerations).toBe(1);
    expect(excluded.peopleWhoGeneratedOrSaved).toBe(1);
    expect(excluded.distinctSavedProjects).toBe(1);
    expect(excluded.opens).toBe(1);
    expect(excluded.edits).toBe(0);
    expect(excluded.prints).toBe(0);
    expect(excluded.people.map((person) => person.memberId)).toEqual(["mem_named_sue"]);
    expect(JSON.stringify(excluded)).not.toContain(SUE_PATTERN_ACTIVITY_MEMBER_ID);

    const included = buildPatternActivityUsage(
      rows,
      { datePreset: "all", patternSystem: "", excludeSue: excludeSuePatternActivity(true) },
      NOW,
    );
    expect(included.totalGenerations).toBe(3);
    expect(included.peopleWhoGeneratedOrSaved).toBe(3);
    expect(included.opens).toBe(2);
    expect(included.edits).toBe(1);
    expect(included.prints).toBe(1);
  });

  it("starts on the current Los Angeles month without Sue, and keeps each override", () => {
    const now = new Date("2026-10-16T17:00:00.000Z");
    const rows = [
      event({
        eventType: "pattern_generated",
        userId: "mem_member",
        userEmail: "member@example.com",
        createdAt: "2026-10-02T18:00:00.000Z",
        patternTitle: "October hat",
      }),
      event({
        eventType: "pattern_generated",
        userId: SUE_PATTERN_ACTIVITY_MEMBER_ID,
        userEmail: "Sue",
        createdAt: "2026-10-03T18:00:00.000Z",
        patternTitle: "Sue October",
      }),
      event({
        eventType: "pattern_saved",
        userId: "mem_earlier",
        userEmail: "earlier@example.com",
        createdAt: "2026-09-15T18:00:00.000Z",
        patternId: "sept",
        patternTitle: "September",
      }),
      event({
        eventType: "pattern_generated",
        userId: "mem_named_sue",
        userEmail: "Sue",
        createdAt: "2026-10-04T18:00:00.000Z",
        patternTitle: "Another Sue",
      }),
      event({
        eventType: "pattern_printed",
        userId: SUE_PATTERN_ACTIVITY_MEMBER_ID,
        createdAt: "2026-09-20T18:00:00.000Z",
        patternTitle: "Sue September",
      }),
    ];

    const initial = buildWatsonPatternActivityReport(
      rows,
      { datePreset: "month", patternSystem: "", includeSue: false },
      now,
    );
    expect(initial.range).toEqual({
      fromIso: "2026-10-01T07:00:00.000Z",
      toIso: "2026-10-17T06:59:59.999Z",
    });
    expect(initial.report.totalGenerations).toBe(2);
    expect(initial.report.people.map((person) => person.memberId).sort()).toEqual([
      "mem_member",
      "mem_named_sue",
    ]);
    expect(JSON.stringify(initial.report)).not.toContain(SUE_PATTERN_ACTIVITY_MEMBER_ID);
    expect(JSON.stringify(initial.report)).not.toContain("September");

    const includeSueSameMonth = buildWatsonPatternActivityReport(
      rows,
      { datePreset: "month", patternSystem: "", includeSue: true },
      now,
    );
    expect(includeSueSameMonth.report.people.map((person) => person.memberId).sort()).toEqual([
      SUE_PATTERN_ACTIVITY_MEMBER_ID,
      "mem_member",
      "mem_named_sue",
    ]);
    expect(JSON.stringify(includeSueSameMonth.report)).not.toContain("Sue September");

    const allWithoutSue = buildWatsonPatternActivityReport(
      rows,
      { datePreset: "all", patternSystem: "", includeSue: true },
      now,
    );
    const stillIncludedAfterDateChange = buildWatsonPatternActivityReport(
      rows,
      { datePreset: "all", patternSystem: "hat", includeSue: true },
      now,
    );
    expect(allWithoutSue.report.prints).toBe(1);
    expect(stillIncludedAfterDateChange.report.people.map((person) => person.memberId)).toContain(
      SUE_PATTERN_ACTIVITY_MEMBER_ID,
    );

    const allStoredWithoutSue = buildWatsonPatternActivityReport(
      rows,
      { datePreset: "all", patternSystem: "", includeSue: false },
      now,
    );
    expect(allStoredWithoutSue.report.distinctSavedProjects).toBe(1);
    expect(JSON.stringify(allStoredWithoutSue.report)).not.toContain(SUE_PATTERN_ACTIVITY_MEMBER_ID);

    const custom = buildWatsonPatternActivityReport(
      rows,
      {
        datePreset: "custom",
        customFrom: "2026-09-01",
        customTo: "2026-09-30",
        patternSystem: "",
        includeSue: false,
      },
      now,
    );
    expect(custom.report.people.map((person) => person.label)).toEqual(["earlier@example.com"]);
    expect(custom.report.prints).toBe(0);
  });
});
