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
} from "./sidewaysCardiganConstructionIdentity";
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
  const summary = buildSidewaysCardiganWorkspaceSummary({
    calc: result.calc,
    input: inspected.input,
    sleeveDirection:
      parseSidewaysCardiganSleeveDirection(section(pattern.style).sleeveDirection) ?? undefined,
    garmentStyle,
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
  };
}
