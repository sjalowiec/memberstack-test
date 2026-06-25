import { describe, expect, it } from "vitest";
import { assertDropShoulderDiagramAssetsExistOnDisk } from "./dropShoulderDiagramSvgResolver.assertOnDisk";
import {
  DROP_SHOULDER_DIAGRAM_ASSETS,
  auditDropShoulderDiagramAssetGrid,
  expectedDropShoulderDiagramAssetPath,
  resolveDropShoulderDiagramSvg,
  resolveDropShoulderDiagramSvgFromPattern,
} from "./dropShoulderDiagramSvgResolver";
import {
  DROP_SHOULDER_BODY_BACK_NOTATION_SRC,
  DROP_SHOULDER_BODY_BACK_STS_ROWS_SRC,
  DROP_SHOULDER_BODY_CARDIGAN_NOTATION_SRC,
  DROP_SHOULDER_BODY_CARDIGAN_STS_ROWS_SRC,
  DROP_SHOULDER_BODY_FRONT_NOTATION_SRC,
  DROP_SHOULDER_BODY_FRONT_STS_ROWS_SRC,
  resolveDropShoulderBackDiagramSvg,
  resolveDropShoulderFrontDiagramSvg,
} from "./dropShoulderBodyNotationSvg";

const DROP_SHOULDER_ALINE_PATTERN = {
  style: {
    construction: "drop-shoulder",
    frontStyle: "open",
    garmentStyle: "cardigan",
    neckline: "v-neck",
    bodyShape: "aline",
  },
  fit: {
    selectedMeasurements: {
      finished_bust_chest: 40,
      finished_hip: 44,
    },
  },
};

const DROP_SHOULDER_SHAPED_PATTERN = {
  style: {
    construction: "drop-shoulder",
    frontStyle: "closed",
    garmentStyle: "pullover",
    neckline: "round",
    bodyShape: "shaped",
  },
  fit: {
    selectedMeasurements: {
      finished_bust_chest: 40,
      finished_hip: 36,
    },
  },
};

const DROP_SHOULDER_STRAIGHT_CARDIGAN = {
  style: {
    construction: "drop-shoulder",
    frontStyle: "open",
    garmentStyle: "cardigan",
    neckline: "round",
    bodyShape: "straight",
  },
};

describe("dropShoulderDiagramSvgResolver inventory", () => {
  it("lists only on-disk diagram SVGs under public/images/patterns/drop-shoulder", () => {
    assertDropShoulderDiagramAssetsExistOnDisk();
    expect(DROP_SHOULDER_DIAGRAM_ASSETS.length).toBeGreaterThanOrEqual(16);
  });
});

describe("dropShoulderDiagramSvgResolver grid audit", () => {
  it("covers back/front/sleeve/summary combinations", () => {
    const grid = auditDropShoulderDiagramAssetGrid();
    expect(grid.some((c) => c.criteria.piece === "back")).toBe(true);
    expect(grid.some((c) => c.criteria.piece === "front")).toBe(true);
    expect(grid.some((c) => c.criteria.piece === "sleeve")).toBe(true);
    expect(grid.some((c) => c.criteria.piece === "summary")).toBe(true);
    expect(grid.filter((c) => c.criteria.piece === "front").length).toBe(24);
    expect(grid.filter((c) => c.criteria.piece === "back").length).toBe(6);
  });

  it("documents missing A-line assets with expected paths (not silent straight fallback)", () => {
    const alineBackStsRows = resolveDropShoulderDiagramSvg({
      piece: "back",
      mode: "sts-rows",
      bodyShape: "aline",
    });
    expect(alineBackStsRows.exactMatch).toBe(true);
    expect(alineBackStsRows.fallback).toBeUndefined();
    expect(alineBackStsRows.src).toBe("/images/patterns/drop-shoulder/drop-body-back-aline.svg");

    const missingCardiganVJp = resolveDropShoulderDiagramSvg({
      piece: "front",
      mode: "japanese",
      garment: "cardigan",
      neckline: "v",
      bodyShape: "aline",
    });
    expect(missingCardiganVJp.exactMatch).toBe(false);
    expect(missingCardiganVJp.fallback).toBeDefined();
    expect(missingCardiganVJp.src).toBe(DROP_SHOULDER_BODY_CARDIGAN_NOTATION_SRC);
    expect(missingCardiganVJp.expectedAssetPath).toBe(
      "/images/patterns/drop-shoulder/japanese/jp-drop-body-cardigan-v-aline.svg",
    );
  });
});

