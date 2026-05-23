import type { SleevelessPatternValidationMessage } from "./sleevelessPatternValidation";

export const PATTERN_VALIDATION_ERROR_HEADING =
  "Please fix the following before generating your pattern";

export const PATTERN_VALIDATION_WARNING_HEADING =
  "Please double-check the following measurements";

/** Compact headings for the custom-build diagram overlay only. */
export const CB_VALIDATION_OVERLAY_ERROR_HEADING = "Fix these measurements";
export const CB_VALIDATION_OVERLAY_WARNING_HEADING = "Double-check";

/** Short labels for diagram overlay; full `message` is used when id is unknown. */
const CB_VALIDATION_OVERLAY_LABELS: Record<string, string> = {
  "neck-depth-exceeds-armhole-depth": "Neck depth > armhole depth",
  "shoulder-width-less-than-neck-opening": "Shoulder width < neck opening",
  "neck-opening-exceeds-shoulder-width": "Neck opening > shoulder width",
  "shoulder-width-exceeds-bust": "Shoulder width > finished bust",
  "finished-length-too-short": "Length too short for armhole + hem",
  "hem-depth-too-deep": "Hem too deep for finished length",
  "armhole-depth-out-of-range": "Armhole depth looks unusual",
  "shoulder-width-unusually-narrow": "Shoulder width looks narrow",
  "shoulder-width-unusually-wide": "Shoulder width looks wide",
  "neck-opening-unusually-wide": "Neck opening looks wide",
  "neck-depth-unusually-deep": "Neck depth looks deep",
  "hem-depth-zero": "No hem band",
};

export function cbMeasureValidationOverlayLabel(
  item: SleevelessPatternValidationMessage,
): string {
  return CB_VALIDATION_OVERLAY_LABELS[item.id] ?? item.message;
}

export type CbMeasureValidationOverlayOptions = {
  /** When true, warning overlay is hidden until the next measurement edit. */
  warningsDismissed?: boolean;
  onDismissWarnings?: () => void;
};

export const PATTERN_VALIDATION_BLOCKED_HELPER =
  "Pattern generation is disabled until measurement errors are resolved.";

export const CB_MEASURE_CONTINUE_LABEL_DEFAULT = "Save & Continue →";
export const CB_MEASURE_CONTINUE_LABEL_ERRORS = "Fix Errors to Continue";

export function splitPatternValidationMessages(
  messages: SleevelessPatternValidationMessage[],
): {
  errors: SleevelessPatternValidationMessage[];
  warnings: SleevelessPatternValidationMessage[];
} {
  const errors: SleevelessPatternValidationMessage[] = [];
  const warnings: SleevelessPatternValidationMessage[] = [];
  for (const message of messages) {
    if (message.severity === "error") errors.push(message);
    else warnings.push(message);
  }
  return { errors, warnings };
}

function createValidationBlock(
  severity: "error" | "warning",
  heading: string,
  items: SleevelessPatternValidationMessage[],
): HTMLElement {
  const block = document.createElement("section");
  block.className = `pattern-validation pattern-validation--${severity}`;
  if (severity === "error") block.setAttribute("role", "alert");

  const title = document.createElement("h2");
  title.className = "pattern-validation__title";
  title.textContent = heading;

  const list = document.createElement("ul");
  list.className = "pattern-validation__list";
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item.message;
    list.appendChild(li);
  }

  block.append(title, list);
  return block;
}

/** Renders error and warning blocks into `host`; hides host when there are no messages. */
export function renderPatternValidationUi(
  host: HTMLElement,
  messages: SleevelessPatternValidationMessage[],
): { errors: SleevelessPatternValidationMessage[]; warnings: SleevelessPatternValidationMessage[] } {
  const { errors, warnings } = splitPatternValidationMessages(messages);
  host.replaceChildren();

  if (errors.length === 0 && warnings.length === 0) {
    host.hidden = true;
    return { errors, warnings };
  }

  host.hidden = false;
  if (errors.length > 0) {
    host.appendChild(createValidationBlock("error", PATTERN_VALIDATION_ERROR_HEADING, errors));
  }
  if (warnings.length > 0) {
    host.appendChild(createValidationBlock("warning", PATTERN_VALIDATION_WARNING_HEADING, warnings));
  }
  return { errors, warnings };
}

