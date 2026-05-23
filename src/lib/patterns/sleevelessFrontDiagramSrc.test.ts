import { describe, expect, it } from "vitest";
import {
  getSleevelessShoulderNotationIconSrc,
  isSleevelessEffectiveAlineBody,
  isSleevelessEffectiveShapedBody,
  isSleevelessPulloverVNeckAlineFront,
  isSleevelessVNeckChoice,
  isSleevelessCardiganGarmentStyle,
  isSleevelessDevCardiganExpressPreview,
  resolveSleevelessFrontDiagram,
  SLEEVELESS_CARDIGAN_ROUND_ALINE_FRONT_DIAGRAM_SRC,
  SLEEVELESS_CARDIGAN_V_ALINE_FRONT_DIAGRAM_SRC,
  SLEEVELESS_PULLOVER_ROUND_ALINE_FRONT_DIAGRAM_SRC,
  SLEEVELESS_PULLOVER_V_ALINE_FRONT_DIAGRAM_SRC,
  SLEEVELESS_SHOULDER_NOTATION_ICON_BACK,
  SLEEVELESS_SHOULDER_NOTATION_ICON_FRONT_ROUND,
  SLEEVELESS_SHOULDER_NOTATION_ICON_FRONT_V,
} from "./sleevelessFrontDiagramSrc";

const alineFit = {
  style: { bodyShape: "aline" },
  fit: { selectedMeasurements: { finished_bust_chest: 38, finished_hip: 44 } },
};

describe("getSleevelessShoulderNotationIconSrc", () => {
  const vNeckPattern = { style: { neckline: "v-neck" } };
  const roundPattern = { style: { neckline: "round" } };

  it("back always uses shoulder-round-icon.svg (never front V asset)", () => {
    expect(getSleevelessShoulderNotationIconSrc("back", vNeckPattern)).toBe(SLEEVELESS_SHOULDER_NOTATION_ICON_BACK);
    expect(getSleevelessShoulderNotationIconSrc("back", vNeckPattern)).toBe("/images/patterns/shoulder-round-icon.svg");
    expect(getSleevelessShoulderNotationIconSrc("back", roundPattern)).toBe(SLEEVELESS_SHOULDER_NOTATION_ICON_BACK);
  });

  it("front v-neck uses shoulder-front-icon-V.svg", () => {
    expect(getSleevelessShoulderNotationIconSrc("front", vNeckPattern)).toBe(SLEEVELESS_SHOULDER_NOTATION_ICON_FRONT_V);
    expect(getSleevelessShoulderNotationIconSrc("front", vNeckPattern)).toBe("/images/patterns/shoulder-front-icon-V.svg");
  });

  it("front round uses shoulder-round-icon.svg", () => {
    expect(getSleevelessShoulderNotationIconSrc("front", roundPattern)).toBe(SLEEVELESS_SHOULDER_NOTATION_ICON_FRONT_ROUND);
    expect(getSleevelessShoulderNotationIconSrc("front", roundPattern)).toBe("/images/patterns/shoulder-round-icon.svg");
  });

  it("front round cardigan uses same icon as pullover (neckline only, not garment style)", () => {
    const cardiganRound = { style: { neckline: "round", garmentStyle: "cardigan", frontStyle: "open" } };
    expect(getSleevelessShoulderNotationIconSrc("front", cardiganRound)).toBe(
      "/images/patterns/shoulder-round-icon.svg",
    );
    expect(getSleevelessShoulderNotationIconSrc("front", roundPattern)).toBe(
      getSleevelessShoulderNotationIconSrc("front", cardiganRound),
    );
  });

  it("front v-neck cardigan uses same icon as pullover (neckline only, not garment style)", () => {
    const cardiganV = { style: { neckline: "v-neck", garmentStyle: "cardigan" } };
    expect(getSleevelessShoulderNotationIconSrc("front", cardiganV)).toBe("/images/patterns/shoulder-front-icon-V.svg");
    expect(getSleevelessShoulderNotationIconSrc("front", vNeckPattern)).toBe(
      getSleevelessShoulderNotationIconSrc("front", cardiganV),
    );
  });
});

