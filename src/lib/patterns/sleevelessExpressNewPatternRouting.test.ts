import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withDropShoulderConstructionAuthored } from "./patternConstructionIdentity";
import {
  canStartNewPatternForSystem,
  canStartNewSleevelessPattern,
  resolveNewPatternBlockedCopy,
  resolveSleevelessNewPatternBlockedCopy,
} from "./sleevelessNewPatternAccessGuard";
import type { SleevelessUserAccess } from "./sleevelessPatternSystemAccess";
import { saveCurrentPattern, savePatternData } from "./patternStorage";
import { stubLocalStorage } from "./test/stubLocalStorage";

const nosubDropShoulderClaimed: SleevelessUserAccess = {
  loggedIn: true,
  memberId: "ms_nosub",
  hasSystemAccess: false,
  freeClaimsBySystem: {
    "drop-shoulder": { claimed: true, patternId: "pat_ds" },
  },
};

const nosubSleevelessClaimed: SleevelessUserAccess = {
  loggedIn: true,
  memberId: "ms_nosub",
  hasSystemAccess: false,
  freeClaimsBySystem: {
    sleeveless: { claimed: true, patternId: "pat_sl" },
  },
};

function stubSleevelessExpressPage(): void {
  const pathname = "/patterns/sleeveless-express";
  vi.stubGlobal("window", { location: { pathname, href: `http://localhost${pathname}` } });
  vi.stubGlobal("document", {
    defaultView: { location: { pathname } },
    querySelector: () => null,
  });
}

function stubDropShoulderBuilderPage(): void {
  const pathname = "/patterns/drop-shoulder/builder";
  vi.stubGlobal("window", { location: { pathname, href: `http://localhost${pathname}?new=1` } });
  vi.stubGlobal("document", {
    defaultView: { location: { pathname } },
    querySelector: (sel: string) =>
      sel === "[data-express-construction]"
        ? { getAttribute: () => "drop-shoulder" }
        : null,
  });
}

describe("Sleeveless express new-pattern routing (per-system entitlement)", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    stubSleevelessExpressPage();
    const style = withDropShoulderConstructionAuthored({}, "long");
    saveCurrentPattern({ style });
    savePatternData("style", style);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("blocks a nosub knitter regardless of historical free claims", () => {
    expect(canStartNewSleevelessPattern(nosubDropShoulderClaimed)).toBe(false);
    expect(canStartNewSleevelessPattern(nosubSleevelessClaimed)).toBe(false);
    const copy = resolveSleevelessNewPatternBlockedCopy(nosubSleevelessClaimed);
    expect(copy).toMatch(/Sleeveless/i);
    expect(copy).toMatch(/membership/i);
  });
});

describe("Drop-shoulder builder new-pattern routing (per-system entitlement)", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    stubDropShoulderBuilderPage();
    saveCurrentPattern({ style: { patternMode: "express" } });
    savePatternData("style", { patternMode: "express" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("blocks a nosub knitter on the drop-shoulder builder without membership", () => {
    expect(canStartNewPatternForSystem(nosubDropShoulderClaimed, "drop-shoulder")).toBe(false);
    expect(canStartNewSleevelessPattern(nosubDropShoulderClaimed)).toBe(false);
    const copy = resolveNewPatternBlockedCopy(nosubDropShoulderClaimed);
    expect(copy).toMatch(/Drop Shoulder/i);
    expect(copy).toMatch(/membership/i);
    expect(copy).not.toMatch(/free Sleeveless/i);
  });

  it("blocks a nosub knitter with only a sleeveless historical claim on the drop-shoulder builder", () => {
    expect(canStartNewSleevelessPattern(nosubSleevelessClaimed)).toBe(false);
  });
});
