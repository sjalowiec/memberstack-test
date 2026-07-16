import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildDropShoulderBackJapaneseNotationReplacements,
  buildDropShoulderFrontJapaneseNotationReplacements,
} from "./dropShoulderBodyJapaneseNotation";
import { buildDropShoulderBodyDiagramReplacements, withDropShoulderShoulderMeasurementReplacements } from "./dropShoulderBodyNotationSvg";
import {
  DROP_SHOULDER_DIAGRAM_ASSETS,
  type DropShoulderDiagramAsset,
} from "./dropShoulderDiagramSvgResolver";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import {
  buildDropShoulderSleeveDiagramReplacements,
  buildDropShoulderSleeveJapaneseNotationReplacements,
} from "./sleevelessGarmentDiagramReplacements";
import { applyGarmentDiagramSvgReplacements } from "./sleevelessGarmentDiagramSvg";
import {
  applyJapaneseNotationSvgReplacements,
  listJapaneseNotationPlaceholdersInSvg,
} from "./sleevelessJapaneseNotationSvg";
import { DROP_SHOULDER_QA_SCENARIOS } from "./testScenarios/dropShoulderPatternQaMatrix";

const BODY_JP_SHARED = [
  "jp-caston",
  "jp-neckline-bo",
  "jp-neckline-shaping",
  "rc-caston",
  "rc-hem",
  "rc-armhole-bo",
  "rc-neckline-start",
] as const;

const EXPECTED_JP_INVENTORY: Record<string, readonly string[]> = {
  back: [...BODY_JP_SHARED, "jp-body-shaping", "rc_reset"],
  "pullover-front": [...BODY_JP_SHARED, "jp-body-rows", "jp-armhole-bo", "jp-armhole-shaping", "rc_reset"],
  "cardigan-front": [
    "jp-caston",
    "jp-body-rows",
    "jp-neckline-bo",
    "jp-neckline-shaping",
    "rc-caston",
    "rc-hem",
    "rc-armhole-bo",
    "rc-neckline-start",
  ],
  sleeve: ["jp-caston", "jp-cuff", "jp-sleeve_cap_sts"],
};

const EXPECTED_STS_ROWS_BODY_MINIMAL = ["cross-shoulder-width", "shoulder-stitches", "UNIT"] as const;

const EXPECTED_STS_ROWS_SLEEVE_MINIMAL = ["SLEEVE_CAP_STS", "CUFF_ROWS", "UNIT"] as const;

function listBracePlaceholdersInSvg(svgText: string): string[] {
  const found = new Set<string>();
  for (const match of svgText.matchAll(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g)) {
    found.add(match[1]!);
  }
  return [...found].sort();
}

function countSvgGroupTagDepth(svgText: string): number {
  let depth = 0;
  const re = /<\/?g[\s>]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(svgText)) !== null) {
    if (match[0].startsWith("</")) depth -= 1;
    else depth += 1;
  }
  return depth;
}

function assertParseableSvgMarkup(svgText: string): void {
  expect(countSvgGroupTagDepth(svgText)).toBe(0);
  const normalized = svgText.replace(/^\uFEFF/, "").replace(/^<\?xml[\s\S]*?\?>\s*/, "");
  expect(normalized.trimStart().startsWith("<svg")).toBe(true);
  const openText = (normalized.match(/<text\b/gi) || []).length;
  const closeText = (normalized.match(/<\/text>/gi) || []).length;
  expect(openText).toBe(closeText);
}

function assertNoUnreplacedTokens(svgText: string): void {
  expect(listBracePlaceholdersInSvg(svgText)).toEqual([]);
}

function jpInventoryKey(asset: DropShoulderDiagramAsset): string {
  if (asset.piece === "sleeve") return "sleeve";
  if (asset.piece === "back") return "back";
  if (asset.garment === "cardigan") return "cardigan-front";
  return "pullover-front";
}

function patternDataForAsset(asset: DropShoulderDiagramAsset): Record<string, unknown> {
  if (asset.bodyShape === "shaped") {
    return {
      fit: {
        selectedMeasurements: {
          finished_bust_chest: 40,
          finished_hip: 36,
          back_neck_to_hem: 24,
          upper_arm: 16,
          wrist: 8,
          sleeve_length: 12,
          shoulder_width: 16,
          neck_opening: 7,
          back_neck_depth: 1,
          front_neck_depth: 4,
        },
      },
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
      style: {
        construction: "drop-shoulder",
        constructionAuthored: "drop-shoulder",
        bodyShape: "shaped",
        frontStyle: asset.garment === "cardigan" ? "open" : "closed",
        garmentStyle: asset.garment === "cardigan" ? "cardigan" : "pullover",
        neckline: asset.neckline === "v" ? "v" : "round",
      },
    };
  }
  if (asset.bodyShape === "aline") {
    return {
      fit: {
        selectedMeasurements: {
          finished_bust_chest: 40,
          finished_hip: 44,
          back_neck_to_hem: 24,
          upper_arm: 16,
          wrist: 8,
          sleeve_length: 12,
          shoulder_width: 16,
          neck_opening: 7,
          back_neck_depth: 1,
          front_neck_depth: 4,
        },
      },
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
      style: {
        construction: "drop-shoulder",
        constructionAuthored: "drop-shoulder",
        bodyShape: "aline",
        frontStyle: asset.garment === "cardigan" ? "open" : "closed",
        garmentStyle: asset.garment === "cardigan" ? "cardigan" : "pullover",
        neckline: asset.neckline === "v" ? "v" : "round",
      },
    };
  }
  const cardigan = asset.garment === "cardigan";
  const scenario =
    DROP_SHOULDER_QA_SCENARIOS.find((s) =>
      cardigan ? s.id.includes("cardigan-round") : s.id === "mens-med-16-24-pullover-round",
    ) ?? DROP_SHOULDER_QA_SCENARIOS[0]!;
  return scenario.patternData;
}

