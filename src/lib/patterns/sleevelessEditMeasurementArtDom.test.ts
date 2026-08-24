import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SLEEVELESS_EDIT_GARMENT_ART_WIRED_FLAG,
  SLEEVELESS_EDIT_MEASUREMENT_ART_HOST_CLASS,
  SLEEVELESS_EDIT_NECKLINE_ART_WIRED_FLAG,
  collectedMeasurementValuesArePersistable,
  createSameTurnCommitGate,
  refreshSleevelessEditMeasurementArtLayer,
  replaceSleevelessMeasurementArtOnly,
  wireSleevelessGarmentArtRefreshOnce,
  wireSleevelessNecklineArtRefreshOnce,
} from "./sleevelessEditMeasurementArtDom";
import {
  SLEEVELESS_EDIT_MEASUREMENT_TARGET_IDS,
  buildSleevelessEditMeasurementDiagramSvg,
} from "./sleevelessEditMeasurementDiagramSvg";

const measurementsPageSrc = readFileSync(
  resolve("src/scripts/sleeveless-custom-build-measurements-page.ts"),
  "utf8",
);
const rendererSrc = readFileSync(
  resolve("src/lib/patterns/sleevelessEditMeasurementDiagramSvg.ts"),
  "utf8",
);
const storageSrc = readFileSync(
  resolve("src/lib/patterns/sleevelessCustomMeasurementStorage.ts"),
  "utf8",
);

const CHIP_KEYS = [
  "finishedNeckOpeningWidth",
  "neckDepth",
  "chestBust",
  "hip",
  "finishedLength",
  "armholeDepth",
  "hemDepth",
] as const;

type FakeChip = {
  className: string;
  dataset: { measurementTarget: string };
  value: string;
  key: string;
};

class FakeEl {
  readonly tagName: string;
  className: string;
  id: string;
  parent: FakeEl | null = null;
  children: FakeEl[] = [];
  chips: FakeChip[] = [];

  constructor(tagName: string, className = "", id = "") {
    this.tagName = tagName;
    this.className = className;
    this.id = id;
  }

  append(child: FakeEl): void {
    child.parent = this;
    this.children.push(child);
  }

  replaceWith(next: FakeEl): void {
    const parent = this.parent;
    if (!parent) return;
    const index = parent.children.indexOf(this);
    if (index < 0) return;
    next.parent = parent;
    parent.children.splice(index, 1, next);
    this.parent = null;
  }

  querySelector(sel: string): FakeEl | null {
    if (matches(this, sel)) return this;
    for (const child of this.children) {
      const found = child.querySelector(sel);
      if (found) return found;
    }
    return null;
  }

  querySelectorAll(sel: string): FakeEl[] {
    const out: FakeEl[] = [];
    if (matches(this, sel)) out.push(this);
    for (const child of this.children) out.push(...child.querySelectorAll(sel));
    return out;
  }
}

function matches(el: FakeEl, sel: string): boolean {
  if (sel.startsWith("#")) return el.id === sel.slice(1);
  if (sel.startsWith("svg.")) {
    return el.tagName === "svg" && hasClass(el, sel.slice(4));
  }
  if (sel.startsWith(".")) return hasClass(el, sel.slice(1));
  return false;
}

function hasClass(el: FakeEl, className: string): boolean {
  return el.className.split(/\s+/).includes(className);
}

function makeChip(key: string, targetId: string, value: string): FakeChip {
  return {
    className: "express-mbp-box",
    dataset: { measurementTarget: targetId },
    value,
    key,
  };
}

function makeArt(label: string, targetIds: readonly string[]): FakeEl {
  const svg = new FakeEl("svg", "express-mbp-art", `art-${label}`);
  for (const id of targetIds) {
    svg.append(new FakeEl("circle", "", id));
  }
  return svg;
}

function hydrateStage(values: Record<string, string>): {
  inner: FakeEl;
  overlay: FakeEl;
  chips: FakeChip[];
} {
  const inner = new FakeEl("div", "express-mbp-stage__inner");
  const host = new FakeEl("div", SLEEVELESS_EDIT_MEASUREMENT_ART_HOST_CLASS);
  const overlay = new FakeEl("div", "express-mbp-overlay");
  const chips = CHIP_KEYS.map((key, index) =>
    makeChip(key, SLEEVELESS_EDIT_MEASUREMENT_TARGET_IDS[index] ?? `target_${key}`, values[key] ?? ""),
  );
  overlay.chips = chips;
  host.append(makeArt("round", SLEEVELESS_EDIT_MEASUREMENT_TARGET_IDS));
  inner.append(host);
  inner.append(overlay);
  return { inner, overlay, chips };
}

