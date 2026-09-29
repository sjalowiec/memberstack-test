import { describe, expect, it } from "vitest";
import type { PatternActivityEvent } from "./patternActivityLog";
import { PATTERN_SYSTEM_IDS } from "./patternSystemId";
import { patternActivitySystemLabel } from "./patternActivityReport";
import {
  SUE_PATTERN_ACTIVITY_EMAIL,
  SUE_PATTERN_ACTIVITY_MEMBER_ID,
  buildPatternActivityPatternSummary,
  buildPatternActivityUsage,
  patternActivityPatternGroup,
  patternActivityPersonIdentity,
} from "./patternActivityUsage";

function event(
  partial: Partial<PatternActivityEvent> & Pick<PatternActivityEvent, "eventType" | "userId">,
): PatternActivityEvent {
  return {
    id: partial.id ?? `${partial.eventType}-${partial.userId}-${partial.patternSystem ?? "x"}`,
    patternSystem: partial.patternSystem ?? "hat",
    createdAt: partial.createdAt ?? "2026-09-22T15:00:00.000Z",
    ...partial,
  };
}

const NOW = new Date("2026-09-24T16:00:00.000Z");
const ALL = { datePreset: "all" as const, patternSystem: "", excludeSue: false };

describe("pattern activity pattern summary", () => {
  it("maps known identifiers and keeps unmapped identifiers in one Unknown row", () => {
    const summary = buildPatternActivityPatternSummary(
      [
        event({ eventType: "pattern_generated", userId: "mem_hat", patternSystem: "hat" }),
        event({ eventType: "pattern_generated", userId: "mem_drop", patternSystem: "drop-shoulder" }),
        event({ eventType: "pattern_saved", userId: "mem_blanket", patternSystem: "blanket", patternId: "b1" }),
        event({ eventType: "pattern_opened", userId: "mem_socks", patternSystem: "socks" }),
        event({ eventType: "pattern_updated", userId: "mem_sleeve", patternSystem: "sleeveless" }),
        event({ eventType: "pattern_printed", userId: "mem_side", patternSystem: "sideways-cardigan" }),
        event({ eventType: "pattern_generated", userId: "mem_rag", patternSystem: "raglan" }),
        event({
          eventType: "pattern_generated",
          userId: "mem_mystery",
          patternSystem: "not-a-pattern",
        }),
        event({
          eventType: "pattern_generated",
          userId: "mem_blank",
          patternSystem: "  ",
        }),
        event({
          eventType: "pattern_opened",
          userId: "guest_abc",
          patternSystem: "unknown",
        }),
      ],
      ALL,
      NOW,
    );

    const byId = new Map(summary.rows.flatMap((row) => row.identifiers.map((id) => [id, row] as const)));
    for (const id of PATTERN_SYSTEM_IDS) {
      const row = byId.get(id);
      expect(row?.label).toBe(patternActivitySystemLabel(id));
      expect(row?.group).toBe(id === "hat" ? "free-hat" : "member-pattern");
    }
    const unknown = summary.rows.find((row) => row.group === "unknown");
    expect(unknown?.label).toBe("Unknown");
    expect(unknown?.identifiers).toEqual(["(blank)", "not-a-pattern", "unknown"]);
    expect(unknown?.generations).toBe(2);
    expect(unknown?.opens).toBe(1);
    expect(summary.memberPatterns.generations).toBe(2);
    expect(summary.freeHat.generations).toBe(1);
    expect(summary.unknown.generations).toBe(2);
    expect(summary.rows.some((row) => row.identifiers.includes("not-a-pattern") && row.group !== "unknown")).toBe(
      false,
    );
  });

  it("sorts by signed-in people, then generations", () => {
    const summary = buildPatternActivityPatternSummary(
      [
        event({ eventType: "pattern_generated", userId: "mem_a", patternSystem: "hat" }),
        event({ eventType: "pattern_generated", userId: "mem_b", patternSystem: "hat" }),
        event({ eventType: "pattern_generated", userId: "mem_c", patternSystem: "hat" }),
        event({ eventType: "pattern_generated", userId: "mem_a", patternSystem: "socks" }),
        event({ eventType: "pattern_generated", userId: "mem_b", patternSystem: "socks" }),
        event({ eventType: "pattern_generated", userId: "mem_c", patternSystem: "socks" }),
        event({ eventType: "pattern_generated", userId: "mem_c", patternSystem: "socks" }),
        event({ eventType: "pattern_generated", userId: "mem_d", patternSystem: "blanket" }),
        event({ eventType: "pattern_generated", userId: "mem_e", patternSystem: "blanket" }),
        event({ eventType: "pattern_generated", userId: "mem_d", patternSystem: "sleeveless", id: "extra-gen" }),
        event({ eventType: "pattern_generated", userId: "mem_d", patternSystem: "sleeveless" }),
        event({ eventType: "pattern_generated", userId: "mem_e", patternSystem: "sleeveless" }),
        event({ eventType: "pattern_generated", userId: "mem_f", patternSystem: "sleeveless" }),
        event({ eventType: "pattern_generated", userId: "mem_g", patternSystem: "sleeveless" }),
        event({ eventType: "pattern_generated", userId: "mem_h", patternSystem: "sleeveless" }),
      ],
      ALL,
      NOW,
    );
    expect(summary.rows.map((row) => [row.label, row.signedInPeople, row.generations])).toEqual([
      ["Sleeveless", 5, 6],
      ["Socks", 3, 4],
      ["Hat", 3, 3],
      ["Blanket", 2, 2],
    ]);
  });

  it("keeps guest Hat activity out of signed-in people and does not treat other patterns as paid access", () => {
    const summary = buildPatternActivityPatternSummary(
      [
        event({
          eventType: "pattern_generated",
          userId: "mem_member_hat",
          patternSystem: "hat",
          metadata: { membership: "member" },
        }),
        event({
          eventType: "pattern_generated",
          userId: "guest_hat",
          userEmail: "guest@example.com",
          patternSystem: "hat",
        }),
        event({
          eventType: "pattern_saved",
          userId: "dev_local_pattern_user",
          patternSystem: "hat",
          patternId: "local-hat",
        }),
        event({
          eventType: "pattern_generated",
          userId: "guest_socks",
          patternSystem: "socks",
        }),
        event({
          eventType: "pattern_opened",
          userId: "mem_only_open",
          patternSystem: "sleeveless",
        }),
      ],
      ALL,
      NOW,
    );
    expect(patternActivityPersonIdentity("mem_member_hat")).toBe("signed-in");
    expect(patternActivityPersonIdentity("guest_hat")).toBe("guest");
    expect(patternActivityPersonIdentity("dev_local_pattern_user")).toBe("not-established");
    expect(patternActivityPatternGroup("hat")).toBe("free-hat");
    expect(patternActivityPatternGroup("socks")).toBe("member-pattern");
    expect(summary.freeHat.signedInPeople).toBe(1);
    expect(summary.freeHat.guestPeople).toBe(1);
    expect(summary.freeHat.identityNotEstablished).toBe(1);
    expect(summary.freeHat.generations).toBe(2);
    expect(summary.freeHat.distinctSavedProjects).toBe(1);
    expect(summary.memberPatterns.signedInPeople).toBe(0);
    expect(summary.memberPatterns.guestPeople).toBe(1);
    expect(summary.memberPatterns.generations).toBe(1);
    const sleeveless = summary.rows.find((row) => row.identifiers.includes("sleeveless"));
    expect(sleeveless?.signedInPeople).toBe(0);
    expect(sleeveless?.opens).toBe(1);
  });

  it("matches the existing usage totals without dropping or double-counting events", () => {
    const events = [
      event({
        eventType: "pattern_generated",
        userId: "mem_a",
        patternSystem: "hat",
        patternId: "shared-project",
      }),
      event({
        eventType: "pattern_saved",
        userId: "mem_a",
        patternSystem: "hat",
        patternId: "shared-project",
      }),
      event({
        eventType: "pattern_saved",
        userId: "mem_a",
        patternSystem: "socks",
        patternId: "shared-project",
      }),
      event({ eventType: "pattern_opened", userId: "mem_a", patternSystem: "socks" }),
      event({ eventType: "pattern_updated", userId: "mem_b", patternSystem: "blanket" }),
      event({ eventType: "pattern_printed", userId: "guest_print", patternSystem: "hat" }),
      event({ eventType: "pattern_started", userId: "mem_b", patternSystem: "raglan" }),
      event({
        eventType: "pattern_generated",
        userId: SUE_PATTERN_ACTIVITY_MEMBER_ID,
        userEmail: SUE_PATTERN_ACTIVITY_EMAIL,
        patternSystem: "sleeveless",
      }),
      event({
        eventType: "pattern_generated",
        userId: "mem_old",
        patternSystem: "drop-shoulder",
        createdAt: "2026-08-01T00:00:00.000Z",
      }),
      event({
        eventType: "pattern_generated",
        userId: "mem_unknown",
        patternSystem: "future-pattern",
      }),
    ];
    const filters = { datePreset: "all" as const, patternSystem: "", excludeSue: false };
    const usage = buildPatternActivityUsage(events, filters, NOW);
    const summary = buildPatternActivityPatternSummary(events, filters, NOW);
    expect(summary.matchesExistingTotals).toBe(true);
    expect(summary.overall.signedInPeople).toBe(usage.peopleWhoGeneratedOrSaved);
    expect(summary.overall.generations).toBe(usage.totalGenerations);
    expect(summary.overall.distinctSavedProjects).toBe(usage.distinctSavedProjects);
    expect(summary.overall.opens).toBe(usage.opens);
    expect(summary.overall.edits).toBe(usage.edits);
    expect(summary.overall.prints).toBe(usage.prints);
    expect(summary.rows.reduce((sum, row) => sum + row.generations, 0)).toBe(usage.totalGenerations);
    expect(summary.freeHat.generations + summary.memberPatterns.generations + summary.unknown.generations).toBe(
      usage.totalGenerations,
    );
    expect(summary.overall.signedInPeople).toBe(4);
    expect(summary.rows.reduce((sum, row) => sum + row.signedInPeople, 0)).toBeGreaterThan(
      summary.overall.signedInPeople,
    );
    expect(summary.overall.distinctSavedProjects).toBe(1);
    expect(summary.rows.reduce((sum, row) => sum + row.distinctSavedProjects, 0)).toBe(2);
    const withoutSue = buildPatternActivityPatternSummary(
      events,
      { datePreset: "week", patternSystem: "socks", excludeSue: true },
      NOW,
    );
    const socksUsage = buildPatternActivityUsage(
      events,
      { datePreset: "week", patternSystem: "socks", excludeSue: true },
      NOW,
    );
    expect(withoutSue.matchesExistingTotals).toBe(true);
    expect(withoutSue.rows.map((row) => row.label)).toEqual(["Socks"]);
    expect(withoutSue.freeHat.generations).toBe(0);
    expect(withoutSue.memberPatterns.distinctSavedProjects).toBe(socksUsage.distinctSavedProjects);
    expect(withoutSue.overall.generations).toBe(0);
    expect(JSON.stringify(withoutSue)).not.toContain(SUE_PATTERN_ACTIVITY_EMAIL);
  });
});