describe("dropShoulderDiagramSvgResolver priority routing", () => {
  it("1 — back A-line Japanese notation uses diagram-jp-back-aline.svg", () => {
    const result = resolveDropShoulderDiagramSvgFromPattern(
      "back",
      "shaping-notation",
      DROP_SHOULDER_ALINE_PATTERN,
    );
    expect(result.exactMatch).toBe(true);
    expect(result.src).toBe("/images/patterns/drop-shoulder/diagram-jp-back-aline.svg");
    expect(result.fallback).toBeUndefined();
  });

  it("2 — back A-line stitches/rows uses drop-body-back-aline.svg", () => {
    const result = resolveDropShoulderBackDiagramSvg("sts-rows", DROP_SHOULDER_ALINE_PATTERN);
    expect(result.exactMatch).toBe(true);
    expect(result.fallback).toBeUndefined();
    expect(result.src).toBe("/images/patterns/drop-shoulder/drop-body-back-aline.svg");
  });

  it("2b — back shaped Japanese notation uses diagram-jp-back-shaped.svg", () => {
    const result = resolveDropShoulderDiagramSvgFromPattern(
      "back",
      "shaping-notation",
      DROP_SHOULDER_SHAPED_PATTERN,
    );
    expect(result.exactMatch).toBe(true);
    expect(result.fallback).toBeUndefined();
    expect(result.src).toBe("/images/patterns/drop-shoulder/diagram-jp-back-shaped.svg");
  });

  it("2c — back shaped stitches/rows uses drop-body-back-shaped.svg", () => {
    const result = resolveDropShoulderBackDiagramSvg("sts-rows", DROP_SHOULDER_SHAPED_PATTERN);
    expect(result.exactMatch).toBe(true);
    expect(result.fallback).toBeUndefined();
    expect(result.src).toBe("/images/patterns/drop-shoulder/drop-body-back-shaped.svg");
  });

  it("3 — front cardigan V-neck A-line Japanese notation reports fallback", () => {
    const result = resolveDropShoulderFrontDiagramSvg(
      "shaping-notation",
      DROP_SHOULDER_ALINE_PATTERN,
    );
    expect(result.exactMatch).toBe(false);
    expect(result.fallback).toBeDefined();
    expect(result.src).toBe(DROP_SHOULDER_BODY_CARDIGAN_NOTATION_SRC);
    expect(result.expectedAssetPath).toBe(
      "/images/patterns/drop-shoulder/japanese/jp-drop-body-cardigan-v-aline.svg",
    );
  });

  it("4 — front cardigan V-neck A-line stitches/rows uses round A-line draft with neckline fallback", () => {
    const result = resolveDropShoulderFrontDiagramSvg("sts-rows", DROP_SHOULDER_ALINE_PATTERN);
    expect(result.exactMatch).toBe(false);
    expect(result.src).toBe("/images/patterns/drop-shoulder/drop-A-body-cardigan.svg");
    expect(result.fallback?.reason).toMatch(/round neckline artwork only/i);
    expect(result.expectedAssetPath).toBe(
      "/images/patterns/drop-shoulder/drop-A-body-cardigan-v.svg",
    );
  });

  it("5 — front pullover V-neck A-line shaping notation uses diagram-front-v-aline.svg", () => {
    const result = resolveDropShoulderFrontDiagramSvg("shaping-notation", {
      style: {
        construction: "drop-shoulder",
        frontStyle: "closed",
        garmentStyle: "pullover",
        neckline: "v-neck",
        bodyShape: "aline",
      },
      fit: { selectedMeasurements: { finished_bust_chest: 40, finished_hip: 44 } },
    });
    expect(result.exactMatch).toBe(true);
    expect(result.src).toBe("/images/patterns/drop-shoulder/diagram-jp-front-v-aline.svg");
    expect(result.fallback).toBeUndefined();
  });
});

