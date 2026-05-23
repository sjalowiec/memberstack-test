import { resolveGeneratorPatternMode } from "./sleevelessPatternBuilderMerge";
import { SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY } from "./patternStorage";
import type {
  SleevelessBackPatternResult,
  SleevelessPatternDisplayRow,
} from "./sleevelessPatternOutput";

/** DOM id for Express gauge-step available needles input. */
export const EXPRESS_AVAILABLE_NEEDLES_INPUT_ID = "express-available-needles";

/** Express builder — return here to adjust size, ease, or gauge without clearing saved answers. */
export const EXPRESS_BUILDER_ADJUST_HREF = "/patterns/sleeveless-express/";

/** Default when the knitter has not entered a needle count. */
export const EXPRESS_DEFAULT_AVAILABLE_NEEDLES = "150";

/** True when the knitter entered a positive needle count (Express gauge step). */
export function isValidExpressAvailableNeedles(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0;
}

/**
 * Resolved needle count for Express storage (string, digits only when from presets/default).
 * Prefers live input, then prior `yarnGaugeMachine`, then {@link EXPRESS_DEFAULT_AVAILABLE_NEEDLES}.
 */
export function resolveExpressAvailableNeedles(
  prevYarnGaugeMachine: Record<string, unknown> | undefined,
  inputValue?: string,
): string {
  const fromInput = (inputValue ?? "").trim();
  if (fromInput) return fromInput;

  const raw = prevYarnGaugeMachine?.availableNeedles;
  if (raw != null && String(raw).trim() !== "") {
    return String(raw).trim();
  }

  return EXPRESS_DEFAULT_AVAILABLE_NEEDLES;
}

/** Needle count stored on the Express wizard snapshot (resume). */
export function resolveExpressAvailableNeedlesForResume(
  persistedNeedles: string | undefined,
  prevYarnGaugeMachine: Record<string, unknown> | undefined,
): string {
  const fromSession = (persistedNeedles ?? "").trim();
  if (fromSession) return fromSession;
  return resolveExpressAvailableNeedles(prevYarnGaugeMachine);
}

export type ExpressNeedleValidation = {
  ok: boolean;
  requiredNeedles: number;
  availableNeedles: number;
};

export type ExpressNeedleValidationSources = {
  yarnGaugeMachine?: Record<string, unknown> | null;
  mergedMachine?: Record<string, unknown> | null;
  generatorYarnGaugeMachine?: Record<string, unknown> | null;
  expressSessionNeedles?: string | undefined;
};

export type ExpressBuilderSessionSnapshot = {
  values: Record<string, string>;
  availableNeedles?: string;
  gaugeStitchRaw?: string;
  gaugeRowRaw?: string;
  flowSteps?: number;
  whoSizeCombined?: boolean;
};

export type ExpressNeedleResolvedAvailable = {
  value: number;
  source: string;
};

export type ExpressNeedleResolvedRequired = {
  value: number;
  source: string;
};

export type ExpressNeedleFailSafeActivation = {
  active: boolean;
  reason: string;
};

export type ExpressNeedleFailSafeResult = {
  ran: boolean;
  active: boolean;
  skipReason?: string;
  activeReason?: string;
  availableNeedles: number;
  availableSource: string;
  requiredNeedles: number;
  requiredSource: string;
  validation: ExpressNeedleValidation;
  /** When true, caller must not render pattern instructions. */
  shouldBlockRender: boolean;
};

function sectionRecord(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return obj as Record<string, unknown>;
  }
  return {};
}

function finitePositive(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Full Express wizard snapshot from `kbm_sleeveless_express_builder`. */
export function readExpressBuilderSessionSnapshot(): ExpressBuilderSessionSnapshot | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const rec = parsed as Record<string, unknown>;
    const valuesRaw = rec.values;
    const values =
      valuesRaw && typeof valuesRaw === "object" && !Array.isArray(valuesRaw)
        ? { ...(valuesRaw as Record<string, string>) }
        : {};
    return {
      values,
      availableNeedles:
        rec.availableNeedles != null ? String(rec.availableNeedles).trim() || undefined : undefined,
      gaugeStitchRaw:
        typeof rec.gaugeStitchRaw === "string" ? rec.gaugeStitchRaw : undefined,
      gaugeRowRaw: typeof rec.gaugeRowRaw === "string" ? rec.gaugeRowRaw : undefined,
      flowSteps: typeof rec.flowSteps === "number" ? rec.flowSteps : undefined,
      whoSizeCombined: rec.whoSizeCombined === true,
    };
  } catch {
    return null;
  }
}

