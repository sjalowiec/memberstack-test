import { describe, expect, it } from "vitest";

import {
  findMatchingProjectKeys,
  isUuid,
  matchOutcome,
  parseMemberstackUserIdFromKey,
} from "./inspectCustomPatternProjectKeys";

const PROJECT_ID = "e77c684f-c097-4400-aa85-52e4e2e315c8";
const OTHER_ID = "11111111-2222-3333-4444-555555555555";

describe("isUuid", () => {
  it("accepts a standard UUID", () => {
    expect(isUuid(PROJECT_ID)).toBe(true);
  });

  it("rejects non-UUID strings", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("e77c684f")).toBe(false);
    expect(isUuid("")).toBe(false);
  });
});

describe("findMatchingProjectKeys", () => {
  const keys = [
    `sleeveless/mem_cynthia/${PROJECT_ID}.json`,
    `sleeveless/mem_cynthia/index.json`,
    `sleeveless/mem_other/${OTHER_ID}.json`,
    `sleeveless/mem_other/index.json`,
    "index.json",
  ];

  it("matches the requested project ID", () => {
    expect(findMatchingProjectKeys(keys, PROJECT_ID)).toEqual([
      `sleeveless/mem_cynthia/${PROJECT_ID}.json`,
    ]);
  });

  it("ignores index.json files", () => {
    const withOnlyIndexes = [
      `sleeveless/mem_cynthia/index.json`,
      `sleeveless/${PROJECT_ID}/index.json`,
    ];
    expect(findMatchingProjectKeys(withOnlyIndexes, PROJECT_ID)).toEqual([]);
  });

  it("returns no match when the project ID is absent", () => {
    expect(findMatchingProjectKeys(keys, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")).toEqual([]);
    expect(matchOutcome({ matchingKeys: [] })).toBe("none");
  });

  it("returns multiple matches without picking one", () => {
    const dupes = [
      `sleeveless/mem_a/${PROJECT_ID}.json`,
      `sleeveless/mem_b/${PROJECT_ID}.json`,
    ];
    const matching = findMatchingProjectKeys(dupes, PROJECT_ID);
    expect(matching).toHaveLength(2);
    expect(matchOutcome({ matchingKeys: matching })).toBe("many");
  });

  it("finds Drop Shoulder projects under the shared sleeveless family prefix", () => {
    const keysWithDrop = [
      `sleeveless/mem_drop/${PROJECT_ID}.json`,
      `sleeveless/mem_drop/index.json`,
    ];
    expect(findMatchingProjectKeys(keysWithDrop, PROJECT_ID)).toEqual([
      `sleeveless/mem_drop/${PROJECT_ID}.json`,
    ]);
  });
});

describe("parseMemberstackUserIdFromKey", () => {
  it("parses the user ID from the blob key", () => {
    expect(parseMemberstackUserIdFromKey(`sleeveless/mem_cynthia/${PROJECT_ID}.json`)).toBe(
      "mem_cynthia",
    );
  });

  it("returns null for unexpected key shapes", () => {
    expect(parseMemberstackUserIdFromKey(`${PROJECT_ID}.json`)).toBeNull();
    expect(parseMemberstackUserIdFromKey("")).toBeNull();
  });
});

describe("matchOutcome", () => {
  it("reports one when a single key matches", () => {
    expect(
      matchOutcome({
        matchingKeys: [`sleeveless/mem_cynthia/${PROJECT_ID}.json`],
      }),
    ).toBe("one");
  });
});