describe("dropShoulderDiagramSvgResolver straight-body baselines", () => {
  it("keeps existing straight pullover and cardigan paths", () => {
    expect(
      resolveDropShoulderDiagramSvgFromPattern("back", "sts-rows", DROP_SHOULDER_STRAIGHT_CARDIGAN)
        .src,
    ).toBe(DROP_SHOULDER_BODY_BACK_STS_ROWS_SRC);
    expect(
      resolveDropShoulderDiagramSvgFromPattern(
        "back",
        "shaping-notation",
        DROP_SHOULDER_STRAIGHT_CARDIGAN,
      ).src,
    ).toBe(DROP_SHOULDER_BODY_BACK_NOTATION_SRC);

    expect(
      resolveDropShoulderDiagramSvgFromPattern(
        "front",
        "sts-rows",
        DROP_SHOULDER_STRAIGHT_CARDIGAN,
      ).src,
    ).toBe(DROP_SHOULDER_BODY_CARDIGAN_STS_ROWS_SRC);
    expect(
      resolveDropShoulderDiagramSvgFromPattern(
        "front",
        "shaping-notation",
        DROP_SHOULDER_STRAIGHT_CARDIGAN,
      ).src,
    ).toBe(DROP_SHOULDER_BODY_CARDIGAN_NOTATION_SRC);

    expect(
      resolveDropShoulderDiagramSvgFromPattern("front", "sts-rows", {
        style: { frontStyle: "closed", neckline: "round", bodyShape: "straight" },
      }).src,
    ).toBe(DROP_SHOULDER_BODY_FRONT_STS_ROWS_SRC);
    expect(
      resolveDropShoulderDiagramSvgFromPattern("front", "shaping-notation", {
        style: { frontStyle: "closed", neckline: "round", bodyShape: "straight" },
      }).src,
    ).toBe(DROP_SHOULDER_BODY_FRONT_NOTATION_SRC);
  });

  it("straight front round and V-neck share the same SVG (exact match, no fallback)", () => {
    const round = resolveDropShoulderDiagramSvg({
      piece: "front",
      mode: "sts-rows",
      garment: "pullover",
      neckline: "round",
      bodyShape: "straight",
    });
    const v = resolveDropShoulderDiagramSvg({
      piece: "front",
      mode: "sts-rows",
      garment: "pullover",
      neckline: "v",
      bodyShape: "straight",
    });
    expect(round.exactMatch).toBe(true);
    expect(v.exactMatch).toBe(true);
    expect(round.src).toBe(v.src);
    expect(v.fallback).toBeUndefined();
  });
});

describe("expectedDropShoulderDiagramAssetPath", () => {
  it("names the A-line back Japanese notation target file", () => {
    expect(
      expectedDropShoulderDiagramAssetPath({
        piece: "back",
        mode: "japanese",
        bodyShape: "aline",
      }),
    ).toBe("/images/patterns/drop-shoulder/diagram-jp-back-aline.svg");
  });

  it("names the shaped back measurement and notation target files", () => {
    expect(
      expectedDropShoulderDiagramAssetPath({
        piece: "back",
        mode: "sts-rows",
        bodyShape: "shaped",
      }),
    ).toBe("/images/patterns/drop-shoulder/drop-body-back-shaped.svg");
    expect(
      expectedDropShoulderDiagramAssetPath({
        piece: "back",
        mode: "japanese",
        bodyShape: "shaped",
      }),
    ).toBe("/images/patterns/drop-shoulder/diagram-jp-back-shaped.svg");
  });
});
