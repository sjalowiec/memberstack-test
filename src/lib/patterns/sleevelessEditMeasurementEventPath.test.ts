import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SLEEVELESS_EDIT_MEASUREMENT_ART_HOST_CLASS,
  createSameTurnCommitGate,
  replaceSleevelessMeasurementArtOnly,
} from "./sleevelessEditMeasurementArtDom";
import { SLEEVELESS_EDIT_MEASUREMENT_TARGET_IDS } from "./sleevelessEditMeasurementDiagramSvg";

const measurementsPageSrc = readFileSync(
  resolve("src/scripts/sleeveless-custom-build-measurements-page.ts"),
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
  if (sel.startsWith("svg.")) return el.tagName === "svg" && hasClass(el, sel.slice(4));
  if (sel.startsWith(".")) return hasClass(el, sel.slice(1));
  return false;
}

function hasClass(el: FakeEl, className: string): boolean {
  return el.className.split(/\s+/).includes(className);
}

function makeArt(label: string): FakeEl {
  const svg = new FakeEl("svg", "express-mbp-art", `art-${label}`);
  for (const id of SLEEVELESS_EDIT_MEASUREMENT_TARGET_IDS) {
    svg.append(new FakeEl("circle", "", id));
  }
  return svg;
}

function hydrate(values: Record<string, string>): {
  inner: FakeEl;
  overlay: FakeEl;
  chips: FakeChip[];
} {
  const inner = new FakeEl("div", "express-mbp-stage__inner");
  const host = new FakeEl("div", SLEEVELESS_EDIT_MEASUREMENT_ART_HOST_CLASS);
  const overlay = new FakeEl("div", "express-mbp-overlay");
  const chips = CHIP_KEYS.map((key, index) => ({
    className: "express-mbp-box",
    dataset: { measurementTarget: SLEEVELESS_EDIT_MEASUREMENT_TARGET_IDS[index] ?? `target_${key}` },
    value: values[key] ?? "",
    key,
  }));
  overlay.chips = chips;
  host.append(makeArt("round"));
  inner.append(host);
  inner.append(overlay);
  return { inner, overlay, chips };
}

const INITIAL: Record<string, string> = {
  finishedNeckOpeningWidth: "7",
  neckDepth: "3.25",
  chestBust: "40",
  hip: "42",
  finishedLength: "22",
  armholeDepth: "8",
  hemDepth: "2",
};

/**
 * Production commit path from `wireFieldPersistence`:
 *   input  → validation only (no persist / no art refresh)
 *   change → saveFromInput → persist + validation + art refresh
 *   blur   → same saveFromInput (capture on root)
 *
 * This fixture runs that sequence. It cannot mount the real page (no jsdom).
 * What it does cover: the same-turn gate, art-only swap, retarget-not-teardown,
 * and that hydrate/replaceChildren is not part of the edit path.
 */
function runProductionMeasurementCommit(options: {
  chips: FakeChip[];
  inner: FakeEl;
  overlay: FakeEl;
  field: (typeof CHIP_KEYS)[number];
  nextValue: string;
  neckline: "round" | "v-neck";
  persistLog: string[];
  hydrateLog: string[];
  retargetLog: string[];
  disconnectLog: string[];
}): void {
  const shouldCommit = createSameTurnCommitGate();
  const fieldChip = options.chips.find((chip) => chip.key === options.field);
  if (!fieldChip) throw new Error(`missing chip ${options.field}`);

  const saveFromInput = (): void => {
    if (!shouldCommit(fieldChip.key, fieldChip.value)) return;
    options.persistLog.push(`${fieldChip.key}=${fieldChip.value}`);
    const next = makeArt(options.neckline);
    const swapped = replaceSleevelessMeasurementArtOnly(
      options.inner as unknown as ParentNode,
      next as unknown as Element,
    );
    expect(swapped?.overlay).toBe(options.overlay);
    options.retargetLog.push(next.id);
  };

  const onInput = (): void => {
    /* validation only — production onInput does not persist or refresh art */
  };
  const onChange = (): void => saveFromInput();
  const onBlur = (): void => saveFromInput();

  fieldChip.value = options.nextValue;
  onInput();
  onChange();
  onBlur();

  expect(options.hydrateLog).toEqual([]);
  expect(options.disconnectLog).toEqual([]);
}

