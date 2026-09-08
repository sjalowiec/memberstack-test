import { describe, expect, it } from "vitest";
import {
  clientTipAdminFieldErrors,
  parseTipAdminSaveJson,
} from "./adminSaveClient";

const filled = {
  tipId: "wrap-short-rows-2026-09",
  title: "Wrap for short rows",
  intro: "<p>Wrap the first needle in hold.</p>",
  videoContentId: "339",
  availableFrom: "2026-09-08",
  availableThrough: "2026-09-14",
  ctaText: "",
  ctaUrl: "",
};

describe("Tip of the Week admin save client", () => {
  it("does not treat optional empty CTA and Related Help as save blockers", () => {
    expect(clientTipAdminFieldErrors(filled)).toEqual([]);
    expect(
      clientTipAdminFieldErrors({
        ...filled,
        ctaText: "",
        ctaUrl: "   ",
        relatedLinks: [{ type: "video", videoId: "" }],
      }),
    ).toEqual([]);
  });

  it("returns field-level errors for missing required create fields", () => {
    const errors = clientTipAdminFieldErrors({
      tipId: "",
      title: "",
      intro: "<p><br></p>",
      videoContentId: "",
      availableFrom: "",
      availableThrough: "",
    });
    expect(errors.map((item) => item.field)).toEqual([
      "tipId",
      "title",
      "intro",
      "videoContentId",
      "availableFrom",
      "availableThrough",
    ]);
    expect(errors[0]?.error).toBe("Tip ID is required.");
  });

  it("requires CTA text and URL together", () => {
    const textOnly = clientTipAdminFieldErrors({
      ...filled,
      ctaText: "Build Your Sock Pattern",
    });
    expect(textOnly).toEqual([
      { field: "ctaUrl", error: "CTA URL is required when CTA text is set." },
    ]);
  });

  it("surfaces the actual API error instead of swallowing a non-JSON body", () => {
    const htmlFailure = parseTipAdminSaveJson(false, "<html>nope</html>");
    expect(htmlFailure.ok).toBe(false);
    if (htmlFailure.ok) return;
    expect(htmlFailure.error).toMatch(/did not return a usable response/i);

    const apiFailure = parseTipAdminSaveJson(false, {
      ok: false,
      error: "That Tip ID is already in use.",
      field: "tipId",
    });
    expect(apiFailure).toEqual({
      ok: false,
      error: "That Tip ID is already in use.",
      field: "tipId",
    });

    const saved = parseTipAdminSaveJson(true, {
      ok: true,
      tip: { tipId: filled.tipId },
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.tip).toEqual({ tipId: filled.tipId });
  });
});
