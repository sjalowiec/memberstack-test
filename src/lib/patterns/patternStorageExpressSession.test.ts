import { beforeEach, describe, expect, it } from "vitest";
import {
  CUSTOM_PATTERN_ACTIVE_PROJECT_ID_KEY,
  readActiveCustomPatternProjectId,
  writeActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import { clearSleevelessExpressSession, PATTERN_STORAGE_KEY } from "./patternStorage";
import { stubLocalStorage } from "./test/stubLocalStorage";

describe("clearSleevelessExpressSession", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("clears the active saved project id when starting a fresh Express session", () => {
    localStorage.setItem(PATTERN_STORAGE_KEY, "{}");
    writeActiveCustomPatternProjectId("proj-justin");
    localStorage.setItem("bodyShape", "aline");
    localStorage.setItem("garmentType", "cardigan");
    localStorage.setItem("necklineStyle", "v-neck");
    clearSleevelessExpressSession();
    expect(readActiveCustomPatternProjectId()).toBe("");
    expect(localStorage.getItem(CUSTOM_PATTERN_ACTIVE_PROJECT_ID_KEY)).toBeNull();
    expect(localStorage.getItem(PATTERN_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem("bodyShape")).toBeNull();
    expect(localStorage.getItem("garmentType")).toBeNull();
    expect(localStorage.getItem("necklineStyle")).toBeNull();
  });
});
