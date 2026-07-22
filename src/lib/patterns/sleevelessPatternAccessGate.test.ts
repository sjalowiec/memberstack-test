import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  canCustomizePattern,
  isAdvancedAccessDevOverrideEnabled,
  resolveHasAdvancedPatternAccess,
  resolveHasAdvancedPatternAccessForAccess,
  SLEEVELESS_PATTERN_ACCESS_LS_KEY,
} from "./sleevelessPatternAccessGate";
import { testAccess } from "./patternAccessTestFixtures";
import { MEMBERSHIPS } from "../../config/memberships";

vi.mock("./sleevelessPatternSystemAccessClient", () => ({
  getCachedSleevelessUserAccess: vi.fn(() => null),
}));

import { getCachedSleevelessUserAccess } from "./sleevelessPatternSystemAccessClient";

const getCached = vi.mocked(getCachedSleevelessUserAccess);

function memberAccess() {
  return testAccess({
    loggedIn: true,
    hasSystemAccess: true,
    activePlanIds: [MEMBERSHIPS.membership.memberstackPlanId],
  });
}

const memoryStore = new Map<string, string>();

beforeEach(() => {
  memoryStore.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => memoryStore.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memoryStore.set(key, String(value));
    },
    removeItem: (key: string) => {
      memoryStore.delete(key);
    },
  });
});

afterEach(() => {
  getCached.mockReturnValue(null);
  vi.unstubAllGlobals();
});

describe("advanced access overrides — production", () => {
  const prod = { ignoreDevOverrides: true } as const;

  it("ignores ?advanced=1 in production", () => {
    expect(
      resolveHasAdvancedPatternAccess(
        new URL("https://example.test/review?advanced=1"),
        prod,
      ),
    ).toBe(false);
  });

  it("ignores localStorage override in production", () => {
    localStorage.setItem(SLEEVELESS_PATTERN_ACCESS_LS_KEY, "1");
    expect(resolveHasAdvancedPatternAccess(new URL("https://example.test/review"), prod)).toBe(
      false,
    );
  });

  it("still grants access for an active member via entitlement snapshot", () => {
    const access = memberAccess();
    expect(
      resolveHasAdvancedPatternAccessForAccess(
        access,
        new URL("https://example.test/review?advanced=0"),
        prod,
      ),
    ).toBe(true);
  });

  it("reports overrides disabled when ignoreDevOverrides is set", () => {
    expect(isAdvancedAccessDevOverrideEnabled(prod)).toBe(false);
  });
});

describe("advanced access overrides — development", () => {
  it("allows ?advanced=1 when DEV overrides are enabled", () => {
    // Vitest runs with import.meta.env.DEV === true.
    expect(isAdvancedAccessDevOverrideEnabled()).toBe(true);
    expect(
      resolveHasAdvancedPatternAccess(new URL("https://example.test/review?advanced=1")),
    ).toBe(true);
  });

  it("allows ?advanced=0 to force locked in development", () => {
    expect(
      resolveHasAdvancedPatternAccess(new URL("https://example.test/review?advanced=0")),
    ).toBe(false);
  });

  it("allows customize query overrides in development", () => {
    expect(
      resolveHasAdvancedPatternAccess(new URL("https://example.test/review?customize=1")),
    ).toBe(true);
    expect(
      resolveHasAdvancedPatternAccess(new URL("https://example.test/review?customize=0")),
    ).toBe(false);
  });

  it("allows localStorage override in development", () => {
    localStorage.setItem(SLEEVELESS_PATTERN_ACCESS_LS_KEY, "1");
    expect(resolveHasAdvancedPatternAccess(new URL("https://example.test/review"))).toBe(true);
  });
});

describe("canCustomizePattern", () => {
  it("matches resolveHasAdvancedPatternAccess", () => {
    const url = new URL("https://example.test/review?advanced=0");
    expect(canCustomizePattern(url)).toBe(resolveHasAdvancedPatternAccess(url));
  });
});

describe("resolveHasAdvancedPatternAccess — membership (no override)", () => {
  it("defaults to false when no override and no cached access", () => {
    expect(resolveHasAdvancedPatternAccess(new URL("https://example.test/review"))).toBe(false);
  });

  it("uses cached membership access when present", () => {
    getCached.mockReturnValue(memberAccess());
    expect(
      resolveHasAdvancedPatternAccess(new URL("https://example.test/review"), {
        ignoreDevOverrides: true,
      }),
    ).toBe(true);
  });
});
