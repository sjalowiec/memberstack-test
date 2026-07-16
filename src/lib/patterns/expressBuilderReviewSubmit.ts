import {
  EXPRESS_AVAILABLE_NEEDLES_INPUT_ID,
} from "./sleevelessExpressAvailableNeedles";
import {
  setAvailableNeedlesFieldErrorState,
  validateAvailableNeedlesFieldValue,
} from "./availableNeedlesFieldValidation";

export const EXPRESS_GAUGE_FORM_ID = "express-gauge-form";
export const EXPRESS_GENERATE_BUTTON_ID = "express-generate";
export const EXPRESS_GENERATE_WRAP_ID = "express-generate-wrap";
export const EXPRESS_GAUGE_STITCH_INPUT_ID = "express-stitch-gauge";
export const EXPRESS_GAUGE_ROW_INPUT_ID = "express-row-gauge";
export const EXPRESS_NEEDLE_BLOCK_SELECTOR = ".express-needle-block";

export type ExpressReviewSubmitOutcome =
  | { proceed: true }
  | { proceed: false; reason: "missing-gauge-inputs" | "invalid-stitch" | "invalid-row" | "invalid-needles" };

export type ExpressReviewSubmitHooks = {
  openGaugeStepForValidation: () => void;
  /** Called after the gauge accordion is opened; use to focus the field once visible. */
  afterGaugeStepOpened?: () => void;
};

/** True when the builder markup includes the available-needles field. */
export function expressBuilderRequiresNeedles(doc: Document): boolean {
  return doc.getElementById(EXPRESS_AVAILABLE_NEEDLES_INPUT_ID) != null;
}

/** Gauge accordion step is complete: stitch/row gauge plus needles when the field is present. */
export function computeExpressGaugeStepComplete(
  stitchRowGaugeOk: boolean,
  needlesOk: boolean,
  doc: Document,
): boolean {
  if (!stitchRowGaugeOk) return false;
  if (!expressBuilderRequiresNeedles(doc)) return true;
  return needlesOk;
}

/**
 * Review CTA is ready when wizard choices and stitch/row gauge are complete.
 * Available needles are validated on submit (not a CTA gate) so knitters get
 * the inline required-field message instead of a silent disabled button.
 */
export function isExpressReviewCtaReady(
  wizardStepsComplete: boolean,
  stitchRowGaugeOk: boolean,
): boolean {
  return wizardStepsComplete && stitchRowGaugeOk;
}

/** Reveal the needles block once stitch/row gauge is entered; hide it until then. */
export function syncExpressNeedleBlockVisibility(doc: Document, stitchRowGaugeOk: boolean): void {
  const block = doc.querySelector(EXPRESS_NEEDLE_BLOCK_SELECTOR);
  if (
    !block ||
    typeof (block as Element).setAttribute !== "function" ||
    typeof (block as Element).removeAttribute !== "function"
  ) {
    return;
  }
  if (stitchRowGaugeOk) block.removeAttribute("hidden");
  else block.setAttribute("hidden", "");
}

function isValidPositiveNumber(value: string): boolean {
  const n = parseFloat(value.trim());
  return !Number.isNaN(n) && n > 0 && Number.isFinite(n);
}

function asTextInput(el: Element | null | undefined): HTMLInputElement | null {
  if (!el || typeof (el as HTMLInputElement).value !== "string") return null;
  return el as HTMLInputElement;
}

function gaugeInput(
  doc: Document,
  id: string,
): HTMLInputElement | null {
  return asTextInput(doc.getElementById(id));
}

/**
 * Validate gauge + needles on View/Review Pattern submit.
 * Opens the gauge accordion and surfaces the needles error when that is the blocker.
 */
