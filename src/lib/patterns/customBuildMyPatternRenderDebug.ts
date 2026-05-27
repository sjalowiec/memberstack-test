/**
 * Dev-only My Pattern render diagnostics (console + on-page panel).
 * Gated by `import.meta.env.DEV`; remove when no longer needed for local troubleshooting.
 */
import { buildCustomBuildEffectivePatternInput } from "./buildCustomBuildEffectivePatternInput";
import { resolveEffectiveFinishedBustInches } from "./customBuildEffectiveFinishedBust";
import { resolveEffectiveFinishedLengthInches } from "./customBuildEffectiveFinishedLength";
import { resolveEffectiveHemDepthInches } from "./customBuildEffectiveHemDepth";
import {
  readActiveCustomPatternProjectId,
  readActiveCustomPatternProjectLinkedName,
} from "./customPatternProjectActiveId";
import { loadMeasurementOverrides } from "./sleevelessCustomMeasurementStorage";
import { buildSleevelessGarmentDiagramReplacements } from "./sleevelessGarmentDiagramReplacements";
import { buildSleevelessGarmentDiagramPatternData } from "./sleevelessPatternBuilderMerge";
import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";
import { getCurrentPattern, getPatternData } from "./patternStorage";

const PANEL_ID = "kbm-my-pattern-render-debug";

function section(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return obj as Record<string, unknown>;
  }
  return {};
}

function readCbOverrides(source: unknown): Record<string, string> {
  const nested = section(section(source).cbMeasurementOverrides);
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(nested)) {
    if (typeof value === "string" && value.trim() !== "") out[key] = value.trim();
  }
  return out;
}

function pickMeasureKeys(overrides: Record<string, string>): Record<string, string> {
  return {
    hemDepth: overrides.hemDepth ?? "(missing)",
    chestBust: overrides.chestBust ?? "(missing)",
    finishedLength: overrides.finishedLength ?? "(missing)",
  };
}

function audienceFromPattern(patternData: Record<string, unknown>): string {
  const fit = section(patternData.fit);
  const style = section(patternData.style);
  const chart = fit.sizingChart ?? fit.knitFor;
  if (typeof chart === "string" && chart.trim()) return chart.trim();
  const cat = style.recipientCategory;
  if (typeof cat === "string" && cat.trim()) return cat.trim();
  return "misses";
}

export type MyPatternRenderDebugOptions = {
  renderStage: "after-generate" | "after-diagram-hydrate";
  genInput: Record<string, unknown>;
  result: SleevelessBackPatternResult;
  unit: "in" | "cm";
  patternMerged: Record<string, unknown>;
  usedFallbackGenInput?: boolean;
  diagramPatternData?: Record<string, unknown>;
};

export function isMyPatternRenderDebugEnabled(doc: Document = document): boolean {
  return doc.querySelector(".sleeveless-pattern-page.sleeveless-workspace-subpage") instanceof HTMLElement;
}

