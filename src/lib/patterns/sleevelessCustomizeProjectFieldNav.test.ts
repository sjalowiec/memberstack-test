import { afterEach, describe, expect, it, vi } from "vitest";
import {
  consumeCustomizeProjectFieldHash,
  customizeReviewHrefForField,
  parseCustomizeProjectFieldHash,
} from "./sleevelessCustomizeProjectFieldNav";

describe("sleevelessCustomizeProjectFieldNav", () => {
  it("builds review URLs with edit hashes", () => {
    expect(customizeReviewHrefForField("title")).toBe("/patterns/sleeveless/review/#edit-title");
    expect(customizeReviewHrefForField("notes")).toBe("/patterns/sleeveless/review/#edit-notes");
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
        pathname: "/patterns/sleeveless/review/",
        search: "",
      },
    });
    expect(consumeCustomizeProjectFieldHash()).toBe("notes");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/patterns/sleeveless/review/");
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
