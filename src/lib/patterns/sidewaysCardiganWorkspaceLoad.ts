/**
 * Workspace load path used by the Sideways Cardigan pattern page.
 * Same merge + calc + instruction sequence as Create Pattern → workspace.
 */

import { getCurrentPattern, getPatternData } from "./patternStorage";
import { calculateSidewaysCardiganBody } from "./sidewaysCardiganBodyCalc";
import {
  buildSidewaysCardiganBodyInstructions,
  renderSidewaysCardiganBodySequenceHtml,
  type SidewaysCardiganBodyInstructions,
} from "./sidewaysCardiganBodyInstructions";
import {
  inspectSidewaysCardiganBodyCalcInputFromPattern,
} from "./sidewaysCardiganFinishedMeasurements";
import {
  hasAuthoritativeSidewaysCardiganConstruction,
  parseSidewaysCardiganSleeveDirection,
  resolveSidewaysCardiganGarmentStyle,
  type SidewaysCardiganSleeveDirection,
} from "./sidewaysCardiganConstructionIdentity";
import {
  inspectSidewaysCardiganSleeveCalcInputFromPattern,
  SIDEWAYS_CARDIGAN_SLEEVE_MISSING_GAUGE,
  SIDEWAYS_CARDIGAN_SLEEVE_MISSING_LENGTH,
} from "./sidewaysCardiganSleeveCalc";
import {
  buildSidewaysCardiganSleeveInstructions,
  renderSidewaysCardiganSleeveSequenceHtml,
  renderSidewaysSleeveNotConnectedHtml,
  type SidewaysCardiganSleeveInstructions,
} from "./sidewaysCardiganSleeveInstructions";
import {
  buildSidewaysCardiganWorkspaceSummary,
  renderSidewaysCardiganWorkspaceSummaryHtml,
  type SidewaysCardiganWorkspaceSummary,
} from "./sidewaysCardiganWorkspaceSummary";
import type { SidewaysCardiganBodyCalc } from "./sidewaysCardiganBodyCalc";
import type { SidewaysCardiganBodyCalcInput } from "./sidewaysCardiganBodyCalc";

function section(obj: unknown): Record<string, unknown> {
  return obj && typeof obj === "object" && !Array.isArray(obj)
    ? (obj as Record<string, unknown>)
    : {};
}

