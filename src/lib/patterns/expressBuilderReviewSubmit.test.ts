import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AVAILABLE_NEEDLES_REQUIRED_MESSAGE,
  EXPRESS_AVAILABLE_NEEDLES_INPUT_ID,
} from "./sleevelessExpressAvailableNeedles";
import {
  evaluateExpressGaugeFormSubmit,
  EXPRESS_GAUGE_FORM_ID,
  EXPRESS_GAUGE_ROW_INPUT_ID,
  EXPRESS_GAUGE_STITCH_INPUT_ID,
  EXPRESS_GENERATE_BUTTON_ID,
  isExpressReviewCtaReady,
  wireExpressBuilderReviewSubmit,
} from "./expressBuilderReviewSubmit";

type El = {
  tag: string;
  id?: string;
  type?: string;
  value?: string;
  disabled?: boolean;
  attributes: Record<string, string>;
  children: El[];
  parent: El | null;
  listeners: Map<string, Array<(ev: Event) => void>>;
  scrollIntoView: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
  setAttribute: (name: string, value: string) => void;
  removeAttribute: (name: string) => void;
  getAttribute: (name: string) => string | null;
  classList: { toggle: ReturnType<typeof vi.fn> };
  addEventListener: (type: string, handler: (ev: Event) => void) => void;
  removeEventListener: (type: string, handler: (ev: Event) => void) => void;
};

function makeEl(tag: string, init: Partial<El> = {}): El {
  const el: El = {
    tag,
    attributes: {},
    children: [],
    parent: null,
    listeners: new Map(),
    scrollIntoView: vi.fn(),
    focus: vi.fn(),
    classList: { toggle: vi.fn() },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    removeAttribute(name) {
      delete this.attributes[name];
    },
    getAttribute(name) {
      return this.attributes[name] ?? null;
    },
    addEventListener(type, handler) {
      const list = this.listeners.get(type) ?? [];
      list.push(handler);
      this.listeners.set(type, list);
    },
    removeEventListener(type, handler) {
      const list = this.listeners.get(type) ?? [];
      this.listeners.set(
        type,
        list.filter((fn) => fn !== handler),
      );
    },
    ...init,
  };
  return el;
}

function mountBuilderDom(): { doc: Document; needles: El; button: El; openGauge: ReturnType<typeof vi.fn> } {
  const openGauge = vi.fn();
  const needles = makeEl("input", {
    id: EXPRESS_AVAILABLE_NEEDLES_INPUT_ID,
    type: "number",
    value: "",
  });
  const stitch = makeEl("input", {
    id: EXPRESS_GAUGE_STITCH_INPUT_ID,
    type: "number",
    value: "28",
  });
  const row = makeEl("input", {
    id: EXPRESS_GAUGE_ROW_INPUT_ID,
    type: "number",
    value: "44",
  });
  const errorText = makeEl("span", { id: "express-available-needles-error" });
  const floating = makeEl("div", { children: [needles, errorText] });
  needles.parent = floating;
  errorText.parent = floating;

  const form = makeEl("form", { id: EXPRESS_GAUGE_FORM_ID, children: [stitch, row, floating] });
  stitch.parent = form;
  row.parent = form;
  floating.parent = form;

  const button = makeEl("button", {
    id: EXPRESS_GENERATE_BUTTON_ID,
    type: "submit",
    disabled: false,
  });
  button.setAttribute("form", EXPRESS_GAUGE_FORM_ID);

  const byId = new Map<string, El>([
    [EXPRESS_GAUGE_FORM_ID, form],
    [EXPRESS_GAUGE_STITCH_INPUT_ID, stitch],
    [EXPRESS_GAUGE_ROW_INPUT_ID, row],
    [EXPRESS_AVAILABLE_NEEDLES_INPUT_ID, needles],
    [EXPRESS_GENERATE_BUTTON_ID, button],
    ["express-available-needles-error", errorText],
  ]);

  const doc = {
    getElementById: (id: string) => byId.get(id) ?? null,
  } as unknown as Document;

  vi.stubGlobal("window", {
    requestAnimationFrame: (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    },
  });

  return { doc, needles, button, openGauge };
}

