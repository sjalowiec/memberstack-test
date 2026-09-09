/**
 * Minimal Sideways Cardigan workspace — shows body calc numbers only.
 * Does not generate Drop Shoulder / Sleeveless instructions.
 */
import { getCurrentPattern, getPatternData } from "../lib/patterns/patternStorage";
import {
  calculateSidewaysCardiganBody,
} from "../lib/patterns/sidewaysCardiganBodyCalc";
import { resolveSidewaysCardiganBodyCalcInputFromPattern } from "../lib/patterns/sidewaysCardiganFinishedMeasurements";
import {
  hasAuthoritativeSidewaysCardiganConstruction,
  stampSidewaysCardiganWorkingDraftFromPage,
} from "../lib/patterns/sidewaysCardiganConstructionIdentity";
import { loadExpressSweaterCharts } from "../lib/patterns/sleevelessExpressSizeChartClient";

function section(obj: unknown): Record<string, unknown> {
  return obj && typeof obj === "object" && !Array.isArray(obj)
    ? (obj as Record<string, unknown>)
    : {};
}

function addRow(dl: HTMLElement, label: string, value: string): void {
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.textContent = value;
  dl.append(dt, dd);
}

function mergedPattern(): Record<string, unknown> {
  const canonical = getCurrentPattern() as unknown as Record<string, unknown>;
  const pb = getPatternData();
  return {
    ...canonical,
    ...pb,
    style: { ...section(canonical.style), ...section(pb.style) },
    fit: { ...section(canonical.fit), ...section(pb.fit) },
    yarnGaugeMachine: {
      ...section(canonical.yarnGauge),
      ...section(pb.yarnGaugeMachine),
    },
  };
}

async function render(): Promise<void> {
  stampSidewaysCardiganWorkingDraftFromPage();
  try {
    await loadExpressSweaterCharts();
  } catch {
    /* charts optional once measurements are already on the draft */
  }

  const pattern = mergedPattern();
  const missing = document.querySelector("[data-sideways-calc-missing]");
  const summary = document.querySelector("[data-sideways-calc-summary]");
  const unresolved = document.querySelector("[data-sideways-calc-unresolved]");
  if (!(summary instanceof HTMLElement) || !(missing instanceof HTMLElement)) return;

  if (!hasAuthoritativeSidewaysCardiganConstruction(section(pattern.style))) {
    missing.hidden = false;
    summary.hidden = true;
    return;
  }

  const input = resolveSidewaysCardiganBodyCalcInputFromPattern(pattern);
  if (!input) {
    missing.hidden = false;
    summary.hidden = true;
    return;
  }

  const result = calculateSidewaysCardiganBody(input);
  missing.hidden = true;
  summary.hidden = false;
  summary.replaceChildren();

  if (!result.ok) {
    if (unresolved instanceof HTMLElement) {
      unresolved.hidden = false;
      unresolved.textContent = result.error.message;
    }
    addRow(summary, "Requested bust", `${result.error.requestedTotalBustRows} rows`);
    addRow(summary, "Neck opening", `${result.error.neckOpeningRows} rows each`);
    addRow(summary, "Shoulder rows", String(result.error.roundedShoulderRows));
    return;
  }

  const calc = result.calc;
  addRow(summary, "Garment length", `${calc.garmentLengthStitches} stitches`);
  addRow(summary, "V-neck depth", `${calc.vNeckDepthStitches} stitches`);
  addRow(
    summary,
    "Armhole slit depth",
    `${calc.armholeDepthStitches} stitches (${calc.armholeDepthInches} in)`,
  );
  addRow(summary, "Requested bust", `${calc.bust.requestedTotalBustRows} rows`);
  addRow(summary, "Actual bust", `${calc.bust.actualTotalBustRows} rows`);
  addRow(
    summary,
    "Bust adjustment",
    `${calc.bust.adjustmentRows} rows / ${calc.bust.adjustmentInches} in`,
  );
  addRow(summary, "Each neck section", `${calc.neckOpeningRows} rows`);
  addRow(summary, "Each shoulder section", `${calc.shoulders.firstFrontRows} rows`);

  if (unresolved instanceof HTMLElement) {
    unresolved.hidden = true;
    unresolved.textContent = "";
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void render();
  }, { once: true });
} else {
  void render();
}
