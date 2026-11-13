/**
 * Triangle Scarf builder. Three express steps, then Summary/Edit.
 */
import { readTriangleScarfDraft } from "../lib/patterns/triangleScarf/triangleScarfDraft";
import { startFreshTriangleScarfPattern } from "../lib/patterns/triangleScarf/triangleScarfSavedProject";
import {
  triangleScarfFieldsFromDraft,
  triangleScarfFirstIncompleteStep,
  triangleScarfFormError,
  triangleScarfGaugeComplete,
  triangleScarfNeedlesComplete,
  triangleScarfSizeComplete,
  triangleScarfStepComplete,
  type TriangleScarfFormFields,
} from "../lib/patterns/triangleScarf/triangleScarfForm";
import {
  TRIANGLE_SCARF_SUMMARY_FROM_BUILDER_HREF,
  isTriangleScarfNewSession,
} from "../lib/patterns/triangleScarf/triangleScarfNavigation";
import {
  applyTriangleScarfFields,
  bindTriangleScarfFieldChrome,
  clearTriangleScarfFields,
  fieldsFromSearchParams,
  readTriangleScarfFormFields,
  saveTriangleScarfFormDraft,
  showTriangleScarfFormError,
  triangleScarfDepthInput,
  triangleScarfLengthInput,
} from "./triangle-scarf-form.ts";

const STEPS = 3;
let openStep = 1;
let lastIncomplete: 1 | 2 | 3 | null = 1;

function stepSection(step: number): HTMLElement | null {
  const el = document.querySelector(`[data-express-step="${step}"]`);
  return el instanceof HTMLElement ? el : null;
}

function summaryForStep(step: number, fields: TriangleScarfFormFields): string {
  const mark = fields.unit === "cm" ? "cm" : "in";
  if (step === 1 && triangleScarfSizeComplete(fields)) {
    return `${fields.length} ${mark} × ${fields.depth} ${mark}`;
  }
  if (step === 2 && triangleScarfNeedlesComplete(fields)) {
    return `${fields.needles} needles`;
  }
  if (step === 3 && triangleScarfGaugeComplete(fields)) {
    return `${fields.stitchGauge} sts / ${fields.rowGauge} rows`;
  }
  return "";
}

function refreshAccordion(): void {
  const fields = readTriangleScarfFormFields();
  const incomplete = triangleScarfFirstIncompleteStep(fields);
  const maxReachable = incomplete ?? STEPS;
  if (openStep > maxReachable) openStep = maxReachable;

  for (let step = 1; step <= STEPS; step += 1) {
    const sectionEl = stepSection(step);
    if (!sectionEl) continue;
    const complete = triangleScarfStepComplete(step as 1 | 2 | 3, fields);
    const locked = step > maxReachable;
    const open = step === openStep && !locked;
    sectionEl.classList.toggle("express-acc--open", open);
    sectionEl.classList.toggle("express-acc--locked", locked);
    sectionEl.classList.toggle("express-acc--complete", complete);
    const header = sectionEl.querySelector("[data-express-header]");
    const body = sectionEl.querySelector(".express-acc__body");
    const lockedFeedback = sectionEl.querySelector("[data-express-locked-feedback]");
    if (header instanceof HTMLElement) {
      header.setAttribute("aria-expanded", open ? "true" : "false");
      header.tabIndex = locked ? -1 : 0;
    }
    if (body instanceof HTMLElement) body.hidden = !open;
    if (lockedFeedback instanceof HTMLElement) lockedFeedback.hidden = !locked;
    const summaryKey = step === 1 ? "size" : step === 2 ? "needles" : "gauge";
    const summary = sectionEl.querySelector(`[data-express-summary="${summaryKey}"]`);
    if (summary) summary.textContent = complete ? summaryForStep(step, fields) : "";
    const cta = sectionEl.querySelector(".express-generate-wrap");
    if (cta instanceof HTMLElement) cta.hidden = !open;
  }

  document.querySelectorAll<HTMLButtonElement>("[data-pill-step]").forEach((btn) => {
    const step = Number(btn.dataset.pillStep || "0");
    const current = step === openStep;
    const locked = step > maxReachable;
    const complete = step >= 1 && step <= 3 && triangleScarfStepComplete(step as 1 | 2 | 3, fields);
    btn.classList.toggle("is-current", current);
    btn.classList.toggle("is-upcoming", locked);
    btn.classList.toggle("is-complete", complete && !current);
    const item = btn.closest(".express-step-nav__item");
    item?.classList.toggle("active", current);
    if (current) btn.setAttribute("aria-current", "page");
    else btn.removeAttribute("aria-current");
    if (locked) btn.setAttribute("aria-disabled", "true");
    else btn.removeAttribute("aria-disabled");
  });

  const createBtn = document.getElementById("create-pattern-btn");
  if (createBtn instanceof HTMLButtonElement) {
    const ready = incomplete == null;
    createBtn.classList.toggle("button-disabled", !ready);
    if (ready) createBtn.removeAttribute("aria-disabled");
    else createBtn.setAttribute("aria-disabled", "true");
  }
}

