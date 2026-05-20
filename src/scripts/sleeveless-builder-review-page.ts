/**
 * Unified Sleeveless review (`/patterns/sleeveless/review`).
 * Gates read-only vs editable summary (measurements, title, notes) via `canCustomizePattern`.
 */
import { canCustomizePattern } from "../lib/patterns/sleevelessPatternAccessGate";
import { initSleevelessLockedBannerDismiss } from "./sleevelessLockedBannerDismiss";
import { initExpressYarnDrawer } from "./sleeveless-express-measurements-page";
import { initCustomBuildMeasurementsPage } from "./sleeveless-custom-build-measurements-page";
import {
  mapExpressStyleKey,
  syncSleevelessDesignBasicsToPatternStorage,
} from "../lib/patterns/syncSleevelessExpressDesignToStorage";
import {
  expressWhoToChartAudience,
  loadExpressSweaterCharts,
  resolveExpressChartFit,
} from "../lib/patterns/sleevelessExpressSizeChartClient";
import { getPatternData, SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY } from "../lib/patterns/patternStorage";

const PATTERN_WORKSPACE_TAB_PATTERN_HREF = "/patterns/sleeveless/pattern/?tab=pattern";

function readExpressValues(): Record<string, string> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object" || Array.isArray(p)) return {};
    const v = (p as Record<string, unknown>).values;
    if (v && typeof v === "object" && !Array.isArray(v)) return { ...(v as Record<string, string>) };
  } catch {
    /* ignore */
  }
  return {};
}

function syncExpressBasicsFromBuilderAndContinue(): void {
  const ls = readExpressValues();
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

  const lsFront = String(ls.front ?? "").trim().toLowerCase();
  const pbGarment = String(style?.garmentStyle ?? "").trim().toLowerCase() === "cardigan";
  const pbOpen = String(style?.frontStyle ?? "").trim().toLowerCase() === "open";
  const styleKey = String(ls.style ?? "").trim().toLowerCase();
  const garmentStyle: "pullover" | "cardigan" =
    pbGarment || pbOpen || lsFront === "open" || styleKey.includes("cardigan")
      ? "cardigan"
      : "pullover";

  const expressStyleKey = String(ls.style ?? styleKey ?? "").trim();
  const expressStyle = mapExpressStyleKey(expressStyleKey);
  const aud = expressWhoToChartAudience(who);
  const chartFit =
    who && selectedSize
      ? resolveExpressChartFit(aud, selectedSize, fitEase || "standard", {
          bodyShape: expressStyle.bodyShape,
        })
      : null;

  if (chartFit) {
    syncSleevelessDesignBasicsToPatternStorage({
      who,
      neckline: neckline === "v-neck" ? "v-neck" : "round",
      fit: fitEase || "standard",
      selectedSize: chartFit.selectedSize,
      selectedMeasurements: chartFit.selectedMeasurements,
      frontStyle: garmentStyle === "cardigan" ? "open" : "closed",
      garmentStyle,
      bodyShape: expressStyle.bodyShape,
      patternMode: "express",
    });
  }

  window.location.assign(PATTERN_WORKSPACE_TAB_PATTERN_HREF);
}

function configureReviewActions(advanced: boolean): void {
  const cbContinue = document.querySelector("[data-cb-measure-continue]");
  const unitsHost = document.querySelector("[data-express-measurements-units-host]");

  cbContinue?.removeAttribute("hidden");
  if (advanced) {
    unitsHost?.setAttribute("hidden", "");
  } else {
    unitsHost?.removeAttribute("hidden");
  }
}

function continueToPatternFromReview(): void {
  void loadExpressSweaterCharts()
    .then(() => {
      // Customizable review already persisted overrides + syncCustomBuildToPatternStorage.
      if (canCustomizePattern()) {
        window.location.assign(PATTERN_WORKSPACE_TAB_PATTERN_HREF);
        return;
      }
      syncExpressBasicsFromBuilderAndContinue();
    })
    .catch(() => {
      window.alert("Could not load size charts. Check your connection and try again.");
    });
}

function initUnifiedSleevelessReviewPage(): void {
  initSleevelessLockedBannerDismiss();
  const advanced = canCustomizePattern();
  configureReviewActions(advanced);
  initExpressYarnDrawer();

  if (advanced) {
    initCustomBuildMeasurementsPage({
      continueHref: PATTERN_WORKSPACE_TAB_PATTERN_HREF,
      onContinue: continueToPatternFromReview,
      preserveUnitsHost: true,
    });
    return;
  }

  initCustomBuildMeasurementsPage({
    readOnly: true,
    preserveUnitsHost: true,
    onContinue: continueToPatternFromReview,
  });
}

if (typeof document !== "undefined") {
  const boot = (): void => initUnifiedSleevelessReviewPage();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}