export function evaluateExpressGaugeFormSubmit(
  doc: Document,
  hooks: ExpressReviewSubmitHooks,
): ExpressReviewSubmitOutcome {
  const stEl = gaugeInput(doc, EXPRESS_GAUGE_STITCH_INPUT_ID);
  const rwEl = gaugeInput(doc, EXPRESS_GAUGE_ROW_INPUT_ID);
  if (!stEl || !rwEl) return { proceed: false, reason: "missing-gauge-inputs" };

  const stitchValid = isValidPositiveNumber(stEl.value);
  const rowValid = isValidPositiveNumber(rwEl.value);
  const requiresNeedles = expressBuilderRequiresNeedles(doc);
  const needlesInput = asTextInput(doc.getElementById(EXPRESS_AVAILABLE_NEEDLES_INPUT_ID));
  const needlesResult = requiresNeedles
    ? validateAvailableNeedlesFieldValue(needlesInput?.value ?? "")
    : { valid: true, message: "" };

  if (!stitchValid || !rowValid || !needlesResult.valid) {
    syncExpressNeedleBlockVisibility(doc, stitchValid && rowValid);
    hooks.openGaugeStepForValidation();

    if (requiresNeedles && !needlesResult.valid) {
      setAvailableNeedlesFieldErrorState(needlesInput, true);
      const focusNeedles = (): void => {
        if (!needlesInput) return;
        needlesInput.scrollIntoView({ behavior: "smooth", block: "center" });
        needlesInput.focus({ preventScroll: true });
      };
      if (hooks.afterGaugeStepOpened) hooks.afterGaugeStepOpened();
      else if (typeof window !== "undefined") window.requestAnimationFrame(focusNeedles);
      else focusNeedles();
    } else if (!stitchValid) {
      if (typeof window !== "undefined") window.requestAnimationFrame(() => stEl.focus());
      else stEl.focus();
    } else if (!rowValid) {
      if (typeof window !== "undefined") window.requestAnimationFrame(() => rwEl.focus());
      else rwEl.focus();
    }

    if (requiresNeedles && !needlesResult.valid) return { proceed: false, reason: "invalid-needles" };
    if (!stitchValid) return { proceed: false, reason: "invalid-stitch" };
    return { proceed: false, reason: "invalid-row" };
  }

  return { proceed: true };
}

export type WireExpressBuilderReviewSubmitOptions = {
  documentRoot?: Document;
  openGaugeStepForValidation: () => void;
  onProceed: () => void;
};

/**
 * Attach the live View/Review Pattern submit + click wiring used by both Sleeveless and Drop Shoulder builders.
 */
export function wireExpressBuilderReviewSubmit(options: WireExpressBuilderReviewSubmitOptions): () => void {
  const doc = options.documentRoot ?? document;
  const form = doc.getElementById(EXPRESS_GAUGE_FORM_ID);
  const button = doc.getElementById(EXPRESS_GENERATE_BUTTON_ID);

  const hooks: ExpressReviewSubmitHooks = {
    openGaugeStepForValidation: options.openGaugeStepForValidation,
    afterGaugeStepOpened: () => {
      if (typeof window === "undefined") return;
      window.requestAnimationFrame(() => {
        const needlesInput = asTextInput(doc.getElementById(EXPRESS_AVAILABLE_NEEDLES_INPUT_ID));
        if (!needlesInput) return;
        needlesInput.scrollIntoView({ behavior: "smooth", block: "center" });
        needlesInput.focus({ preventScroll: true });
      });
    },
  };

  const runValidation = (ev: Event): void => {
    ev.preventDefault();
    const outcome = evaluateExpressGaugeFormSubmit(doc, hooks);
    if (outcome.proceed) options.onProceed();
  };

  form?.addEventListener("submit", runValidation);
  // Disabled buttons do not emit submit; intercept click so knitters still get inline feedback.
  button?.addEventListener("click", (ev) => {
    if (!button || typeof (button as HTMLButtonElement).disabled !== "boolean") return;
    if (!(button as HTMLButtonElement).disabled) return;
    ev.preventDefault();
    evaluateExpressGaugeFormSubmit(doc, hooks);
  });

  return () => {
    form?.removeEventListener("submit", runValidation);
  };
}
