import { describe, expect, it } from "vitest";
import { buildCustomBuildEffectivePatternInput } from "../buildCustomBuildEffectivePatternInput";
import {
  setInActionNotationLines,
  type SetInNotationActionKind,
} from "./setInCenterSeamHalfNotation";
import { tryBuildLiveSleevelessFrontCardiganRoundNotationSvg } from "../sleevelessFrontCardiganRoundShapingNotationDiagramSvg";
import { tryBuildLiveSleevelessFrontStsRowsDiagramSvg } from "../sleevelessFrontStsRowsDiagramSvg";
import { renderPatternDisplayRowsHtml } from "../sleevelessPatternDisplayHtml";
import { tryBuildLiveSleevelessFrontRoundNotationSvg } from "../sleevelessFrontRoundShapingNotationDiagramSvg";
import {
  renderSetInCenterSeamNeckChartHtml,
  type SetInCenterSeamChartPiece,
} from "../setInSleevePrintShaping";
import { generateSetInSleevePattern } from "../setInSleevePatternOutput";

/**
 * Saved kin-dev project "set-in seaming test"
 * (sleeveless/kin-dev-set-in-sleeve-testing/53132fa0-04cb-4146-b0da-67ab97d68615).
 */
function seamingTestPattern(): Record<string, unknown> {
  return {
    style: {
      recipientCategory: "misses",
      bodyShape: "aline",
      frontStyle: "closed",
      garmentStyle: "pullover",
      length: "top",
      armholeStyle: "standard",
      patternMode: "express",
      neckline: "round",
      construction: "set-in-sleeve",
      constructionAuthored: "set-in-sleeve",
      sleeveLength: "long",
      sleeveDirection: "cuff-up",
      centerSeams: true,
    },
    fit: {
      sizingChart: "misses",
      selectedSize: "1",
      easeChoice: "standard",
      fitChoice: "standard",
      setInSleeveSizeLocked: true,
      selectedMeasurements: {
        finished_bust_chest: 34.5,
        finished_waist: 25.5,
        finished_hip: 36.5,
        back_neck_to_hem: 21,
        armhole_depth: 7,
        shoulder_width: 12,
        neck_width: 6,
        front_neck_depth: 4,
        back_neck_depth: 1,
        upper_arm: 9.75,
        wrist: 5.25,
        sleeve_length: 16.25,
      },
      cbMeasurementOverrides: {
        finishedNeckOpeningWidth: "6",
        neckDepth: "4",
        shoulderWidth: "12",
        armholeDepth: "7",
        chestBust: "34.5",
        hip: "50",
        finishedLength: "21",
        hemDepth: "2",
        sleeveLength: "16.25",
        wrist: "6",
        cuffDepth: "2",
        upperArm: "11.75",
      },
    },
    yarnGauge: {
      gaugeStitchRaw: "28",
      gaugeRowRaw: "44",
      gaugeRawUnit: "in",
      stitchGauge: "7",
      rowGauge: "11",
      gaugeUnits: "per_inch",
    },
    machine: { availableNeedles: "150" },
    measurements: {
      bodyBustOrChest: 31.5,
      bodyWaist: 22.5,
      bodyHip: 33.5,
      finishedBustOrChest: 34.5,
      finishedWaist: 34.5,
      finishedHip: 34.5,
    },
  };
}

type ChecklistAction = {
  rc: number;
  carriage: string;
  verb: string;
  amount: number;
  edge: string;
};

function checklistActions(html: string): ChecklistAction[] {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const actions: ChecklistAction[] = [];
  const re =
    /(\d{3}) \((Left|Right)\) (Bind off OR hold|Bind off|Decrease|Hold) (\d+) sts? (Neck|Shoulder|Armhole)/g;
  for (const match of text.matchAll(re)) {
    actions.push({
      rc: Number(match[1]),
      carriage: match[2] ?? "",
      verb: match[3] ?? "",
      amount: Number(match[4]),
      edge: match[5] ?? "",
    });
  }
  return actions;
}

function svgAttr(svg: string, name: string): string {
  return svg.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? "";
}

function notationKind(verb: string): SetInNotationActionKind {
  if (verb === "Hold") return "hold";
  if (verb === "Bind off") return "bindOff";
  if (verb === "Bind off OR hold") return "bindOffOrHold";
  return "decrease";
}

function notationLinesFromChecklist(actions: readonly ChecklistAction[]): string[] {
  return setInActionNotationLines(
    actions.map((action) => ({
      row: action.rc,
      amount: action.amount,
      kind: notationKind(action.verb),
    })),
  );
}

