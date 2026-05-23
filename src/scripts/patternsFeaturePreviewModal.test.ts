import { describe, expect, it, vi } from "vitest";
import {
  handleFeaturePreviewOpenClick,
  normalizeFeatureMediaSrc,
  readFeaturePreviewFromTrigger,
  resolveFeaturePreviewTriggerFromClick,
} from "./patternsFeaturePreviewModal";

describe("patternsFeaturePreviewModal", () => {
  it("normalizes relative media paths to site-root URLs", () => {
    expect(normalizeFeatureMediaSrc("images/foo.gif")).toBe("/images/foo.gif");
    expect(normalizeFeatureMediaSrc("/images/foo.gif")).toBe("/images/foo.gif");
    expect(normalizeFeatureMediaSrc("  ")).toBe("");
  });

  it("reads title and media from trigger data attributes", () => {
    const trigger = {
      getAttribute: (name: string) => {
        if (name === "data-feature-title") return "Japanese Shaping Notation";
        if (name === "data-feature-media") return "/images/patterns/sleeveless/features/shaping-notation.gif";
        return null;
      },
    };
    expect(readFeaturePreviewFromTrigger(trigger)).toEqual({
      title: "Japanese Shaping Notation",
      media: "/images/patterns/sleeveless/features/shaping-notation.gif",
    });
  });

  it("returns null when title or media is missing", () => {
    expect(
      readFeaturePreviewFromTrigger({
        getAttribute: () => "",
      }),
    ).toBeNull();
  });

  it("handleFeaturePreviewOpenClick prevents default only for feature card buttons", () => {
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    const trigger = handleFeaturePreviewOpenClick({
      preventDefault,
      stopPropagation,
      target: {
        closest: (sel: string) => {
          if (sel !== "[data-patterns-feature-preview-root] [data-feature-media]") return null;
          return {
            tagName: "BUTTON",
            getAttribute: (name: string) => (name === "type" ? "button" : null),
            hasAttribute: () => false,
          };
        },
      },
    });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(trigger).not.toBeNull();
  });

  it("handleFeaturePreviewOpenClick does not block unrelated link clicks", () => {
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    const trigger = handleFeaturePreviewOpenClick({
      preventDefault,
      stopPropagation,
      target: {
        closest: () => null,
      },
    });
    expect(preventDefault).not.toHaveBeenCalled();
    expect(stopPropagation).not.toHaveBeenCalled();
    expect(trigger).toBeNull();
  });

  it("resolveFeaturePreviewTriggerFromClick rejects anchors and non-buttons", () => {
    expect(
      resolveFeaturePreviewTriggerFromClick({
        closest: () => ({
          tagName: "A",
          getAttribute: () => null,
          hasAttribute: (name: string) => name === "href",
        }),
      }),
    ).toBeNull();

    expect(
      resolveFeaturePreviewTriggerFromClick({
        closest: () => ({
          tagName: "BUTTON",
          getAttribute: () => "submit",
          hasAttribute: () => false,
        }),
      }),
    ).toBeNull();
  });
});
