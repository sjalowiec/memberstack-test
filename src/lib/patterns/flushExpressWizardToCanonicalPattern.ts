/**
 * Push Express / unified builder wizard snapshot (incl. gauge and needles) into canonical
 * pattern storage before pattern generation or cloud save.
 *
 * Shared by the review page and the dedicated pattern workspace builder handoff.
 */
import { mapExpressStyleKey } from "./syncSleevelessExpressDesignToStorage";
import {
  expressWhoToChartAudience,
  resolveExpressChartFit,
} from "./sleevelessExpressSizeChartClient";
import { getCurrentPattern, getPatternData, SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY } from "./patternStorage";
import { resolveSleevelessGarmentKind } from "./resolveSleevelessGarmentKind";
import { readCustomBuildWizardGarmentType } from "./sleevelessCustomBuildWizardNeckline";
import {
  readExpressWizardValues,
  syncExpressWizardToPatternStorage,
} from "./syncExpressWizardToPatternStorage";

function readExpressValuesFromBuilderStorage(): Record<string, string> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    if (!raw) return readExpressWizardValues();
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object" || Array.isArray(p)) return readExpressWizardValues();
    const v = (p as Record<string, unknown>).values;
    if (v && typeof v === "object" && !Array.isArray(v)) return { ...(v as Record<string, string>) };
  } catch {
    /* ignore */
  }
  return readExpressWizardValues();
}

export function flushExpressWizardToCanonicalPattern(): void {
  const ls = readExpressValuesFromBuilderStorage();
  const pb = getPatternData();
  const fit = pb.fit as Record<string, unknown> | undefined;
  const style = pb.style as Record<string, unknown> | undefined;

  const who = ls.who?.trim() || "";
  const selectedSize =
    ls.selectedSize?.trim() || String(fit?.selectedSize ?? "").trim();
  const fitEase =
    ls.fit?.trim() || String(fit?.easeChoice ?? fit?.fitChoice ?? "standard").trim();

  let neckline = ls.neckline?.trim() ?? "";
  if (!neckline) {
    const canon = String(style?.neckline ?? "").trim().toLowerCase();
    if (canon === "v") neckline = "v-neck";
    else if (canon === "round") neckline = "round";
  }

  resolveSleevelessGarmentKind({
    wizardGarmentType: readCustomBuildWizardGarmentType(),
    canonicalStyle: (getCurrentPattern().style ?? {}) as Record<string, unknown>,
    patternBuilderStyle: (style ?? {}) as Record<string, unknown>,
    expressValues: ls,
  });

  const expressStyleKey = String(ls.style ?? "").trim();
  const expressStyle = mapExpressStyleKey(expressStyleKey);
  const aud = expressWhoToChartAudience(who);
  const chartFit =
    who && selectedSize
      ? resolveExpressChartFit(aud, selectedSize, fitEase || "standard", {
          bodyShape: expressStyle.bodyShape,
        })
      : null;

  syncExpressWizardToPatternStorage(ls, chartFit, { preferDomGauge: false });
}

/** @deprecated Import {@link flushExpressWizardToCanonicalPattern} instead. */
export const flushExpressWizardToCanonicalPatternForReview = flushExpressWizardToCanonicalPattern;