describe("isExpressReviewCtaReady", () => {
  it("shows the CTA when stitch/row gauge is ready even if needles are still empty", () => {
    expect(isExpressReviewCtaReady(true, true)).toBe(true);
    expect(isExpressReviewCtaReady(true, false)).toBe(false);
  });
});

describe("evaluateExpressGaugeFormSubmit", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("blocks navigation, opens gauge, and marks needles invalid when empty", () => {
    const { doc, needles, openGauge } = mountBuilderDom();
    const outcome = evaluateExpressGaugeFormSubmit(doc, {
      openGaugeStepForValidation: openGauge,
    });

    expect(outcome).toEqual({ proceed: false, reason: "invalid-needles" });
    expect(openGauge).toHaveBeenCalledOnce();
    expect(needles.classList.toggle).toHaveBeenCalledWith("error", true);
    expect(needles.getAttribute("aria-invalid")).toBe("true");
    expect(needles.focus).toHaveBeenCalled();
  });

  it("allows navigation when needles are a valid positive whole number", () => {
    const { doc, needles, openGauge } = mountBuilderDom();
    needles.value = "200";
    const outcome = evaluateExpressGaugeFormSubmit(doc, {
      openGaugeStepForValidation: openGauge,
    });
    expect(outcome).toEqual({ proceed: true });
    expect(openGauge).not.toHaveBeenCalled();
  });
});

describe("wireExpressBuilderReviewSubmit", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("invokes validation when the live form submit event fires", () => {
    const { doc, needles, openGauge } = mountBuilderDom();
    const onProceed = vi.fn();

    wireExpressBuilderReviewSubmit({
      documentRoot: doc,
      openGaugeStepForValidation: openGauge,
      onProceed,
    });

    const form = doc.getElementById(EXPRESS_GAUGE_FORM_ID) as unknown as El;
    const submitHandler = form.listeners.get("submit")?.[0];
    expect(submitHandler).toBeTypeOf("function");

    submitHandler?.({ preventDefault: vi.fn() } as unknown as Event);

    expect(onProceed).not.toHaveBeenCalled();
    expect(openGauge).toHaveBeenCalledOnce();
    expect(needles.classList.toggle).toHaveBeenCalledWith("error", true);
    expect(needles.getAttribute("aria-invalid")).toBe("true");
  });

  it("uses the same validation path when the button is disabled and clicked", () => {
    const { doc, needles, button, openGauge } = mountBuilderDom();
    button.disabled = true;

    wireExpressBuilderReviewSubmit({
      documentRoot: doc,
      openGaugeStepForValidation: openGauge,
      onProceed: vi.fn(),
    });

    const clickHandler = button.listeners.get("click")?.[0];
    expect(clickHandler).toBeTypeOf("function");
    clickHandler?.({ preventDefault: vi.fn() } as unknown as Event);

    expect(openGauge).toHaveBeenCalledOnce();
    expect(needles.classList.toggle).toHaveBeenCalledWith("error", true);
  });

  it("proceeds through the wired handler when needles are valid", () => {
    const { doc, needles, openGauge } = mountBuilderDom();
    needles.value = "180";
    const onProceed = vi.fn();

    wireExpressBuilderReviewSubmit({
      documentRoot: doc,
      openGaugeStepForValidation: openGauge,
      onProceed,
    });

    const form = doc.getElementById(EXPRESS_GAUGE_FORM_ID) as unknown as El;
    form.listeners.get("submit")?.[0]?.({ preventDefault: vi.fn() } as unknown as Event);

    expect(onProceed).toHaveBeenCalledOnce();
    expect(openGauge).not.toHaveBeenCalled();
  });
});

describe("builder needles copy parity", () => {
  it("uses the shared required message in the submit evaluation path", () => {
    expect(AVAILABLE_NEEDLES_REQUIRED_MESSAGE).toBe(
      "Enter the number of working needles available on your machine.",
    );
  });
});