const INITIAL_VALUES: Record<string, string> = {
  finishedNeckOpeningWidth: "7",
  neckDepth: "3.25",
  chestBust: "40",
  hip: "42",
  finishedLength: "22",
  armholeDepth: "8",
  hemDepth: "2",
};

describe("Sleeveless edit measurement art refresh lifecycle", () => {
  it("initial hydrate keeps the overlay chips beside the generated art host", () => {
    const { inner, overlay, chips } = hydrateStage(INITIAL_VALUES);
    expect(inner.querySelector(`.${SLEEVELESS_EDIT_MEASUREMENT_ART_HOST_CLASS}`)).toBeTruthy();
    expect(inner.querySelector(".express-mbp-overlay")).toBe(overlay);
    expect(chips.map((chip) => chip.value)).toEqual(Object.values(INITIAL_VALUES));
    expect(overlay.chips).toHaveLength(CHIP_KEYS.length);
    expect(inner.querySelector("svg.express-mbp-art")?.id).toBe("art-round");
  });

  it("Round → V live refresh keeps every chip value and the same overlay nodes", () => {
    const { inner, overlay, chips } = hydrateStage(INITIAL_VALUES);
    const sameOverlay = overlay;
    const next = makeArt("v-neck", SLEEVELESS_EDIT_MEASUREMENT_TARGET_IDS);
    const swapped = refreshSleevelessEditMeasurementArtLayer({
      stageInner: inner as unknown as ParentNode,
      nextArt: next as unknown as Element,
      bindOverlay: () => undefined,
    });
    expect(swapped?.overlay).toBe(sameOverlay);
    expect(overlay.chips).toBe(chips);
    expect(chips.map((chip) => chip.value)).toEqual(Object.values(INITIAL_VALUES));
    expect(inner.querySelector("svg.express-mbp-art")?.id).toBe("art-v-neck");
    expect(inner.querySelector("#target_bust")?.parent?.id).toBe("art-v-neck");
  });

  it("V → Round live refresh keeps every chip value", () => {
    const { inner, overlay, chips } = hydrateStage(INITIAL_VALUES);
    refreshSleevelessEditMeasurementArtLayer({
      stageInner: inner as unknown as ParentNode,
      nextArt: makeArt("v-neck", SLEEVELESS_EDIT_MEASUREMENT_TARGET_IDS) as unknown as Element,
      bindOverlay: () => undefined,
    });
    refreshSleevelessEditMeasurementArtLayer({
      stageInner: inner as unknown as ParentNode,
      nextArt: makeArt("round-2", SLEEVELESS_EDIT_MEASUREMENT_TARGET_IDS) as unknown as Element,
      bindOverlay: () => undefined,
    });
    expect(overlay.chips).toBe(chips);
    expect(chips.map((chip) => chip.value)).toEqual(Object.values(INITIAL_VALUES));
    expect(inner.querySelector("svg.express-mbp-art")?.id).toBe("art-round-2");
  });

  it("bust/hip edits followed by diagram refresh keep all chip values", () => {
    const { inner, overlay, chips } = hydrateStage(INITIAL_VALUES);
    const bust = chips.find((chip) => chip.key === "chestBust");
    const hip = chips.find((chip) => chip.key === "hip");
    expect(bust && hip).toBeTruthy();
    bust!.value = "38";
    hip!.value = "44";
    refreshSleevelessEditMeasurementArtLayer({
      stageInner: inner as unknown as ParentNode,
      nextArt: makeArt("aline", SLEEVELESS_EDIT_MEASUREMENT_TARGET_IDS) as unknown as Element,
      bindOverlay: () => undefined,
    });
    expect(overlay.chips).toHaveLength(CHIP_KEYS.length);
    expect(bust!.value).toBe("38");
    expect(hip!.value).toBe("44");
    expect(chips.find((chip) => chip.key === "finishedLength")?.value).toBe("22");
    expect(inner.querySelector("svg.express-mbp-art")?.id).toBe("art-aline");
  });

  it("repeated refreshes do not duplicate chips", () => {
    const { inner, overlay, chips } = hydrateStage(INITIAL_VALUES);
    for (let i = 0; i < 5; i += 1) {
      refreshSleevelessEditMeasurementArtLayer({
        stageInner: inner as unknown as ParentNode,
        nextArt: makeArt(`pass-${i}`, SLEEVELESS_EDIT_MEASUREMENT_TARGET_IDS) as unknown as Element,
        bindOverlay: () => undefined,
      });
    }
    expect(overlay.chips).toHaveLength(CHIP_KEYS.length);
    expect(overlay.chips).toBe(chips);
    expect(inner.querySelectorAll("svg.express-mbp-art")).toHaveLength(1);
    expect(inner.querySelectorAll(`.${SLEEVELESS_EDIT_MEASUREMENT_ART_HOST_CLASS}`)).toHaveLength(1);
    expect(inner.querySelectorAll(".express-mbp-overlay")).toHaveLength(1);
  });

  it("repeated refreshes do not duplicate overlay bind listeners", () => {
    const { inner } = hydrateStage(INITIAL_VALUES);
    let bindCount = 0;
    let liveBinds = 0;
    const bindOverlay = (): void => {
      bindCount += 1;
      liveBinds += 1;
    };
    const cleanupPreviousBind = (): void => {
      if (liveBinds > 0) liveBinds -= 1;
    };
    for (let i = 0; i < 4; i += 1) {
      refreshSleevelessEditMeasurementArtLayer({
        stageInner: inner as unknown as ParentNode,
        nextArt: makeArt(`bind-${i}`, SLEEVELESS_EDIT_MEASUREMENT_TARGET_IDS) as unknown as Element,
        cleanupPreviousBind,
        bindOverlay,
      });
    }
    expect(bindCount).toBe(4);
    expect(liveBinds).toBe(1);
  });

  it("rebinding reads the new generated target_* anchors, not the previous SVG", () => {
    const { inner } = hydrateStage(INITIAL_VALUES);
    const reboundTargets: string[] = [];
    const next = makeArt("rebinding", SLEEVELESS_EDIT_MEASUREMENT_TARGET_IDS);
    refreshSleevelessEditMeasurementArtLayer({
      stageInner: inner as unknown as ParentNode,
      nextArt: next as unknown as Element,
      bindOverlay: (art) => {
        for (const id of SLEEVELESS_EDIT_MEASUREMENT_TARGET_IDS) {
          const target = (art as unknown as FakeEl).querySelector(`#${id}`);
          expect(target).toBeTruthy();
          expect(target?.parent).toBe(art);
          reboundTargets.push(id);
        }
      },
    });
    expect(reboundTargets).toEqual([...SLEEVELESS_EDIT_MEASUREMENT_TARGET_IDS]);
    expect(inner.querySelector("#target_bust")?.parent?.id).toBe("art-rebinding");
  });

  it("does not treat an empty collect as persistable saved state", () => {
    const saved = { ...INITIAL_VALUES };
    const emptyCollect = Object.fromEntries(CHIP_KEYS.map((key) => [key, ""])) as Record<
      string,
      string
    >;
    expect(collectedMeasurementValuesArePersistable(INITIAL_VALUES)).toBe(true);
    expect(collectedMeasurementValuesArePersistable({ chestBust: "38", hip: "" })).toBe(true);
    expect(collectedMeasurementValuesArePersistable(emptyCollect)).toBe(false);
    expect(collectedMeasurementValuesArePersistable({})).toBe(false);
    expect(saved).toEqual(INITIAL_VALUES);
  });

  it("refuses to swap art when the overlay contract is missing", () => {
    const inner = new FakeEl("div", "express-mbp-stage__inner");
    inner.append(makeArt("orphan", SLEEVELESS_EDIT_MEASUREMENT_TARGET_IDS));
    const result = replaceSleevelessMeasurementArtOnly(
      inner as unknown as ParentNode,
      makeArt("next", SLEEVELESS_EDIT_MEASUREMENT_TARGET_IDS) as unknown as Element,
    );
    expect(result).toBeNull();
    expect(inner.querySelector("svg.express-mbp-art")?.id).toBe("art-orphan");
  });
});

