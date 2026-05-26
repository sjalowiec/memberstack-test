import { describe, expect, it } from "vitest";
import {
  buildPatternPeopleHeroFilename,
  normalizePatternPeopleHeroNeckline,
  normalizePatternPeopleHeroAudience,
} from "./patternPeopleHeroImage";

describe("normalizePatternPeopleHeroAudience", () => {
  it("maps chart and Express keys to people slugs", () => {
    expect(normalizePatternPeopleHeroAudience("misses")).toBe("woman");
    expect(normalizePatternPeopleHeroAudience("men")).toBe("man");
    expect(normalizePatternPeopleHeroAudience("kids")).toBe("kids");
    expect(normalizePatternPeopleHeroAudience("baby")).toBe("baby");
  });
});

describe("normalizePatternPeopleHeroNeckline", () => {
  it("normalizes round family tokens", () => {
    expect(normalizePatternPeopleHeroNeckline("round")).toBe("round");
    expect(normalizePatternPeopleHeroNeckline("roundneck")).toBe("round");
    expect(normalizePatternPeopleHeroNeckline("round-neck")).toBe("round");
  });

  it("normalizes V-neck family tokens", () => {
    expect(normalizePatternPeopleHeroNeckline("v")).toBe("v-neck");
    expect(normalizePatternPeopleHeroNeckline("v-neck")).toBe("v-neck");
    expect(normalizePatternPeopleHeroNeckline("vneck")).toBe("v-neck");
  });
});

describe("buildPatternPeopleHeroFilename", () => {
  it("matches shipped sleeveless basename conventions", () => {
    expect(buildPatternPeopleHeroFilename("sleeveless", "woman", "pullover", "round")).toBe(
      "sleeveless-woman-pullover-round-neck.webp",
    );
    expect(buildPatternPeopleHeroFilename("sleeveless", "woman", "cardigan", "round")).toBe(
      "sleeveless-woman-cardigan-roundneck.webp",
    );
    expect(buildPatternPeopleHeroFilename("sleeveless", "man", "pullover", "v-neck")).toBe(
      "sleeveless-man-pullover-v-neck.webp",
    );
  });
});
