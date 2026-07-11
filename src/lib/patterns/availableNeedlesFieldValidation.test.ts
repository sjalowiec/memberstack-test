import { describe, expect, it, vi } from "vitest";
import {
  AVAILABLE_NEEDLES_REQUIRED_MESSAGE,
} from "./sleevelessExpressAvailableNeedles";
import {
  clearAvailableNeedlesFieldErrorIfValid,
  reportAvailableNeedlesFieldValidationFailure,
  setAvailableNeedlesFieldErrorState,
  validateAvailableNeedlesFieldValue,
} from "./availableNeedlesFieldValidation";

type MockInput = {
  value: string;
  classList: { add: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn>; toggle: ReturnType<typeof vi.fn> };
  setAttribute: ReturnType<typeof vi.fn>;
  removeAttribute: ReturnType<typeof vi.fn>;
  scrollIntoView: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
};

function makeMockInput(value = ""): MockInput {
  const classes = new Set<string>();
  return {
    value,
    classList: {
      add: vi.fn((c: string) => classes.add(c)),
      remove: vi.fn((c: string) => classes.delete(c)),
      toggle: vi.fn((c: string, on?: boolean) => {
        const next = on ?? !classes.has(c);
        if (next) classes.add(c);
        else classes.delete(c);
      }),
    },
    setAttribute: vi.fn(),
    removeAttribute: vi.fn(),
    scrollIntoView: vi.fn(),
    focus: vi.fn(),
  };
}

describe("validateAvailableNeedlesFieldValue", () => {
  it("uses the shared required message for empty and invalid values", () => {
    expect(validateAvailableNeedlesFieldValue("")).toEqual({
      valid: false,
      message: AVAILABLE_NEEDLES_REQUIRED_MESSAGE,
    });
    expect(validateAvailableNeedlesFieldValue("0")).toEqual({
      valid: false,
      message: AVAILABLE_NEEDLES_REQUIRED_MESSAGE,
    });
    expect(validateAvailableNeedlesFieldValue("12.5")).toEqual({
      valid: false,
      message: AVAILABLE_NEEDLES_REQUIRED_MESSAGE,
    });
  });

  it("accepts a positive whole number and clears the message", () => {
    expect(validateAvailableNeedlesFieldValue("200")).toEqual({
      valid: true,
      message: "",
    });
  });
});

describe("availableNeedles field DOM helpers", () => {
  it("marks the input invalid and focuses it when submission fails", () => {
    const input = makeMockInput("");
    const beforeFocus = vi.fn();

    const result = reportAvailableNeedlesFieldValidationFailure(
      input as unknown as HTMLInputElement,
      { onBeforeFocus: beforeFocus },
    );

    expect(result.valid).toBe(false);
    expect(result.message).toBe(AVAILABLE_NEEDLES_REQUIRED_MESSAGE);
    expect(beforeFocus).toHaveBeenCalledOnce();
    expect(input.classList.toggle).toHaveBeenCalledWith("error", true);
    expect(input.setAttribute).toHaveBeenCalledWith("aria-invalid", "true");
    expect(input.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(input.focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("clears the error state when the value becomes valid", () => {
    const input = makeMockInput("180");
    setAvailableNeedlesFieldErrorState(input as unknown as HTMLInputElement, true);
    clearAvailableNeedlesFieldErrorIfValid(input as unknown as HTMLInputElement);
    expect(input.classList.toggle).toHaveBeenCalledWith("error", false);
    expect(input.removeAttribute).toHaveBeenCalledWith("aria-invalid");
  });

  it("preserves an invalid value while reporting failure", () => {
    const input = makeMockInput("abc");
    reportAvailableNeedlesFieldValidationFailure(input as unknown as HTMLInputElement);
    expect(input.value).toBe("abc");
  });
});