/** Visible panel + structured console log for dedicated My Pattern workspace renders (dev only). */
export function reportMyPatternRenderDebug(options: MyPatternRenderDebugOptions): void {
  if (typeof import.meta === "undefined" || !import.meta.env?.DEV) return;
  if (typeof document === "undefined" || !isMyPatternRenderDebugEnabled()) return;

  const loadOverrides = loadMeasurementOverrides();
  const canonical = getCurrentPattern();
  const patternBuilder = getPatternData();
  const freshEffectiveInput = buildCustomBuildEffectivePatternInput();
  const genInput = options.genInput;
  const genCb = readCbOverrides(genInput.fit);
  const freshCb = readCbOverrides(freshEffectiveInput.fit);
  const diagramPatternData =
    options.diagramPatternData ??
    buildSleevelessGarmentDiagramPatternData(options.patternMerged, genInput);
  const diagramCb = readCbOverrides(diagramPatternData.fit);
  const repl = buildSleevelessGarmentDiagramReplacements(options.result, options.unit, {
    patternData: diagramPatternData,
    measurementPiece: "front",
  });
  const audience = audienceFromPattern(genInput);

  const payload = {
    renderStage: options.renderStage,
    pathname: typeof window !== "undefined" ? window.location.pathname : "",
    session: {
      activeProjectId: readActiveCustomPatternProjectId() || "(none)",
      activeProjectName: readActiveCustomPatternProjectLinkedName() || "(none)",
      canonicalPatternId: canonical.id ?? "(none)",
    },
    renderPath: {
      refreshFunction: "refreshPatternTabContent",
      buildGeneratorPatternDataUsesEffectiveInput: true,
      usedFallbackGenInput: options.usedFallbackGenInput === true,
      genInputSameFreshEffectiveInput: {
        hemDepth: genCb.hemDepth === freshCb.hemDepth,
        chestBust: genCb.chestBust === freshCb.chestBust,
        finishedLength: genCb.finishedLength === freshCb.finishedLength,
      },
    },
    "1_loadMeasurementOverrides": pickMeasureKeys(loadOverrides),
    "2_getCurrentPattern_fit_cbMeasurementOverrides": pickMeasureKeys(
      readCbOverrides(canonical.fit),
    ),
    "3_buildCustomBuildEffectivePatternInput_fit_cbMeasurementOverrides": pickMeasureKeys(freshCb),
    "4_generateSleevelessBackPattern_input": {
      cbMeasurementOverrides: pickMeasureKeys(genCb),
      patternMode: String(section(genInput.style).patternMode ?? "(missing)"),
      resolvedForMath: {
        hemDepthInches: resolveEffectiveHemDepthInches(genInput, audience),
        chestBustInches: resolveEffectiveFinishedBustInches(genInput),
        finishedLengthInches: resolveEffectiveFinishedLengthInches(genInput),
      },
      resultDebug: {
        hemRows: options.result.debug.hemRows,
        expectedGarmentRows: options.result.debug.expectedGarmentRows,
        backNeckToHem: options.result.debug.backNeckToHem,
        bustBodyStitches: options.result.debug.bustBodyStitches,
      },
    },
    "5_diagram_replacements": {
      diagramPatternDataCb: pickMeasureKeys(diagramCb),
      tokens: {
        HEM_INCHES: repl.HEM_INCHES ?? "(missing)",
        HEM_ROWS: repl.HEM_ROWS ?? "(missing)",
        BUST_WIDTH: repl.BUST_WIDTH ?? "(missing)",
        SIDE_LENGTH: repl.SIDE_LENGTH ?? "(missing)",
      },
    },
    crossCheck: {
      patternBuilderFitCb: pickMeasureKeys(readCbOverrides(patternBuilder.fit)),
      loadMatchesCanonicalHem:
        (loadOverrides.hemDepth ?? "") === (readCbOverrides(canonical.fit).hemDepth ?? ""),
    },
  };

  console.groupCollapsed(`[kbm My Pattern render debug] ${options.renderStage}`);
  console.log(payload);
  console.groupEnd();

  renderMyPatternDebugPanel(payload);
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderMyPatternDebugPanel(payload: Record<string, unknown>): void {
  let panel = document.getElementById(PANEL_ID);
  if (!(panel instanceof HTMLElement)) {
    panel = document.createElement("aside");
    panel.id = PANEL_ID;
    panel.className = "no-print kbm-my-pattern-render-debug";
    panel.setAttribute("aria-label", "Temporary My Pattern render debug");
    panel.style.cssText =
      "margin:0 0 1rem;padding:0.75rem 1rem;border:2px dashed #c2614e;background:#fff8f3;" +
      "font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#1f2937;" +
      "max-height:420px;overflow:auto;";
    const anchor =
      document.querySelector("#sg-sleeveless-results") ??
      document.querySelector(".sleeveless-pattern-page");
    anchor?.prepend(panel);
  }

  panel.innerHTML =
    `<p style="margin:0 0 0.5rem;font-family:inherit;font-size:13px;font-weight:700;color:#9a3412;">` +
    `Temporary My Pattern render debug (${escapeHtml(payload.renderStage)})` +
    `</p>` +
    `<pre style="margin:0;white-space:pre-wrap;word-break:break-word;">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>`;
}