describe("isSleevelessVNeckChoice", () => {
  it("returns false for round neckline value", () => {
    expect(isSleevelessVNeckChoice({ style: { neckline: "round" } })).toBe(false);
  });

  it("returns true for v-neck builder value", () => {
    expect(isSleevelessVNeckChoice({ style: { neckline: "v-neck" } })).toBe(true);
  });

  it("returns true for legacy flat v", () => {
    expect(isSleevelessVNeckChoice({ style: { neckline: "v" } })).toBe(true);
  });

  it("does not treat arbitrary strings containing letter v as V-neck", () => {
    expect(isSleevelessVNeckChoice({ style: { neckline: "sleeveless" } })).toBe(false);
    expect(isSleevelessVNeckChoice({ style: { neckline: "vertical rib" } })).toBe(false);
  });

  it("treats descriptive round-neck copy as round when it contains the word round", () => {
    expect(
      isSleevelessVNeckChoice({
        style: {
          neckline: "Women's sleeveless pullover with a round neckline",
        },
      }),
    ).toBe(false);
  });
});

describe("isSleevelessCardiganGarmentStyle", () => {
  it("detects explicit garmentStyle cardigan", () => {
    expect(isSleevelessCardiganGarmentStyle({ style: { garmentStyle: "cardigan" } })).toBe(true);
  });

  it("detects open frontStyle", () => {
    expect(isSleevelessCardiganGarmentStyle({ style: { frontStyle: "open" } })).toBe(true);
  });

  it("returns false for closed pullover", () => {
    expect(isSleevelessCardiganGarmentStyle({ style: { frontStyle: "closed", garmentStyle: "pullover" } })).toBe(
      false,
    );
  });
});

describe("isSleevelessDevCardiganExpressPreview", () => {
  it("is true in dev when cardigan style is set (including V-neck)", () => {
    expect(
      isSleevelessDevCardiganExpressPreview({
        style: { neckline: "v-neck", garmentStyle: "cardigan" },
      }),
    ).toBe(import.meta.env.DEV);
  });
});

