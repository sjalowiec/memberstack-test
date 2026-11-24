import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { draftForBuilderSize, mittenBuilderReady } from "./mittenBuilderState";
import { womanSmallExampleDraft } from "./mittenDraft";

describe("mitten builder steps", () => {
  it("loads chart measurements when a size is chosen and keeps later edits for that size", () => {
    const child = draftForBuilderSize({
      sizeId: "child_2_4",
      previous: null,
      stitchGaugePer4: "",
      rowGaugePer4: "",
      thumbStyle: "",
    });
    expect(child?.thumbLength).toBe("1.8");
    expect(child?.cuffCircumference).toBe("5");
    expect(child?.thumbStyle).toBeUndefined();

    const edited = child ? { ...child, cuffCircumference: "5.25", thumbStyle: "gored" as const } : null;
    const sameSize = draftForBuilderSize({
      sizeId: "child_2_4",
      previous: edited,
      stitchGaugePer4: "28",
      rowGaugePer4: "40",
      thumbStyle: "gored",
    });
    expect(sameSize?.cuffCircumference).toBe("5.25");
    expect(sameSize?.thumbStyle).toBe("gored");
    expect(sameSize?.stitchGaugePer4).toBe("28");

    const woman = draftForBuilderSize({
      sizeId: "woman_sm",
      previous: sameSize,
      stitchGaugePer4: "28",
      rowGaugePer4: "40",
      thumbStyle: "gored",
    });
    expect(woman?.thumbLength).toBe("2.4");
    expect(woman?.cuffCircumference).toBe("6.5");
    expect(woman?.thumbStyle).toBe("gored");
  });

  it("uses the approved child and adult thumb lengths from the chart", () => {
    const lengths = ["child_2_4", "child_4_6", "child_6_8", "woman_lg", "man_med"].map((sizeId) =>
      draftForBuilderSize({
        sizeId,
        previous: null,
        stitchGaugePer4: "28",
        rowGaugePer4: "40",
        thumbStyle: "slotted",
      })?.thumbLength,
    );
    expect(lengths).toEqual(["1.8", "1.8", "2", "2.4", "2.6"]);
  });

  it("is ready only after size, thumb, and gauge", () => {
    expect(
      mittenBuilderReady({
        sizeId: "woman_sm",
        thumbStyle: "",
        stitchGaugePer4: "28",
        rowGaugePer4: "40",
      }),
    ).toBe(false);
    expect(
      mittenBuilderReady({
        sizeId: "woman_sm",
        thumbStyle: "slotted",
        stitchGaugePer4: "28",
        rowGaugePer4: "40",
      }),
    ).toBe(true);
    expect(womanSmallExampleDraft().thumbStyle).toBe("slotted");
  });
});

describe("mitten builder pages", () => {
  const builder = readFileSync("src/pages/patterns/mittens/builder.astro", "utf8");
  const summary = readFileSync("src/pages/patterns/mittens/summary/index.astro", "utf8");
  const fields = readFileSync("src/lib/patterns/mitten/mittenSummaryFields.ts", "utf8");

  it("uses the shared builder steps and leaves measurements for summary", () => {
    expect(builder).toContain('data-pill-step={s.step}');
    expect(builder).toContain('data-express-step="1"');
    expect(builder).toContain('data-express-step="2"');
    expect(builder).toContain('data-express-step="3"');
    expect(builder).toContain('data-choice');
    expect(builder).toContain('data-field="thumbStyle"');
    expect(builder).toContain('data-value="slotted"');
    expect(builder).toContain('data-value="gored"');
    expect(builder).toContain('src="/images/patterns/mittens.png"');
    expect(builder).toContain("/images/patterns/mittens/picker/slotted-thumb.webp");
    expect(builder).toContain("/images/patterns/mittens/picker/gored-thumb.webp");
    expect(builder).toContain("object-fit: contain");
    expect(builder).toContain("GaugeInput");
    expect(builder).not.toContain("mitten-cuff-circ");
    expect(builder).not.toContain("still need to be checked");
    expect(builder).not.toContain("temporary");
    expect(builder).not.toContain("Child 9–12");
  });

  it("reviews measurements with the shared summary workspace", () => {
    expect(summary).toContain("PatternSummaryEditWorkspace");
    expect(summary).toContain("PatternSummaryMeasurementChip");
    expect(summary).toContain("mitten-thumb-style");
    expect(summary).toContain("mitten-stitch-gauge");
    expect(fields).toContain("From the thumb web to the thumb tip. The gore is not added.");
    expect(summary).not.toContain("still need to be checked");
    expect(summary).not.toContain("temporary");
    expect(summary).not.toContain("Child 9–12");
  });
});
