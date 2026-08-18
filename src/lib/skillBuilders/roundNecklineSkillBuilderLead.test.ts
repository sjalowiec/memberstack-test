import { describe, expect, it } from "vitest";
import { decideRoundNecklineLeadCapture } from "./roundNecklineSkillBuilderLead";
import {
  isRoundNecklineLeadRecognized,
  isRoundNecklineLeadRecognizedAt,
  markRoundNecklineLeadRecognized,
  parseRoundNecklineLeadRecognizedAt,
  ROUND_NECKLINE_SKILL_BUILDER_LEAD_STORAGE_KEY,
  ROUND_NECKLINE_SKILL_BUILDER_LEAD_TTL_MS,
} from "./roundNecklineSkillBuilderLeadHint";
import { ROUND_NECKLINE_SKILL_BUILDER_LEAD_TAG } from "./roundNecklineSkillBuilderLeadShared";

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

describe("decideRoundNecklineLeadCapture", () => {
  it("asks a logged-out visitor for email before personalized practice", () => {
    expect(
      decideRoundNecklineLeadCapture({
        builderId: "round-neckline-basics",
        alreadyCaptured: false,
        memberEmail: null,
      }),
    ).toEqual({ action: "show-capture" });
  });

  it("lets a returning visitor continue without entering email again", () => {
    expect(
      decideRoundNecklineLeadCapture({
        builderId: "round-neckline-basics",
        alreadyCaptured: true,
        memberEmail: null,
      }),
    ).toEqual({ action: "create-practice" });
  });

  it("does not prompt a logged-in member with a known email", () => {
    expect(
      decideRoundNecklineLeadCapture({
        builderId: "round-neckline-basics",
        alreadyCaptured: false,
        memberEmail: "ada@example.com",
        memberFirstName: "Ada",
      }),
    ).toEqual({
      action: "submit-known-email",
      email: "ada@example.com",
      firstName: "Ada",
    });
  });

  it("leaves member-only Skill Builder gating unchanged", () => {
    expect(
      decideRoundNecklineLeadCapture({
        builderId: "round-necklines-shaped-shoulders",
        alreadyCaptured: false,
        memberEmail: null,
      }),
    ).toEqual({ action: "create-practice" });
  });
});

describe("round neckline Skill Builder lead remember hint", () => {
  it("stores only a recognition timestamp — never name or email", () => {
    const storage = memoryStorage();
    const now = 1_700_000_000_000;
    expect(markRoundNecklineLeadRecognized(now, storage)).toBe(true);
    expect(storage.getItem(ROUND_NECKLINE_SKILL_BUILDER_LEAD_STORAGE_KEY)).toBe(String(now));
    expect(storage.getItem(ROUND_NECKLINE_SKILL_BUILDER_LEAD_STORAGE_KEY)).not.toMatch(/@/);
    expect(isRoundNecklineLeadRecognized(now, storage)).toBe(true);
  });

  it("treats an expired timestamp as not recognized", () => {
    const now = 1_700_000_000_000;
    expect(parseRoundNecklineLeadRecognizedAt("1700000000000")).toBe(1700000000000);
    expect(isRoundNecklineLeadRecognizedAt(now - 1000, now)).toBe(true);
    expect(
      isRoundNecklineLeadRecognizedAt(now - ROUND_NECKLINE_SKILL_BUILDER_LEAD_TTL_MS - 1, now),
    ).toBe(false);
  });
});

describe("lead tag name", () => {
  it("uses the existing human-readable ActiveCampaign tag", () => {
    expect(ROUND_NECKLINE_SKILL_BUILDER_LEAD_TAG).toBe(
      "Lead: Skill Builder",
    );
  });
});
