import { beforeEach, describe, expect, it } from "vitest";
import {
  claimPatternDraftForMember,
  enforcePatternDraftOwner,
  PATTERN_DRAFT_OWNER_KEY,
  readPatternDraftOwnerId,
} from "./patternDraftOwnerGuard";
import { PATTERN_STORAGE_KEY, SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY } from "./patternStorage";
import { startFreshSleevelessExpressPattern } from "./sleevelessExpressFreshStart";
import { CUSTOM_PATTERN_ACTIVE_PROJECT_ID_KEY } from "./customPatternProjectActiveId";
import { HAT_DRAFT_STORAGE_KEY } from "./hat/hatDraft";
import { HAT_ACTIVE_PROJECT_ID_KEY, HAT_ACTIVE_PROJECT_NAME_KEY } from "./hat/hatSavedProject";
import { stubLocalStorage } from "./test/stubLocalStorage";

/** Seed a full local working draft as if a member had built/loaded a pattern. */
function seedWorkingDraft(): void {
  localStorage.setItem(PATTERN_STORAGE_KEY, JSON.stringify({ id: "p1", patternType: "sleeveless" }));
  localStorage.setItem(
    SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
    JSON.stringify({ values: { who: "women", selectedSize: "8" } }),
  );
  localStorage.setItem(CUSTOM_PATTERN_ACTIVE_PROJECT_ID_KEY, "proj-user-a");
}

function workingDraftExists(): boolean {
  return (
    localStorage.getItem(PATTERN_STORAGE_KEY) !== null ||
    localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY) !== null ||
    localStorage.getItem(CUSTOM_PATTERN_ACTIVE_PROJECT_ID_KEY) !== null
  );
}

describe("enforcePatternDraftOwner", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("claims an unowned draft for the current member without clearing it", () => {
    seedWorkingDraft();
    const result = enforcePatternDraftOwner("ms_userA");
    expect(result).toBe("claimed");
    expect(readPatternDraftOwnerId()).toBe("ms_userA");
    expect(workingDraftExists()).toBe(true);
  });

  it("is unchanged when the same member re-enters", () => {
    seedWorkingDraft();
    enforcePatternDraftOwner("ms_userA");
    const result = enforcePatternDraftOwner("ms_userA");
    expect(result).toBe("unchanged");
    expect(workingDraftExists()).toBe(true);
    expect(readPatternDraftOwnerId()).toBe("ms_userA");
  });

  // The core cross-user leak guard: user B must never inherit user A's working draft.
  it("clears the draft and re-claims it when a different member signs in", () => {
    seedWorkingDraft();
    enforcePatternDraftOwner("ms_userA");

    const result = enforcePatternDraftOwner("ms_userB");

    expect(result).toBe("cleared");
    expect(localStorage.getItem(PATTERN_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(CUSTOM_PATTERN_ACTIVE_PROJECT_ID_KEY)).toBeNull();
    expect(readPatternDraftOwnerId()).toBe("ms_userB");
  });

  it("clears Hat draft and Hat project identity when a different member signs in", () => {
    seedWorkingDraft();
    localStorage.setItem(
      HAT_DRAFT_STORAGE_KEY,
      JSON.stringify({ patternType: "hat", patternProject: { title: "Member A Hat" } }),
    );
    localStorage.setItem(HAT_ACTIVE_PROJECT_ID_KEY, "proj-hat-a");
    localStorage.setItem(HAT_ACTIVE_PROJECT_NAME_KEY, "Member A Hat");
    enforcePatternDraftOwner("ms_userA");

    expect(enforcePatternDraftOwner("ms_userB")).toBe("cleared");
    expect(localStorage.getItem(HAT_DRAFT_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(HAT_ACTIVE_PROJECT_ID_KEY)).toBeNull();
    expect(localStorage.getItem(HAT_ACTIVE_PROJECT_NAME_KEY)).toBeNull();
    expect(readPatternDraftOwnerId()).toBe("ms_userB");
  });

  it("does nothing destructive when identity is unavailable (logged out)", () => {
    seedWorkingDraft();
    enforcePatternDraftOwner("ms_userA");

    expect(enforcePatternDraftOwner(null)).toBe("unchanged");
    expect(enforcePatternDraftOwner("")).toBe("unchanged");
    expect(enforcePatternDraftOwner(undefined)).toBe("unchanged");

    // Draft + owner tag stay intact; the next *different* sign-in is what clears it.
    expect(workingDraftExists()).toBe(true);
    expect(readPatternDraftOwnerId()).toBe("ms_userA");
  });

  it("treats whitespace-only ids as no identity", () => {
    seedWorkingDraft();
    enforcePatternDraftOwner("ms_userA");
    expect(enforcePatternDraftOwner("   ")).toBe("unchanged");
    expect(workingDraftExists()).toBe(true);
  });

  it("claimPatternDraftForMember tags the owner without clearing", () => {
    seedWorkingDraft();
    enforcePatternDraftOwner("ms_userA");
    // A verified owner-scoped cloud load re-tags ownership so a later page keeps the draft.
    claimPatternDraftForMember("ms_userB");
    expect(localStorage.getItem(PATTERN_DRAFT_OWNER_KEY)).toBe("ms_userB");
    expect(workingDraftExists()).toBe(true);
    // Now the same member re-entering is a no-op (draft preserved).
    expect(enforcePatternDraftOwner("ms_userB")).toBe("unchanged");
    expect(workingDraftExists()).toBe(true);
  });
});

describe("start-new forces a fresh draft", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  // "Create sleeveless sweater" routes through ?new=1 → startFreshSleevelessExpressPattern.
  it("discards the previous/current draft (Express snapshot + saved-project link) for a blank build", () => {
    seedWorkingDraft();
    expect(workingDraftExists()).toBe(true);

    startFreshSleevelessExpressPattern();

    // Express wizard snapshot and the active saved-project link are gone — nothing resumes.
    expect(localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(CUSTOM_PATTERN_ACTIVE_PROJECT_ID_KEY)).toBeNull();

    // The canonical draft is reset to a fresh, EMPTY pattern (not the seeded one) — never the
    // previous build's selections.
    const rawCanonical = localStorage.getItem(PATTERN_STORAGE_KEY);
    if (rawCanonical !== null) {
      const canonical = JSON.parse(rawCanonical) as {
        id?: string;
        style?: Record<string, unknown>;
        measurements?: Record<string, unknown>;
      };
      expect(canonical.id).not.toBe("p1");
      expect(canonical.style ?? {}).toEqual({});
      expect(canonical.measurements ?? {}).toEqual({});
    }
  });
});
