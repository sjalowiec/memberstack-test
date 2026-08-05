import { describe, expect, it } from "vitest";

import {
  computeEmailSignupsReport,
  formatEmailSignupsChange,
  formatEmailSignupsPercentChange,
  type EmailSignupEvent,
} from "./emailSignupsReport";
import { loadEmailSignupsReport } from "./emailSignupsReportLoad";
import { laCivilMidnightUtc } from "./salesReportDates";

/** 2026-08-05 13:00 PDT — "today" is 2026-08-05 in America/Los_Angeles. */
const NOW = new Date("2026-08-05T20:00:00Z");

function addedAt(civilYear: number, civilMonth: number, civilDay: number, hourUtc = 18): EmailSignupEvent {
  // Place the event safely inside the LA civil day (afternoon UTC → morning/afternoon LA in summer).
  const start = laCivilMidnightUtc({
    year: civilYear,
    month: civilMonth,
    day: civilDay,
  });
  return {
    createdAt: new Date(start.getTime() + hourUtc * 60 * 60 * 1000),
    status: "added",
    source: "tip-of-the-week",
  };
}

function event(
  status: string,
  civilYear: number,
  civilMonth: number,
  civilDay: number,
): EmailSignupEvent {
  return {
    ...addedAt(civilYear, civilMonth, civilDay),
    status,
  };
}

describe("computeEmailSignupsReport", () => {
  it("counts only added status as new signups", () => {
    const report = computeEmailSignupsReport({
      now: NOW,
      events: [
        addedAt(2026, 8, 5),
        event("already-subscribed", 2026, 8, 5),
        event("not-added", 2026, 8, 5),
        event("failed", 2026, 8, 5),
      ],
    });

    expect(report.today.newSignups).toBe(1);
    expect(report.last7.current.newSignups).toBe(1);
    expect(report.last30.current.newSignups).toBe(1);
  });

  it("does not inflate totals when the same email is recorded as added then already-subscribed", () => {
    // Duplicate submission after a successful add: second row is already-subscribed.
    const report = computeEmailSignupsReport({
      now: NOW,
      events: [
        addedAt(2026, 8, 5),
        event("already-subscribed", 2026, 8, 5),
        event("already-subscribed", 2026, 8, 5),
      ],
    });
    expect(report.today.newSignups).toBe(1);
  });

  it("uses America/Los_Angeles day boundaries", () => {
    // Just before LA midnight Aug 5 (PDT): still Aug 4 in LA.
    const lateAug4 = new Date("2026-08-05T06:59:00Z");
    // Just after LA midnight Aug 5.
    const earlyAug5 = new Date("2026-08-05T07:01:00Z");

    const report = computeEmailSignupsReport({
      now: NOW,
      events: [
        { createdAt: lateAug4, status: "added", source: "tip-of-the-week" },
        { createdAt: earlyAug5, status: "added", source: "tip-of-the-week" },
      ],
    });

    expect(report.today.newSignups).toBe(1);
    const aug4 = report.daily.find((row) => row.date === "2026-08-04");
    const aug5 = report.daily.find((row) => row.date === "2026-08-05");
    expect(aug4?.newSignups).toBe(1);
    expect(aug5?.newSignups).toBe(1);
  });

  it("compares current and previous 7-day periods", () => {
    // Current 7: Jul 30 – Aug 5. Previous 7: Jul 23 – Jul 29.
    const report = computeEmailSignupsReport({
      now: NOW,
      events: [
        addedAt(2026, 8, 1), // current
        addedAt(2026, 8, 3), // current
        addedAt(2026, 7, 25), // previous
      ],
    });

    expect(report.last7.current.fromCivil).toBe("2026-07-30");
    expect(report.last7.current.toCivil).toBe("2026-08-05");
    expect(report.last7.previous.fromCivil).toBe("2026-07-23");
    expect(report.last7.previous.toCivil).toBe("2026-07-29");
    expect(report.last7.current.newSignups).toBe(2);
    expect(report.last7.previous.newSignups).toBe(1);
    expect(report.last7.change).toBe(1);
    expect(report.last7.percentChange).toBe(100);
  });

  it("compares current and previous 30-day periods", () => {
    // Current 30: Jul 7 – Aug 5. Previous 30: Jun 7 – Jul 6.
    const report = computeEmailSignupsReport({
      now: NOW,
      events: [
        addedAt(2026, 7, 10), // current
        addedAt(2026, 8, 1), // current
        addedAt(2026, 6, 15), // previous
        addedAt(2026, 6, 20), // previous
        addedAt(2026, 7, 1), // previous
      ],
    });

    expect(report.last30.current.fromCivil).toBe("2026-07-07");
    expect(report.last30.current.toCivil).toBe("2026-08-05");
    expect(report.last30.previous.fromCivil).toBe("2026-06-07");
    expect(report.last30.previous.toCivil).toBe("2026-07-06");
    expect(report.last30.current.newSignups).toBe(2);
    expect(report.last30.previous.newSignups).toBe(3);
    expect(report.last30.change).toBe(-1);
    expect(report.last30.percentChange).toBe(-33);
  });

  it("returns null percent change when the previous period total is zero", () => {
    const report = computeEmailSignupsReport({
      now: NOW,
      events: [addedAt(2026, 8, 5)],
    });
    expect(report.last7.previous.newSignups).toBe(0);
    expect(report.last7.percentChange).toBeNull();
    expect(formatEmailSignupsPercentChange(report.last7.percentChange)).toBe("—");
    expect(formatEmailSignupsChange(report.last7.change)).toBe("+1");
  });

  it("includes zero-signup dates across the full 30-day daily breakdown", () => {
    const report = computeEmailSignupsReport({
      now: NOW,
      events: [addedAt(2026, 8, 5)],
    });

    expect(report.daily).toHaveLength(30);
    expect(report.daily[0]?.date).toBe("2026-07-07");
    expect(report.daily[report.daily.length - 1]?.date).toBe("2026-08-05");
    expect(report.daily.filter((row) => row.newSignups === 0).length).toBe(29);
    expect(report.daily.find((row) => row.date === "2026-08-05")?.inProgress).toBe(
      true,
    );
  });

  it("labels the source as Tip of the Week", () => {
    const report = computeEmailSignupsReport({ now: NOW, events: [] });
    expect(report.sourceLabel).toBe("Tip of the Week");
    expect(report.timezone).toBe("America/Los_Angeles");
  });
});

describe("loadEmailSignupsReport", () => {
  it("queries the added window and computes the report", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const report = await loadEmailSignupsReport({
      now: NOW,
      queryFn: async (sql, params = []) => {
        calls.push({ sql, params: params as unknown[] });
        return [
          {
            created_at: addedAt(2026, 8, 5).createdAt.toISOString(),
            status: "added",
            source: "tip-of-the-week",
          },
          {
            created_at: addedAt(2026, 8, 5).createdAt.toISOString(),
            status: "failed",
            source: "tip-of-the-week",
          },
        ];
      },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toContain("watson_email_signups");
    expect(calls[0]?.params[0]).toBe("tip-of-the-week");
    expect(report.today.newSignups).toBe(1);
    expect(report.daily).toHaveLength(30);
  });
});