describe("Sleeveless Edit Pattern — real measurement input event path", () => {
  it("documents the live production sequence (not a helper-only refresh)", () => {
    const persistFn = measurementsPageSrc.match(
      /function wireFieldPersistence[\s\S]*?measureFieldPersistenceCleanup = \(\) => \{[\s\S]*?\n  \};/,
    )?.[0];
    expect(persistFn).toBeTruthy();
    expect(persistFn).toContain('root.addEventListener("change", onChange)');
    expect(persistFn).toContain('root.addEventListener("blur", onChange, true)');
    expect(persistFn).toContain('root.addEventListener("input", onInput)');
    expect(persistFn).toContain("createSameTurnCommitGate");
    expect(persistFn).toContain("persistFromRoot(root, displayUnit)");
    expect(persistFn).toContain("sleevelessMeasurementArtRefreshImpl?.()");
    expect(persistFn).not.toContain("hydrateWorkspaceSummaryDiagram");
    expect(persistFn).not.toContain("renderSummaryDiagramFromMerged");
    expect(persistFn).not.toContain("renderDiagram(");
    expect(persistFn).not.toContain("replaceChildren");

    const refreshFn = measurementsPageSrc.match(
      /const refreshSleevelessMeasurementArt = \(\): void => \{[\s\S]*?\n  \};/,
    )?.[0];
    expect(refreshFn).toContain("replaceSleevelessMeasurementArtOnly");
    expect(refreshFn).toContain("retarget");
    expect(refreshFn).not.toContain("hydrateWorkspaceSummaryDiagram");
    expect(refreshFn).not.toContain("renderDiagram(");
  });

  it("change + capture blur persist and refresh once, keeping every chip", async () => {
    const { inner, overlay, chips } = hydrate(INITIAL);
    const persistLog: string[] = [];
    const hydrateLog: string[] = [];
    const retargetLog: string[] = [];
    const disconnectLog: string[] = [];

    runProductionMeasurementCommit({
      chips,
      inner,
      overlay,
      field: "chestBust",
      nextValue: "38",
      neckline: "round",
      persistLog,
      hydrateLog,
      retargetLog,
      disconnectLog,
    });
    await Promise.resolve();

    expect(persistLog).toEqual(["chestBust=38"]);
    expect(retargetLog).toEqual(["art-round"]);
    expect(overlay.chips).toBe(chips);
    expect(chips.map((chip) => chip.value)).toEqual([
      "7",
      "3.25",
      "38",
      "42",
      "22",
      "8",
      "2",
    ]);
    expect(inner.querySelectorAll(".express-mbp-box").length + overlay.chips.length).toBe(
      overlay.chips.length,
    );
    expect(inner.querySelectorAll("svg.express-mbp-art")).toHaveLength(1);
  });

  it("repeats the same event path for Round and V without duplicating chips or binders", async () => {
    const { inner, overlay, chips } = hydrate(INITIAL);
    const persistLog: string[] = [];
    const hydrateLog: string[] = [];
    const retargetLog: string[] = [];
    const disconnectLog: string[] = [];

    const edits: Array<{ field: (typeof CHIP_KEYS)[number]; value: string; neckline: "round" | "v-neck" }> =
      [
        { field: "chestBust", value: "39", neckline: "round" },
        { field: "hip", value: "44", neckline: "round" },
        { field: "chestBust", value: "38", neckline: "v-neck" },
        { field: "hip", value: "46", neckline: "v-neck" },
        { field: "finishedLength", value: "23", neckline: "round" },
      ];

    for (const edit of edits) {
      runProductionMeasurementCommit({
        chips,
        inner,
        overlay,
        field: edit.field,
        nextValue: edit.value,
        neckline: edit.neckline,
        persistLog,
        hydrateLog,
        retargetLog,
        disconnectLog,
      });
      await Promise.resolve();
    }

    expect(persistLog).toHaveLength(edits.length);
    expect(retargetLog).toHaveLength(edits.length);
    expect(disconnectLog).toEqual([]);
    expect(hydrateLog).toEqual([]);
    expect(overlay.chips).toHaveLength(CHIP_KEYS.length);
    expect(overlay.chips).toBe(chips);
    expect(inner.querySelectorAll("svg.express-mbp-art")).toHaveLength(1);
    expect(inner.querySelectorAll(".express-mbp-overlay")).toHaveLength(1);
    expect(chips.find((chip) => chip.key === "chestBust")?.value).toBe("38");
    expect(chips.find((chip) => chip.key === "hip")?.value).toBe("46");
    expect(chips.find((chip) => chip.key === "finishedLength")?.value).toBe("23");
    expect(chips.find((chip) => chip.key === "armholeDepth")?.value).toBe("8");
  });

  it("does not treat a measurement edit as a workspace rehydrate", () => {
    expect(measurementsPageSrc).toMatch(
      /persistFromRoot\(root, displayUnit\);\s*refreshPatternValidationUi\(root, displayUnit\);\s*if \(!isDropShoulderConstruction\(\)\) \{\s*sleevelessMeasurementArtRefreshImpl\?\.\(\);/,
    );
    expect(measurementsPageSrc).not.toMatch(
      /sleevelessMeasurementArtRefreshImpl\?\.\(\);[\s\S]{0,200}hydrateWorkspaceSummaryDiagram/,
    );
  });
});

describe("Sleeveless Edit Pattern — Front Style live art refresh", () => {
  function refreshArtOnly(
    inner: FakeEl,
    overlay: FakeEl,
    label: string,
    disconnectLog: string[],
    retargetLog: string[],
  ): void {
    const next = makeArt(label);
    const swapped = replaceSleevelessMeasurementArtOnly(
      inner as unknown as ParentNode,
      next as unknown as Element,
    );
    expect(swapped?.overlay).toBe(overlay);
    retargetLog.push(next.id);
  }

  it("Pullover → Cardigan and Cardigan → Pullover keep the same chips and values", () => {
    const { inner, overlay, chips } = hydrate(INITIAL);
    const disconnectLog: string[] = [];
    const retargetLog: string[] = [];

    refreshArtOnly(inner, overlay, "cardigan", disconnectLog, retargetLog);
    expect(overlay.chips).toBe(chips);
    expect(chips.map((chip) => chip.value)).toEqual(Object.values(INITIAL));

    refreshArtOnly(inner, overlay, "pullover", disconnectLog, retargetLog);
    expect(overlay.chips).toBe(chips);
    expect(chips.map((chip) => chip.value)).toEqual(Object.values(INITIAL));
    expect(disconnectLog).toEqual([]);
    expect(retargetLog).toEqual(["art-cardigan", "art-pullover"]);
    expect(inner.querySelectorAll("svg.express-mbp-art")).toHaveLength(1);
    expect(inner.querySelectorAll(".express-mbp-overlay")).toHaveLength(1);
  });

  it("repeated Front Style changes do not duplicate overlays or disconnect the binder", () => {
    const { inner, overlay, chips } = hydrate(INITIAL);
    const disconnectLog: string[] = [];
    const retargetLog: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      refreshArtOnly(inner, overlay, i % 2 === 0 ? "cardigan" : "pullover", disconnectLog, retargetLog);
    }
    expect(overlay.chips).toHaveLength(CHIP_KEYS.length);
    expect(overlay.chips).toBe(chips);
    expect(disconnectLog).toEqual([]);
    expect(retargetLog).toHaveLength(6);
    expect(inner.querySelectorAll("svg.express-mbp-art")).toHaveLength(1);
    expect(inner.querySelectorAll(".express-mbp-overlay")).toHaveLength(1);
  });

  it("wires Front Style to the same art-only refresh as Round/V", () => {
    expect(measurementsPageSrc).toContain("wireSleevelessGarmentArtRefreshOnce");
    expect(measurementsPageSrc).toContain('input[name="sl-edit-garment"]');
    expect(measurementsPageSrc).toContain("readLiveSleevelessEditGarmentStyle");
    expect(measurementsPageSrc).toContain("liveGarmentStyle");
    const refreshFn = measurementsPageSrc.match(
      /const refreshSleevelessMeasurementArt = \(\): void => \{[\s\S]*?\n  \};/,
    )?.[0];
    expect(refreshFn).toContain("replaceSleevelessMeasurementArtOnly");
    expect(refreshFn).toContain("retarget");
    expect(measurementsPageSrc).toMatch(
      /wireSleevelessGarmentArtRefreshOnce\(\s*document\.querySelectorAll<HTMLInputElement>\('input\[name="sl-edit-garment"\]'\),\s*refreshSleevelessMeasurementArt,/,
    );
    expect(measurementsPageSrc).toMatch(
      /wireSleevelessNecklineArtRefreshOnce\(\s*document\.querySelectorAll<HTMLInputElement>\('input\[name="sl-edit-neckline"\]'\),\s*refreshSleevelessMeasurementArt,/,
    );
  });
});
