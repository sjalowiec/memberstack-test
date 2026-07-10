import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hasAuthoritativeUrlSavedPatternId,
  readSavedPatternProjectIdFromUrl,
  SAVED_PATTERN_VIEW_PROJECT_QUERY_KEY,
  withSavedPatternProjectId,
} from "./savedPatternViewUrl";

describe("savedPatternViewUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses `project` as the query key", () => {
    expect(SAVED_PATTERN_VIEW_PROJECT_QUERY_KEY).toBe("project");
  });

  it("appends the project id to a relative view href", () => {
    expect(withSavedPatternProjectId("/patterns/sleeveless/pattern/", "proj-a")).toBe(
      "/patterns/sleeveless/pattern/?project=proj-a",
    );
    expect(withSavedPatternProjectId("/patterns/drop-shoulder/pattern/", "proj-b")).toBe(
      "/patterns/drop-shoulder/pattern/?project=proj-b",
    );
  });

  it("preserves existing query params and hash", () => {
    expect(withSavedPatternProjectId("/patterns/sleeveless/pattern/?tab=pattern#top", "proj-c")).toBe(
      "/patterns/sleeveless/pattern/?tab=pattern&project=proj-c#top",
    );
  });

  it("replaces an existing project id rather than duplicating it", () => {
    expect(withSavedPatternProjectId("/patterns/sleeveless/pattern/?project=old", "new")).toBe(
      "/patterns/sleeveless/pattern/?project=new",
    );
  });

  it("returns the href unchanged when the id is empty", () => {
    expect(withSavedPatternProjectId("/patterns/sleeveless/pattern/", "")).toBe(
      "/patterns/sleeveless/pattern/",
    );
    expect(withSavedPatternProjectId("/patterns/sleeveless/pattern/", "   ")).toBe(
      "/patterns/sleeveless/pattern/",
    );
  });

  it("reads the project id back from a url", () => {
    expect(readSavedPatternProjectIdFromUrl("/patterns/sleeveless/pattern/?project=proj-a")).toBe(
      "proj-a",
    );
    expect(readSavedPatternProjectIdFromUrl("/patterns/sleeveless/pattern/")).toBe("");
    expect(readSavedPatternProjectIdFromUrl(undefined)).toBe("");
  });

  it("hasAuthoritativeUrlSavedPatternId reflects presence of the id", () => {
    expect(hasAuthoritativeUrlSavedPatternId("/patterns/drop-shoulder/pattern/?project=x")).toBe(true);
    expect(hasAuthoritativeUrlSavedPatternId("/patterns/drop-shoulder/pattern/")).toBe(false);
  });
});
