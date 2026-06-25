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

const DROP_SHOULDER_SHAPED_CARDIGAN = {
  style: {
    construction: "drop-shoulder",
    frontStyle: "open",
    garmentStyle: "cardigan",
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

const DROP_SHOULDER_ALINE_ROUND_CARDIGAN = {
  style: {
    construction: "drop-shoulder",
    frontStyle: "open",
    garmentStyle: "cardigan",
    neckline: "round",
    bodyShape: "aline",
  },
  fit: {
    selectedMeasurements: {
      finished_bust_chest: 40,
      finished_hip: 44,
    },
  },
};

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

    const cardiganVJp = resolveDropShoulderDiagramSvg({
      piece: "front",
      mode: "japanese",
      garment: "cardigan",
      neckline: "v",
      bodyShape: "aline",
    });
    expect(cardiganVJp.exactMatch).toBe(true);
    expect(cardiganVJp.fallback).toBeUndefined();
    expect(cardiganVJp.src).toBe(
      "/images/patterns/drop-shoulder/japanese/jp-drop-cardigan-aline.svg",
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

  it("2d — front shaped stitches/rows uses drop-body-front-shaped.svg", () => {
    const result = resolveDropShoulderFrontDiagramSvg("sts-rows", DROP_SHOULDER_SHAPED_PATTERN);
    expect(result.exactMatch).toBe(true);
    expect(result.fallback).toBeUndefined();
    expect(result.src).toBe("/images/patterns/drop-shoulder/drop-body-front-shaped.svg");
  });

  it("2e — front shaped Japanese notation uses diagram-jp-front-shaped.svg", () => {
    const result = resolveDropShoulderFrontDiagramSvg(
      "shaping-notation",
      DROP_SHOULDER_SHAPED_PATTERN,
    );
    expect(result.exactMatch).toBe(true);
    expect(result.fallback).toBeUndefined();
    expect(result.src).toBe("/images/patterns/drop-shoulder/diagram-jp-front-shaped.svg");
  });

  it("3 — front cardigan V-neck A-line Japanese notation shares jp-drop-cardigan-aline.svg", () => {
    const result = resolveDropShoulderFrontDiagramSvg(
      "shaping-notation",
      DROP_SHOULDER_ALINE_PATTERN,
    );
    expect(result.exactMatch).toBe(true);
    expect(result.fallback).toBeUndefined();
    expect(result.src).toBe("/images/patterns/drop-shoulder/japanese/jp-drop-cardigan-aline.svg");
  });

  it("4 — front cardigan V-neck A-line stitches/rows shares drop-A-body-cardigan.svg", () => {
    const result = resolveDropShoulderFrontDiagramSvg("sts-rows", DROP_SHOULDER_ALINE_PATTERN);
    expect(result.exactMatch).toBe(true);
    expect(result.fallback).toBeUndefined();
    expect(result.src).toBe("/images/patterns/drop-shoulder/drop-A-body-cardigan.svg");
  });

  it("5 — front pullover V-neck A-line shaping notation uses diagram-jp-front-v-aline.svg", () => {
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

  it("6 — front pullover round-neck A-line uses drop-A-body-front and diagram-jp-front-aline", () => {
    const pattern = {
      style: {
        construction: "drop-shoulder",
        frontStyle: "closed",
        garmentStyle: "pullover",
        neckline: "round",
        bodyShape: "aline",
      },
      fit: { selectedMeasurements: { finished_bust_chest: 40, finished_hip: 44 } },
    };
    const stsRows = resolveDropShoulderFrontDiagramSvg("sts-rows", pattern);
    expect(stsRows.exactMatch).toBe(true);
    expect(stsRows.src).toBe("/images/patterns/drop-shoulder/drop-A-body-front.svg");
    expect(stsRows.fallback).toBeUndefined();

    const jp = resolveDropShoulderFrontDiagramSvg("shaping-notation", pattern);
    expect(jp.exactMatch).toBe(true);
    expect(jp.src).toBe("/images/patterns/drop-shoulder/diagram-jp-front-aline.svg");
    expect(jp.fallback).toBeUndefined();
  });

  it("7 — front cardigan round-neck A-line uses drop-A-body-cardigan and jp-drop-cardigan-aline", () => {
    const stsRows = resolveDropShoulderFrontDiagramSvg("sts-rows", DROP_SHOULDER_ALINE_ROUND_CARDIGAN);
    expect(stsRows.exactMatch).toBe(true);
    expect(stsRows.src).toBe("/images/patterns/drop-shoulder/drop-A-body-cardigan.svg");
    expect(stsRows.fallback).toBeUndefined();

    const jp = resolveDropShoulderFrontDiagramSvg(
      "shaping-notation",
      DROP_SHOULDER_ALINE_ROUND_CARDIGAN,
    );
    expect(jp.exactMatch).toBe(true);
    expect(jp.src).toBe("/images/patterns/drop-shoulder/japanese/jp-drop-cardigan-aline.svg");
    expect(jp.fallback).toBeUndefined();
  });

  it("8 — front cardigan shaped uses drop-body-cardigan-shaped and jp-drop-cardigan-shaped", () => {
    const stsRows = resolveDropShoulderFrontDiagramSvg("sts-rows", DROP_SHOULDER_SHAPED_CARDIGAN);
    expect(stsRows.exactMatch).toBe(true);
    expect(stsRows.src).toBe("/images/patterns/drop-shoulder/drop-body-cardigan-shaped.svg");
    expect(stsRows.fallback).toBeUndefined();

    const jp = resolveDropShoulderFrontDiagramSvg(
      "shaping-notation",
      DROP_SHOULDER_SHAPED_CARDIGAN,
    );
    expect(jp.exactMatch).toBe(true);
    expect(jp.src).toBe("/images/patterns/drop-shoulder/japanese/jp-drop-cardigan-shaped.svg");
    expect(jp.fallback).toBeUndefined();
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
