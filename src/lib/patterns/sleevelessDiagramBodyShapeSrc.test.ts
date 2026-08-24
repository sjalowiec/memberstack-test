import { describe, expect, it } from "vitest";
import { resolveEffectiveSleevelessBodyShapeKind } from "./sleevelessAlineShaping";
import { resolveSleevelessBackDiagramSrc } from "./sleevelessBackDiagramSrc";
import {
  applySleevelessDiagramBodyShapeSuffix,
  resolveSleevelessDiagramBodyShapeKind,
  shouldGenerateSleevelessAlineStsRows,
  usesDedicatedSleevelessBodyShapeDiagramSvg,
} from "./sleevelessDiagramBodyShapeSrc";
import { resolveSleevelessFrontDiagramSrc } from "./sleevelessFrontJapaneseNotation";
import { resolveSleevelessFrontDiagram } from "./sleevelessFrontDiagramSrc";

const alineFit = {
  style: { bodyShape: "aline", garmentStyle: "pullover" },
  fit: { selectedMeasurements: { finished_bust_chest: 38, finished_hip: 44 } },
};

const shapedFit = {
  style: { bodyShape: "shaped", garmentStyle: "pullover", neckline: "round" },
  fit: { selectedMeasurements: { finished_bust_chest: 40, finished_hip: 40 } },
};

const straightFit = {
  style: { bodyShape: "straight", garmentStyle: "pullover", neckline: "round" },
  fit: { selectedMeasurements: { finished_bust_chest: 40, finished_hip: 40 } },
};

describe("applySleevelessDiagramBodyShapeSuffix", () => {
  const base = "/images/patterns/sleeveless/diagrams/diagram-front-round.svg";

  it("leaves straight base unchanged", () => {
    expect(applySleevelessDiagramBodyShapeSuffix(base, "straight")).toBe(base);
  });

  it("appends -aline before .svg", () => {
    expect(applySleevelessDiagramBodyShapeSuffix(base, "aline")).toBe(
      "/images/patterns/sleeveless/diagrams/diagram-front-round-aline.svg",
    );
  });

  it("appends -shaped before .svg", () => {
    expect(applySleevelessDiagramBodyShapeSuffix(base, "shaped")).toBe(
      "/images/patterns/sleeveless/diagrams/diagram-front-round-shaped.svg",
    );
  });
});

describe("resolveSleevelessDiagramBodyShapeKind", () => {
  it("resolves aline from hip wider than bust", () => {
    expect(resolveSleevelessDiagramBodyShapeKind(alineFit)).toBe("aline");
    expect(resolveEffectiveSleevelessBodyShapeKind(alineFit, 38, 44)).toBe("aline");
  });

  it("resolves shaped from stored bodyShape", () => {
    expect(resolveSleevelessDiagramBodyShapeKind(shapedFit)).toBe("shaped");
  });

  it("resolves shaped when hip is narrower than bust (measurement-inferred)", () => {
    const pd = {
      style: { bodyShape: "straight", garmentStyle: "pullover", neckline: "round" },
      fit: { selectedMeasurements: { finished_bust_chest: 44, finished_hip: 40 } },
    };
    expect(resolveSleevelessDiagramBodyShapeKind(pd)).toBe("shaped");
    expect(resolveSleevelessBackDiagramSrc("sts-rows", pd)).toBe(
      "/images/patterns/sleeveless/diagrams/diagram-back-shaped.svg",
    );
  });

  it("resolves straight when bust matches hip and style is straight", () => {
    expect(resolveSleevelessDiagramBodyShapeKind(straightFit)).toBe("straight");
  });
});

describe("shouldGenerateSleevelessAlineStsRows", () => {
  it("allows both A-line stitch directions and rejects explicit shaped", () => {
    expect(shouldGenerateSleevelessAlineStsRows(alineFit, "decrease-to-bust")).toBe(true);
    expect(
      shouldGenerateSleevelessAlineStsRows(
        {
          style: { bodyShape: "aline", garmentStyle: "pullover" },
          fit: { selectedMeasurements: { finished_bust_chest: 40, finished_hip: 32 } },
        },
        "increase-to-bust",
      ),
    ).toBe(true);
    expect(
      shouldGenerateSleevelessAlineStsRows(
        {
          style: { garmentStyle: "pullover" },
          fit: { selectedMeasurements: { finished_bust_chest: 40, finished_hip: 32 } },
        },
        "increase-to-bust",
      ),
    ).toBe(true);
    expect(shouldGenerateSleevelessAlineStsRows(shapedFit, "increase-to-bust")).toBe(false);
    expect(shouldGenerateSleevelessAlineStsRows(straightFit, "straight")).toBe(false);
  });
});