export function mergeSidewaysCardiganWorkingDraft(): Record<string, unknown> {
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

export type SidewaysCardiganWorkspaceView =
  | {
      ok: true;
      pattern: Record<string, unknown>;
      input: SidewaysCardiganBodyCalcInput;
      calc: SidewaysCardiganBodyCalc;
      instructions: SidewaysCardiganBodyInstructions | null;
      summary: SidewaysCardiganWorkspaceSummary;
      summaryHtml: string;
      sequenceHtml: string;
      instructionError?: string;
      sleeveDirection: SidewaysCardiganSleeveDirection;
      sleeveInstructions: SidewaysCardiganSleeveInstructions | null;
      sleeveHtml: string;
      sleeveError?: string;
    }
  | {
      ok: false;
      reason: "missing-construction" | "incomplete" | "calc-error";
      message: string;
      diagnostic: string;
      missing?: string[];
    };

function isDev(): boolean {
  return Boolean(
    typeof import.meta !== "undefined" && import.meta.env !== undefined && import.meta.env.DEV,
  );
}

function withDevDiagnostic(message: string, diagnostic: string): string {
  if (!isDev()) return message;
  return diagnostic ? `${message} ${diagnostic}` : message;
}

function resolveSidewaysCardiganSleeveWorkspace(args: {
  pattern: Record<string, unknown>;
  calc: SidewaysCardiganBodyCalc;
  input: SidewaysCardiganBodyCalcInput;
}): {
  sleeveDirection: SidewaysCardiganSleeveDirection;
  sleeveInstructions: SidewaysCardiganSleeveInstructions | null;
  sleeveHtml: string;
  sleeveError?: string;
} {
  const inspected = inspectSidewaysCardiganSleeveCalcInputFromPattern(
    args.pattern,
    args.calc,
    args.input.finishedUpperArmInches,
    {
      stitchesPerInch: args.input.stitchesPerInch,
      rowsPerInch: args.input.rowsPerInch,
    },
  );
  const sleeveDirection = inspected.sleeveDirection;

  if (sleeveDirection === "sideways") {
    return {
      sleeveDirection,
      sleeveInstructions: null,
      sleeveHtml: isDev() ? renderSidewaysSleeveNotConnectedHtml() : "",
    };
  }

  if (!inspected.input) {
    const missing = inspected.missing;
    const code = missing.includes("gauge")
      ? SIDEWAYS_CARDIGAN_SLEEVE_MISSING_GAUGE
      : SIDEWAYS_CARDIGAN_SLEEVE_MISSING_LENGTH;
    const message = missing.includes("gauge")
      ? "Stitch gauge and row gauge are required to calculate sleeve stitches and rows."
      : missing.includes("sleeve length")
        ? "Sleeve length is missing. Enter a sleeve length to calculate cuff-up or top-down sleeves."
        : `This sleeve is missing ${missing.join(", ") || "measurements"}.`;
    const diagnostic = `[DEV] Sleeve calculation failed (${code}): missing ${missing.join(", ") || "sleeve measurements"}.`;
    return {
      sleeveDirection,
      sleeveInstructions: null,
      sleeveHtml: "",
      sleeveError: withDevDiagnostic(message, diagnostic),
    };
  }

  const sleeve = buildSidewaysCardiganSleeveInstructions(inspected.input);
  if (!sleeve.ok) {
    const diagnostic = `[DEV] Sleeve calculation failed (${sleeve.error.code}).`;
    return {
      sleeveDirection,
      sleeveInstructions: null,
      sleeveHtml: "",
      sleeveError: withDevDiagnostic(sleeve.error.message, diagnostic),
    };
  }

  return {
    sleeveDirection,
    sleeveInstructions: sleeve.instructions,
    sleeveHtml: renderSidewaysCardiganSleeveSequenceHtml(sleeve.instructions),
  };
}

/** Load the workspace view from canonical + patternBuilderData storage. */
export function loadSidewaysCardiganWorkspaceView(
  pattern: Record<string, unknown> = mergeSidewaysCardiganWorkingDraft(),
): SidewaysCardiganWorkspaceView {
  if (!hasAuthoritativeSidewaysCardiganConstruction(section(pattern.style))) {
    const diagnostic =
      "[DEV] Working draft is not an authored sideways-cardigan construction (missing construction / constructionAuthored).";
    return {
      ok: false,
      reason: "missing-construction",
      message: withDevDiagnostic(
        "Complete the Sideways V-Neck Sweater builder to see the pattern numbers.",
        diagnostic,
      ),
      diagnostic,
    };
  }

  const inspected = inspectSidewaysCardiganBodyCalcInputFromPattern(pattern);
  if (!inspected.input) {
    const missing = inspected.missing;
    const diagnostic = `[DEV] Saved pattern is missing: ${missing.join(", ")}.`;
    return {
      ok: false,
      reason: "incomplete",
      message: withDevDiagnostic(
        "This Sideways V-Neck Sweater is missing measurements needed to calculate the body.",
        diagnostic,
      ),
      diagnostic,
      missing,
    };
  }

  const result = calculateSidewaysCardiganBody(inspected.input);
  if (!result.ok) {
    const diagnostic = `[DEV] Body calculation failed (${result.error.code}).`;
    return {
      ok: false,
      reason: "calc-error",
      message: withDevDiagnostic(result.error.message, diagnostic),
      diagnostic,
    };
  }

  const garmentStyle = resolveSidewaysCardiganGarmentStyle(section(pattern.style));
  const body = buildSidewaysCardiganBodyInstructions(inspected.input, garmentStyle);
  const sleeveDirection =
    parseSidewaysCardiganSleeveDirection(section(pattern.style).sleeveDirection) ?? undefined;
  const summary = buildSidewaysCardiganWorkspaceSummary({
    calc: result.calc,
    input: inspected.input,
    sleeveDirection,
    garmentStyle,
  });
  const sleeve = resolveSidewaysCardiganSleeveWorkspace({
    pattern,
    calc: result.calc,
    input: inspected.input,
  });

  if (!body.ok) {
    const diagnostic = `[DEV] Body instruction model failed (${body.error.code}).`;
    return {
      ok: true,
      pattern,
      input: inspected.input,
      calc: result.calc,
      instructions: null,
      summary,
      summaryHtml: renderSidewaysCardiganWorkspaceSummaryHtml(summary),
      sequenceHtml: "",
      instructionError: withDevDiagnostic(body.error.message, diagnostic),
      ...sleeve,
    };
  }

  return {
    ok: true,
    pattern,
    input: inspected.input,
    calc: result.calc,
    instructions: body.instructions,
    summary,
    summaryHtml: renderSidewaysCardiganWorkspaceSummaryHtml(summary),
    sequenceHtml: renderSidewaysCardiganBodySequenceHtml(body.instructions),
    ...sleeve,
  };
}