function buildReplacementsForAsset(
  asset: DropShoulderDiagramAsset,
  patternData: Record<string, unknown>,
) {
  const result = generateDropShoulderPattern(patternData);
  if (asset.piece === "summary") return null;
  if (asset.piece === "sleeve") {
    const direction = asset.sleeveDirection ?? "cuff-up";
    return asset.mode === "japanese"
      ? buildDropShoulderSleeveJapaneseNotationReplacements(result, direction)
      : buildDropShoulderSleeveDiagramReplacements(result, "in", direction);
  }

  const measurementPiece = asset.piece === "back" ? "back" : "front";
  const diagramOptions = {
    patternData,
    measurementPiece,
    ...(asset.garment === "cardigan" && asset.piece === "front"
      ? { cardiganHalfSide: "left" as const }
      : {}),
  };

  if (asset.mode === "japanese") {
    const jp =
      asset.piece === "back"
        ? buildDropShoulderBackJapaneseNotationReplacements(result, patternData)
        : buildDropShoulderFrontJapaneseNotationReplacements(result, patternData);
    return withDropShoulderShoulderMeasurementReplacements(jp, result, "in", diagramOptions);
  }

  return withDropShoulderShoulderMeasurementReplacements(
    buildDropShoulderBodyDiagramReplacements(result, "in", diagramOptions),
    result,
    "in",
    diagramOptions,
  );
}

describe("drop-shoulder diagram SVG token sweep", () => {
  it.each(DROP_SHOULDER_DIAGRAM_ASSETS.map((asset) => [asset.src, asset] as const))(
    "%s is parseable after replacement with no unreplaced tokens",
    (src, asset) => {
      const diskPath = resolve(process.cwd(), "public" + src);
      const rawSvg = readFileSync(diskPath, "utf8");
      assertParseableSvgMarkup(rawSvg);

      if (asset.piece === "summary") {
        expect(listBracePlaceholdersInSvg(rawSvg)).toEqual([]);
        return;
      }

      const patternData = patternDataForAsset(asset);
      const replacements = buildReplacementsForAsset(asset, patternData);
      expect(replacements).toBeTruthy();

      const processed =
        asset.mode === "japanese"
          ? applyJapaneseNotationSvgReplacements(rawSvg, replacements!)
          : applyGarmentDiagramSvgReplacements(rawSvg, replacements!);

      assertParseableSvgMarkup(processed);
      assertNoUnreplacedTokens(processed);
    },
  );

  it.each(DROP_SHOULDER_DIAGRAM_ASSETS.filter((a) => a.mode === "japanese").map((a) => [a.src, a] as const))(
    "JP notation %s uses the expected minimal token inventory",
    (src, asset) => {
      const rawSvg = readFileSync(resolve(process.cwd(), "public" + src), "utf8");
      const tokens =
        asset.mode === "japanese"
          ? listJapaneseNotationPlaceholdersInSvg(rawSvg)
          : listBracePlaceholdersInSvg(rawSvg);
      const expected = EXPECTED_JP_INVENTORY[jpInventoryKey(asset)] ?? [];
      for (const token of expected) {
        expect(tokens, `${src} missing ${token}`).toContain(token);
      }
    },
  );

  it.each(
    DROP_SHOULDER_DIAGRAM_ASSETS.filter((a) => a.mode === "sts-rows" && a.piece !== "summary").map(
      (a) => [a.src, a] as const,
    ),
  )("sts-rows %s includes the expected minimal measurement token inventory", (src, asset) => {
    const rawSvg = readFileSync(resolve(process.cwd(), "public" + src), "utf8");
    const tokens = listBracePlaceholdersInSvg(rawSvg);
    if (tokens.length === 0) return;
    const expected =
      asset.piece === "sleeve" ? EXPECTED_STS_ROWS_SLEEVE_MINIMAL : EXPECTED_STS_ROWS_BODY_MINIMAL;
    for (const token of expected) {
      expect(tokens, `${src} missing ${token}`).toContain(token);
    }
  });
});
