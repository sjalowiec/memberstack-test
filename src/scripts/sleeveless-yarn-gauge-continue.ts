/**
 * Classic Yarn & Gauge page — sync Custom Build state and gate pattern generation on measurement validation.
 */
import { buildSleevelessCustomBuildValidationInput } from "../lib/patterns/sleevelessCustomBuildValidationInput";
import { getCurrentPattern } from "../lib/patterns/patternStorage";
import { validateSleevelessPatternInputs } from "../lib/patterns/sleevelessPatternValidation";
import {
  renderPatternValidationUi,
  setPatternGenerateButtonBlocked,
} from "../lib/patterns/sleevelessPatternValidationUi";
import { prepareCustomBuildPatternGeneration } from "../lib/patterns/prepareCustomBuildPatternGeneration";

function isCustomBuildPatternMode(): boolean {
  const style = getCurrentPattern().style ?? {};
  return style.patternMode === "custom-build";
}

function refreshYarnGaugePatternValidation(): boolean {
  const validationHost = document.querySelector("[data-sg-pattern-validation]");
  const helperEl = document.querySelector("[data-sg-pattern-validation-helper]");
  const generateBtn = document.querySelector("[data-sg-yarn-continue-pattern]");

  if (!(validationHost instanceof HTMLElement)) return true;

  if (!isCustomBuildPatternMode()) {
    validationHost.hidden = true;
    validationHost.replaceChildren();
    setPatternGenerateButtonBlocked(
      generateBtn instanceof HTMLAnchorElement ? generateBtn : null,
      helperEl instanceof HTMLElement ? helperEl : null,
      false,
    );
    return true;
  }

  const messages = validateSleevelessPatternInputs(buildSleevelessCustomBuildValidationInput());
  const { errors } = renderPatternValidationUi(validationHost, messages);
  const blocked = errors.length > 0;
  setPatternGenerateButtonBlocked(
    generateBtn instanceof HTMLAnchorElement ? generateBtn : null,
    helperEl instanceof HTMLElement ? helperEl : null,
    blocked,
  );
  return !blocked;
}

export function wireYarnGaugePatternContinue(): void {
  prepareCustomBuildPatternGeneration({ awaitCharts: false });
  refreshYarnGaugePatternValidation();

  const generateBtn = document.querySelector("[data-sg-yarn-continue-pattern]");
  if (generateBtn instanceof HTMLAnchorElement) {
    generateBtn.addEventListener("click", (event) => {
      prepareCustomBuildPatternGeneration({ awaitCharts: false });
      if (!isCustomBuildPatternMode()) return;
      if (!refreshYarnGaugePatternValidation()) {
        event.preventDefault();
      }
    });
  }

  window.addEventListener("storage", (event) => {
    if (event.key == null || event.key.includes("sleeveless") || event.key.includes("pattern")) {
      refreshYarnGaugePatternValidation();
    }
  });
}

if (typeof document !== "undefined") {
  const boot = (): void => wireYarnGaugePatternContinue();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}
