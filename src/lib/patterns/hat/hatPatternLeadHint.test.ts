import { describe, expect, it } from "vitest";
import { startFreshHatPattern } from "./hatFreshStart";
import {
  HAT_DRAFT_STORAGE_KEY,
  LEGACY_HAT_PATTERN_INPUTS_STORAGE_KEY,
  LEGACY_HAT_SIZE_STORAGE_KEY,
  createEmptyHatDraft,
} from "./hatDraft";
import {
  HAT_PATTERN_LEAD_STORAGE_KEY,
  HAT_PATTERN_LEAD_TTL_MS,
  isHatPatternLeadRecognized,
  isHatPatternLeadRecognizedAt,
  markHatPatternLeadRecognized,
  parseHatPatternLeadRecognizedAt,
} from "./hatPatternLeadHint";

function memoryStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

describe("Hat Pattern lead remember hint", () => {
  it("stores only a recognition timestamp — never name or email", () => {
    const storage = memoryStorage();
    const now = 1_700_000_000_000;
    expect(markHatPatternLeadRecognized(now, storage)).toBe(true);
    expect(storage.getItem(HAT_PATTERN_LEAD_STORAGE_KEY)).toBe(String(now));
    expect(storage.getItem(HAT_PATTERN_LEAD_STORAGE_KEY)).not.toMatch(/@/);
    expect(isHatPatternLeadRecognized(now, storage)).toBe(true);
  });

  it("treats an expired timestamp as not recognized", () => {
    const now = 1_700_000_000_000;
    expect(parseHatPatternLeadRecognizedAt("1700000000000")).toBe(1700000000000);
    expect(isHatPatternLeadRecognizedAt(now - 1000, now)).toBe(true);
    expect(
      isHatPatternLeadRecognizedAt(now - HAT_PATTERN_LEAD_TTL_MS - 1, now),
    ).toBe(false);
  });

  it("does not share the Skill Builder recognition key", () => {
    expect(HAT_PATTERN_LEAD_STORAGE_KEY).toBe("kin:hat-pattern-lead-at");
    expect(HAT_PATTERN_LEAD_STORAGE_KEY).not.toContain("skill-builder");
  });

  it("keeps the lead marker when ?new=1 / startFreshHatPattern clears the draft", () => {
    const now = 1_700_000_000_000;
    const storage = memoryStorage({
      [HAT_DRAFT_STORAGE_KEY]: JSON.stringify(
        createEmptyHatDraft({ sizeSel: "adult_woman", brimType: "single" }),
      ),
      [LEGACY_HAT_SIZE_STORAGE_KEY]: JSON.stringify({ sel: "adult_woman" }),
      [LEGACY_HAT_PATTERN_INPUTS_STORAGE_KEY]: JSON.stringify({ brimType: "single" }),
      [HAT_PATTERN_LEAD_STORAGE_KEY]: String(now),
    });

    startFreshHatPattern(storage);

    expect(storage.getItem(HAT_DRAFT_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(HAT_PATTERN_LEAD_STORAGE_KEY)).toBe(String(now));
    expect(isHatPatternLeadRecognized(now, storage)).toBe(true);
  });
});
