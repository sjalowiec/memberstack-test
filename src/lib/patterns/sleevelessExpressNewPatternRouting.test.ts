import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withDropShoulderConstructionAuthored } from "./patternConstructionIdentity";
import {
  canStartNewSleevelessPattern,
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

  it("allows a nosub knitter with a drop-shoulder free claim to start a sleeveless pattern", () => {
    expect(canStartNewSleevelessPattern(nosubDropShoulderClaimed)).toBe(true);
  });

  it("blocks a nosub knitter with a sleeveless free claim even when a drop-shoulder draft remains", () => {
    expect(canStartNewSleevelessPattern(nosubSleevelessClaimed)).toBe(false);
    const copy = resolveSleevelessNewPatternBlockedCopy(nosubSleevelessClaimed);
    expect(copy).toMatch(/Sleeveless/i);
    expect(copy).not.toMatch(/Drop Shoulder/i);
  });

  it("does not treat a drop-shoulder claim as blocking a sleeveless builder request", () => {
    expect(canStartNewSleevelessPattern(nosubDropShoulderClaimed)).toBe(true);
    expect(resolveSleevelessNewPatternBlockedCopy(nosubDropShoulderClaimed)).not.toMatch(
      /Drop Shoulder/i,
    );
  });
});