describe("usesDedicatedSleevelessBodyShapeDiagramSvg", () => {
  it("is false only for straight", () => {
    expect(usesDedicatedSleevelessBodyShapeDiagramSvg("straight")).toBe(false);
    expect(usesDedicatedSleevelessBodyShapeDiagramSvg("aline")).toBe(true);
    expect(usesDedicatedSleevelessBodyShapeDiagramSvg("shaped")).toBe(true);
  });
});

describe("back diagram routing by body shape", () => {
  it.each([
    ["sts-rows", "straight", "/images/patterns/sleeveless/diagrams/diagram-back.svg"],
    ["sts-rows", "aline", "/images/patterns/sleeveless/diagrams/diagram-back-aline.svg"],
    ["sts-rows", "shaped", "/images/patterns/sleeveless/diagrams/diagram-back-shaped.svg"],
    [
      "shaping-notation",
      "straight",
      "/images/patterns/sleeveless/diagrams/diagram-jp-back.svg",
    ],
    [
      "shaping-notation",
      "aline",
      "/images/patterns/sleeveless/diagrams/diagram-jp-back-aline.svg",
    ],
    [
      "shaping-notation",
      "shaped",
      "/images/patterns/sleeveless/diagrams/diagram-jp-back-shaped.svg",
    ],
  ] as const)(
    "mode %s + %s → %s",
    (mode, shape, expected) => {
      const pd =
        shape === "aline"
          ? alineFit
          : shape === "shaped"
            ? shapedFit
            : straightFit;
      expect(resolveSleevelessBackDiagramSrc(mode, pd)).toBe(expected);
    },
  );
});

describe("front diagram routing by body shape", () => {
  const cases = [
    {
      label: "pullover round sts-rows straight",
      pd: { ...straightFit, style: { ...straightFit.style, neckline: "round" } },
      mode: "sts-rows" as const,
      expected: "/images/patterns/sleeveless/diagrams/diagram-front-round.svg",
    },
    {
      label: "pullover round sts-rows aline",
      pd: { ...alineFit, style: { ...alineFit.style, neckline: "round" } },
      mode: "sts-rows" as const,
      expected: "/images/patterns/sleeveless/diagrams/diagram-front-round-aline.svg",
    },
    {
      label: "pullover round sts-rows shaped",
      pd: shapedFit,
      mode: "sts-rows" as const,
      expected: "/images/patterns/sleeveless/diagrams/diagram-front-round-shaped.svg",
    },
    {
      label: "pullover v sts-rows aline",
      pd: { ...alineFit, style: { ...alineFit.style, neckline: "v-neck" } },
      mode: "sts-rows" as const,
      expected: "/images/patterns/sleeveless/diagrams/diagram-front-v-aline.svg",
    },
    {
      label: "pullover v jp shaped",
      pd: { ...shapedFit, style: { ...shapedFit.style, neckline: "v-neck" } },
      mode: "shaping-notation" as const,
      expected: "/images/patterns/sleeveless/diagrams/diagram-jp-front-v-shaped.svg",
    },
    {
      label: "cardigan round sts-rows aline",
      pd: {
        ...alineFit,
        style: {
          ...alineFit.style,
          neckline: "round",
          garmentStyle: "cardigan",
          frontStyle: "open",
        },
      },
      mode: "sts-rows" as const,
      expected: "/images/patterns/sleeveless/diagrams/diagram-cardigan-round-aline.svg",
    },
    {
      label: "cardigan v jp straight",
      pd: {
        style: { neckline: "v-neck", garmentStyle: "cardigan" },
        fit: { selectedMeasurements: { finished_bust_chest: 40, finished_hip: 40 } },
      },
      mode: "shaping-notation" as const,
      expected: "/images/patterns/sleeveless/diagrams/diagram-jp-cardigan-v.svg",
    },
    {
      label: "cardigan v jp shaped",
      pd: {
        style: { neckline: "v-neck", garmentStyle: "cardigan", bodyShape: "shaped" },
        fit: { selectedMeasurements: { finished_bust_chest: 40, finished_hip: 40 } },
      },
      mode: "shaping-notation" as const,
      expected: "/images/patterns/sleeveless/diagrams/diagram-jp-cardigan-v-shaped.svg",
    },
  ];

  it.each(cases)("$label", ({ pd, mode, expected }) => {
    expect(resolveSleevelessFrontDiagramSrc(mode, pd)).toBe(expected);
    if (mode === "sts-rows") {
      expect(resolveSleevelessFrontDiagram(pd, { devForceCardiganHalfLeft: false }).src).toBe(
        expected,
      );
    }
  });
});
