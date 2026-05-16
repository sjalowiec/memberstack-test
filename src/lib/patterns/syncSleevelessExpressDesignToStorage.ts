/**
 * Maps Express / Custom Build design basics (who, selectedSize, neckline, fit, optional chart measurements)
 * into canonical sleeveless pattern storage. Shared by Express and Custom Build design step.
 */
import { normalizeSleevelessAudience, saveCurrentPattern, savePatternData } from "./patternStorage";

export function expressWhoToChartAudience(whoRaw: unknown): string {
  const s = String(whoRaw ?? "").trim().toLowerCase();
  if (s === "women" || s === "woman") return "misses";
  if (s === "men" || s === "man" || s === "male") return "men";
  if (s === "kids" || s === "kid") return "kids";
  if (s === "baby") return "baby";
  const n = normalizeSleevelessAudience(whoRaw);
  return n || "misses";
}

/** Express UI uses `round` | `v-neck`; canonical pattern uses `round` | `v`. */
export function mapExpressNecklineToStorage(n: string): "round" | "v" {
  return n === "v-neck" ? "v" : "round";
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
    /** When set (e.g. Express dev cardigan), preserves open front instead of forcing pullover. */
    frontStyle?: "open" | "closed";
    garmentStyle?: "pullover" | "cardigan";
    patternMode?: string;
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
}