function appendCbValidationOverlayList(
  list: HTMLUListElement,
  items: SleevelessPatternValidationMessage[],
): void {
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = cbMeasureValidationOverlayLabel(item);
    list.appendChild(li);
  }
}

/**
 * Compact overlay on the measurement diagram (custom-build fit step).
 * Errors take priority; warnings are hidden until errors are resolved.
 */
export function renderCbMeasureValidationOverlay(
  host: HTMLElement,
  messages: SleevelessPatternValidationMessage[],
  options: CbMeasureValidationOverlayOptions = {},
): { errors: SleevelessPatternValidationMessage[]; warnings: SleevelessPatternValidationMessage[] } {
  const { errors, warnings } = splitPatternValidationMessages(messages);
  host.replaceChildren();
  host.classList.remove("cb-validation-overlay--error", "cb-validation-overlay--warning");
  host.removeAttribute("role");

  if (errors.length > 0) {
    host.hidden = false;
    host.classList.add("cb-validation-overlay--error");
    host.setAttribute("role", "alert");

    const title = document.createElement("p");
    title.className = "cb-validation-overlay__title";
    title.textContent = CB_VALIDATION_OVERLAY_ERROR_HEADING;

    const list = document.createElement("ul");
    list.className = "cb-validation-overlay__list";
    appendCbValidationOverlayList(list, errors);
    host.append(title, list);
    return { errors, warnings };
  }

  if (warnings.length > 0 && !options.warningsDismissed) {
    host.hidden = false;
    host.classList.add("cb-validation-overlay--warning");

    const header = document.createElement("div");
    header.className = "cb-validation-overlay__header";

    const title = document.createElement("p");
    title.className = "cb-validation-overlay__title";
    title.textContent = CB_VALIDATION_OVERLAY_WARNING_HEADING;

    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "cb-validation-overlay__dismiss";
    dismiss.setAttribute("aria-label", "Dismiss warning");
    dismiss.textContent = "×";
    dismiss.addEventListener("click", () => options.onDismissWarnings?.());

    header.append(title, dismiss);

    const list = document.createElement("ul");
    list.className = "cb-validation-overlay__list";
    appendCbValidationOverlayList(list, warnings);
    host.append(header, list);
    return { errors, warnings };
  }

  host.hidden = true;
  return { errors, warnings };
}

export function setCbMeasureContinueButton(
  button: HTMLButtonElement | null,
  hasErrors: boolean,
  defaultLabel: string = CB_MEASURE_CONTINUE_LABEL_DEFAULT,
): void {
  if (!button) return;

  button.disabled = hasErrors;
  if (hasErrors) {
    button.setAttribute("aria-disabled", "true");
    button.textContent = CB_MEASURE_CONTINUE_LABEL_ERRORS;
  } else {
    button.removeAttribute("aria-disabled");
    button.textContent = defaultLabel;
  }
  button.classList.toggle("is-disabled", hasErrors);
}

export function setPatternGenerateButtonBlocked(
  button: HTMLButtonElement | HTMLAnchorElement | null,
  helper: HTMLElement | null,
  blocked: boolean,
): void {
  if (helper) {
    helper.hidden = !blocked;
    if (blocked) helper.textContent = PATTERN_VALIDATION_BLOCKED_HELPER;
  }

  if (!button) return;

  if (button instanceof HTMLButtonElement) {
    button.disabled = blocked;
    if (blocked) button.setAttribute("aria-disabled", "true");
    else button.removeAttribute("aria-disabled");
    button.classList.toggle("is-disabled", blocked);
    return;
  }

  button.classList.toggle("is-disabled", blocked);
  if (blocked) {
    button.setAttribute("aria-disabled", "true");
    button.setAttribute("tabindex", "-1");
  } else {
    button.removeAttribute("aria-disabled");
    button.removeAttribute("tabindex");
  }
}
