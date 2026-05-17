import { describe, expect, it } from "vitest";
import {
  customPatternProjectBlobKey,
  customPatternProjectsListPrefix,
} from "./customPatternProjectStoreKeys";

describe("customPatternProjectStoreKeys", () => {
  it("builds blob keys as family/userId/projectId.json", () => {
    expect(customPatternProjectBlobKey("sleeveless", "ms_abc", "proj-1")).toBe(
      "sleeveless/ms_abc/proj-1.json",
    );
  });

  it("sanitizes unsafe characters in key segments", () => {
    expect(customPatternProjectBlobKey("sleeveless", "user/id", "proj 2")).toBe(
      "sleeveless/user_id/proj_2.json",
    );
  });

  it("builds list prefix for a user family folder", () => {
    expect(customPatternProjectsListPrefix("sleeveless", "ms_abc")).toBe("sleeveless/ms_abc/");
  });
});
