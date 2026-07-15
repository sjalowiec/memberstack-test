import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FIT_EASE_INCHES_BY_CHOICE } from "./fitEaseInches";
import {
  buildExpressStandardBodyMeasurementsSummaryFromRow,
  computeDefaultMeasurementsFromChartRow,
  formatBodyMeasurementDisplay,
} from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import {
  EXPRESS_BUILDER_SIZE_HEADING,
  EXPRESS_BUILDER_SIZE_INSTRUCTION,
  EXPRESS_BUILDER_SWEATER_SIZING_CHART_LINK_LABEL,
} from "./expressBuilderCopy";

const dropShoulderBuilderAstro = readFileSync(
  resolve("src/pages/patterns/drop-shoulder/builder.astro"),
  "utf8",
);
const sleevelessBuilderAstro = readFileSync(
  resolve("src/pages/patterns/sleeveless/builder.astro"),
  "utf8",
);
const customBuildDesignAstro = readFileSync(
  resolve("src/pages/patterns/sleeveless/custom-build/design/index.astro"),
  "utf8",
);

const sizeFitCopy = {
  sizingChartLabel: EXPRESS_BUILDER_SWEATER_SIZING_CHART_LINK_LABEL,
  sizeHeading: EXPRESS_BUILDER_SIZE_HEADING,
  sizeInstruction: EXPRESS_BUILDER_SIZE_INSTRUCTION,
  fitHeading: "Choose a starting fit",
  fitInstruction:
    "Your selected fit adds ease to the standard body measurements shown above. You can adjust the finished garment measurements after the pattern is built.",
  summaryMarker: "data-express-size-standard-body-summary",
} as const;

const sampleRow: ChartRow = {
  size: 8,
  bust_or_chest: 37,
  waist: 29,
  hip: 39,
  upper_arm: 12.25,
};

const whoSizeSection = readFileSync(
  resolve("src/components/patterns/ExpressBuilderWhoSizeSection.astro"),
  "utf8",
);

function expectBuilderSizeFitClarity(builderSource: string, fitStep: "3" | "4"): void {
  expect(builderSource).toContain("ExpressBuilderWhoSizeSection");
  expect(builderSource).toContain("buildSweaterSizingChartHref");
  expect(builderSource).toContain("sweaterSizingChartHref={sweaterSizingChartHref}");
  expect(whoSizeSection).toContain("expressBuilderCopy");
  expect(whoSizeSection).toContain("EXPRESS_BUILDER_SWEATER_SIZING_CHART_LINK_LABEL");
  expect(whoSizeSection).toContain("EXPRESS_BUILDER_SIZE_HEADING");
  expect(whoSizeSection).toContain("EXPRESS_BUILDER_SIZE_INSTRUCTION");
    expect(EXPRESS_BUILDER_SIZE_INSTRUCTION).toContain("Select the body bust/chest measurement closest to your own");
  expect(builderSource).toContain(sizeFitCopy.fitHeading);
  expect(builderSource).toContain(sizeFitCopy.fitInstruction);
  expect(whoSizeSection).toContain(sizeFitCopy.summaryMarker);
  expect(builderSource).toContain('data-value="close"');
  expect(builderSource).toContain('data-value="standard"');
  expect(builderSource).toContain('data-value="relaxed"');
  expect(builderSource).toContain('formatFitEaseApproxLabel("close")');
  expect(builderSource).toContain('formatFitEaseApproxLabel("standard")');
  expect(builderSource).toContain('formatFitEaseApproxLabel("relaxed")');
  expect(builderSource).toContain(`express-step-${fitStep}-title`);
}

describe("Drop Shoulder builder size and fit clarity", () => {
  it("includes shared size/fit explanatory UI", () => {
    expectBuilderSizeFitClarity(dropShoulderBuilderAstro, "3");
    expect(dropShoulderBuilderAstro).toContain(
      'buildSweaterSizingChartHref("/patterns/drop-shoulder/builder")',
    );
  });
});

describe("Sleeveless builder size and fit clarity", () => {
  it("includes shared size/fit explanatory UI", () => {
    expectBuilderSizeFitClarity(sleevelessBuilderAstro, "4");
    expect(sleevelessBuilderAstro).toContain(
      'buildSweaterSizingChartHref("/patterns/sleeveless/builder")',
    );
  });
});

describe("Express builder selected-size standard body measurements", () => {
  it("uses chart body measurements without fit ease", () => {
    const summary = buildExpressStandardBodyMeasurementsSummaryFromRow("8", sampleRow, "in");
    expect(summary.heading).toBe("Size 8 standard body measurements");
    expect(summary.measurements).toEqual([
      { label: "Bust/Chest", value: '37"' },
      { label: "Waist", value: '29"' },
      { label: "Hip", value: '39"' },
      { label: "Upper Arm", value: '12.25"' },
    ]);

    const finished = computeDefaultMeasurementsFromChartRow(sampleRow, "standard");
    expect(finished.finished_bust_chest).toBe(37 + FIT_EASE_INCHES_BY_CHOICE.standard);
    expect(formatBodyMeasurementDisplay(sampleRow, "bust_or_chest", "in")).toBe('37"');
  });

  it("updates displayed body measurements when the selected chart row changes", () => {
    const otherRow: ChartRow = {
      size: 10,
      bust_or_chest: 39,
      waist: 31,
      hip: 41,
      upper_arm: 12.75,
    };
    const size8 = buildExpressStandardBodyMeasurementsSummaryFromRow("8", sampleRow, "in");
    const size10 = buildExpressStandardBodyMeasurementsSummaryFromRow("10", otherRow, "in");
    expect(size8.measurements[0]?.value).toBe('37"');
    expect(size10.measurements[0]?.value).toBe('39"');
    expect(size8.measurements[2]?.value).toBe('39"');
    expect(size10.measurements[2]?.value).toBe('41"');
  });

  it("shows an em dash when a chart field is missing", () => {
    const sparseRow: ChartRow = {
      size: "2 yr",
      bust_or_chest: 21,
      waist: 21,
      hip: "",
      upper_arm: 6,
    };
    expect(formatBodyMeasurementDisplay(sparseRow, "hip", "in")).toBe("\u2014");
  });
});

describe("Other Express size flows", () => {
  it("does not add the builder summary marker to Custom Build design", () => {
    expect(customBuildDesignAstro).not.toContain(sizeFitCopy.summaryMarker);
    expect(customBuildDesignAstro).not.toContain(sizeFitCopy.sizingChartLabel);
  });
});
