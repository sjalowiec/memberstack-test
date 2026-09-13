import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EXPRESS_BUILDER_INTRO_SUBTEXT,
  EXPRESS_BUILDER_SIZE_HEADING,
  EXPRESS_BUILDER_SIZE_INSTRUCTION,
  EXPRESS_BUILDER_SIZE_RANGE_HEADING,
  EXPRESS_BUILDER_SIZE_TABLE_BODY_BUST_CHEST_COLUMN,
  EXPRESS_BUILDER_SWEATER_SIZING_CHART_LINK_LABEL,
} from "./expressBuilderCopy";

const sleevelessBuilderAstro = readFileSync(
  resolve("src/pages/patterns/sleeveless/builder.astro"),
  "utf8",
);
const dropShoulderBuilderAstro = readFileSync(
  resolve("src/pages/patterns/drop-shoulder/builder.astro"),
  "utf8",
);
const whoSizeSection = readFileSync(
  resolve("src/components/patterns/ExpressBuilderWhoSizeSection.astro"),
  "utf8",
);

describe("expressBuilderCopy", () => {
  it("defines the shared builder introduction", () => {
    expect(EXPRESS_BUILDER_INTRO_SUBTEXT).toBe(
      "Start with the closest size. We'll fill in the measurements for you, and if you own the pattern, you can customize every measurement later.",
    );
  });

  it("defines the shared size section copy", () => {
    expect(EXPRESS_BUILDER_SIZE_RANGE_HEADING).toBe("Size Range");
    expect(EXPRESS_BUILDER_SIZE_HEADING).toBe("Choose your starting size");
    expect(EXPRESS_BUILDER_SIZE_INSTRUCTION).toBe(
      "Select the body bust/chest measurement closest to your own. We'll use the Knit It Now standard sizing chart as the starting point for your sweater.",
    );
    expect(EXPRESS_BUILDER_SIZE_TABLE_BODY_BUST_CHEST_COLUMN).toBe("Body Bust/Chest");
    expect(EXPRESS_BUILDER_SWEATER_SIZING_CHART_LINK_LABEL).toBe("View the sweater sizing chart");
  });
});

describe("expressBuilderCopy wiring", () => {
  it("uses shared intro copy in both unified builders", () => {
    expect(sleevelessBuilderAstro).toContain("expressBuilderCopy");
    expect(sleevelessBuilderAstro).toContain("EXPRESS_BUILDER_INTRO_SUBTEXT");
    expect(sleevelessBuilderAstro).toContain("{EXPRESS_BUILDER_INTRO_SUBTEXT}");
    expect(dropShoulderBuilderAstro).toContain("expressBuilderCopy");
    expect(dropShoulderBuilderAstro).toContain("EXPRESS_BUILDER_INTRO_SUBTEXT");
    expect(dropShoulderBuilderAstro).toContain("{EXPRESS_BUILDER_INTRO_SUBTEXT}");
    expect(sleevelessBuilderAstro).not.toContain("Create a ready-to-knit sweater pattern in a few guided steps.");
    expect(dropShoulderBuilderAstro).not.toContain(
      "Create a ready-to-knit drop shoulder sweater pattern in a few guided steps.",
    );
  });

  it("uses shared size copy in ExpressBuilderWhoSizeSection", () => {
    expect(whoSizeSection).toContain("expressBuilderCopy");
    expect(whoSizeSection).toContain("EXPRESS_BUILDER_SIZE_HEADING");
    expect(whoSizeSection).toContain("EXPRESS_BUILDER_SIZE_INSTRUCTION");
    expect(whoSizeSection).toContain("EXPRESS_BUILDER_SIZE_TABLE_BODY_BUST_CHEST_COLUMN");
    expect(whoSizeSection).toContain("{EXPRESS_BUILDER_SIZE_TABLE_BODY_BUST_CHEST_COLUMN}");
    expect(whoSizeSection).not.toContain(">Bust/Chest</th>");
    expect(whoSizeSection).toContain("EXPRESS_BUILDER_SWEATER_SIZING_CHART_LINK_LABEL");
    expect(whoSizeSection).toContain("{EXPRESS_BUILDER_SIZE_HEADING}");
    expect(whoSizeSection).toContain("{EXPRESS_BUILDER_SIZE_INSTRUCTION}");
    expect(whoSizeSection).toContain("{EXPRESS_BUILDER_SWEATER_SIZING_CHART_LINK_LABEL}");
  });

  it("uses shared Size Range heading in both unified builders", () => {
    expect(sleevelessBuilderAstro).toContain("EXPRESS_BUILDER_SIZE_RANGE_HEADING");
    expect(dropShoulderBuilderAstro).toContain("EXPRESS_BUILDER_SIZE_RANGE_HEADING");
    expect(sleevelessBuilderAstro).not.toContain(">Who & Size<");
    expect(dropShoulderBuilderAstro).not.toContain(">Who & Size<");
  });
});
