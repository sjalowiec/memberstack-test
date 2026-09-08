import { describe, expect, it, vi } from "vitest";

import {
  parseHelpHubPreviewBody,
  resolveHelpHubPreviewTip,
  helpHubPreviewUrlExposesDocument,
  HELP_HUB_PREVIEW_PATH,
} from "./previewDocument";

describe("parseHelpHubPreviewBody", () => {
  it("renders unsaved editor fields from the posted document", () => {
    const parsed = parseHelpHubPreviewBody({
      document: {
        slug: "patterns-for-lk150",
        title: "Unsaved title",
        status: "draft",
        question: "Unsaved question",
      },
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok && parsed.mode === "document") {
      expect(parsed.tip.title).toBe("Unsaved title");
      expect(parsed.tip.slug).toBe("patterns-for-lk150");
      expect(parsed.tip.status).toBe("draft");
    }
  });

  it("accepts a saved slug without putting the document in a URL", () => {
    const parsed = parseHelpHubPreviewBody({ slug: "patterns-for-lk150" });
    expect(parsed).toEqual({ ok: true, mode: "slug", slug: "patterns-for-lk150" });
    expect(helpHubPreviewUrlExposesDocument(HELP_HUB_PREVIEW_PATH)).toBe(false);
    expect(helpHubPreviewUrlExposesDocument("/help-hub/preview?data=%7B%22title%22%3A%22x%22%7D")).toBe(
      true,
    );
  });
});

describe("resolveHelpHubPreviewTip", () => {
  it("does not load or persist when a document is posted", async () => {
    const loadBySlug = vi.fn();
    const result = await resolveHelpHubPreviewTip(
      {
        document: {
          slug: "patterns-for-lk150",
          title: "Edited in the form",
          status: "draft",
        },
      },
      loadBySlug,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tip.title).toBe("Edited in the form");
    expect(loadBySlug).not.toHaveBeenCalled();
  });

  it("loads a saved draft by slug and does not persist", async () => {
    const loadBySlug = vi.fn(async (slug: string) => ({
      slug,
      title: "Saved draft",
      status: "draft",
    }));
    const result = await resolveHelpHubPreviewTip({ slug: "patterns-for-lk150" }, loadBySlug);
    expect(result.ok).toBe(true);
    expect(loadBySlug).toHaveBeenCalledTimes(1);
    expect(loadBySlug).toHaveBeenCalledWith("patterns-for-lk150");
  });
});