describe("Sleeveless edit measurement art — same-turn change+blur gate", () => {
  it("runs persist/refresh once for change then blur of the same value", async () => {
    const shouldCommit = createSameTurnCommitGate();
    expect(shouldCommit("chestBust", "38")).toBe(true);
    expect(shouldCommit("chestBust", "38")).toBe(false);
    await Promise.resolve();
    expect(shouldCommit("chestBust", "38")).toBe(true);
    expect(shouldCommit("hip", "44")).toBe(true);
  });
});

describe("Sleeveless edit measurement art — listener wiring", () => {
  it("wires each neckline radio once", () => {
    const listeners: Array<() => void> = [];
    const radios = [
      { dataset: {} as Record<string, string | undefined>, addEventListener: (_t: string, fn: () => void) => listeners.push(fn) },
      { dataset: {} as Record<string, string | undefined>, addEventListener: (_t: string, fn: () => void) => listeners.push(fn) },
    ];
    const onChange = (): void => undefined;
    expect(wireSleevelessNecklineArtRefreshOnce(radios, onChange)).toBe(2);
    expect(wireSleevelessNecklineArtRefreshOnce(radios, onChange)).toBe(0);
    expect(listeners).toHaveLength(2);
    expect(radios.every((el) => el.dataset[SLEEVELESS_EDIT_NECKLINE_ART_WIRED_FLAG] === "1")).toBe(
      true,
    );
  });

  it("wires each Front Style radio once to the same refresh callback", () => {
    const listeners: Array<() => void> = [];
    const radios = [
      { dataset: {} as Record<string, string | undefined>, addEventListener: (_t: string, fn: () => void) => listeners.push(fn) },
      { dataset: {} as Record<string, string | undefined>, addEventListener: (_t: string, fn: () => void) => listeners.push(fn) },
    ];
    const onChange = (): void => undefined;
    expect(wireSleevelessGarmentArtRefreshOnce(radios, onChange)).toBe(2);
    expect(wireSleevelessGarmentArtRefreshOnce(radios, onChange)).toBe(0);
    expect(listeners).toHaveLength(2);
    expect(radios.every((el) => el.dataset[SLEEVELESS_EDIT_GARMENT_ART_WIRED_FLAG] === "1")).toBe(
      true,
    );
  });
});

