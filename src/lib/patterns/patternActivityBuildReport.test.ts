import { describe, expect, it } from "vitest";
import type { PatternActivityEvent } from "./patternActivityLog";
import { patternActivitySystemLabel } from "./patternActivityReport";
import {
  SUE_PATTERN_ACTIVITY_EMAIL,
  SUE_PATTERN_ACTIVITY_MEMBER_ID,
  buildPatternBuildReport,
} from "./patternActivityUsage";

function event(
  partial: Partial<PatternActivityEvent> & Pick<PatternActivityEvent, "eventType" | "userId" | "patternSystem">,
): PatternActivityEvent {
  return {
    id: partial.id ?? `${partial.eventType}-${partial.userId}-${partial.patternSystem}`,
    createdAt: partial.createdAt ?? "2026-09-22T15:00:00.000Z",
    ...partial,
  };
}

const NOW = new Date("2026-09-24T16:00:00.000Z");
const ALL = { datePreset: "all" as const, patternSystem: "", excludeSue: false };

describe("pattern build report", () => {
  it("counts distinct identities who generated a pattern and ignores other actions", () => {
    const report = buildPatternBuildReport(
      [
        event({ eventType: "pattern_generated", userId: "mem_a", patternSystem: "sleeveless" }),
        event({ eventType: "pattern_generated", userId: "mem_a", patternSystem: "sleeveless", id: "repeat" }),
        event({ eventType: "pattern_generated", userId: "mem_b", patternSystem: "sleeveless" }),
        event({ eventType: "pattern_started", userId: "mem_c", patternSystem: "sleeveless" }),
        event({ eventType: "pattern_opened", userId: "mem_d", patternSystem: "sleeveless" }),
        event({ eventType: "pattern_saved", userId: "mem_e", patternSystem: "sleeveless", patternId: "p1" }),
        event({ eventType: "pattern_updated", userId: "mem_f", patternSystem: "sleeveless" }),
        event({ eventType: "pattern_printed", userId: "mem_g", patternSystem: "sleeveless" }),
        event({ eventType: "pattern_generated", userId: "mem_h", patternSystem: "drop-shoulder" }),
        event({ eventType: "pattern_generated", userId: "guest_sock", patternSystem: "socks" }),
      ],
      ALL,
      NOW,
    );
    expect(report.rows.map((row) => [row.key, row.label, row.peopleWhoBuilt, row.patternsGenerated])).toEqual([
      ["hat-guest", "Hat — guest identities", 0, 0],
      ["hat-signed-in", "Hat — signed-in people", 0, 0],
      ["sleeveless", patternActivitySystemLabel("sleeveless"), 2, 3],
      ["drop-shoulder", patternActivitySystemLabel("drop-shoulder"), 1, 1],
      ["socks", patternActivitySystemLabel("socks"), 1, 1],
    ]);
    expect(report.rows.find((row) => row.key === "sleeveless")?.label).toBe("Sleeveless");
    expect(report.rows.find((row) => row.key === "drop-shoulder")?.label).toBe("Drop Shoulder");
    expect(report.hatIdentityNotEstablished).toBeNull();
  });

  it("splits Hat generations into guest identities and signed-in people", () => {
    const report = buildPatternBuildReport(
      [
        event({ eventType: "pattern_generated", userId: "guest_a", patternSystem: "hat" }),
        event({ eventType: "pattern_generated", userId: "guest_a", patternSystem: "hat", id: "guest-repeat" }),
        event({ eventType: "pattern_generated", userId: "guest_b", patternSystem: "hat" }),
        event({ eventType: "pattern_generated", userId: "mem_hat", patternSystem: "hat" }),
        event({ eventType: "pattern_saved", userId: "mem_only_saved", patternSystem: "hat", patternId: "hat-1" }),
        event({ eventType: "pattern_opened", userId: "guest_only_open", patternSystem: "hat" }),
        event({ eventType: "pattern_generated", userId: "dev_local_pattern_user", patternSystem: "hat" }),
      ],
      ALL,
      NOW,
    );
    const guest = report.rows.find((row) => row.key === "hat-guest");
    const signedIn = report.rows.find((row) => row.key === "hat-signed-in");
    expect(guest).toMatchObject({ peopleWhoBuilt: 2, patternsGenerated: 3 });
    expect(signedIn).toMatchObject({ peopleWhoBuilt: 1, patternsGenerated: 1 });
    expect(report.hatIdentityNotEstablished).toMatchObject({
      peopleWhoBuilt: 1,
      patternsGenerated: 1,
    });
    expect(guest!.peopleWhoBuilt + signedIn!.peopleWhoBuilt).toBe(3);
  });

  it("applies the date range and Sue exclusion only to generation counts", () => {
    const events = [
      event({
        eventType: "pattern_generated",
        userId: SUE_PATTERN_ACTIVITY_MEMBER_ID,
        userEmail: SUE_PATTERN_ACTIVITY_EMAIL,
        patternSystem: "hat",
      }),
      event({ eventType: "pattern_generated", userId: "mem_keep", patternSystem: "socks" }),
      event({
        eventType: "pattern_generated",
        userId: "mem_old",
        patternSystem: "drop-shoulder",
        createdAt: "2026-08-01T00:00:00.000Z",
      }),
      event({ eventType: "pattern_generated", userId: "mem_week", patternSystem: "sleeveless" }),
    ];
    const excluded = buildPatternBuildReport(events, { ...ALL, excludeSue: true }, NOW);
    expect(excluded.rows.find((row) => row.key === "hat-signed-in")).toMatchObject({
      peopleWhoBuilt: 0,
      patternsGenerated: 0,
    });
    expect(excluded.rows.find((row) => row.key === "socks")).toMatchObject({
      peopleWhoBuilt: 1,
      patternsGenerated: 1,
    });
    const week = buildPatternBuildReport(
      events,
      { datePreset: "week", patternSystem: "", excludeSue: false },
      NOW,
    );
    expect(week.rows.find((row) => row.key === "drop-shoulder")).toMatchObject({
      peopleWhoBuilt: 0,
      patternsGenerated: 0,
    });
    expect(week.rows.find((row) => row.key === "hat-signed-in")?.peopleWhoBuilt).toBe(1);
    expect(week.rows.find((row) => row.key === "sleeveless")?.peopleWhoBuilt).toBe(1);
  });

  it("keeps generation events for any other identifier out of the four rows", () => {
    const report = buildPatternBuildReport(
      [
        event({ eventType: "pattern_generated", userId: "mem_side", patternSystem: "sideways-cardigan" }),
        event({ eventType: "pattern_started", userId: "mem_side", patternSystem: "sideways-cardigan", id: "start" }),
        event({ eventType: "pattern_generated", userId: "mem_blank", patternSystem: "  " }),
      ],
      ALL,
      NOW,
    );
    expect(report.rows.every((row) => row.patternsGenerated === 0)).toBe(true);
    expect(report.otherPatterns.map((row) => [row.key, row.peopleWhoBuilt, row.patternsGenerated])).toEqual([
      ["(blank)", 1, 1],
      ["sideways-cardigan", 1, 1],
    ]);
  });
});
