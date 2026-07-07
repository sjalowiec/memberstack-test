import { afterEach, describe, expect, it, vi } from "vitest";
import { OPEN_PATTERN_EDIT_WORKSPACE_HREF } from "./customPatternProjectNavigation";
import {
  consumeCustomizeProjectFieldHash,
  customizeReviewHrefForField,
  parseCustomizeProjectFieldHash,
} from "./sleevelessCustomizeProjectFieldNav";

describe("sleevelessCustomizeProjectFieldNav", () => {
  it("builds workspace edit URLs with edit hashes", () => {
    expect(customizeReviewHrefForField("title")).toBe(
      `${OPEN_PATTERN_EDIT_WORKSPACE_HREF}#edit-title`,
    );
    expect(customizeReviewHrefForField("notes")).toBe(
      `${OPEN_PATTERN_EDIT_WORKSPACE_HREF}#edit-notes`,
    );
    expect(customizeReviewHrefForField("title")).not.toContain("/review");
  });

  it("parses edit hashes", () => {
    expect(parseCustomizeProjectFieldHash("#edit-title")).toBe("title");
    expect(parseCustomizeProjectFieldHash("edit-notes")).toBe("notes");
    expect(parseCustomizeProjectFieldHash("#other")).toBeNull();
  });

  it("consumes hash from the URL without leaving the fragment", () => {
    const replaceState = vi.fn();
    vi.stubGlobal("history", { replaceState });
    vi.stubGlobal("window", {
      location: {
        hash: "#edit-notes",
        pathname: "/patterns/sleeveless/pattern/",
        search: "?edit=1",
      },
    });
    expect(consumeCustomizeProjectFieldHash()).toBe("notes");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/patterns/sleeveless/pattern/?edit=1");
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
