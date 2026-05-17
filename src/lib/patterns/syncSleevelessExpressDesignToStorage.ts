/**
 * Maps Express / Custom Build design basics (who, selectedSize, neckline, fit, optional chart measurements)
 * into canonical sleeveless pattern storage. Shared by Express and Custom Build design step.
 */
import { normalizeSleevelessAudience, saveCurrentPattern, savePatternData } from "./patternStorage";
import { seedCustomBuildBodyFinishedFromChartRow } from "./sleevelessCustomBuildBodyMeasurements";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";

export function expressWhoToChartAudience(whoRaw: unknown): string {
  const s = String(whoRaw ?? "").trim().toLowerCase();
  if (s === "women" || s === "woman") return "misses";
  if (s === "men" || s === "man" || s === "male") return "men";
  if (s === "kids" || s === "kid") return "kids";
  if (s === "baby") return "baby";
  const n = normalizeSleevelessAudience(whoRaw);
  return n || "misses";
}

/** Express UI uses `round` | `v-neck` (any casing); canonical pattern uses `round` | `v`. */
export function mapExpressNecklineToStorage(n: string): "round" | "v" {
  const s = String(n ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!s) return "round";
  if (s === "v" || s === "v-neck" || s === "vneck" || s === "v_neck" || s === "v neck") return "v";
  if (/\bv[\s_-]?neck\b/.test(s)) return "v";
  return "round";
}

/**
 * Merges who / neckline / fit into `kbm_current_pattern` and `patternBuilderData`
 * (same paths as {@link syncExpressSelectionsToBuilderStorage} on the Express page).
 */
export function syncSleevelessDesignBasicsToPatternStorage(
  params: Partial<{
    who: string;
    neckline: string;
    fit: string;
    selectedSize: string;
    selectedMeasurements: Record<string, number>;
    /** When set (e.g. Express cardigan), preserves open front instead of forcing pullover. */
    frontStyle?: "open" | "closed";
    garmentStyle?: "pullover" | "cardigan";
    patternMode?: string;
    /** Sweater chart row for Custom Build body/finished measurement layer (optional). */
    chartRow?: ChartRow;
    /** When false, re-seed finished bust/waist/hip from chart on each sync. Default true. */
    preserveCustomBuildFinished?: boolean;
  }>,
): void {
  const stylePayload: Record<string, unknown> = {};
  const fitPayload: Record<string, unknown> = {};

  if (params.who) {
    const aud = expressWhoToChartAudience(params.who);
    stylePayload.recipientCategory = aud;
    fitPayload.sizingChart = aud;
  }
  if (params.neckline) {
    stylePayload.neckline = mapExpressNecklineToStorage(params.neckline);
  }
  if (params.fit) {
    fitPayload.easeChoice = params.fit;
    fitPayload.fitChoice = params.fit;
  }
  if (typeof params.selectedSize === "string" && params.selectedSize.trim() !== "") {
    fitPayload.selectedSize = params.selectedSize.trim();
  }
  if (
    params.selectedMeasurements &&
    typeof params.selectedMeasurements === "object" &&
    !Array.isArray(params.selectedMeasurements) &&
    Object.keys(params.selectedMeasurements).length > 0
  ) {
    fitPayload.selectedMeasurements = params.selectedMeasurements;
  }

  const explicitFront = params.frontStyle === "open" || params.frontStyle === "closed";
  const explicitGarment = params.garmentStyle === "cardigan" || params.garmentStyle === "pullover";

  if (params.who || params.neckline || explicitFront || explicitGarment || params.patternMode) {
    stylePayload.bodyShape = "straight";
    stylePayload.length = "top";
    stylePayload.armholeStyle = "standard";

    let front: "open" | "closed" = "closed";
    if (params.frontStyle === "open" || params.frontStyle === "closed") {
      front = params.frontStyle;
    } else if (params.garmentStyle === "cardigan") {
      front = "open";
    } else if (params.garmentStyle === "pullover") {
      front = "closed";
    }
    stylePayload.frontStyle = front;

    let garment: "pullover" | "cardigan" = front === "open" ? "cardigan" : "pullover";
    if (params.garmentStyle === "cardigan" || params.garmentStyle === "pullover") {
      garment = params.garmentStyle;
    }
    stylePayload.garmentStyle = garment;

    if (typeof params.patternMode === "string" && params.patternMode.trim() !== "") {
      stylePayload.patternMode = params.patternMode.trim();
    }
  }

  const hasStyle = Object.keys(stylePayload).length > 0;
  const hasFit = Object.keys(fitPayload).length > 0;
  if (!hasStyle && !hasFit) return;

  saveCurrentPattern({
    ...(hasStyle ? { style: stylePayload } : {}),
    ...(hasFit ? { fit: fitPayload } : {}),
    machine: {},
  });

  if (hasStyle) savePatternData("style", stylePayload);
  if (hasFit) savePatternData("fit", fitPayload);

  const fitPref =
    params.fit === "close" || params.fit === "standard" || params.fit === "relaxed"
      ? params.fit
      : "standard";
  if (params.chartRow && params.fit) {
    seedCustomBuildBodyFinishedFromChartRow(params.chartRow, fitPref, {
      preserveFinished: params.preserveCustomBuildFinished !== false,
    });
  }
}