function openBuilderStep(step: number): void {
  const fields = readTriangleScarfFormFields();
  const incomplete = triangleScarfFirstIncompleteStep(fields);
  const maxReachable = incomplete ?? STEPS;
  if (step < 1 || step > maxReachable) {
    const locked = stepSection(step)?.querySelector("[data-express-locked-feedback]");
    if (locked instanceof HTMLElement) locked.hidden = false;
    return;
  }
  openStep = step;
  refreshAccordion();
}

function formHasState(): boolean {
  const fields = readTriangleScarfFormFields();
  return Boolean(
    fields.length.trim() ||
      fields.depth.trim() ||
      fields.stitchGauge.trim() ||
      fields.rowGauge.trim() ||
      fields.needles.trim(),
  );
}

function hydrate(): void {
  const startingFresh = isTriangleScarfNewSession(window.location.search);
  if (startingFresh) {
    startFreshTriangleScarfPattern();
    const url = new URL(window.location.href);
    url.searchParams.delete("new");
    const qs = url.searchParams.toString();
    window.history.replaceState({}, "", `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`);
  }
  const fromUrl = fieldsFromSearchParams(window.location.search);
  if (fromUrl) {
    applyTriangleScarfFields({
      length: "",
      depth: "",
      stitchGauge: "",
      rowGauge: "",
      needles: "",
      unit: "in",
      ...fromUrl,
    });
  } else if (!startingFresh) {
    const draft = readTriangleScarfDraft();
    if (draft) applyTriangleScarfFields(triangleScarfFieldsFromDraft(draft));
  } else {
    clearTriangleScarfFields();
  }
  const incomplete = triangleScarfFirstIncompleteStep(readTriangleScarfFormFields());
  openStep = incomplete ?? STEPS;
  lastIncomplete = incomplete;
  refreshAccordion();
}

function reviewPattern(): void {
  const fields = readTriangleScarfFormFields();
  const incomplete = triangleScarfFirstIncompleteStep(fields);
  if (incomplete) {
    openStep = incomplete;
    refreshAccordion();
    showTriangleScarfFormError(triangleScarfFormError(fields) ?? "");
    stepSection(incomplete)?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const message = triangleScarfFormError(fields);
  if (message) {
    showTriangleScarfFormError(message);
    return;
  }
  showTriangleScarfFormError("");
  saveTriangleScarfFormDraft();
  window.location.assign(TRIANGLE_SCARF_SUMMARY_FROM_BUILDER_HREF);
}

function bind(): void {
  bindTriangleScarfFieldChrome(() => {
    showTriangleScarfFormError("");
    const incomplete = triangleScarfFirstIncompleteStep(readTriangleScarfFormFields());
    if (lastIncomplete && incomplete !== lastIncomplete && openStep === lastIncomplete && incomplete) {
      openStep = incomplete;
    }
    lastIncomplete = incomplete;
    refreshAccordion();
  });
  document.querySelectorAll("[data-express-header]").forEach((header) => {
    const openFromHeader = () => {
      const section = header.closest("[data-express-step]");
      const step = Number(section?.getAttribute("data-express-step") || "0");
      if (step) openBuilderStep(step);
    };
    header.addEventListener("click", openFromHeader);
    header.addEventListener("keydown", (event) => {
      if (!(event instanceof KeyboardEvent)) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openFromHeader();
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-pill-step]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const step = Number(btn.dataset.pillStep || "0");
      if (step) openBuilderStep(step);
    });
  });
  document.getElementById("create-pattern-btn")?.addEventListener("click", reviewPattern);
  document.getElementById("triangle-scarf-start-over")?.addEventListener("click", () => {
    if (formHasState()) {
      const ok = window.confirm("Discard your measurements and start over?");
      if (!ok) return;
    }
    startFreshTriangleScarfPattern();
    clearTriangleScarfFields();
    showTriangleScarfFormError("");
    openStep = 1;
    refreshAccordion();
    triangleScarfLengthInput()?.focus();
  });
}

function start(): void {
  if (!document.querySelector("[data-triangle-scarf-builder]")) return;
  bind();
  const run = () => window.setTimeout(hydrate, 0);
  if (document.readyState === "complete") run();
  else document.addEventListener("DOMContentLoaded", run);
}

start();
