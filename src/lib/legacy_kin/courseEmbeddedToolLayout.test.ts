import { describe, expect, it } from "vitest";
import {
  embeddedToolLayoutSummary,
  EMBEDDED_TOOL_INTRO_ROLE,
  getEmbeddedToolLayoutParts,
  isEmbeddedToolLayoutBlock,
} from "./courseEmbeddedToolLayout";

describe("isEmbeddedToolLayoutBlock", () => {
  it("matches a block with only an embedded tool", () => {
    expect(
      isEmbeddedToolLayoutBlock({
        components: [{ type: "embeddedTool", toolKey: "yarn-estimator", order: 1 }],
      }),
    ).toBe(true);
  });

  it("matches intro richText plus embedded tool", () => {
    expect(
      isEmbeddedToolLayoutBlock({
        components: [
          { type: "richText", html: "<p>Try this</p>", order: 1, layoutRole: EMBEDDED_TOOL_INTRO_ROLE },
          { type: "embeddedTool", toolKey: "maximum-knitted-width", order: 2 },
        ],
      }),
    ).toBe(true);
  });

  it("rejects blocks with multiple tools", () => {
    expect(
      isEmbeddedToolLayoutBlock({
        components: [
          { type: "embeddedTool", toolKey: "yarn-estimator", order: 1 },
          { type: "embeddedTool", toolKey: "maximum-knitted-width", order: 2 },
        ],
      }),
    ).toBe(false);
  });
});

describe("getEmbeddedToolLayoutParts", () => {
  it("returns intro text when present", () => {
    const parts = getEmbeddedToolLayoutParts({
      components: [
        { type: "richText", html: "<p>Measure your swatch first.</p>", order: 1, layoutRole: EMBEDDED_TOOL_INTRO_ROLE },
        { type: "embeddedTool", toolKey: "yarn-estimator", order: 2, legacyComponentId: 42 },
      ],
    });

    expect(parts?.tool.legacyComponentId).toBe(42);
    expect(String(parts?.introText?.html ?? "")).toContain("Measure your swatch");
  });
});

describe("embeddedToolLayoutSummary", () => {
  it("includes intro preview and tool key", () => {
    const summary = embeddedToolLayoutSummary({
      introText: { html: "<p>Check your gauge before continuing.</p>" },
      tool: { toolKey: "maximum-knitted-width" },
    });

    expect(summary).toContain("Check your gauge");
    expect(summary).toContain("maximum-knitted-width");
  });
});
