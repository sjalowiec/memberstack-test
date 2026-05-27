import { beforeEach, describe, expect, it } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  clearActiveCustomPatternProjectId,
  writeActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import {
  PATTERN_WORKSPACE_EXPRESS_TAB_LABEL_CREATE,
  PATTERN_WORKSPACE_EXPRESS_TAB_LABEL_EDIT,
  resolvePatternWorkspaceExpressTabLabel,
} from "./patternWorkspaceExpressTabLabel";

describe("resolvePatternWorkspaceExpressTabLabel", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    clearActiveCustomPatternProjectId();
  });

  it("returns Create when no saved project is active", () => {
    expect(resolvePatternWorkspaceExpressTabLabel()).toBe(
      PATTERN_WORKSPACE_EXPRESS_TAB_LABEL_CREATE,
    );
  });

  it("returns Edit when a saved project id is active", () => {
    writeActiveCustomPatternProjectId("proj-1", "My Vest");
    expect(resolvePatternWorkspaceExpressTabLabel()).toBe(
      PATTERN_WORKSPACE_EXPRESS_TAB_LABEL_EDIT,
    );
  });
});