/** Available needles from Express wizard localStorage snapshot (survives review navigation). */
export function readExpressSessionAvailableNeedles(): string | undefined {
  return readExpressBuilderSessionSnapshot()?.availableNeedles;
}

/** Browser hint that the knitter arrived from Express builder or unified review. */
export function hasExpressReviewFlowRouteHint(pageUrl?: URL): boolean {
  let url = pageUrl ?? null;
  if (!url && typeof window !== "undefined") {
    try {
      url = new URL(window.location.href);
    } catch {
      url = null;
    }
  }
  if (url?.searchParams.get("express") === "1") return true;

  if (typeof document !== "undefined") {
    const ref = document.referrer ?? "";
    if (
      ref.includes("/patterns/sleeveless-express") ||
      ref.includes("/patterns/sleeveless/review")
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Fail-safe activation — does not rely on `patternMode` alone.
 * Skips pure Custom Build projects without Express handoff signals.
 */
export function resolveExpressNeedleFailSafeActivation(input: {
  canonicalStyle: Record<string, unknown>;
  patternBuilderStyle: Record<string, unknown>;
  session?: ExpressBuilderSessionSnapshot | null;
  expressRouteHint?: boolean;
}): ExpressNeedleFailSafeActivation {
  const mode = resolveGeneratorPatternMode(input.canonicalStyle, input.patternBuilderStyle);
  const session = input.session ?? null;
  const expressRouteHint = input.expressRouteHint === true;

  const sessionNeedles = session?.availableNeedles?.trim();
  const sessionWho = session?.values?.who?.trim();
  const sessionGauge =
    Boolean(session?.gaugeStitchRaw?.trim()) || Boolean(session?.gaugeRowRaw?.trim());
  const expressWizardSession =
    session?.flowSteps === 5 ||
    session?.whoSizeCombined === true ||
    Boolean(sessionNeedles) ||
    Boolean(sessionWho && sessionGauge);

  const expressHandoff =
    mode === "express" ||
    expressRouteHint ||
    expressWizardSession ||
    Boolean(sessionWho && session?.values?.selectedSize?.trim());

  if (!expressHandoff) {
    if (mode === "custom-build") {
      return { active: false, reason: "custom-build without express handoff signals" };
    }
    return { active: false, reason: "no express handoff signals" };
  }

  if (mode === "custom-build") {
    return {
      active: true,
      reason: "express handoff (session/route) with overwritten custom-build patternMode",
    };
  }
  if (mode === "express") {
    return { active: true, reason: "patternMode express" };
  }
  if (expressRouteHint) {
    return { active: true, reason: "express/review route hint" };
  }
  if (sessionNeedles) {
    return { active: true, reason: "express session availableNeedles" };
  }
  return { active: true, reason: "express wizard session snapshot" };
}

/** @deprecated Prefer {@link resolveExpressNeedleFailSafeActivation}. */
export function isExpressNeedleValidationActive(
  canonicalStyle: Record<string, unknown>,
  patternBuilderStyle: Record<string, unknown>,
): boolean {
  return resolveExpressNeedleFailSafeActivation({
    canonicalStyle,
    patternBuilderStyle,
    session: readExpressBuilderSessionSnapshot(),
    expressRouteHint: hasExpressReviewFlowRouteHint(),
  }).active;
}

/** Prefer Express session needle entry over stale yarnGaugeMachine defaults (e.g. 200). */
export function resolveExpressAvailableNeedlesForValidationWithSource(
  sources: ExpressNeedleValidationSources,
): ExpressNeedleResolvedAvailable {
  const candidates: Array<[unknown, string]> = [
    [sources.expressSessionNeedles, "express-session"],
    [sources.yarnGaugeMachine?.availableNeedles, "patternBuilderData.yarnGaugeMachine"],
    [sources.generatorYarnGaugeMachine?.availableNeedles, "generator.yarnGaugeMachine"],
    [sources.mergedMachine?.availableNeedles, "merged.machine"],
  ];
  for (const [raw, source] of candidates) {
    const n = finitePositive(raw);
    if (n !== undefined) return { value: n, source };
  }
  return { value: 0, source: "none" };
}

/** Resolve stored available needles from every Express persistence location. */
export function resolveExpressAvailableNeedlesForValidation(
  sources: ExpressNeedleValidationSources,
): number {
  return resolveExpressAvailableNeedlesForValidationWithSource(sources).value;
}

const CAST_ON_RE = /Cast on (\d+) stitches/i;
const STITCHES_PHRASE_RE = /(\d+) stitches/i;
const NEEDLES_PHRASE_RE = /(\d+) needles/i;

function stitchCountsFromDisplayRowsWithSource(
  rows: readonly SleevelessPatternDisplayRow[],
  label: string,
): Array<{ value: number; source: string }> {
  const out: Array<{ value: number; source: string }> = [];
  for (const row of rows) {
    if (row.kind !== "block") continue;
    const n = finitePositive(row.stitchCount);
    if (n !== undefined) {
      out.push({ value: n, source: `${label}.stitchCount` });
    }
    const textParts = [...(row.paragraphs ?? []), ...(row.trustedParagraphs ?? [])];
    if (row.tipHtml) textParts.push(row.tipHtml);
    for (const p of textParts) {
      for (const re of [CAST_ON_RE, STITCHES_PHRASE_RE, NEEDLES_PHRASE_RE]) {
        const m = p.match(re);
        if (m) {
          const parsed = finitePositive(m[1]);
          if (parsed !== undefined) {
            const kind =
              re === CAST_ON_RE ? "castOnText" : re === NEEDLES_PHRASE_RE ? "needlesText" : "stitchesText";
            out.push({ value: parsed, source: `${label}.${kind}` });
          }
        }
      }
    }
  }
  return out;
}

/** Widest stitch count from generated output about to render (debug + row counts + visible text). */
export function resolveExpressRequiredNeedlesFromPatternWithSource(
  result: Pick<SleevelessBackPatternResult, "debug" | "displayRows" | "frontDisplayRows">,
): ExpressNeedleResolvedRequired {
  const d = result.debug;
  const candidates: Array<{ value: number; source: string }> = [];

  const debugFields: Array<[unknown, string]> = [
    [d.hemCastOnStitches, "debug.hemCastOnStitches"],
    [d.bustBodyStitches, "debug.bustBodyStitches"],
    [d.backStitches, "debug.backStitches"],
    [d.cardiganHalfLeftCastOnSts, "debug.cardiganHalfLeftCastOnSts"],
    [d.cardiganHalfLeftBustBodySts, "debug.cardiganHalfLeftBustBodySts"],
  ];
  for (const [raw, source] of debugFields) {
    const n = finitePositive(raw);
    if (n !== undefined) candidates.push({ value: n, source });
  }

  candidates.push(...stitchCountsFromDisplayRowsWithSource(result.displayRows ?? [], "displayRows"));
  candidates.push(
    ...stitchCountsFromDisplayRowsWithSource(result.frontDisplayRows ?? [], "frontDisplayRows"),
  );

  if (candidates.length === 0) return { value: 0, source: "none" };
  const widest = candidates.reduce((max, c) => (c.value > max.value ? c : max));
  return { value: widest.value, source: widest.source };
}

export function resolveExpressRequiredNeedlesFromPattern(
  result: Pick<SleevelessBackPatternResult, "debug" | "displayRows" | "frontDisplayRows">,
): number {
  return resolveExpressRequiredNeedlesFromPatternWithSource(result).value;
}

export function validateExpressPatternNeedlesFromSources(
  sources: ExpressNeedleValidationSources,
  result: Pick<SleevelessBackPatternResult, "debug" | "displayRows" | "frontDisplayRows">,
): ExpressNeedleValidation {
  const availableNeedles = resolveExpressAvailableNeedlesForValidation(sources);
  const requiredNeedles = resolveExpressRequiredNeedlesFromPattern(result);
  return {
    ok:
      availableNeedles > 0 &&
      requiredNeedles > 0 &&
      requiredNeedles <= availableNeedles,
    requiredNeedles,
    availableNeedles,
  };
}

/** Hard stop when {@link resolveExpressRequiredNeedlesFromPattern} exceeds stored available needles. */
export function validateExpressPatternNeedles(
  availableNeedlesRaw: unknown,
  result: Pick<SleevelessBackPatternResult, "debug" | "displayRows" | "frontDisplayRows">,
): ExpressNeedleValidation {
  return validateExpressPatternNeedlesFromSources(
    { yarnGaugeMachine: { availableNeedles: availableNeedlesRaw } },
    result,
  );
}

/** Collect validation inputs from merged pattern storage (pattern tab / review handoff). */
export function expressNeedleValidationSourcesFromPatternStorage(
  patternData: Record<string, unknown>,
  patternMerged: Record<string, unknown>,
  generatorPatternData?: Record<string, unknown>,
  session?: ExpressBuilderSessionSnapshot | null,
): ExpressNeedleValidationSources {
  const snap = session ?? readExpressBuilderSessionSnapshot();
  return {
    yarnGaugeMachine: sectionRecord(patternData.yarnGaugeMachine),
    mergedMachine: sectionRecord(patternMerged.machine),
    generatorYarnGaugeMachine: sectionRecord(generatorPatternData?.yarnGaugeMachine),
    expressSessionNeedles: snap?.availableNeedles ?? readExpressSessionAvailableNeedles(),
  };
}

/**
 * Final fail-safe immediately before pattern instructions render.
 * Call from the pattern tab right before {@link renderMount} (and at the top of renderMount).
 */
export function evaluateExpressNeedleFailSafeBeforeRender(
  result: Pick<SleevelessBackPatternResult, "debug" | "displayRows" | "frontDisplayRows">,
  input: {
    patternData: Record<string, unknown>;
    patternMerged: Record<string, unknown>;
    canonicalStyle: Record<string, unknown>;
    generatorPatternData?: Record<string, unknown>;
    expressRouteHint?: boolean;
    session?: ExpressBuilderSessionSnapshot | null;
  },
): ExpressNeedleFailSafeResult {
  const session = input.session ?? readExpressBuilderSessionSnapshot();
  const pbStyle = sectionRecord(input.patternData.style);
  const activation = resolveExpressNeedleFailSafeActivation({
    canonicalStyle: input.canonicalStyle,
    patternBuilderStyle: pbStyle,
    session,
    expressRouteHint: input.expressRouteHint ?? hasExpressReviewFlowRouteHint(),
  });

  if (!activation.active) {
    return {
      ran: false,
      active: false,
      skipReason: activation.reason,
      availableNeedles: 0,
      availableSource: "none",
      requiredNeedles: 0,
      requiredSource: "none",
      validation: { ok: true, requiredNeedles: 0, availableNeedles: 0 },
      shouldBlockRender: false,
    };
  }

  const sources = expressNeedleValidationSourcesFromPatternStorage(
    input.patternData,
    input.patternMerged,
    input.generatorPatternData,
    session,
  );
  const available = resolveExpressAvailableNeedlesForValidationWithSource(sources);
  const required = resolveExpressRequiredNeedlesFromPatternWithSource(result);
  const validation: ExpressNeedleValidation = {
    availableNeedles: available.value,
    requiredNeedles: required.value,
    ok:
      available.value > 0 &&
      required.value > 0 &&
      required.value <= available.value,
  };

  const insufficientNeedlesData = available.value <= 0;
  const shouldBlockRender =
    !insufficientNeedlesData &&
    required.value > 0 &&
    required.value > available.value;

  return {
    ran: true,
    active: true,
    activeReason: activation.reason,
    skipReason: insufficientNeedlesData ? "express handoff active but availableNeedles missing" : undefined,
    availableNeedles: available.value,
    availableSource: available.source,
    requiredNeedles: required.value,
    requiredSource: required.source,
    validation,
    shouldBlockRender,
  };
}

/** Hard-stop card when Express pattern exceeds available needle count. */
export function buildExpressNeedleHardStopHtml(validation: ExpressNeedleValidation): string {
  const { requiredNeedles, availableNeedles } = validation;
  return `<section class="express-needle-hard-stop" role="alert">
  <h2 class="express-needle-hard-stop__title">This pattern is too wide for your machine</h2>
  <p class="express-needle-hard-stop__body">
    This pattern requires <strong>${requiredNeedles}</strong> needles at the widest point.
    You entered <strong>${availableNeedles}</strong> available needles.
  </p>
  <p class="express-needle-hard-stop__lead">Try one of these adjustments:</p>
  <ul class="express-needle-hard-stop__list">
    <li>Choose a smaller size</li>
    <li>Reduce ease</li>
    <li>Use a larger gauge</li>
    <li>Choose a different sweater style</li>
  </ul>
  <p class="express-needle-hard-stop__actions">
    <a href="${EXPRESS_BUILDER_ADJUST_HREF}" class="kbm-btn kbm-btn-accent express-needle-hard-stop__btn">Go Back and Adjust</a>
  </p>
</section>`;
}
