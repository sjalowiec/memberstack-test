/**
 * Sideways Cardigan workspace — calculation summary only.
 * Does not generate Drop Shoulder / Sleeveless instructions.
 */
import { getCurrentPattern, getPatternData } from "../lib/patterns/patternStorage";
import { calculateSidewaysCardiganBody } from "../lib/patterns/sidewaysCardiganBodyCalc";
import { resolveSidewaysCardiganBodyCalcInputFromPattern } from "../lib/patterns/sidewaysCardiganFinishedMeasurements";
import {
  hasAuthoritativeSidewaysCardiganConstruction,
  parseSidewaysCardiganSleeveDirection,
  stampSidewaysCardiganWorkingDraftFromPage,
} from "../lib/patterns/sidewaysCardiganConstructionIdentity";
import {
  buildSidewaysCardiganWorkspaceSummary,
  renderSidewaysCardiganWorkspaceSummaryHtml,
} from "../lib/patterns/sidewaysCardiganWorkspaceSummary";
import { loadExpressSweaterCharts } from "../lib/patterns/sleevelessExpressSizeChartClient";

function section(obj: unknown): Record<string, unknown> {
  return obj && typeof obj === "object" && !Array.isArray(obj)
    ? (obj as Record<string, unknown>)
    : {};
}

function mergedPattern(): Record<string, unknown> {
  const canonical = getCurrentPattern() as unknown as Record<string, unknown>;
  const pb = getPatternData();
  return {
    ...canonical,
    ...pb,
    style: { ...section(canonical.style), ...section(pb.style) },
    fit: { ...section(canonical.fit), ...section(pb.fit) },
    yarnGauge: { ...section(canonical.yarnGauge), ...section(pb.yarnGauge) },
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
  const host = document.querySelector("[data-sideways-calc-host]");
  const summary = document.querySelector("[data-sideways-calc-summary]");
  const errorEl = document.querySelector("[data-sideways-calc-error]");
  const adjustmentEl = document.querySelector("[data-sideways-calc-adjustment]");
  if (
    !(summary instanceof HTMLElement) ||
    !(missing instanceof HTMLElement) ||
    !(host instanceof HTMLElement)
  ) {
    return;
  }

  const hideSummary = (): void => {
    missing.hidden = false;
    host.hidden = true;
  };

  if (!hasAuthoritativeSidewaysCardiganConstruction(section(pattern.style))) {
    hideSummary();
    return;
  }

  const input = resolveSidewaysCardiganBodyCalcInputFromPattern(pattern);
  if (!input) {
    hideSummary();
    return;
  }

  const result = calculateSidewaysCardiganBody(input);
  missing.hidden = true;
  host.hidden = false;

  if (!result.ok) {
    summary.innerHTML = "";
    if (errorEl instanceof HTMLElement) {
      errorEl.hidden = false;
      errorEl.textContent = result.error.message;
    }
    if (adjustmentEl instanceof HTMLElement) {
      adjustmentEl.hidden = true;
      adjustmentEl.textContent = "";
    }
    return;
  }

  if (errorEl instanceof HTMLElement) {
    errorEl.hidden = true;
    errorEl.textContent = "";
  }

  const workspace = buildSidewaysCardiganWorkspaceSummary({
    calc: result.calc,
    input,
    sleeveDirection: parseSidewaysCardiganSleeveDirection(section(pattern.style).sleeveDirection) ?? undefined,
  });
  summary.innerHTML = renderSidewaysCardiganWorkspaceSummaryHtml(workspace);

  if (adjustmentEl instanceof HTMLElement) {
    if (workspace.adjustmentMessage) {
      adjustmentEl.hidden = false;
      adjustmentEl.textContent = `Bust adjusted to keep the pattern symmetrical: ${workspace.adjustmentMessage}.`;
    } else {
      adjustmentEl.hidden = true;
      adjustmentEl.textContent = "";
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void render();
  }, { once: true });
} else {
  void render();
}
