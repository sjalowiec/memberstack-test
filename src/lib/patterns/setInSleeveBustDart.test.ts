import { beforeEach, describe, expect, it } from "vitest";
import { buildBustDartPatternContext } from "./bustDartPatternCustomization";
import { BUST_DART_STYLE_KEY } from "./legoBlocks/bustDart";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { renderSleevelessPrintPieceHtml } from "./sleevelessPatternPrintRender";
import { generateSetInSleevePattern } from "./setInSleevePatternOutput";
import { withSetInSleeveConstructionAuthored } from "./setInSleeveConstructionIdentity";
import { stubLocalStorage } from "./test/stubLocalStorage";

function missesSetIn(extraStyle: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "misses",
      easeChoice: "close",
      selectedMeasurements: {
        finished_bust_chest: 39,
        finished_hip: 39,
        finished_waist: 30,
        back_neck_to_hem: 24,
        armhole_depth: 7.5,
        neck_width: 7,
        shoulder_width: 13.5,
        front_neck_depth: 5,
        back_neck_depth: 1,
        upper_arm: 11.25,
        wrist: 6,
        sleeve_length: 17,
      },
    },
    style: withSetInSleeveConstructionAuthored(
      {
        recipientCategory: "misses",
        garmentStyle: "pullover",
        neckline: "round",
        bodyShape: "straight",
        ...extraStyle,
      },
      "long",
    ),
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 10,
      gaugeRowsPerInch: 15,
      availableNeedles: 200,
    },
  };
}

function bodyRows(rows: ReadonlyArray<{ kind: string; title?: string }>) {
  const start = rows.findIndex((row) => row.kind === "section" && row.title === "BODY");
  const armhole = rows.findIndex((row) => row.kind === "section" && row.title === "ARMHOLE");
  return rows.slice(start + 1, armhole < 0 ? undefined : armhole);
}

function textOf(rows: ReadonlyArray<{ kind: string; paragraphs?: string[] }>): string {
  return rows
    .filter((row) => row.kind === "block")
    .map((row) => (row.paragraphs ?? []).join(" "))
    .join("\n");
}

describe("set-in sleeve bust dart", () => {
  beforeEach(() => {
    stubLocalStorage();
  });

  it("places the optional block in the Misses front BODY and names the dialog Set-in Sleeve", () => {
    const data = missesSetIn();
    const pattern = generateSetInSleevePattern(data);
    const sleeveless = generateSleevelessBackPattern(data);
    const slot = pattern.frontDisplayRows.find((row) => row.kind === "bustDartCustomization");
    const body = bodyRows(pattern.frontDisplayRows);

    expect(slot?.kind).toBe("bustDartCustomization");
    expect(slot?.kind === "bustDartCustomization" && slot.active).toBe(false);
    expect(body.some((row) => row.kind === "bustDartCustomization")).toBe(true);
    expect(pattern.displayRows.some((row) => row.kind === "bustDartCustomization")).toBe(false);
    expect(pattern.sleeveDisplayRows.some((row) => row.kind === "bustDartCustomization")).toBe(false);

    const context = buildBustDartPatternContext(data);
    expect(context.summary.constructionLabel).toBe("Set-in Sleeve");
    expect(context.summary.summaryLine).toMatch(/^Set-in Sleeve Pullover • Misses /);
    expect(context.armholeOpeningGarmentRc).toBe(pattern.debug.armholeStartRow);
    expect(context.hemRows).toBe(pattern.debug.hemRows);
    expect(context.bodyToArmholeRows).toBe(pattern.debug.bodyRows);
    expect(context.frontStitchCount).toBe(pattern.debug.bustBodyStitches);
    expect(sleeveless.debug.armholeStartRow).toBe(pattern.debug.armholeStartRow);
  });

  it("keeps men's set-in patterns on the existing eligibility rule", () => {
    const data = missesSetIn();
    const style = data.style as Record<string, unknown>;
    const fit = data.fit as Record<string, unknown>;
    style.recipientCategory = "men";
    fit.sizingChart = "men";
    const pattern = generateSetInSleevePattern(data);
    expect(pattern.frontDisplayRows.some((row) => row.kind === "bustDartCustomization")).toBe(false);
  });

  it("prints an applied dart with the front and leaves the Add control off the page", () => {
    const off = generateSetInSleevePattern(missesSetIn());
    const on = generateSetInSleevePattern(
      missesSetIn({ [BUST_DART_STYLE_KEY]: { enabled: true, cupSize: "C" } }),
    );
    const slot = on.frontDisplayRows.find((row) => row.kind === "bustDartCustomization");
    expect(slot?.kind === "bustDartCustomization" && slot.active).toBe(true);
    const dartText =
      slot?.kind === "bustDartCustomization" ? slot.instructionParagraphs.join("\n") : "";
    expect(dartText).toMatch(/Stop the row counter at RC \d+, 1″ below the armhole opening/i);
    expect(textOf(on.frontDisplayRows)).toMatch(/Knit 202 rows to RC: 232/);
    expect(textOf(on.frontDisplayRows)).toMatch(/Knit 15 rows even to RC: 247/);
    expect(textOf(on.displayRows)).toBe(textOf(off.displayRows));
    expect(textOf(on.sleeveDisplayRows)).toBe(textOf(off.sleeveDisplayRows));

    const screenOff = on.frontDisplayRows
      .filter((row) => row.kind === "bustDartCustomization")
      .map((row) => (row.kind === "bustDartCustomization" ? row.active : false));
    expect(screenOff).toEqual([true]);

    const printOn = renderSleevelessPrintPieceHtml(on.frontDisplayRows, "", "front");
    const printOff = renderSleevelessPrintPieceHtml(off.frontDisplayRows, "", "front");
    expect(printOn).toContain(dartText.split("\n")[0] ?? "missing dart instruction");
    expect(printOn).not.toContain("Add Bust Dart");
    expect(printOn).not.toContain("Update Bust Dart");
    expect(printOff).not.toContain("Optional Bust Dart");
    expect(printOff).not.toContain("Add Bust Dart");
    expect(renderSleevelessPrintPieceHtml(on.displayRows, "", "back")).toBe(
      renderSleevelessPrintPieceHtml(off.displayRows, "", "back"),
    );
    expect(renderSleevelessPrintPieceHtml(on.sleeveDisplayRows, "", "sleeve")).toBe(
      renderSleevelessPrintPieceHtml(off.sleeveDisplayRows, "", "sleeve"),
    );

    const removed = generateSetInSleevePattern(
      missesSetIn({ [BUST_DART_STYLE_KEY]: { enabled: false, cupSize: null } }),
    );
    const removedSlot = removed.frontDisplayRows.find((row) => row.kind === "bustDartCustomization");
    expect(removedSlot?.kind === "bustDartCustomization" && removedSlot.active).toBe(false);
    expect(textOf(removed.frontDisplayRows)).not.toMatch(/Stop the row counter at RC/i);
  });
});
