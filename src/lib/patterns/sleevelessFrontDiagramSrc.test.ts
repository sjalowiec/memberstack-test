import { describe, expect, it } from "vitest";
import {
  getSleevelessShoulderNotationIconSrc,
  isSleevelessVNeckChoice,
  isSleevelessCardiganGarmentStyle,
  isSleevelessDevCardiganExpressPreview,
  resolveSleevelessFrontDiagram,
  SLEEVELESS_SHOULDER_NOTATION_ICON_BACK,
  SLEEVELESS_SHOULDER_NOTATION_ICON_FRONT_ROUND,
  SLEEVELESS_SHOULDER_NOTATION_ICON_FRONT_V,
} from "./sleevelessFrontDiagramSrc";

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

  it("routes pullover round neck to diagram-front.svg", () => {
    const r = resolveSleevelessFrontDiagram(roundPattern, { devForceCardiganHalfLeft: false });
    expect(r.garmentStyle).toBe("pullover");
    expect(r.diagramType).toBe("pulloverFullFrontRound");
    expect(r.frontPieceType).toBe("fullFront");
    expect(r.src.endsWith("/diagram-front.svg")).toBe(true);
  });

  it("routes pullover v-neck to diagram-front-V.svg", () => {
    const r = resolveSleevelessFrontDiagram({ style: { neckline: "v-neck" } }, { devForceCardiganHalfLeft: false });
    expect(r.diagramType).toBe("pulloverFullFrontV");
    expect(r.src.endsWith("/diagram-front-V.svg")).toBe(true);
  });

  it("routes round-neck cardigan style to half-front schematic in dev", () => {
    if (!import.meta.env.DEV) return;
    const r = resolveSleevelessFrontDiagram(
      { style: { neckline: "round", frontStyle: "open" } },
      { devForceCardiganHalfLeft: false },
    );
    expect(r.diagramType).toBe("cardiganHalfFrontRound");
    expect(r.src.endsWith("/cardigan-half-front-round.svg")).toBe(true);
  });

  it("routes v-neck cardigan style to half-front V schematic in dev", () => {
    if (!import.meta.env.DEV) return;
    const r = resolveSleevelessFrontDiagram(
      { style: { neckline: "v-neck", garmentStyle: "cardigan" } },
      { devForceCardiganHalfLeft: false },
    );
    expect(r.diagramType).toBe("cardiganHalfFrontV");
    expect(r.src.endsWith("/cardigan-v.svg")).toBe(true);
  });

  it("forces cardigan half-front asset when dev flag is true", () => {
    const r = resolveSleevelessFrontDiagram(roundPattern, { devForceCardiganHalfLeft: true });
    expect(r.garmentStyle).toBe("cardigan");
    expect(r.diagramType).toBe("cardiganHalfFrontRound");
    expect(r.frontPieceType).toBe("leftFront");
    expect(r.src.endsWith("/cardigan-half-front-round.svg")).toBe(true);
  });

  it("forces V cardigan half-front when dev flag is true and neckline is V", () => {
    const r = resolveSleevelessFrontDiagram(
      { style: { neckline: "v-neck" } },
      { devForceCardiganHalfLeft: true },
    );
    expect(r.diagramType).toBe("cardiganHalfFrontV");
    expect(r.src.endsWith("/cardigan-v.svg")).toBe(true);
  });
});
