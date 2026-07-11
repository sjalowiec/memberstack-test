import {
  AVAILABLE_NEEDLES_REQUIRED_MESSAGE,
  EXPRESS_AVAILABLE_NEEDLES_INPUT_ID,
  isValidExpressAvailableNeedles,
} from "./sleevelessExpressAvailableNeedles";

export type AvailableNeedlesFieldValidation = {
  valid: boolean;
  message: string;
};

/** Shared value check + user-facing message for every builder / edit needles field. */
export function validateAvailableNeedlesFieldValue(value: string): AvailableNeedlesFieldValidation {
  const valid = isValidExpressAvailableNeedles(value);
  return {
    valid,
    message: valid ? "" : AVAILABLE_NEEDLES_REQUIRED_MESSAGE,
  };
}

export function setAvailableNeedlesFieldErrorState(
  input: HTMLInputElement | null | undefined,
  showError: boolean,
): void {
  if (!input) return;
  input.classList.toggle("error", showError);
  if (showError) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
}

export function focusAvailableNeedlesField(
  input: HTMLInputElement | null | undefined,
  options?: { scroll?: boolean },
): void {
  if (!input) return;
  if (options?.scroll !== false) {
    input.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  input.focus({ preventScroll: true });
}

export type AvailableNeedlesFieldFailureOptions = {
  scroll?: boolean;
  /** Run before focus (e.g. open the gauge accordion). */
  onBeforeFocus?: () => void;
};

/**
 * Mark the field invalid, optionally reveal its section, scroll it into view, and focus it.
 * Returns the validation result so callers can block navigation / save.
 */
export function reportAvailableNeedlesFieldValidationFailure(
  input: HTMLInputElement | null | undefined,
  options?: AvailableNeedlesFieldFailureOptions,
): AvailableNeedlesFieldValidation {
  const result = validateAvailableNeedlesFieldValue(input?.value ?? "");
  if (!result.valid) {
    setAvailableNeedlesFieldErrorState(input, true);
    options?.onBeforeFocus?.();
    focusAvailableNeedlesField(input, { scroll: options?.scroll });
  }
  return result;
}

export function clearAvailableNeedlesFieldErrorIfValid(
  input: HTMLInputElement | null | undefined,
): void {
  if (!input) return;
  if (isValidExpressAvailableNeedles(input.value)) {
    setAvailableNeedlesFieldErrorState(input, false);
  }
}

/** Clear the inline error as soon as the knitter enters a valid positive whole number. */
export function bindAvailableNeedlesFieldValidation(input: HTMLInputElement | null | undefined): void {
  if (!input) return;
  const handler = () => clearAvailableNeedlesFieldErrorIfValid(input);
  input.addEventListener("input", handler);
  input.addEventListener("change", handler);
}

export function getAvailableNeedlesInputById(
  id: string = EXPRESS_AVAILABLE_NEEDLES_INPUT_ID,
): HTMLInputElement | null {
  if (typeof document === "undefined") return null;
  const el = document.getElementById(id);
  return el instanceof HTMLInputElement ? el : null;
}
