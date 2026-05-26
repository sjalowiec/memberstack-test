import { beforeEach, describe, expect, it } from "vitest";
import {
  clearActiveCustomPatternProjectId,
  CUSTOM_PATTERN_ACTIVE_PROJECT_ID_KEY,
  CUSTOM_PATTERN_ACTIVE_PROJECT_NAME_KEY,
  readActiveCustomPatternProjectId,
  readActiveCustomPatternProjectLinkedName,
  writeActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import { stubLocalStorage } from "./test/stubLocalStorage";

describe("customPatternProjectActiveId", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("reads and writes the active saved project id", () => {
    expect(readActiveCustomPatternProjectId()).toBe("");
    writeActiveCustomPatternProjectId("proj-abc");
    expect(readActiveCustomPatternProjectId()).toBe("proj-abc");
    expect(localStorage.getItem(CUSTOM_PATTERN_ACTIVE_PROJECT_ID_KEY)).toBe("proj-abc");
  });

  it("stores the linked project name for save-copy defaults", () => {
    writeActiveCustomPatternProjectId("proj-abc", "Aubrey's Vest");
    expect(readActiveCustomPatternProjectLinkedName()).toBe("Aubrey's Vest");
    expect(localStorage.getItem(CUSTOM_PATTERN_ACTIVE_PROJECT_NAME_KEY)).toBe("Aubrey's Vest");
  });

  it("clearActiveCustomPatternProjectId removes the link without touching other keys", () => {
    localStorage.setItem("kbm_current_pattern", "{}");
    writeActiveCustomPatternProjectId("proj-old");
    clearActiveCustomPatternProjectId();
    expect(readActiveCustomPatternProjectId()).toBe("");
    expect(readActiveCustomPatternProjectLinkedName()).toBe("");
    expect(localStorage.getItem(CUSTOM_PATTERN_ACTIVE_PROJECT_ID_KEY)).toBeNull();
    expect(localStorage.getItem(CUSTOM_PATTERN_ACTIVE_PROJECT_NAME_KEY)).toBeNull();
    expect(localStorage.getItem("kbm_current_pattern")).toBe("{}");
  });
});
