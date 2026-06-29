import { describe, expect, it } from "vitest";
import { validateLessonInput } from "../legacy_kin/courseContentAdmin";

describe("validateLessonInput embeddedTool", () => {
  it("accepts embeddedTool components with toolKey", () => {
    const result = validateLessonInput({
      title: "Test lesson",
      slug: "test-lesson",
      displayOrder: 1,
      legacy: { itemId: 1, lessonOrder: 1 },
      blocks: [
        {
          title: "Calculator",
          slug: "calculator-block",
          order: 1,
          legacy: { assignId: 100, blockType: "HTML" },
          components: [
            {
              type: "embeddedTool",
              toolKey: "maximum-knitted-width",
              legacyComponentId: 9001,
              order: 1,
            },
          ],
        },
      ],
    });

    expect("error" in result).toBe(false);
    if ("error" in result) return;

    const component = result.blocks[0]?.components[0];
    expect(component?.type).toBe("embeddedTool");
    if (component?.type === "embeddedTool") {
      expect(component.toolKey).toBe("maximum-knitted-width");
    }
  });

  it("accepts yarn-estimator embeddedTool components", () => {
    const result = validateLessonInput({
      title: "Blanket lesson",
      slug: "blanket-lesson",
      displayOrder: 1,
      legacy: { itemId: 2, lessonOrder: 1 },
      blocks: [
        {
          title: "Yarn check",
          slug: "yarn-check",
          order: 1,
          legacy: { assignId: 101, blockType: "HTML" },
          components: [
            {
              type: "embeddedTool",
              toolKey: "yarn-estimator",
              legacyComponentId: 9002,
              order: 1,
            },
          ],
        },
      ],
    });

    expect("error" in result).toBe(false);
    if ("error" in result) return;

    const component = result.blocks[0]?.components[0];
    expect(component?.type).toBe("embeddedTool");
    if (component?.type === "embeddedTool") {
      expect(component.toolKey).toBe("yarn-estimator");
    }
  });
});