describe("set-in center-seam half notation", () => {
  const input = buildCustomBuildEffectivePatternInput({
    canonicalPattern: seamingTestPattern(),
    patternBuilderData: {},
  });
  const seamed = generateSetInSleevePattern(input);
  const pieces = seamed.centerSeamPieces!;

  function chart(piece: SetInCenterSeamChartPiece) {
    const half =
      piece === "left-back"
        ? pieces.leftBack
        : piece === "right-back"
          ? pieces.rightBack
          : piece === "left-front"
            ? pieces.leftFront!
            : pieces.rightFront!;
    const patternData = piece.endsWith("back") ? pieces.backPatternData : pieces.frontPatternData;
    const html = renderSetInCenterSeamNeckChartHtml({
      piece,
      chart: half.frontNeckShoulderShapingChart,
      armholeStartRow: half.debug.armholeStartRow,
    });
    const svg = tryBuildLiveSleevelessFrontCardiganRoundNotationSvg(half, patternData);
    return { half, html, svg, actions: checklistActions(html) };
  }

  it("matches the saved left-back checklist before drawing", () => {
    const left = chart("left-back");
    const neck = left.actions.filter((action) => action.edge === "Neck");
    const shoulder = left.actions.filter((action) => action.edge === "Shoulder");
    expect(neck[0]).toMatchObject({ rc: 65, carriage: "Right", verb: "Hold", amount: 11 });
    expect(neck.reduce((sum, action) => sum + action.amount, 0)).toBe(22);
    expect(shoulder.reduce((sum, action) => sum + action.amount, 0)).toBe(21);
    expect(neck.at(-1)).toMatchObject({ rc: 77, verb: "Bind off", amount: 2 });
    expect(neck.some((action) => action.verb === "Decrease")).toBe(false);
    expect(left.html).toContain("If you held the shoulder stitches, bind off those held shoulder stitches.");
    expect(left.html).toContain("Scrap off or bind off all remaining held neckline stitches.");
    expect(left.html).not.toMatch(/Knit in pattern<\/td>\s*<td>[^<]*<\/td>\s*<td[^>]*>0</);
    expect(shoulder[0]).toMatchObject({ rc: 66, carriage: "Left", verb: "Bind off OR hold" });
    const shapingEnd =
      (left.half.setInArmholePlan?.matchedBindOffRows ?? 0) +
      (left.half.setInArmholePlan?.decreaseRows ?? 0);
    expect(shapingEnd).toBe(22);
    expect(shoulder[0]!.rc - shapingEnd).toBe(44);
    expect(left.half.warnings.join(" ")).not.toMatch(/shoulder shaping notation does not/i);
  });

  it("draws the left back from that checklist", () => {
    const left = chart("left-back");
    expect(left.svg).toBeTruthy();
    const svg = left.svg!;
    expect(svgAttr(svg, "data-neck-bo")).toBe("hold11");
    expect(svgAttr(svg, "data-cf-neck-bo-sts")).toBe("11");
    expect(svgAttr(svg, "data-cf-neck-bo-source")).toBe("center-seam-half-timeline");
    expect(svgAttr(svg, "data-neck-shaping")).toBe("hold2-2r-4x\nhold1\nbo2");
    expect(svgAttr(svg, "data-rc-neck-start")).toBe("rc065");
    expect(svgAttr(svg, "data-rc-shoulder-start")).toBe("rc066");
    expect(svgAttr(svg, "data-armhole-shaping")).toContain("44r");
    expect(svgAttr(svg, "data-armhole-shaping")).not.toContain("55r");
    expect(svgAttr(svg, "data-neck-bo")).not.toBe("bo10");
    expect(svg).not.toContain("1s-2r-3x");
    expect(svgAttr(svg, "data-shoulder-shaping")).toBe(
      notationLinesFromChecklist(left.actions.filter((action) => action.edge === "Shoulder")).join("\n"),
    );
  });

  it("mirrors the right back and keeps each front on its own checklist", () => {
    const left = chart("left-back");
    const right = chart("right-back");
    const leftFront = chart("left-front");
    const rightFront = chart("right-front");

    expect(svgAttr(right.svg!, "data-neck-bo")).toBe(svgAttr(left.svg!, "data-neck-bo"));
    expect(svgAttr(right.svg!, "data-neck-shaping")).toBe(svgAttr(left.svg!, "data-neck-shaping"));
    expect(svgAttr(right.svg!, "data-armhole-shaping")).toBe(svgAttr(left.svg!, "data-armhole-shaping"));
    expect(svgAttr(right.svg!, "data-shoulder-shaping")).toBe(svgAttr(left.svg!, "data-shoulder-shaping"));
    expect(svgAttr(right.svg!, "data-rc-neck-start")).toBe("rc065");
    expect(svgAttr(right.svg!, "data-rc-shoulder-start")).toBe("rc066");
    const rightNeck = right.actions.find((action) => action.edge === "Neck");
    expect(rightNeck).toMatchObject({ rc: 65, carriage: "Left", verb: "Hold", amount: 11 });

    for (const front of [leftFront, rightFront]) {
      const neck = front.actions.filter((action) => action.edge === "Neck");
      const shoulder = front.actions.filter((action) => action.edge === "Shoulder");
      const opening = neck[0]!;
      expect(neck.reduce((sum, action) => sum + action.amount, 0)).toBe(22);
      expect(shoulder.reduce((sum, action) => sum + action.amount, 0)).toBe(21);
      expect(shoulder.reduce((sum, action) => sum + action.amount, 0)).toBe(
        left.actions.filter((action) => action.edge === "Shoulder").reduce((sum, action) => sum + action.amount, 0),
      );
      expect(front.html).toContain("If you held the shoulder stitches, bind off those held shoulder stitches.");
      expect(front.html).not.toMatch(/Decrease 2/);
      expect(front.svg).toBeTruthy();
      const svg = front.svg!;
      expect(svgAttr(svg, "data-neck-bo")).toBe(`bo${opening.amount}`);
      expect(svgAttr(svg, "data-rc-neck-start")).toBe(`rc${String(opening.rc).padStart(3, "0")}`);
      expect(svgAttr(svg, "data-neck-shaping")).toBe(notationLinesFromChecklist(neck.slice(1)).join("\n"));
      expect(svgAttr(svg, "data-rc-shoulder-start")).toBe(
        `rc${String(shoulder[0]!.rc).padStart(3, "0")}`,
      );
      expect(svgAttr(svg, "data-shoulder-shaping")).toBe(notationLinesFromChecklist(shoulder).join("\n"));
      const shapingEnd =
        (front.half.setInArmholePlan?.matchedBindOffRows ?? 0) +
        (front.half.setInArmholePlan?.decreaseRows ?? 0);
      expect(svgAttr(svg, "data-armhole-shaping")).toContain(`${shoulder[0]!.rc - shapingEnd}r`);
      expect(front.half.warnings.join(" ")).not.toMatch(/shoulder shaping notation does not/i);
    }

    expect(svgAttr(leftFront.svg!, "data-neck-bo")).toBe(svgAttr(rightFront.svg!, "data-neck-bo"));
    expect(leftFront.actions[0]?.rc).not.toBe(65);
  });

  it("keeps the saved-test wording, widths, length, and counter header", () => {
    const left = chart("left-back");
    const front = chart("right-front");
    const written = [...seamed.displayRows, ...seamed.frontDisplayRows]
      .flatMap((row) =>
        row.kind === "block" ? [...(row.paragraphs ?? []), ...(row.printInstructionParagraphs ?? [])] : [],
      )
      .join("\n");
    expect(written).toContain("The next row shapes the opposite edge.");
    expect(written).toContain("Knit across by working that shaping. Do not add a plain row.");
    expect(written).toContain("After the last row, no stitches remain. Do not knit another row.");
    expect(written).toContain("Scrap off or bind off all remaining held neckline stitches.");
    expect(written).toContain("If you held the shoulder stitches, bind off those held shoulder stitches.");
    expect(written).toContain("Swap Left and Right.");
    expect(written).toContain("This is a decrease: move 1 stitch in. Do not bind it off.");
    expect(written).not.toMatch(/knit 1 row across in pattern before shaping this edge again\. The next row shapes the opposite edge/);
    expect(written).not.toMatch(/0 stitches remain at RC: \d{3}\.\nKnit in pattern to/);
    expect(left.html).not.toMatch(/Knit in pattern<\/td>[\s\S]{0,80}>0</);
    expect(front.html).not.toMatch(/Knit in pattern<\/td>[\s\S]{0,80}>0</);

    const backSvg = tryBuildLiveSleevelessFrontStsRowsDiagramSvg(left.half, pieces.backPatternData);
    const frontSvg = tryBuildLiveSleevelessFrontStsRowsDiagramSvg(front.half, pieces.frontPatternData);
    for (const svg of [backSvg, frontSvg]) {
      expect(svg).toContain('data-neck-sts="22"');
      expect(svg).toContain('data-shoulder-sts="21"');
      expect(svg).toContain("14 in");
      expect(svg).toContain("8.9 in");
      expect(svg).toContain("Full cross shoulder");
      expect(svg).toContain("Half piece");
      expect(svg).not.toContain("includes 1 seam stitch");
      expect(svg).not.toContain("including 1 seam stitch");
      expect(svg).not.toContain("excluding center seam stitches");
    }

    const backHtml = renderPatternDisplayRowsHtml(seamed.displayRows, { pieceSectionId: "back" });
    const frontHtml = renderPatternDisplayRowsHtml(seamed.frontDisplayRows, { pieceSectionId: "front" });
    const counter = "RC continues from the start of this piece. Do not reset the counter for this chart.";
    expect(backHtml).toContain(counter);
    expect(frontHtml).toContain(counter);
    expect(backHtml).not.toContain("Row counter was reset to RC: 000 before this chart.");
    expect(frontHtml).not.toContain("Row counter was reset to RC: 000 before this chart.");
    expect(backHtml).toMatch(/Knit \d+ rows even until the row counter shows RC: \d{3}/);
    expect(backHtml).toContain("Do not mark");
    expect(backHtml).toContain("set the carriage to hold for your machine");
  });

  it("keeps the one-piece armhole straight-row token on the full plan", () => {
    const open = generateSetInSleevePattern({
      ...input,
      style: { ...(input.style as object), centerSeams: false },
    });
    const svg = tryBuildLiveSleevelessFrontRoundNotationSvg(open, input);
    expect(svg).toBeTruthy();
    expect(svgAttr(svg!, "data-armhole-shaping")).toContain(`${open.setInArmholePlan?.straightRows}r`);
  });
});