describe("Sleeveless edit measurement art — page/DOM contract", () => {
  it("hydrates art inside the dedicated host and refreshes only that layer", () => {
    expect(measurementsPageSrc).toContain("SLEEVELESS_EDIT_MEASUREMENT_ART_HOST_CLASS");
    expect(measurementsPageSrc).toContain("inner.append(artHost, overlay)");
    expect(measurementsPageSrc).not.toContain("inner.append(art, overlay)");
    expect(measurementsPageSrc).toContain("replaceSleevelessMeasurementArtOnly");
    expect(measurementsPageSrc).toContain("adoptGeneratedMeasurementSvg");
    expect(measurementsPageSrc).toContain("diagramOverlayPositionCleanup.retarget");
    expect(measurementsPageSrc).toContain("wireSleevelessGarmentArtRefreshOnce");
    expect(measurementsPageSrc).not.toContain("oldArt.replaceWith(next)");
    const refreshFn = measurementsPageSrc.match(
      /const refreshSleevelessMeasurementArt = \(\): void => \{[\s\S]*?\n  \};/,
    )?.[0];
    expect(refreshFn).toBeTruthy();
    expect(refreshFn).not.toContain("diagramHost.replaceChildren()");
    expect(refreshFn).not.toContain("overlay.innerHTML");
    expect(refreshFn).not.toContain("replaceChildren()");
    expect(refreshFn).toContain("retarget");
    expect(refreshFn).not.toContain("cleanupPreviousBind");
    expect(refreshFn).not.toMatch(/diagramOverlayPositionCleanup\?\.\(\)/);
  });

  it("does not persist an empty chip collection after a refresh", () => {
    expect(measurementsPageSrc).toContain("collectedMeasurementValuesArePersistable");
    expect(measurementsPageSrc).toMatch(
      /persistFromRoot[\s\S]*if \(!collectedMeasurementValuesArePersistable\(values\)\) return/,
    );
    expect(storageSrc).toContain("cbMeasurementOverrides");
    expect(storageSrc).toMatch(/if \(Object\.keys\(fromDom\)\.length > 0\)/);
  });

  it("keeps Drop Shoulder on the static blueprint fetch path", () => {
    expect(measurementsPageSrc).toMatch(/if \(isDropShoulderConstruction\(\)\) return;/);
    expect(measurementsPageSrc).toContain("resolveMeasurementBlueprintSvgUrl");
    expect(measurementsPageSrc).toMatch(
      /if \(!isDropShoulderConstruction\(\) && merged\)/,
    );
    expect(rendererSrc).not.toContain("drop_shoulder_summary");
  });

  it("keeps generated target circles id-only so overlay collection stays on chips", () => {
    const svg = buildSleevelessEditMeasurementDiagramSvg({
      measurements: {
        garmentLengthInches: 22,
        armholeDepthInches: 8,
        neckOpeningInches: 7,
        neckDepthInches: 3.25,
        shoulderWidthInches: 4.5,
        hemDepthInches: 2,
        bustInches: 40,
        hipInches: 42,
      },
      patternData: { style: { neckline: "round" } },
    });
    expect(svg).not.toContain("data-measurement-target");
    expect(rendererSrc).not.toContain("data-measurement-target");
    for (const id of SLEEVELESS_EDIT_MEASUREMENT_TARGET_IDS) {
      expect(svg).toContain(`id="${id}"`);
    }
  });
});
