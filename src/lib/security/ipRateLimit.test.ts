import { describe, expect, it } from "vitest";
import { checkIpRateLimit } from "./ipRateLimit";

describe("checkIpRateLimit", () => {
  it("allows the first submissions within the window", () => {
    const store = new Map();
    const now = 1_000_000;

    for (let i = 0; i < 5; i += 1) {
      expect(
        checkIpRateLimit({
          ip: "1.2.3.4",
          store,
          now,
          maxPerWindow: 5,
          windowMs: 60_000,
        }),
      ).toEqual({ allowed: true });
    }
  });

  it("blocks the next submission in the same window", () => {
    const store = new Map();
    const now = 1_000_000;

    for (let i = 0; i < 5; i += 1) {
      checkIpRateLimit({
        ip: "1.2.3.4",
        store,
        now,
        maxPerWindow: 5,
        windowMs: 60_000,
      });
    }

    expect(
      checkIpRateLimit({
        ip: "1.2.3.4",
        store,
        now: now + 1_000,
        maxPerWindow: 5,
        windowMs: 60_000,
      }),
    ).toEqual({ allowed: false, reason: "rate_limited" });
  });

  it("resets after the window expires", () => {
    const store = new Map();
    const now = 1_000_000;

    for (let i = 0; i < 5; i += 1) {
      checkIpRateLimit({
        ip: "1.2.3.4",
        store,
        now,
        maxPerWindow: 5,
        windowMs: 60_000,
      });
    }

    expect(
      checkIpRateLimit({
        ip: "1.2.3.4",
        store,
        now: now + 60_001,
        maxPerWindow: 5,
        windowMs: 60_000,
      }),
    ).toEqual({ allowed: true });
  });
});