describe("resolveSleevelessFrontDiagram", () => {
  const roundPattern = { style: { neckline: "round" } };

  it("routes pullover round neck to diagram-front-round.svg", () => {
    const r = resolveSleevelessFrontDiagram(roundPattern, { devForceCardiganHalfLeft: false });
    expect(r.garmentStyle).toBe("pullover");
    expect(r.diagramType).toBe("pulloverFullFrontRound");
    expect(r.frontPieceType).toBe("fullFront");
    expect(r.src).toBe("/images/patterns/sleeveless/diagrams/diagram-front-round.svg");
  });

  it("routes pullover v-neck to diagram-front-v.svg", () => {
    const r = resolveSleevelessFrontDiagram({ style: { neckline: "v-neck" } }, { devForceCardiganHalfLeft: false });
    expect(r.diagramType).toBe("pulloverFullFrontV");
    expect(r.src).toBe("/images/patterns/sleeveless/diagrams/diagram-front-v.svg");
  });

  it("routes pullover v-neck A-line to diagram-front-v-aline.svg", () => {
    const alinePattern = {
      style: { neckline: "v-neck", bodyShape: "aline", garmentStyle: "pullover" },
      fit: {
        selectedMeasurements: { finished_bust_chest: 38, finished_hip: 44 },
      },
    };
    expect(isSleevelessPulloverVNeckAlineFront(alinePattern)).toBe(true);
    const r = resolveSleevelessFrontDiagram(alinePattern, { devForceCardiganHalfLeft: false });
    expect(r.diagramType).toBe("pulloverFullFrontV");
    expect(r.src).toBe(SLEEVELESS_PULLOVER_V_ALINE_FRONT_DIAGRAM_SRC);
  });

  it("routes v-neck cardigan A-line to diagram-cardigan-v-aline.svg", () => {
    const cardiganAline = {
      style: { neckline: "v-neck", bodyShape: "aline", garmentStyle: "cardigan" },
      fit: {
        selectedMeasurements: { finished_bust_chest: 38, finished_hip: 44 },
      },
    };
    expect(isSleevelessPulloverVNeckAlineFront(cardiganAline)).toBe(false);
    expect(isSleevelessEffectiveAlineBody(cardiganAline)).toBe(true);
    const r = resolveSleevelessFrontDiagram(cardiganAline, { devForceCardiganHalfLeft: false });
    expect(r.src).toBe(SLEEVELESS_CARDIGAN_V_ALINE_FRONT_DIAGRAM_SRC);
  });

  it("routes round-neck pullover A-line to diagram-front-round-aline.svg", () => {
    const pattern = {
      ...alineFit,
      style: { neckline: "round", garmentStyle: "pullover", bodyShape: "aline" },
    };
    expect(isSleevelessEffectiveAlineBody(pattern)).toBe(true);
    const r = resolveSleevelessFrontDiagram(pattern, { devForceCardiganHalfLeft: false });
    expect(r.src).toBe(SLEEVELESS_PULLOVER_ROUND_ALINE_FRONT_DIAGRAM_SRC);
  });

  it("routes round-neck cardigan A-line to diagram-cardigan-round-aline.svg", () => {
    const pattern = {
      ...alineFit,
      style: { neckline: "round", garmentStyle: "cardigan", frontStyle: "open", bodyShape: "aline" },
    };
    const r = resolveSleevelessFrontDiagram(pattern, { devForceCardiganHalfLeft: false });
    expect(r.src).toBe(SLEEVELESS_CARDIGAN_ROUND_ALINE_FRONT_DIAGRAM_SRC);
  });

  it("routes round-neck cardigan style to full-width schematic", () => {
    const r = resolveSleevelessFrontDiagram(
      { style: { neckline: "round", frontStyle: "open" } },
      { devForceCardiganHalfLeft: false },
    );
    expect(r.garmentStyle).toBe("cardigan");
    expect(r.diagramType).toBe("cardiganFullFrontRound");
    expect(r.frontPieceType).toBe("fullFront");
    expect(r.src).toBe("/images/patterns/sleeveless/diagrams/diagram-cardigan-round.svg");
  });

  it("routes v-neck cardigan style to full-width V schematic", () => {
    const r = resolveSleevelessFrontDiagram(
      { style: { neckline: "v-neck", garmentStyle: "cardigan" } },
      { devForceCardiganHalfLeft: false },
    );
    expect(r.garmentStyle).toBe("cardigan");
    expect(r.diagramType).toBe("cardiganFullFrontV");
    expect(r.frontPieceType).toBe("fullFront");
    expect(r.src).toBe("/images/patterns/sleeveless/diagrams/diagram-cardigan-v.svg");
  });

  it("forces cardigan half-front asset when dev flag is true", () => {
    const r = resolveSleevelessFrontDiagram(roundPattern, { devForceCardiganHalfLeft: true });
    expect(r.garmentStyle).toBe("cardigan");
    expect(r.diagramType).toBe("cardiganHalfFrontRound");
    expect(r.frontPieceType).toBe("leftFront");
    expect(r.src).toBe("/images/patterns/sleeveless/cardigan-half-front-round.svg");
  });

  it("forces V cardigan half-front when dev flag is true and neckline is V", () => {
    const r = resolveSleevelessFrontDiagram(
      { style: { neckline: "v-neck" } },
      { devForceCardiganHalfLeft: true },
    );
    expect(r.diagramType).toBe("cardiganHalfFrontV");
    expect(r.src).toBe("/images/patterns/sleeveless/diagrams/diagram-cardigan-v.svg");
  });

  it("routes shaped waist to -shaped.svg variants", () => {
    const shaped = {
      style: { neckline: "round", bodyShape: "shaped", garmentStyle: "pullover" },
      fit: { selectedMeasurements: { finished_bust_chest: 40, finished_hip: 40 } },
    };
    expect(isSleevelessEffectiveShapedBody(shaped)).toBe(true);
    expect(isSleevelessEffectiveAlineBody(shaped)).toBe(false);
    const r = resolveSleevelessFrontDiagram(shaped, { devForceCardiganHalfLeft: false });
    expect(r.src).toBe("/images/patterns/sleeveless/diagrams/diagram-front-round-shaped.svg");
  });
});
