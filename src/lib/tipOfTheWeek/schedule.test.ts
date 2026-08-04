import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  defaultTipAvailableThrough,
  initTipDateFormState,
  onTipAvailableFromChanged,
  onTipAvailableThroughChanged,
  resetTipAvailableThroughToSevenDays,
  tipDateRangesOverlap,
  tipIsPubliclyFeatured,
  tipLosAngelesCalendarDate,
  tipScheduleBucket,
} from "./schedule";

describe("tipOfTheWeek schedule", () => {
  it("computes America/Los_Angeles calendar dates", () => {
    // 2026-08-08 07:00 UTC is still 2026-08-07 evening in LA.
    const laEvening = tipLosAngelesCalendarDate(new Date("2026-08-08T06:00:00.000Z"));
    expect(laEvening).toBe("2026-08-07");
    const laDay = tipLosAngelesCalendarDate(new Date("2026-08-08T12:00:00.000Z"));
    expect(laDay).toBe("2026-08-08");
  });

  it("keeps draft tips off the public page", () => {
    expect(
      tipIsPubliclyFeatured(
        {
          status: "draft",
          availableFrom: "2026-08-01",
          availableThrough: "2026-08-14",
        },
        "2026-08-10",
      ),
    ).toBe(false);
  });

  it("respects scheduled start and available-through in LA", () => {
    const tip = {
      status: "scheduled" as const,
      availableFrom: "2026-08-08",
      availableThrough: "2026-08-14",
    };
    expect(tipIsPubliclyFeatured(tip, "2026-08-07")).toBe(false);
    expect(tipIsPubliclyFeatured(tip, "2026-08-08")).toBe(true);
    expect(tipIsPubliclyFeatured(tip, "2026-08-14")).toBe(true);
    expect(tipIsPubliclyFeatured(tip, "2026-08-15")).toBe(false);
  });

  it("keeps archived tips out of the featured window", () => {
    expect(
      tipIsPubliclyFeatured(
        {
          status: "archived",
          availableFrom: "2026-08-08",
          availableThrough: "2026-08-14",
        },
        "2026-08-10",
      ),
    ).toBe(false);
  });

  it("detects overlapping date ranges", () => {
    expect(
      tipDateRangesOverlap("2026-08-08", "2026-08-14", "2026-08-14", "2026-08-20"),
    ).toBe(true);
    expect(
      tipDateRangesOverlap("2026-08-08", "2026-08-14", "2026-08-15", "2026-08-20"),
    ).toBe(false);
  });

  it("buckets tips for Watson lists", () => {
    expect(
      tipScheduleBucket(
        {
          status: "active",
          availableFrom: "2026-08-08",
          availableThrough: "2026-08-14",
        },
        "2026-08-10",
      ),
    ).toBe("current");
    expect(
      tipScheduleBucket(
        {
          status: "scheduled",
          availableFrom: "2026-08-20",
          availableThrough: "2026-08-27",
        },
        "2026-08-10",
      ),
    ).toBe("scheduled");
    expect(
      tipScheduleBucket(
        {
          status: "active",
          availableFrom: "2026-07-01",
          availableThrough: "2026-07-07",
        },
        "2026-08-10",
      ),
    ).toBe("expired");
  });
});

describe("Tip of the Week 7-day date window helpers", () => {
  it("defaults end date to start + 6 calendar days", () => {
    expect(addCalendarDays("2026-08-08", 6)).toBe("2026-08-14");
    expect(defaultTipAvailableThrough("2026-08-08")).toBe("2026-08-14");
  });

  it("produces August 14 from August 8", () => {
    expect(defaultTipAvailableThrough("2026-08-08")).toBe("2026-08-14");
  });

  it("avoids UTC conversion shifting month boundaries", () => {
    expect(defaultTipAvailableThrough("2026-01-28")).toBe("2026-02-03");
    expect(defaultTipAvailableThrough("2026-12-28")).toBe("2027-01-03");
  });

  it("recalculates an untouched end date when start date changes", () => {
    let state = initTipDateFormState(null);
    state = onTipAvailableFromChanged(state, "2026-08-08");
    expect(state.availableThrough).toBe("2026-08-14");
    expect(state.throughManuallyEdited).toBe(false);

    state = onTipAvailableFromChanged(state, "2026-09-01");
    expect(state.availableThrough).toBe("2026-09-07");
    expect(state.throughManuallyEdited).toBe(false);
  });

  it("preserves a manually edited end date when start date changes", () => {
    let state = initTipDateFormState(null);
    state = onTipAvailableFromChanged(state, "2026-08-08");
    state = onTipAvailableThroughChanged(state, "2026-08-20");
    expect(state.throughManuallyEdited).toBe(true);

    state = onTipAvailableFromChanged(state, "2026-08-10");
    expect(state.availableFrom).toBe("2026-08-10");
    expect(state.availableThrough).toBe("2026-08-20");
  });

  it("Reset to 7 days restores start + 6 days", () => {
    let state = initTipDateFormState(null);
    state = onTipAvailableFromChanged(state, "2026-08-08");
    state = onTipAvailableThroughChanged(state, "2026-08-31");
    state = resetTipAvailableThroughToSevenDays(state);
    expect(state.availableThrough).toBe("2026-08-14");
    expect(state.throughManuallyEdited).toBe(false);

    state = onTipAvailableFromChanged(state, "2026-09-01");
    expect(state.availableThrough).toBe("2026-09-07");
  });

  it("does not silently alter stored dates when editing an existing tip", () => {
    const state = initTipDateFormState({
      availableFrom: "2026-08-08",
      availableThrough: "2026-08-14",
      isExisting: true,
    });
    expect(state.availableFrom).toBe("2026-08-08");
    expect(state.availableThrough).toBe("2026-08-14");
    expect(state.throughManuallyEdited).toBe(true);

    const afterStartChange = onTipAvailableFromChanged(state, "2026-08-09");
    expect(afterStartChange.availableFrom).toBe("2026-08-09");
    expect(afterStartChange.availableThrough).toBe("2026-08-14");
  });
});
